# ETHOLYS — Arquitectura de Productos y Soluciones v2.0
**Fábrica de Soluciones | Laboratorio de I+D+i**
**Última actualización: Marzo 2026**

---

## 1. Visión General del Ecosistema

ETHOLYS opera como un holding de propiedad intelectual que diseña, desarrolla y licencia soluciones integradas (software + hardware + metodologías). El ecosistema se compone de **6 sistemas independientes** + **1 capa transversal** + **1 laboratorio interno**.

### Principios Fundamentales

1. **Independencia total**: Cada sistema se vende y funciona por separado. Ninguno es obligatorio.
2. **Integración nativa**: Cuando un cliente contrata más de un sistema, los datos se cruzan sin duplicar información.
3. **Base de datos compartida**: Misma DB con visibilidad por licencia. No APIs entre sistemas — queries directas.
4. **Core incluido**: Toda contratación incluye la capa transversal (SSO, Chat, Docs, i18n).
5. **Multi-sector**: Los sistemas no están limitados a un sector. Sirven para rural, urbano, industrial, servicios.

### Mapa de Sistemas

```
┌─────────────────────────────────────────────────────────────┐
│                    VITRINA ETHOLYS                          │
│              (Laboratorio Virtual / Showcase)                │
├──────────┬──────────┬──────────┬──────────┬────────┬────────┤
│ SISTEMA 1│ SISTEMA 2│ SISTEMA 3│ SISTEMA 4│SIST. 5 │SIST. 6 │
│  ATLAS   │  SIEP    │ FundHub  │ NEXUS    │FORGE   │PRISM   │
│  ERP 360 │Proyectos │ Captac.  │ MIPYMEs  │  EAD   │ BI 360 │
├──────────┴──────────┴──────────┴──────────┴────────┴────────┤
│            CAPA TRANSVERSAL: ETHOLYS CORE                   │
│     (SSO, Chat, Docs, APIs, i18n, Permisos, Notif.)        │
├─────────────────────────────────────────────────────────────┤
│            ETHOLYS LAB (Herramientas internas)              │
│            MUSE | Smart Import | [futuras]                  │
└─────────────────────────────────────────────────────────────┘
```

### Modelo de Licenciamiento por Empresa

```
Company → licensedSystems: ["ATLAS", "SIEP", "FUNDHUB"]
```

El Hub y la UI se arman dinámicamente según los sistemas contratados.

---

## 2. Experiencia Visual: Hub + Navegación Cruzada (Camino 3)

### Concepto
- El **Hub** es el punto de entrada (menú principal con tarjetas de sistemas activos)
- Cada sistema tiene su **propio layout y colores sutilmente distintos**
- Cuando hay integración, aparecen **puentes contextuales** (widgets de datos de otros sistemas)
- El usuario siente que son productos distintos pero que "se hablan"

### Ejemplo: ONG con ATLAS + SIEP + PRISM
1. **Hub**: Ve 3 tarjetas activas + las demás en "contratar"
2. **En SIEP**: Sidebar de proyectos. Widget "Finanzas del proyecto" → datos de ATLAS (si lo tiene contratado). Si no → no aparece o dice "Activa ATLAS para ver finanzas integradas"
3. **En PRISM**: Dashboards cruzando datos de SIEP + ATLAS
4. **Chat**: Aparece siempre, en todos lados (es de Core)

### Puentes Contextuales entre Sistemas
| Desde | Hacia | Puente |
|-------|-------|--------|
| SIEP | ATLAS | Widget de finanzas del proyecto |
| ATLAS | SIEP | Link "Ver proyecto en SIEP" |
| PRISM | Todos | Datos de cualquier sistema contratado |
| FUNDHUB | SIEP | "Proyecto aprobado → Crear en SIEP" |
| NEXUS | ATLAS | Diagnóstico usa datos financieros reales |
| NEXUS | FUNDHUB | Necesita crédito → buscar fondos automáticamente |
| NEXUS | PRISM | Indicadores de progreso de la MIPYME |
| ATLAS | FUNDHUB | Planificación de inversión → buscar fondos |

---

## 3. Los 6 Sistemas — Detalle

---

### SISTEMA 1: ATLAS — ERP 360°
**Sistema de Gestión Institucional y Empresarial**

> ERP puro para administrar la empresa/institución. NO incluye gestión de proyectos de cooperación (eso es SIEP).

**Problema que resuelve**: Las organizaciones gastan fortunas en múltiples herramientas desconectadas para contabilidad, RRHH, facturación, inventario.

