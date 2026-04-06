import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import psycopg

from config import settings
from db import get_dsn
from services.llm import LLMError, complete_chat

router = APIRouter(prefix="/ai", tags=["IA"])


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)
    conversation_id: uuid.UUID | None = None


class ChatOut(BaseModel):
    conversation_id: uuid.UUID
    reply: str
    user_message_id: uuid.UUID
    assistant_message_id: uuid.UUID
    model: str


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    updated_at: datetime


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    model: str | None
    created_at: datetime


def _touch_conversation(cur, cid: uuid.UUID) -> None:
    cur.execute(
        """
        UPDATE ai_conversation
        SET updated_at = now()
        WHERE id = %s
        """,
        (str(cid),),
    )


@router.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn):
    """Envia mensagem à IA, grava pergunta e resposta no PostgreSQL."""
    dsn = get_dsn()
    user_text = body.message.strip()

    try:
        conv_id = body.conversation_id
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                if conv_id is None:
                    title = (user_text[:80] + "…") if len(user_text) > 80 else user_text
                    cur.execute(
                        """
                        INSERT INTO ai_conversation (title)
                        VALUES (%s)
                        RETURNING id
                        """,
                        (title,),
                    )
                    conv_id = cur.fetchone()[0]
                else:
                    cur.execute(
                        "SELECT 1 FROM ai_conversation WHERE id = %s",
                        (str(conv_id),),
                    )
                    if cur.fetchone() is None:
                        raise HTTPException(status_code=404, detail="Conversa não encontrada")

                user_mid = uuid.uuid4()
                cur.execute(
                    """
                    INSERT INTO ai_message (id, conversation_id, role, content, model)
                    VALUES (%s, %s, 'user', %s, NULL)
                    """,
                    (str(user_mid), str(conv_id), user_text),
                )

                cur.execute(
                    """
                    SELECT role, content FROM ai_message
                    WHERE conversation_id = %s
                    ORDER BY created_at ASC
                    LIMIT 40
                    """,
                    (str(conv_id),),
                )
                history_rows = cur.fetchall()

            messages: list[dict[str, str]] = [
                {"role": "system", "content": settings.ai_system_prompt}
            ]
            for role, content in history_rows:
                if role in ("user", "assistant", "system"):
                    messages.append({"role": role, "content": content})

        reply_text, model_used = await complete_chat(messages)

        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                asst_mid = uuid.uuid4()
                cur.execute(
                    """
                    INSERT INTO ai_message (id, conversation_id, role, content, model)
                    VALUES (%s, %s, 'assistant', %s, %s)
                    """,
                    (str(asst_mid), str(conv_id), reply_text, model_used),
                )
                _touch_conversation(cur, conv_id)
            conn.commit()

        return ChatOut(
            conversation_id=conv_id,
            reply=reply_text,
            user_message_id=user_mid,
            assistant_message_id=asst_mid,
            model=model_used,
        )
    except HTTPException:
        raise
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(limit: int = 50):
    limit = max(1, min(limit, 200))
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, updated_at
                FROM ai_conversation
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
    return [
        ConversationOut(id=r[0], title=r[1], updated_at=r[2])
        for r in rows
    ]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def get_messages(conversation_id: uuid.UUID):
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM ai_conversation WHERE id = %s",
                (str(conversation_id),),
            )
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail="Conversa não encontrada")
            cur.execute(
                """
                SELECT id, role, content, model, created_at
                FROM ai_message
                WHERE conversation_id = %s
                ORDER BY created_at ASC
                """,
                (str(conversation_id),),
            )
            rows = cur.fetchall()
    return [
        MessageOut(id=r[0], role=r[1], content=r[2], model=r[3], created_at=r[4])
        for r in rows
    ]
