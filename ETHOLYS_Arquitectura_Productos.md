# ETHOLYS — Arquitectura de Productos y Soluciones
## Fábrica de Soluciones | Laboratorio de I+D+i

---

## Visión General del Ecosistema

ETHOLYS opera como un **holding de propiedad intelectual** que diseña, desarrolla y licencia soluciones integradas (software + hardware + metodologías) para resolver problemas complejos en sectores tradicionales. El ecosistema se compone de **6 sistemas independientes** que pueden venderse por separado o integrarse entre sí, más **1 capa transversal** que los conecta.

Cada sistema tiene vida propia, con sus propios módulos, planes de suscripción y add-ons. Pero cuando se conectan, crean un efecto multiplicador que ningún competidor puede replicar fácilmente.

> **Nota sobre funciones repetidas:** Algunas funcionalidades aparecen en más de un sistema (ej: gestión financiera básica en ATLAS y en NEXUS, reportes en varios). Esto es intencional: cuando una función no es el core del sistema, se ofrece en versión simplificada/limitada. El sistema especializado siempre tiene la versión completa.

---

## 🗺️ MAPA DE SISTEMAS

```
┌─────────────────────────────────────────────────────────────┐
│                    VITRINA ETHOLYS                          │
│              (Laboratorio Virtual / Showcase)                │
├──────────┬──────────┬──────────┬──────────┬────────┬────────┤
│ SISTEMA 1│ SISTEMA 2│ SISTEMA 3│ SISTEMA 4│SIST. 5 │SIST. 6 │
│  ATLAS   │  SIEP    │ FundHub  │ NEXUS    │FORGE   │PRISM   │
│  ERP 360 │  Innov.  │ Captac.  │ MIPYMEs  │ EAD    │ BI 360 │
├──────────┴──────────┴──────────┴──────────┴────────┴────────┤
│            CAPA TRANSVERSAL: ETHOLYS CORE                   │
│     (SSO, IA Asistente, Docs, Chat, APIs, i18n)            │
└─────────────────────────────────────────────────────────────┘
```

---

## SISTEMA 1: ATLAS ERP 360°
### *Sistema de Gestión Institucional y Empresarial*

**Concepto:** ERP completo para instituciones, ONGs, cooperativas y empresas que necesitan controlar sus operaciones administrativas, financieras, de personal y de proyectos en una sola plataforma.

**Problema que resuelve:** Las organizaciones de desarrollo y las MIPYMEs gastan fortunas en múltiples herramientas desconectadas (uno para contabilidad, otro para RRHH, otro para proyectos) y pierden trazabilidad, tiempo y dinero.

### Módulos:

| # | Módulo | Descripción | Tipo |
|---|--------|------------|------|
| 1.1 | **Gestión Financiera y Contable** | Flujo de caja multiempresa/multimoneda, DRE, conciliación bancaria, cuentas por pagar/cobrar, automatización fiscal | Core |
| 1.2 | **Facturación y Tesorería** | Emisión de facturas, invoices, procesamiento contable, control de patrimonio y activos | Core |
| 1.3 | **Recursos Humanos y Nómina** | Empleados, contratos, nómina, control de asistencia, portal del colaborador | Core |
| 1.4 | **Compras y Proveedores** | Pedidos, evaluación de proveedores, contratos, pagos recurrentes | Core |
| 1.5 | **Gestión de Proyectos y Programas** | Portfolio multi-proyecto, Gantt, Kanban, metas, resultados, indicadores, marco lógico | Core |
| 1.6 | **Gestión Operacional** | Cursos, servicios técnicos, consultorías, entregas en campo | Add-on |
| 1.7 | **Gestión de Parcerias y Stakeholders** | Pipeline de alianzas, CRM institucional, due diligence, contratos de cooperación | Add-on |
| 1.8 | **Gobernanza y Compliance** | Auditoría, aprobaciones digitales, políticas internas, ESG | Add-on |
| 1.9 | **Gestión Jurídica y Contractual** | Contratos, licencias, PI, firma digital | Add-on |
| 1.10 | **Gestión de Contenido y Comunicación** | Briefings, producción de materiales, banco de contenidos, identidad visual | Add-on |