#### Módulos

| # | Módulo | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| 1.1 | Gestión Financiera y Contable | DRE, cashflow multimoneda, cuentas por pagar/cobrar | Core | ✅ Construido (finanzas, transacciones, categorías dinámicas, forecast vs ejecución) |
| 1.2 | Facturación y Tesorería | Facturas (receivable/payable/credit/debit notes), PDF, estados | Core | ✅ Construido |
| 1.3 | Recursos Humanos y Nómina | Empleados, contratos, solicitudes de licencia | Core | ✅ Construido (HR, contratos) |
| 1.4 | Compras y Proveedores | Pedidos, evaluación de proveedores (5 criterios), órdenes de compra | Core | ✅ Construido |
| 1.5 | Inventario y Productos | Stock, movimientos, productos, alertas de bajo stock | Core | ✅ Construido |
| 1.6 | Gestión de Clientes | CRM básico, interacciones, historial | Core | ✅ Construido |
| 1.7 | Tareas Internas | Kanban, lista, recurrentes, templates, dependencias, time tracking | Core | ✅ Construido |
| 1.8 | Planificación Empresarial (Técnica) | Cronograma operativo, planificación de actividades de la empresa | Core | 🔲 Por construir |
| 1.9 | Presupuesto y Ejecución Presupuestal | Presupuesto anual/trimestral/mensual, ejecución vs planificado, por área/categoría | Core | 🔲 Por construir |
| 1.10 | Planificación de Inversiones | Planificar inversiones + IA sugiere inversiones según datos. Conexión a FUNDHUB para financiamiento | Core | 🔲 Por construir |
| 1.11 | Calculadora Empresarial | Herramienta de cálculo integrada | Core | ✅ Construido |
| 1.12 | Dashboard Operativo | KPIs consolidados de toda la empresa | Core | ✅ Construido |
| 1.13 | Reportes y Exportación | Reportes PDF, exportación de datos | Core | ✅ Construido |
| 1.14 | Configuración y Roles | Gestión de usuarios, roles personalizados, multi-empresa | Core | ✅ Construido |
| 1.15 | Gobernanza y Compliance | Auditoría, aprobaciones digitales, ESG | Add-on | 🔲 Por construir |
| 1.16 | Gestión Jurídica | Contratos, licencias, PI | Add-on | 🔲 Por construir |
| 1.17 | Gestión de Contenido | Briefings, banco de contenidos, identidad visual | Add-on | 🔲 Por construir |

**Público**: Instituciones, ONGs administrativas, cooperativas, MIPYMEs, universidades.

**Nota sobre redistribución pendiente**: Los módulos de proyectos, portafolio, stakeholders, milestones, riesgos, KPIs de proyecto y miembros de proyecto actualmente están en ATLAS pero deben migrar a SIEP.

---

### SISTEMA 2: SIEP — Sistema Inteligente de Ejecución e Innovación de Proyectos
**Plataforma de Ejecución e Innovación de Proyectos**

> Gestión completa de proyectos de cooperación, innovación y desarrollo. No es un gestor de tareas internas (eso es ATLAS).

**Problema que resuelve**: Las instituciones ejecutoras pierden meses diseñando proyectos, no acceden a bancos de soluciones, y la ejecución se desvía sin alertas.

#### Módulos

