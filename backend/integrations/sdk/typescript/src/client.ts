export type EtholysClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
};

export class EtholysApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "EtholysApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class EtholysClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: EtholysClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : `HTTP ${response.status}`;
        throw new EtholysApiError(response.status, detail, payload);
      }

      return payload as T;
    } finally {
      clearTimeout(timer);
    }
  }

  getMe(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api-product/me");
  }

  getUsageCurrent(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api-product/usage/current");
  }

  listConversations(limit = 50): Promise<Array<Record<string, unknown>>> {
    return this.request<Array<Record<string, unknown>>>(`/ai/conversations?limit=${limit}`);
  }

  getConversationMessages(conversationId: string): Promise<Array<Record<string, unknown>>> {
    return this.request<Array<Record<string, unknown>>>(`/ai/conversations/${conversationId}/messages`);
  }

  chat(message: string, conversationId?: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { message };
    if (conversationId) {
      body.conversation_id = conversationId;
    }

    return this.request<Record<string, unknown>>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