### Modelo de Negocio:
- **SaaS por suscripción:** Planes Starter (1.1-1.4), Professional (+ 1.5-1.6), Enterprise (todos)
- **Licenciamiento B2B White Label:** Para gobiernos y multilaterales que necesitan su propia instancia
- **Add-ons individuales:** Cada módulo avanzado se vende como complemento mensual
- **Por usuario/mes** con descuento por volumen

### Público objetivo:
- ONGs administrativas, institutos, fundaciones
- Cooperativas y asociaciones rurales
- Agencias gubernamentales pequeñas
- Universidades con gestión de fondos

---

## SISTEMA 2: SIEP — Sistema Inteligente de Ejecución e Innovación de Proyectos
### *Plataforma de Ejecución e Innovación de Proyectos*
> **Nota:** ETHOLYS como empresa ES el Laboratorio de I+D+i. El SIEP es uno de sus productos con capacidades de innovación, pero no es el laboratorio en sí.

**Concepto:** Plataforma de IA para concebir, ejecutar, monitorear y escalar proyectos de innovación técnica y productiva. Actúa como un "ingeniero asistente" que acompaña todo el ciclo del proyecto.

**Problema que resuelve:** Las instituciones ejecutoras y los centros de I+D pierden meses diseñando proyectos manualmente, no tienen acceso a bancos de soluciones probadas, y la ejecución se desvía sin alertas tempranas.

### Módulos:

| # | Módulo | Descripción | Tipo |
|---|--------|------------|------|
| 2.1 | **IA Project Designer** | Concepción automatizada: la IA genera borradores de proyectos (problema, metodología, presupuesto, indicadores) basándose en datos históricos y diagnósticos | Core |
| 2.2 | **Ejecución y Monitoreo Técnico** | Registro de campo en tiempo real, actividades, resultados, gastos, evidencias. IA detecta desvíos y sugiere replanificación | Core |
| 2.3 | **Banco de Soluciones Tecnológicas** | Catálogo de tecnologías probadas (deshidratadores solares, biodigestores, trazabilidad, etc.) con fichas técnicas, costos y proveedores | Core |
| 2.4 | **Marketplace de Proveedores Técnicos** | Conexión con fabricantes, consultores, desarrolladores. IA recomienda según tipo de proyecto y presupuesto | Add-on |
| 2.5 | **IA de Apoyo Técnico y Científico** | Genera textos, reportes, cálculos, diagramas y análisis comparativos entre tecnologías | Core |
| 2.6 | **Laboratorio Virtual (Maker Digital)** | Co-creación colaborativa, prototipado digital, modelado 3D, simulaciones | Add-on Premium |
| 2.7 | **Indicadores y Reportes Técnicos** | Dashboards de KPIs técnicos, ambientales y económicos | Core |
| 2.8 | **Gestión de Propiedad Intelectual** | Registro de innovaciones, patentes y licencias | Add-on |
| 2.9 | **Integración IoT** | Datos en tiempo real de sensores (producción, clima, energía) | Add-on Premium |

### Modelo de Negocio:
- **SaaS por proyecto o portfolio:** Planes por cantidad de proyectos activos
- **Licenciamiento para universidades e incubadoras** (tarifa anual)
- **Revenue share / Success fee:** Comisión sobre proyectos que logran financiamiento vía FundHub
- **Venta de equipos asociados** (hardware diseñado por ETHOLYS, fabricado por terceros)
- **Royalties:** Por cada solución técnica del banco que sea implementada por terceros

### Público objetivo:
- Centros de I+D, incubadoras
- Instituciones ejecutoras de proyectos de innovación
- Cooperativas que buscan industrializarse
- Organismos multilaterales que financian innovación

---