| # | Módulo | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| 2.1 | Gestión de Proyectos | Portfolio multi-proyecto, Gantt, Kanban, marco lógico, multi-moneda, multi-país | Core | ⚠️ Construido (vive en ATLAS, pendiente de migrar) |
| 2.2 | Dashboard de Portafolio | KPIs agregados, filtros, visualización de estado | Core | ⚠️ Construido (vive en ATLAS, pendiente de migrar) |
| 2.3 | Stakeholders y Alianzas | Pipeline de alianzas, CRM institucional, interacciones | Core | ⚠️ Construido (vive en ATLAS, pendiente de migrar) |
| 2.4 | Milestones, Objetivos e Indicadores | Seguimiento de hitos, objetivos, entregables, KPIs de proyecto | Core | ⚠️ Construido (vive en ATLAS, pendiente de migrar) |
| 2.5 | Gestión de Riesgos | Registro, clasificación, mitigación | Core | ⚠️ Construido (vive en ATLAS, pendiente de migrar) |
| 2.6 | Miembros de Proyecto y Consultores | Equipo, roles, acceso para consultores externos | Core | ⚠️ Construido parcial (pendiente de migrar) |
| 2.7 | IA Project Designer | Concepción automatizada: IA genera borradores de proyectos | Core | 🔲 Por construir |
| 2.8 | Ejecución y Monitoreo Técnico | Registro de campo, actividades, evidencias, IA detecta desvíos | Core | 🔲 Por construir |
| 2.9 | Banco de Soluciones Tecnológicas | Catálogo de tecnologías probadas con fichas técnicas | Core | 🔲 Por construir |
| 2.10 | Marketplace de Proveedores Técnicos | Conexión con fabricantes, consultores. IA recomienda | Add-on | 🔲 Por construir |
| 2.11 | IA de Apoyo Técnico | Genera textos, reportes, cálculos, diagramas | Core | 🔲 Por construir |
| 2.12 | Relación Donante-Ejecutor | Subgrants, reportes al formato del donante, acceso restringido para donantes | Core | 🔲 Por construir |
| 2.13 | Smart Import (Add-on pago) | Subir documento del donante → IA extrae y pre-llena proyecto | Add-on Premium | 🔲 Por construir |
| 2.14 | Laboratorio Virtual | Co-creación, prototipado digital | Add-on Premium | 🔲 Por construir |
| 2.15 | Gestión de PI | Registro de innovaciones, patentes | Add-on | 🔲 Por construir |
| 2.16 | Integración IoT | Datos de sensores en tiempo real | Add-on Premium | 🔲 Por construir |

**Público**: Instituciones ejecutoras, centros de I+D, incubadoras, cooperativas, multilaterales.

---

### SISTEMA 3: FUNDHUB — Motor Global de Captación de Recursos
**IA para Encontrar, Analizar y Ganar Financiamiento**

> No es solo para proyectos de cooperación — también créditos, inversores de impacto, fondos concursables para MIPYMEs.

**Problema que resuelve**: Las organizaciones pierden millones en oportunidades porque no las encuentran a tiempo, no evalúan elegibilidad, y gastan semanas redactando propuestas.

#### Módulos

| # | Módulo | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| 3.1 | Búsqueda Global Automatizada | Rastreo diario de convocatorias por tema, región, sector, monto | Core | 🔲 Por construir |
| 3.2 | Repositorio de Instituciones y Fondos | Base curada de agencias, fundaciones, bancos de desarrollo | Core | 🔲 Por construir |
| 3.3 | IA de Compatibilidad (Matching) | Cruza perfil institucional con requisitos, ranking de probabilidad | Core | 🔲 Por construir |
| 3.4 | Asistente de Redacción | IA que redacta secciones, adapta lenguaje al formato del donante | Core | 🔲 Por construir |
| 3.5 | Gestión de Postulaciones | Pipeline de postulaciones: estado, plazos, documentos, responsables | Core | 🔲 Por construir |
| 3.6 | Buscador de Aliados | IA sugiere organizaciones complementarias para consorcios | Add-on | 🔲 Por construir |
| 3.7 | Gestión Post-Aprobación | Reportes adaptados al formato de cada donante | Add-on | 🔲 Por construir |
| 3.8 | BI de Tendencias de Financiamiento | Análisis sectorial y geográfico de flujos de fondos | Add-on | 🔲 Por construir |
| 3.9 | API Multilateral | Conexión directa con plataformas (ONU, BID, UE, FAO) | Add-on Premium | 🔲 Por construir |
| 3.10 | Buscador de Crédito para MIPYMEs | Microfinanzas, crédito productivo, fondos concursables | Core | 🔲 Por construir |

**Puentes**: SIEP (proyecto aprobado → crear en SIEP), ATLAS (inversión planificada → buscar fondos), NEXUS (MIPYME necesita crédito → FUNDHUB busca).

**Público**: ONGs, consultoras de fundraising, universidades, agencias de cooperación, MIPYMEs.

---

### SISTEMA 4: NEXUS — Plataforma Inteligente de Desarrollo MIPYMEs
**IA para el Desarrollo Empresarial Sostenible**

> ⚠️ NO limitado a rural/agroindustria. Sirve para MIPYMEs de TODOS los sectores: alimenticio, rural, transporte, servicios, comercio, manufactura, etc.

**Problema que resuelve**: Las MIPYMEs operan a ciegas, no tienen herramientas adaptadas, no acceden a digitalización ni mercados formales.

#### Módulos

