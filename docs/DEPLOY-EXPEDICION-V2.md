# Deploy — La Expedición Sostenible V2 (FORGE)

Guía operativa para publicar la metodología **V2** (mapa de construcción, ledger Eco, micro-casos, Feria, quiz de madurez).

> Infra general: [DEPLOY-CONTABO-CLOUDFLARE.md](./DEPLOY-CONTABO-CLOUDFLARE.md)  
> Convites e links: [PUBLICAR-EXPEDICION.md](./PUBLICAR-EXPEDICION.md)  
> Smoke test manual: [SMOKE-TEST-EXPEDICION-V2.md](./SMOKE-TEST-EXPEDICION-V2.md)

---

## Requisitos del servidor

| Recurso | Mínimo recomendado |
|---------|-------------------|
| **RAM** | **8 GB** (Contabo VPS M ou similar). Con 4 GB el build de Next.js + Postgres puede quedarse sin memoria. |
| **CPU** | 2 vCPU |
| **Disco** | 40 GB SSD |
| **Node** | 20 LTS |
| **Postgres** | 16 |

Variables obligatorias en producción (`apps/web/.env`):

```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://forge.tudominio.com
NEXTAUTH_SECRET=...
GEMINI_API_KEY=...          # consultoría IA cápsula + coach
# JITSI_BASE_URL=...        # solo modo online (ver abajo)
```

---

## Modos de sesión

Configurar en **FORGE → Curso → Entrega** (`ForgeDeliverySettings`):

| Modo | `sessionFormat` | Vídeo | Uso |
|------|-----------------|-------|-----|
| **Presencial** | `presencial` | No Jitsi | Cada alumno en su móvil + **un peón por equipo** en el tablero compartido |
| **Online** | `online` | Jitsi embebido | Videollamada + misma sala FORGE |

En presencial:
- El ledger y el mapa V2 de equipo viven en `v2Team` (sala `live_team`).
- Los Eco-Créditos **no** se duplican en el peón del tablero (`v2FinancialMode: true`).

---

## Checklist pre-deploy (local)

Desde `apps/web`:

```bash
# 1. Verificar datos V2 (JSON, cápsulas, tests)
npx tsx scripts/verify-expedicion-v2.ts

# 2. Typecheck
npx tsc --noEmit

# 3. Tests V2
npx tsx --test tests/forge/expedicion-v2*.test.ts

# 4. (Opcional) Re-extraer PDFs oficiales si actualizaste los fuentes
#    Requiere EXPEDICION_PDF_DIR apuntando a la carpeta juego/PDF
npx tsx scripts/extract-expedicion-v2-pdfs.ts
```

---

## Deploy en producción

```bash
cd apps/web
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

Health:

```bash
curl -s https://forge.tudominio.com/api/forge/health | jq .
```

Seed del curso (solo una vez por base de datos):

```bash
cd apps/web
# DATABASE_URL = producción
npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts
```

---

## Flujo del facilitador (día D)

### 1. Turma presencial (recomendado V2)

1. Crear **grupo de juego** modo `live_team` (una mesa = una empresa).
2. Configurar curso → **Presencial** (sin vídeo).
3. Entrar a **Salón**: `/hub/forge/cursos/{courseId}/sala?group={playGroupId}`
4. Como facilitador: **Iniciar partida compartida** (tablero + `v2Team`).
5. Cada alumno abre el mismo link `?group=...` en su móvil.
6. **Quiz de madurez inicial** bloquea el tablero hasta completarlo (todos en la mesa).
7. Sincronizar diapositivas PPT (botón Presentación) — slide 8 = **Feria de Negocios**.

### 2. Turma online

1. Configurar curso → **Online** + URL Jitsi (`JITSI_BASE_URL` o Meet por empresa).
2. Mismo flujo de salón; Jitsi flotante visible para alumnos.

### 3. Panel facilitador V2

En la sala, el facilitador ve:
- **Controles V2**: cerrar ciclo, forzar quiz final, reset, export CSV.
- **Panel equipos**: Eco, post-its, micro-caso / Feria pendientes.
- Validar micro-casos (+200 Eco) y pitch Feria (+300 Eco).

Overview API (solo facilitador):

```
GET /api/forge/courses/{courseId}/expedicion-v2/overview
```

---

## URLs clave

| Rol | Ruta |
|-----|------|
| Salón de juego | `/hub/forge/cursos/{id}/sala?group={playGroupId}` |
| Mapa + finanzas (móvil) | `/hub/forge/cursos/{id}/mi-mapa?room={roomId}` |
| Lobby turmas | `/hub/forge/cursos/{id}/turmas` |
| Activación convite | `/hub/forge/activar?token=...` |

---

## Score final (PPT slide 9)

```
Puntuación = (Eco-Créditos × 0,6) + (Puntos de Impacto × 10 × 0,4)
```

Se calcula al completar el **quiz final** (`complete_post_quiz`).

---

## Problemas frecuentes V2

| Síntoma | Solución |
|---------|----------|
| Eco duplicados (tablero + ledger) | Recrear sala; debe tener `v2FinancialMode: true`. Actualizar a última versión del código. |
| Mapa no sincroniza en equipo | Confirmar `?group=` y que el grupo sea `live_team`. Poll cada 3 s en `useExpedicionV2`. |
| Quiz bloquea tablero | Comportamiento esperado hasta `complete_pre_quiz`. |
| Feria no aparece | Facilitador en **slide 8** del PPT; equipo necesita 3+ columnas con post-its. |
| Consultoría IA falla | Revisar `GEMINI_API_KEY` en servidor. |

---

## Checklist rápido

- [ ] VPS 8 GB + Postgres + `NEXTAUTH_URL` correcto
- [ ] `migrate deploy` + `npm run build`
- [ ] Seed Expedición en BD producción
- [ ] Modo presencial u online configurado en el curso
- [ ] Grupo `live_team` creado y link `?group=` probado en 2 móviles
- [ ] Partida compartida iniciada por facilitador
- [ ] Quiz pre → tablero → micro-caso → validación → Feria (slide 8)
- [ ] Export CSV de puntuaciones al cierre