## SISTEMA 3: FUNDHUB — Motor Global de Captación de Recursos
### *IA para Encontrar, Analizar y Ganar Financiamiento*

**Concepto:** Sistema de IA que busca automáticamente convocatorias de fondos en toda la web, analiza compatibilidad, ayuda a redactar propuestas y gestiona todo el ciclo de postulación.

**Problema que resuelve:** Las organizaciones pierden millones en oportunidades de financiamiento porque no las encuentran a tiempo, no tienen capacidad de análisis para evaluar elegibilidad, y gastan semanas redactando propuestas que podrían automatizarse.

### Módulos:

| # | Módulo | Descripción | Tipo |
|---|--------|------------|------|
| 3.1 | **Búsqueda Global Automatizada** | Rastreo diario de convocatorias por tema, región, idioma, sector, monto. Web scraping + IA | Core |
| 3.2 | **Repositorio de Instituciones y Fondos** | Base curada de agencias multilaterales, fundaciones, bancos de desarrollo, inversores de impacto | Core |
| 3.3 | **IA de Compatibilidad (Matching)** | Cruza perfil institucional con requisitos del edital, genera ranking de probabilidad de aprobación | Core |
| 3.4 | **Asistente de Redacción de Propuestas** | IA que redacta secciones, llena formularios, adapta lenguaje al formato del donante. El usuario co-redacta | Core |
| 3.5 | **Gestión de Submisiones** | Pipeline de postulaciones: estado, plazos, documentos, responsables | Core |
| 3.6 | **Buscador de Aliados** | IA sugiere organizaciones complementarias para consorcios y postulaciones conjuntas | Add-on |
| 3.7 | **Gestión Post-Aprobación** | Si se gana: módulo completo de gestión de proyecto con reportes adaptados al formato de cada donante | Add-on |
| 3.8 | **BI de Tendencias de Financiamiento** | Análisis sectorial y geográfico de flujos de fondos | Add-on |
| 3.9 | **API Multilateral** | Conexión directa con plataformas (ONU, BID, UE, FAO, GEF) | Add-on Premium |

### Modelo de Negocio:
- **SaaS por suscripción:** Planes por cantidad de búsquedas/mes y propuestas activas
- **Success Fee:** Comisión (2-5%) sobre fondos captados con asistencia de la plataforma
- **Licenciamiento para consultoras de fundraising**
- **Datos premium:** Venta de reportes de tendencias de financiamiento

### Público objetivo:
- ONGs y fundaciones que buscan fondos internacionales
- Consultoras de fundraising
- Universidades con oficinas de cooperación
- Agencias de cooperación (GIZ, USAID, BID)
- Empresas con programas de RSE que buscan co-financiamiento

---

## SISTEMA 4: NEXUS — Plataforma Inteligente de Desarrollo MIPYMEs
### *IA para el Desarrollo Empresarial Rural y Sostenible*

**Concepto:** Plataforma que acompaña a micro, pequeñas y medianas empresas (especialmente rurales) en todo su ciclo de desarrollo: diagnóstico 360°, ruta personalizada de crecimiento, herramientas de gestión simplificadas y acceso a mercados.

**Problema que resuelve:** Las MIPYMEs rurales operan a ciegas: no saben dónde están paradas, no tienen herramientas adaptadas a su realidad, y no acceden a digitalización, industrialización ni mercados formales.

### Módulos:

| # | Módulo | Descripción | Tipo |
|---|--------|------------|------|
| 4.1 | **Diagnóstico 360° Inteligente** | Evaluación dinámica de gestión, producción, marketing, innovación y sostenibilidad. Genera mapa de estado actual | Core |
| 4.2 | **Ruta de Desarrollo Personalizada** | Plan automático de acciones, costos, plazos y herramientas basado en el diagnóstico | Core |
| 4.3 | **Plan y Modelo de Negocios Automático** | Herramienta de IA que construye plan de negocios y modelo Canvas adaptado a MIPYMEs rurales | Core |
| 4.4 | **Mapa de Digitalización Productiva** | Ruta específica para digitalizarse: etapas, herramientas, costos, con apoyo de IA | Add-on |
| 4.5 | **Mapa de Modelos Productivos Sostenibles** | Ruta de adaptación a producción sostenible según realidad y medio ambiente | Add-on |
| 4.6 | **Mapa de Industrialización y Valor Agregado** | Ruta para industrializarse: BPM, HACCP, permisos bromatológicos, seguridad alimentaria | Add-on |
| 4.7 | **ERP Simplificado para MIPYMEs** | Finanzas básicas, stock, ventas, proveedores, métricas de producción | Core |
| 4.8 | **Marketing Digital Automatizado** | IA genera identidad visual, empaques, envases, gestión de redes sociales | Add-on |
| 4.9 | **Trazabilidad Productiva** | Seguimiento de producción desde origen hasta consumidor final | Add-on Premium |
| 4.10 | **Canastas Inteligentes** | Venta de canastas frescas por membresía con productos extras | Add-on |
| 4.11 | **Billetera Digital** | Espacio para recibir pagos de ventas, también útil para captación de recursos | Add-on Premium |
| 4.12 | **Recomendador de Crédito** | IA que analiza perfil y conecta con microfinanzas y fondos adecuados | Add-on |
| 4.13 | **Asistencia Técnica y Extensión Rural Digital** | Sistema híbrido IA + técnico humano para acompañamiento en campo. El técnico se apoya en IA para diagnósticos, la IA opera 24/7 cuando el técnico no está disponible. Incluye agendamiento, videollamadas, visitas de campo y seguimiento post-visita | Core |
| 4.14 | **Asesoría Empresarial Híbrida (IA + Humano)** | Módulo de consultoría empresarial donde la IA prepara análisis, borradores y recomendaciones, y un asesor humano valida, ajusta y entrega. El emprendedor puede interactuar con ambos en una misma interfaz | Core |
| 4.15 | **Inteligencia Agrícola y Agroindustrial** | Sistema de análisis de datos en tiempo real: eficiencia productiva, rendimiento por hectárea/unidad, condiciones climáticas, costos de producción, calidad de producto. Integración con sensores IoT, datos satelitales y registros manuales. Alertas predictivas y recomendaciones de IA | Add-on Premium |
| 4.16 | **Gestión Agrícola Integral** | Planificación de cultivos/producción, calendario agrícola, control de insumos, registro de parcelas/lotes, seguimiento de ganado, gestión de riego y recursos hídricos | Core |

### Modelo de Negocio:
- **Freemium:** Diagnóstico 360° gratuito (gancho), ruta básica gratuita
- **SaaS escalable:** Planes por nivel de herramientas desbloqueadas
- **Licenciamiento B2B:** Para programas gubernamentales que atienden MIPYMEs masivamente
- **Comisión Marketplace:** Sobre transacciones dentro de Canastas y Billetera
- **Venture interno:** ETHOLYS como brazo tecnológico de empresas asociadas a cambio de equity/regalías

### Público objetivo:
- Micro y pequeños emprendimientos rurales
- Cooperativas agrícolas y agroindustriales
- Programas gubernamentales de desarrollo productivo
- ONGs que atienden MIPYMEs
- Incubadoras y aceleradoras rurales

---

## SISTEMA 5: FORGE — Ambiente Educacional y de Conexiones
### *Plataforma EAD + Rodadas de Negocio + Knowledge Hub*

**Concepto:** Ecosistema de aprendizaje, capacitación y networking digital diseñado para emprendedores rurales, técnicos e instituciones. No es un LMS genérico: está integrado con WhatsApp, gamificación y rodadas de negocios.

**Problema que resuelve:** Los emprendedores rurales no acceden a formación de calidad, las plataformas EAD existentes son complejas y desconectadas de la realidad productiva, y no existen espacios digitales de networking adaptados.