| # | Módulo | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| 4.1 | Diagnóstico 360° Inteligente | Evaluación de gestión, producción, marketing, innovación, sostenibilidad | Core | 🔲 Por construir |
| 4.2 | Ruta de Desarrollo Personalizada | Plan automático de acciones según diagnóstico | Core | 🔲 Por construir |
| 4.3 | Plan y Modelo de Negocios | IA construye plan de negocios y Canvas | Core | 🔲 Por construir |
| 4.4 | Mapa de Digitalización | Ruta para digitalizarse: etapas, herramientas, costos | Add-on | 🔲 Por construir |
| 4.5 | Mapa de Modelos Productivos Sostenibles | Ruta de adaptación a producción sostenible | Add-on | 🔲 Por construir |
| 4.6 | Mapa de Industrialización | BPM, HACCP, permisos, seguridad alimentaria | Add-on | 🔲 Por construir |
| 4.7 | ERP Simplificado para MIPYMEs | Finanzas básicas, stock, ventas, proveedores | Core | 🔲 Por construir |
| 4.8 | Marketing Digital Automatizado | IA genera identidad visual, gestión de redes | Add-on | 🔲 Por construir |
| 4.9 | Gestión de Producción Multi-sector | Automatización, gestión de datos, previsibilidad, trazabilidad. Adaptable a: alimenticio, rural, transporte, manufactura, servicios | Core | 🔲 Por construir |
| 4.10 | Trazabilidad Productiva | Seguimiento origen → consumidor final | Add-on Premium | 🔲 Por construir |
| 4.11 | Canastas Inteligentes | Venta de canastas frescas por membresía | Add-on | 🔲 Por construir |
| 4.12 | Billetera Digital | Recibir pagos, captación de recursos | Add-on Premium | 🔲 Por construir |
| 4.13 | Recomendador de Crédito | IA conecta con microfinanzas y fondos (→ FUNDHUB) | Add-on | 🔲 Por construir |
| 4.14 | Asistencia Técnica Híbrida (IA + Humano) | Acompañamiento digital + campo, videollamadas, visitas | Core | 🔲 Por construir |
| 4.15 | Asesoría Empresarial Híbrida | Consultoría donde IA prepara análisis, asesor valida | Core | 🔲 Por construir |
| 4.16 | Inteligencia Productiva | Eficiencia, rendimiento, condiciones, costos, alertas predictivas, IoT | Add-on Premium | 🔲 Por construir |
| 4.17 | Gestión Agrícola/Productiva Integral | Planificación de producción, calendario, insumos, parcelas, riego | Core | 🔲 Por construir |

**Puentes**: ATLAS (datos financieros reales para diagnóstico, ATLAS como solución a problemas de gestión), FUNDHUB (crédito/financiamiento), PRISM (indicadores de progreso).

**Público**: MIPYMEs de TODOS los sectores, cooperativas, programas gubernamentales, ONGs, incubadoras.

---

### SISTEMA 5: FORGE — Ambiente Educacional y de Conexiones
**Plataforma EAD unificada + juegos con IA + gamificación transversal + conexiones**

**Problema que resuelve**: Los emprendedores no acceden a formación de calidad, las plataformas EAD son complejas, no existen espacios digitales de networking adaptados.

> **Especificación técnica (fuente de verdad para implementación):**  
> [`docs/architecture/forge-ead.md`](docs/architecture/forge-ead.md)  
> **Entrada para agentes de IA:** [`AGENTS.md`](AGENTS.md)

#### Principio de arquitectura (v1.0 — mayo 2026)

1. **Una sola espina dorsal**: Programa → Curso → Módulo → **Actividad** (unidad atómica de progreso).
2. **Cursos tradicionales y juegos** son tipos de actividad (`lesson`, `media`, `quiz`, `game`, …), no productos separados.
3. **Juegos**: la IA genera `GameSpec` (JSON validado); **motores fijos** (`board`, `quiz_race`, `cards`, `branching`) ejecutan la dinámica.
4. **Gamificación** es transversal (XP, badges, rankings) — escucha `activity.completed`, no es un silo aparte del LMS.

#### Módulos