### Módulos:

| # | Módulo | Descripción | Tipo |
|---|--------|------------|------|
| 5.1 | **Plataforma EAD Completa** | Cursos, trilhas, evaluaciones, certificados, foros, chats | Core |
| 5.2 | **Gestión Académica** | Profesores, alumnos, turmas, frecuencia, reportes | Core |
| 5.3 | **Webinars y Lives** | Transmisiones, grabaciones, reportes de participación | Core |
| 5.4 | **Rodadas de Negocios Virtuales** | Matchmaking, agendas, salas de pitch, reuniones B2B | Add-on |
| 5.5 | **Knowledge Hub** | Biblioteca viva de metodologías, estudios y buenas prácticas | Add-on |
| 5.6 | **Marketplace Educacional** | Mentorías, servicios técnicos y cursos pagos de terceros | Add-on |
| 5.7 | **Gamificación y Learning Analytics** | Rankings, badges, niveles, reportes de impacto del aprendizaje | Add-on |
| 5.8 | **Integración WhatsApp/Jitsi** | Acceso vía WhatsApp, videollamadas integradas para asistencia técnica | Add-on Premium |
| 5.9 | **Certificación verificable** | Autenticación de cursos y certificados | Add-on |

### Modelo de Negocio:
- **SaaS por institución:** Planes por cantidad de alumnos activos
- **Revenue share en Marketplace:** Comisión sobre cursos/mentorías vendidos por terceros
- **Licenciamiento White Label:** Para universidades y programas gubernamentales
- **Venta de cursos propios:** ETHOLYS como productora de contenido premium

### Público objetivo:
- Instituciones que capacitan emprendedores
- Universidades con extensión rural
- Programas de formación técnica
- Emprendedores individuales

---

## SISTEMA 6: PRISM — Panel Ejecutivo y BI Institucional
### *Inteligencia de Datos 360° con IA Predictiva*

**Concepto:** Capa de Business Intelligence que consolida datos de todos los demás sistemas (o funciona standalone) para ofrecer una visión 360° de la organización con análisis predictivo e indicadores ESG.

**Problema que resuelve:** Los directivos toman decisiones con información fragmentada, desactualizada o inexistente. No hay una "foto completa" de la organización.

### Módulos:

| # | Módulo | Descripción | Tipo |
|---|--------|------------|------|
| 6.1 | **Dashboards Interactivos** | Financieros, operacionales, educacionales, productivos — todo en tiempo real | Core |
| 6.2 | **Indicadores ESG y de Impacto Social** | ODS, SDG, GRI — reportes ambientales, sociales y de gobernanza | Add-on |
| 6.3 | **Panel de Gobernanza y Transparencia** | Auditoría, aprobaciones, trazabilidad de decisiones | Add-on |
| 6.4 | **Análisis Predictivo con IA** | Proyecciones de resultados, detección de riesgos, oportunidades | Core |
| 6.5 | **Reportes de Impacto Multinivel** | Para donantes, directorios, gobiernos, socios — adaptable a cada audiencia | Core |
| 6.6 | **Simulador de Escenarios** | Impacto financiero y de productividad ante diferentes decisiones | Add-on Premium |

### Modelo de Negocio:
- **SaaS Premium:** Es el tier más alto, solo para organizaciones con necesidad ejecutiva
- **Add-on para cualquier sistema:** Quien usa ATLAS o SIEP puede agregar PRISM como capa de BI
- **Monetización de datos:** Reportes agregados y anonimizados sobre tendencias
- **Licenciamiento para multilaterales:** BID, GIZ, USAID para monitorear sus portfolios

### Público objetivo:
- Directivos y CEOs de organizaciones
- Agencias multilaterales que monitorean portfolios
- Gobiernos que rinden cuentas sobre inversión social
- Inversores de impacto

---

## CAPA TRANSVERSAL: ETHOLYS CORE
### *La infraestructura que conecta todo*

No se vende solo; viene incluida en cada sistema. Es lo que permite la integración.

| Componente | Descripción |
|-----------|-------------|
| **SSO (Single Sign-On)** | Login único para todos los sistemas |
| **IA Asistente Técnica** | Chatbot contextual que opera dentro de cualquier sistema: redacta, analiza, sugiere |
| **Gestión Documental** | Repositorio centralizado con versionado y permisos |
| **Chat y Colaboración** | Comunicación en tiempo real entre equipos y socios |
| **APIs Abiertas** | Integración con Google, Zoom, Moodle, sistemas fiscales, bancos |
| **Motor i18n** | Multilingüe (ES/PT/EN/FR) automático |
| **Motor de Notificaciones** | Alertas por email, push, in-app |
| **Motor de Permisos** | Roles granulares y multi-tenant |
| **Modo Offline + Sync** | Todos los sistemas funcionan sin conexión y sincronizan cuando hay internet. Crítico para zonas rurales |
| **Canal SMS/WhatsApp** | Interacción vía SMS para zonas sin internet. Alertas, reportes resumidos, entrada de datos básicos por mensaje de texto |

---

## 🔗 MAPA DE INTEGRACIONES ENTRE SISTEMAS

```
ATLAS (ERP) ←→ SIEP (Innovación)
  ↕                  ↕
FUNDHUB (Fondos) ←→ NEXUS (MIPYMEs)
  ↕                  ↕
FORGE (EAD) ←───→ PRISM (BI)
```

**Ejemplos concretos de integración:**
- **FUNDHUB → SIEP:** Se gana un fondo → se crea automáticamente el proyecto en SIEP para ejecutarlo
- **NEXUS → FUNDHUB:** El diagnóstico de una MIPYME genera automáticamente una propuesta de financiamiento
- **ATLAS → PRISM:** Todos los datos financieros y de RRHH alimentan los dashboards ejecutivos
- **FORGE → NEXUS:** Un emprendedor que completa un curso desbloquea herramientas en su ruta de desarrollo
- **SIEP → ATLAS:** Los gastos de ejecución de un proyecto se reflejan automáticamente en la contabilidad
- **NEXUS → FORGE:** El diagnóstico recomienda cursos específicos del catálogo educativo

---

## 🧠 MUSE — Motor Universal de Sugerencias Estratégicas
### *Sistema Interno de Inteligencia e Innovación*

> ⚠️ **COMPONENTE INTERNO — NO VISIBLE EN VITRINA NI PARA CLIENTES**
> Acceso restringido a personal clave de ETHOLYS.

**Concepto:** MUSE es la inteligencia transversal interna de ETHOLYS. Funciona como un asesor/observador permanente que monitorea todo el ecosistema, analiza datos de uso, proyectos, hardware, metodologías e innovación, y genera propuestas accionables de mejora y nuevos desarrollos.

**No es un producto comercializable** — es el cerebro de I+D+i de ETHOLYS.

**Funciones principales:**

1. **Observatorio de Datos**
   - Monitorea métricas de uso de todos los sistemas (ATLAS, SIEP, NEXUS, etc.)
   - Analiza patrones de comportamiento de usuarios
   - Detecta funcionalidades subutilizadas o sobredemandadas
   - Registra feedback y pain points recurrentes

2. **Proponente de Nuevos Sistemas / Productos**
   - Cruza datos del ecosistema y detecta oportunidades de mercado
   - Propone nuevos sistemas de software basados en evidencia de uso
   - Identifica brechas tecnológicas que ningún sistema actual cubre
   - Ejemplo: *"El 70% de los clientes NEXUS solicitan gestión de inventario → proponer módulo de stock"*

3. **Asesor de Mejoras en Sistemas Existentes**
   - Analiza qué módulos se ignoran y propone simplificaciones
   - Sugiere nuevas features basadas en tendencias y datos
   - Prioriza mejoras por impacto estimado vs esfuerzo
   - Ejemplo: *"El módulo de riesgos en ATLAS tiene 8% de adopción → proponer rediseño UX"*