| # | Módulo | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| 5.1 | Plataforma EAD unificada | Cursos, trilhas, actividades polimórficas, trilhas híbridas (teoría + jogo) | Core | 🔲 Spec ✅ — ver `forge-ead.md` |
| 5.1b | Motores de juego + GameSpec | Tabuleiro, quiz competitivo, cartas, simulação; gerador IA desde metodología | Core | 🔲 Spec ✅ |
| 5.2 | Gestión Académica | Profesores, alumnos, turmas, matrículas, progreso | Core | 🔲 Por construir |
| 5.3 | Webinars y Lives | Transmisiones, grabaciones, reportes de participación | Core | 🔲 Por construir |
| 5.4 | Rodadas de Negocios Virtuales | Matchmaking, agendas, salas de pitch, reuniones B2B | Add-on | 🔲 Por construir |
| 5.5 | Knowledge Hub | Biblioteca de metodologías, estudios y buenas prácticas | Add-on | 🔲 Por construir |
| 5.6 | Marketplace Educacional | Mentorías, servicios y cursos pagos de terceros | Add-on | 🔲 Por construir |
| 5.7 | Gamificación y Learning Analytics | Regras XP/badges/rankings + painel (camada transversal, não silo) | Core transversal | 🔲 Spec ✅ |
| 5.8 | Integración WhatsApp/Jitsi | Acceso vía WhatsApp, videollamadas integradas | Add-on Premium | 🔲 Por construir |
| 5.9 | Certificación Verificable | Autenticación de certificados (critérios mistos curso+jogo) | Add-on | 🔲 Por construir |

**UI actual (mockup):** `apps/web/app/hub/forge/page.tsx` — **Ledger MVP:** `apps/web/app/api/company-memory/forge-ledger/route.ts`

**Público**: Instituciones, universidades, programas de formación, emprendedores.

---

### SISTEMA 6: PRISM — Panel Ejecutivo y BI Institucional
**Inteligencia de Datos 360° con IA Predictiva**

> No es solo dashboards internos — cruza datos propios + fuentes externas de internet para generar inteligencia real.

**Problema que resuelve**: Los directivos toman decisiones con información fragmentada. Necesitan un sistema que no solo reporte sino que cruce información interna con datos del mercado y genere inteligencia accionable.

#### Módulos

| # | Módulo | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| 6.1 | Dashboards Interactivos | Financieros, operacionales, productivos — en tiempo real | Core | 🔲 Por construir |
| 6.2 | Indicadores ESG y de Impacto | ODS, SDG, GRI — reportes ambientales, sociales, gobernanza | Add-on | 🔲 Por construir |
| 6.3 | Panel de Gobernanza | Auditoría, aprobaciones, trazabilidad de decisiones | Add-on | 🔲 Por construir |
| 6.4 | Análisis Predictivo con IA | Proyecciones, detección de riesgos, oportunidades | Core | 🔲 Por construir |
| 6.5 | Reportes de Impacto Multinivel | Adaptable a donantes, directorios, gobiernos, socios | Core | 🔲 Por construir |
| 6.6 | Simulador de Escenarios | Impacto financiero y productivo ante diferentes decisiones | Add-on Premium | 🔲 Por construir |
| 6.7 | Cruce con Datos Externos | IA busca y cruza datos de internet con datos internos | Core | 🔲 Por construir |

**Público**: Directivos, agencias multilaterales, gobiernos, inversores de impacto.

---

## 4. Capa Transversal: ETHOLYS CORE

No se vende solo; viene incluida en cada sistema. Es lo que permite la integración.

| Componente | Descripción | Estado |
|------------|-------------|--------|
| SSO (Single Sign-On) | Login único para todos los sistemas | ✅ Construido (NextAuth, credentials + Google) |
| Hub | Punto de entrada, muestra sistemas contratados | ✅ Construido |
| Vitrina/Showcase | Página pública de presentación | ✅ Construido |
| Chat y Colaboración | Comunicación en tiempo real, canales, archivos, @menciones | ✅ Construido |
| Gestión Documental | Repositorio centralizado con S3, permisos | ✅ Construido |
| Motor i18n | Bilingüe ES/PT (extensible a EN/FR) | ✅ Construido |
| Motor de Notificaciones | Alertas in-app | ✅ Construido |
| Motor de Permisos | Roles (ADMIN, PM, TECHNICIAN, COLLABORATOR) + roles custom + multi-tenant | ✅ Construido |
| Onboarding | Flujo de creación de empresa | ✅ Construido |
| IA Asistente Técnica | Chatbot contextual dentro de cualquier sistema | 🔲 Por construir |
| APIs Abiertas | Integración con Google, Zoom, sistemas fiscales | 🔲 Por construir |
| Modo Offline + Sync | Funciona sin conexión, sincroniza después | 🔲 Por construir |
| Canal SMS | Interacción vía SMS para zonas sin internet | 🔲 Por construir |

---

## 5. ETHOLYS Lab (Herramientas Internas)