4. **Evolución de Hardware**
   - Registra versiones y cambios iterativos de hardware (ej: deshidratadora solar v1→v2→v3)
   - Propone mejoras técnicas basadas en datos de rendimiento y tendencias tecnológicas
   - Ejemplo: *"Deshidratadora v2 usa energía pasiva solar → proponer integración de panel fotovoltaico para v3, incluyendo sistema de generación de energía limpia complementaria"*
   - Cruza datos de sensores IoT (humedad, temperatura) con resultados de producción

5. **Innovación Metodológica**
   - Evalúa efectividad de metodologías aplicadas en proyectos
   - Propone adaptaciones o nuevas metodologías
   - Integra aprendizajes de todos los proyectos del ecosistema

**Arquitectura técnica (fase futura):**
- Motor de IA/LLM que analiza datos del ecosistema periódicamente
- Dashboard interno con propuestas priorizadas por categoría
- Sistema de votación/aprobación para ideas (workflow interno)
- Bitácora de innovación: registro histórico de ideas → decisiones → resultados
- Conexión con todos los sistemas vía APIs internas

**Acceso:** Solo personal autorizado de ETHOLYS (dirección, jefes de producto, equipo I+D)

---

## 📦 PLANES COMERCIALES (Licenciamiento)

| Plan | Sistemas incluidos | Público |
|------|-------------------|--------|
| **MIPYME / Cooperativa** | NEXUS + ERP Simplificado (de NEXUS) + FORGE + Marketplace | Emprendimientos locales |
| **Institucional** | ATLAS + FUNDHUB + FORGE + IA Asistente | ONGs, universidades, redes |
| **Técnico / Innovación** | SIEP + IA Técnica + Marketplace de Proveedores | Centros de I+D, incubadoras |
| **Gubernamental / Multilateral** | TODOS + PRISM + Compliance + ESG | Agencias públicas, BID, GIZ |
| **Uso Interno ETHOLYS** | TODOS integrados + Laboratorio de Innovación | ETHOLYS y aliados estratégicos |

---

## 📍 RELACIÓN CON LO YA CONSTRUIDO (Rural Commerce 360°)

Lo que ya tenemos desarrollado en la aplicación actual corresponde principalmente al **ATLAS ERP 360°**:

| Funcionalidad existente | Módulo ATLAS |
|------------------------|-------------|
| Dashboard con KPIs | 1.5 (Gestión de Proyectos) + PRISM |
| Gestión de Proyectos (CRUD, portfolio) | 1.5 |
| Gestión de Tareas (Kanban, filtros, dependencias, Gantt) | 1.5 |
| Módulo Financiero (ingresos, gastos, transferencias, multimoneda) | 1.1 |
| Gestión de Equipo (usuarios, roles, departamentos) | 1.3 |
| Gestión de Empresas (multi-tenant) | 1.5 |
| Reportes y Exportación PDF | 1.5 + PRISM |
| Sistema de Notificaciones | ETHOLYS CORE |
| Autenticación (credenciales + Google SSO) | ETHOLYS CORE |
| Internacionalización (ES/PT) | ETHOLYS CORE |

**Acción:** No se borra nada. Se reorganiza dentro de la vitrina como el primer producto funcional (ATLAS) de ETHOLYS.

---

## 🏗️ SIGUIENTE PASO: LA VITRINA

Crear el **sitio vitrina de ETHOLYS** (Laboratorio Virtual) que:
1. Presenta la empresa y su filosofía
2. Muestra los 6 sistemas como productos independientes
3. Cada sistema tiene su propia landing con módulos, planes y CTA
4. El app actual (Rural Commerce 360°) queda accesible como demo/producto activo del ATLAS ERP
5. Prepara la estructura para que cada sistema futuro sea un módulo dentro del mismo dominio

---

*Documento generado para ETHOLYS — Marzo 2026*