Espacio exclusivo para herramientas internas de la fábrica. No visible en ningún menú público.

| Herramienta | Descripción | Estado |
|-------------|-------------|--------|
| MUSE | Motor Universal de Sugerencias Estratégicas — IA que analiza el ecosistema y propone innovaciones | ✅ Construido (/lab/muse) |
| Smart Import | Importación inteligente de documentos de donantes → proyecto pre-llenado | 🔲 Planificado (add-on pago) |
| Sistema de Invitaciones Lab | Acceso por ADMIN + código de invitación | ✅ Construido |

---

## 6. Resumen de Estado de Construcción

### ✅ Construido y funcionando

**ATLAS (ERP)**:
- Finanzas (DRE, cashflow, transacciones, categorías dinámicas, forecast vs ejecución, multimoneda)
- Facturación (CRUD, PDF, estados, notas de crédito/débito)
- RRHH (empleados, contratos, solicitudes de licencia)
- Proveedores (CRUD, evaluación 5 criterios, órdenes de compra)
- Inventario (productos, stock, movimientos, alertas)
- Clientes (CRM, interacciones)
- Tareas (Kanban, lista, recurrentes, templates, dependencias, time tracking)
- Calculadora
- Dashboard operativo con KPIs
- Reportes y PDF
- Configuración, roles, multi-empresa

**ETHOLYS Core**:
- SSO (credentials + Google)
- Hub con tarjetas de sistemas
- Vitrina pública
- Chat interno (canales, archivos, @menciones, polling)
- Gestión documental (S3)
- i18n (ES/PT)
- Notificaciones in-app
- Permisos y multi-tenant
- Onboarding

**Lab**:
- MUSE (chat IA + sugerencias estratégicas)
- Sistema de invitaciones

**Módulos construidos que deben migrar de ATLAS a SIEP**:
- Gestión de proyectos y portafolio
- Milestones, objetivos, riesgos
- KPIs de proyecto
- Stakeholders y alianzas
- Miembros de proyecto
- Gantt

### 🔲 Por construir

**ATLAS**: Planificación empresarial, presupuesto y ejecución presupuestal, planificación de inversiones, gobernanza, gestión jurídica, gestión de contenido.

**SIEP**: Todos los módulos nuevos (IA Project Designer, ejecución técnica, banco de soluciones, marketplace, relación donante-ejecutor, Smart Import).

**FUNDHUB**: Todo (búsqueda global, matching, redacción, postulaciones, crédito MIPYME).

**NEXUS**: Todo (diagnóstico 360°, rutas, gestión de producción multi-sector, trazabilidad, asistencia técnica).

**FORGE**: Todo (EAD, gestión académica, webinars, rodadas de negocios, knowledge hub).

**PRISM**: Todo (dashboards avanzados, ESG, análisis predictivo, cruce con datos externos, simulador).

**Core**: IA Asistente, APIs abiertas, modo offline, canal SMS.

---

## 7. Decisiones Arquitectónicas Confirmadas

1. **ATLAS no es obligatorio** — cada sistema se vende independiente
2. **Misma DB, visibilidad por licencia** — no APIs entre sistemas
3. **Chat es de Core** — aparece en el Hub y dentro de cualquier sistema
4. **Proyectos migran de ATLAS a SIEP** — ATLAS queda como ERP puro
5. **NEXUS es multi-sector** — no limitado a rural/agroindustria
6. **Gestión de producción vive en NEXUS** — no es un sistema separado
7. **Smart Import es add-on pago** — no usa plantillas propias, se adapta al formato del donante
8. **Planificación de inversiones en ATLAS** — conecta con FUNDHUB para financiamiento
9. **Navegación cruzada (Camino 3)** — Hub como lanzador, cada sistema su layout, puentes contextuales cuando hay integración
10. **Funciones repetidas intencionales** — cuando una función no es el core del sistema, se ofrece en versión simplificada. El sistema especializado tiene la versión completa.

---

## 8. Stack Técnico Actual

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 14 (App Router) |
| UI | Tailwind CSS + Radix UI + Lucide Icons |
| Backend | Next.js API Routes |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Autenticación | NextAuth.js (credentials + Google SSO) |
| Almacenamiento | AWS S3 (presigned URLs) |
| IA | Abacus AI API (GPT-4.1-mini) |
| Idiomas | ES (primario), PT (secundario) |
| Deploy | etholys.abacusai.app |

---

*Documento vivo — se actualiza con cada decisión estratégica.*
