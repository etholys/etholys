'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Lightbulb,
  Radar,
  Sprout,
  BookOpen,
  BarChart3,
  Check,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface SystemModule {
  id: string;
  name: string;
  description: string;
  type: 'Core' | 'Add-on' | 'Add-on Premium';
}

interface SystemData {
  id: string;
  name: string;
  tagline: string;
  fullDescription: string;
  icon: any;
  image: string;
  color: string;
  colorAccent: string;
  problem: string;
  audience: string[];
  revenue: string[];
  modules: SystemModule[];
}

const SYSTEMS_DATA: Record<string, SystemData> = {
  atlas: {
    id: 'atlas',
    name: 'ATLAS ERP 360°',
    tagline: 'Sistema de Gestión Institucional y Empresarial',
    fullDescription: 'ERP completo para instituciones, ONGs, cooperativas y empresas que necesitan controlar sus operaciones administrativas, financieras, de personal y de proyectos en una sola plataforma. Elimina la necesidad de múltiples herramientas desconectadas.',
    icon: Building2,
    image: 'https://cdn.abacus.ai/images/88e2835a-1c92-4ec5-84c6-bb188074a4d5.jpg',
    color: 'from-teal-500 to-emerald-600',
    colorAccent: 'text-teal-400',
    problem: 'Las organizaciones gastan fortunas en múltiples herramientas desconectadas (contabilidad, RRHH, proyectos) y pierden trazabilidad, tiempo y dinero.',
    audience: ['ONGs administrativas, institutos, fundaciones', 'Cooperativas y asociaciones rurales', 'Agencias gubernamentales pequeñas', 'Universidades con gestión de fondos'],
    revenue: ['SaaS por suscripción (Starter / Professional / Enterprise)', 'Licenciamiento B2B White Label para gobiernos y multilaterales', 'Add-ons individuales por módulo', 'Precio por usuario/mes con descuento por volumen'],
    modules: [
      { id: '1.1', name: 'Gestión Financiera y Contable', description: 'Flujo de caja multiempresa/multimoneda, DRE, conciliación bancaria, cuentas por pagar/cobrar, automatización fiscal', type: 'Core' },
      { id: '1.2', name: 'Facturación y Tesorería', description: 'Emisión de facturas, invoices, procesamiento contable, control de patrimonio y activos', type: 'Core' },
      { id: '1.3', name: 'Recursos Humanos y Nómina', description: 'Empleados, contratos, nómina, control de asistencia, portal del colaborador', type: 'Core' },
      { id: '1.4', name: 'Compras y Proveedores', description: 'Pedidos, evaluación de proveedores, contratos, pagos recurrentes', type: 'Core' },
      { id: '1.5', name: 'Gestión de Proyectos y Programas', description: 'Portfolio multi-proyecto, Gantt, Kanban, metas, resultados, indicadores, marco lógico', type: 'Core' },
      { id: '1.6', name: 'Gestión Operacional', description: 'Cursos, servicios técnicos, consultorías, entregas en campo', type: 'Add-on' },
      { id: '1.7', name: 'Parcerias y Stakeholders', description: 'Pipeline de alianzas, CRM institucional, due diligence, contratos de cooperación', type: 'Add-on' },
      { id: '1.8', name: 'Gobernanza y Compliance', description: 'Auditoría, aprobaciones digitales, políticas internas, ESG', type: 'Add-on' },
      { id: '1.9', name: 'Gestión Jurídica y Contractual', description: 'Contratos, licencias, propiedad intelectual, firma digital', type: 'Add-on' },
      { id: '1.10', name: 'Contenido y Comunicación', description: 'Briefings, producción de materiales, banco de contenidos, identidad visual', type: 'Add-on' },
    ],
  },
  siep: {
    id: 'siep',
    name: 'SIEP',
    tagline: 'Sistema Inteligente de Ejecución e Innovación de Proyectos',
    fullDescription: 'Plataforma de IA para concebir, ejecutar, monitorear y escalar proyectos de innovación técnica y productiva. Actúa como un "ingeniero asistente" que acompaña todo el ciclo del proyecto con inteligencia artificial.',
    icon: Lightbulb,
    image: 'https://cdn.abacus.ai/images/da3a8075-963a-40b4-8b90-4a9b01b19002.jpg',
    color: 'from-emerald-500 to-green-600',
    colorAccent: 'text-emerald-400',
    problem: 'Las instituciones ejecutoras y centros de I+D pierden meses diseñando proyectos manualmente, no acceden a bancos de soluciones probadas, y la ejecución se desvía sin alertas tempranas.',
    audience: ['Centros de I+D e incubadoras', 'Instituciones ejecutoras de proyectos de innovación', 'Cooperativas que buscan industrializarse', 'Organismos multilaterales que financian innovación'],
    revenue: ['SaaS por proyecto o portfolio', 'Licenciamiento para universidades e incubadoras', 'Revenue share sobre proyectos financiados vía FundHub', 'Venta de equipos y royalties por soluciones implementadas'],
    modules: [
      { id: '2.1', name: 'IA Project Designer', description: 'Concepción automatizada: genera borradores de proyectos (problema, metodología, presupuesto, indicadores) basándose en datos históricos', type: 'Core' },
      { id: '2.2', name: 'Ejecución y Monitoreo Técnico', description: 'Registro de campo en tiempo real, actividades, resultados, gastos, evidencias. IA detecta desvíos', type: 'Core' },
      { id: '2.3', name: 'Banco de Soluciones Tecnológicas', description: 'Catálogo de tecnologías probadas con fichas técnicas, costos y proveedores', type: 'Core' },
      { id: '2.4', name: 'Marketplace de Proveedores Técnicos', description: 'Conexión con fabricantes, consultores y desarrolladores. IA recomienda según proyecto', type: 'Add-on' },
      { id: '2.5', name: 'IA de Apoyo Técnico y Científico', description: 'Genera textos, reportes, cálculos, diagramas y análisis comparativos', type: 'Core' },
      { id: '2.6', name: 'Laboratorio Virtual (Maker Digital)', description: 'Co-creación colaborativa, prototipado digital, modelado 3D, simulaciones', type: 'Add-on Premium' },
      { id: '2.7', name: 'Indicadores y Reportes Técnicos', description: 'Dashboards de KPIs técnicos, ambientales y económicos', type: 'Core' },
      { id: '2.8', name: 'Gestión de Propiedad Intelectual', description: 'Registro de innovaciones, patentes y licencias', type: 'Add-on' },
      { id: '2.9', name: 'Integración IoT', description: 'Datos en tiempo real de sensores (producción, clima, energía)', type: 'Add-on Premium' },
    ],
  },
  fundhub: {
    id: 'fundhub',
    name: 'FUNDHUB',
    tagline: 'Motor Global de Captación de Recursos',
    fullDescription: 'Sistema de IA que busca automáticamente convocatorias de fondos en toda la web, analiza compatibilidad con tu perfil institucional, ayuda a redactar propuestas y gestiona todo el ciclo de postulación y ejecución post-aprobación.',
    icon: Radar,
    image: 'https://cdn.abacus.ai/images/9e2d01e9-ba3a-40d0-aac4-332c3b768b0d.jpg',
    color: 'from-blue-500 to-cyan-600',
    colorAccent: 'text-blue-400',
    problem: 'Las organizaciones pierden millones en oportunidades de financiamiento porque no las encuentran a tiempo, no evalúan elegibilidad, y gastan semanas redactando propuestas que podrían automatizarse.',
    audience: ['ONGs y fundaciones que buscan fondos internacionales', 'Consultoras de fundraising', 'Universidades con oficinas de cooperación', 'Agencias de cooperación (GIZ, USAID, BID)'],
    revenue: ['SaaS por suscripción (búsquedas/mes)', 'Success Fee (2-5%) sobre fondos captados', 'Licenciamiento para consultoras', 'Datos premium: reportes de tendencias de financiamiento'],
    modules: [
      { id: '3.1', name: 'Búsqueda Global Automatizada', description: 'Rastreo diario de convocatorias por tema, región, idioma, sector, monto. Web scraping + IA', type: 'Core' },
      { id: '3.2', name: 'Repositorio de Instituciones y Fondos', description: 'Base curada de agencias multilaterales, fundaciones, bancos de desarrollo', type: 'Core' },
      { id: '3.3', name: 'IA de Compatibilidad (Matching)', description: 'Cruza perfil institucional con requisitos, genera ranking de probabilidad de aprobación', type: 'Core' },
      { id: '3.4', name: 'Asistente de Redacción de Propuestas', description: 'IA que redacta secciones, llena formularios, adapta lenguaje al formato del donante', type: 'Core' },
      { id: '3.5', name: 'Gestión de Submisiones', description: 'Pipeline de postulaciones: estado, plazos, documentos, responsables', type: 'Core' },
      { id: '3.6', name: 'Buscador de Aliados', description: 'IA sugiere organizaciones complementarias para consorcios y postulaciones conjuntas', type: 'Add-on' },
      { id: '3.7', name: 'Gestión Post-Aprobación', description: 'Módulo completo de gestión de proyecto con reportes adaptados al formato de cada donante', type: 'Add-on' },
      { id: '3.8', name: 'BI de Tendencias de Financiamiento', description: 'Análisis sectorial y geográfico de flujos de fondos', type: 'Add-on' },
      { id: '3.9', name: 'API Multilateral', description: 'Conexión directa con plataformas (ONU, BID, UE, FAO, GEF)', type: 'Add-on Premium' },
    ],
  },
  nexus: {
    id: 'nexus',
    name: 'NEXUS',
    tagline: 'Plataforma Inteligente de Desarrollo Integral de MIPYMEs',
    fullDescription: 'Plataforma completa para acompañar micro, pequeñas y medianas empresas (especialmente rurales) en todo su ciclo de desarrollo: diagnóstico 360°, asistencia técnica híbrida IA+humano, inteligencia agrícola en tiempo real, rutas de crecimiento, herramientas de gestión y acceso a mercados.',
    icon: Sprout,
    image: 'https://cdn.abacus.ai/images/83af9424-81ec-41a7-b4b8-fff96b5c2b51.jpg',
    color: 'from-green-500 to-lime-600',
    colorAccent: 'text-green-400',
    problem: 'Las MIPYMEs rurales operan a ciegas: no saben dónde están paradas, no tienen herramientas adaptadas a su realidad, no acceden a digitalización, industrialización, asistencia técnica de calidad ni mercados formales.',
    audience: ['Micro y pequeños emprendimientos rurales de cualquier sector', 'Cooperativas agrícolas y agroindustriales', 'Programas gubernamentales de desarrollo productivo', 'ONGs e incubadoras que atienden MIPYMEs'],
    revenue: ['Freemium: Diagnóstico 360° gratuito como gancho', 'SaaS escalable por herramientas desbloqueadas', 'Licenciamiento B2B para programas gubernamentales', 'Comisión Marketplace y Venture interno (equity/regalías)'],
    modules: [
      { id: '4.1', name: 'Diagnóstico 360° Inteligente', description: 'Evaluación dinámica de gestión, producción, marketing, innovación y sostenibilidad', type: 'Core' },
      { id: '4.2', name: 'Ruta de Desarrollo Personalizada', description: 'Plan automático de acciones, costos, plazos y herramientas basado en el diagnóstico', type: 'Core' },
      { id: '4.3', name: 'Plan y Modelo de Negocios IA', description: 'IA que construye plan de negocios y modelo Canvas adaptado a MIPYMEs rurales', type: 'Core' },
      { id: '4.13', name: 'Asistencia Técnica y Extensión Rural Digital', description: 'Sistema híbrido IA + técnico humano para acompañamiento en campo. Agendamiento, videollamadas, seguimiento', type: 'Core' },
      { id: '4.14', name: 'Asesoría Empresarial Híbrida (IA + Humano)', description: 'La IA prepara análisis y recomendaciones, el asesor humano valida y entrega. Interacción unificada', type: 'Core' },
      { id: '4.15', name: 'Inteligencia Agrícola y Agroindustrial', description: 'Análisis de datos en tiempo real: eficiencia productiva, clima, costos, calidad. Alertas predictivas con IA', type: 'Add-on Premium' },
      { id: '4.16', name: 'Gestión Agrícola Integral', description: 'Planificación de cultivos, calendario agrícola, control de insumos, registro de parcelas, ganado, riego', type: 'Core' },
      { id: '4.4', name: 'Mapa de Digitalización Productiva', description: 'Ruta para digitalizarse: etapas, herramientas, costos, con apoyo de IA', type: 'Add-on' },
      { id: '4.5', name: 'Modelos Productivos Sostenibles', description: 'Ruta de adaptación a producción sostenible según realidad y medio ambiente', type: 'Add-on' },
      { id: '4.6', name: 'Industrialización y Valor Agregado', description: 'BPM, HACCP, permisos bromatológicos, seguridad alimentaria', type: 'Add-on' },
      { id: '4.7', name: 'ERP Simplificado para MIPYMEs', description: 'Finanzas básicas, stock, ventas, proveedores, métricas de producción', type: 'Core' },
      { id: '4.8', name: 'Marketing Digital Automatizado', description: 'IA genera identidad visual, empaques, envases, gestión de redes sociales', type: 'Add-on' },
      { id: '4.9', name: 'Trazabilidad Productiva', description: 'Seguimiento de producción desde origen hasta consumidor final', type: 'Add-on Premium' },
      { id: '4.10', name: 'Canastas Inteligentes', description: 'Venta de canastas frescas por membresía con productos extras', type: 'Add-on' },
      { id: '4.11', name: 'Billetera Digital', description: 'Recepción de pagos y captación de recursos', type: 'Add-on Premium' },
      { id: '4.12', name: 'Recomendador de Crédito', description: 'IA analiza perfil y conecta con microfinanzas y fondos adecuados', type: 'Add-on' },
    ],
  },
  forge: {
    id: 'forge',
    name: 'FORGE',
    tagline: 'Ambiente Educacional y de Conexiones',
    fullDescription: 'Ecosistema de aprendizaje, capacitación y networking digital diseñado para emprendedores rurales, técnicos e instituciones. No es un LMS genérico: está integrado con WhatsApp, gamificación y rodadas de negocios virtuales.',
    icon: BookOpen,
    image: 'https://cdn.abacus.ai/images/3ca7e132-48b9-4384-a464-17f7c209acc0.jpg',
    color: 'from-violet-500 to-purple-600',
    colorAccent: 'text-violet-400',
    problem: 'Los emprendedores rurales no acceden a formación de calidad, las plataformas EAD son complejas y desconectadas de la realidad productiva, y no hay espacios digitales de networking adaptados.',
    audience: ['Instituciones que capacitan emprendedores', 'Universidades con extensión rural', 'Programas de formación técnica', 'Emprendedores individuales'],
    revenue: ['SaaS por institución (alumnos activos)', 'Revenue share en Marketplace educacional', 'Licenciamiento White Label', 'Venta de cursos propios ETHOLYS'],
    modules: [
      { id: '5.1', name: 'Plataforma EAD Completa', description: 'Cursos, trilhas, evaluaciones, certificados, foros, chats', type: 'Core' },
      { id: '5.2', name: 'Gestión Académica', description: 'Profesores, alumnos, turmas, frecuencia, reportes', type: 'Core' },
      { id: '5.3', name: 'Webinars y Lives', description: 'Transmisiones, grabaciones, reportes de participación', type: 'Core' },
      { id: '5.4', name: 'Rodadas de Negocios Virtuales', description: 'Matchmaking, agendas, salas de pitch, reuniones B2B', type: 'Add-on' },
      { id: '5.5', name: 'Knowledge Hub', description: 'Biblioteca viva de metodologías, estudios y buenas prácticas', type: 'Add-on' },
      { id: '5.6', name: 'Marketplace Educacional', description: 'Mentorías, servicios técnicos y cursos pagos de terceros', type: 'Add-on' },
      { id: '5.7', name: 'Gamificación y Learning Analytics', description: 'Rankings, badges, niveles, reportes de impacto del aprendizaje', type: 'Add-on' },
      { id: '5.8', name: 'Integración WhatsApp/Jitsi', description: 'Acceso vía WhatsApp, videollamadas integradas', type: 'Add-on Premium' },
      { id: '5.9', name: 'Certificación Verificable', description: 'Autenticación de cursos y certificados', type: 'Add-on' },
    ],
  },
  prism: {
    id: 'prism',
    name: 'PRISM',
    tagline: 'Panel Ejecutivo y BI Institucional 360°',
    fullDescription: 'Capa de Business Intelligence que consolida datos de todos los demás sistemas (o funciona standalone) para ofrecer una visión 360° de la organización con análisis predictivo, indicadores ESG y simulación de escenarios.',
    icon: BarChart3,
    image: 'https://cdn.abacus.ai/images/b89b3b9e-7b3a-41c3-85ec-5c523d05b103.jpg',
    color: 'from-amber-500 to-orange-600',
    colorAccent: 'text-amber-400',
    problem: 'Los directivos toman decisiones con información fragmentada, desactualizada o inexistente. No hay una "foto completa" de la organización.',
    audience: ['Directivos y CEOs de organizaciones', 'Agencias multilaterales que monitorean portfolios', 'Gobiernos que rinden cuentas sobre inversión social', 'Inversores de impacto'],
    revenue: ['SaaS Premium (tier ejecutivo)', 'Add-on para cualquier otro sistema ETHOLYS', 'Monetización de datos agregados y anonimizados', 'Licenciamiento para multilaterales'],
    modules: [
      { id: '6.1', name: 'Dashboards Interactivos', description: 'Financieros, operacionales, educacionales, productivos — todo en tiempo real', type: 'Core' },
      { id: '6.2', name: 'Indicadores ESG e Impacto Social', description: 'ODS, SDG, GRI — reportes ambientales, sociales y de gobernanza', type: 'Add-on' },
      { id: '6.3', name: 'Panel de Gobernanza y Transparencia', description: 'Auditoría, aprobaciones, trazabilidad de decisiones', type: 'Add-on' },
      { id: '6.4', name: 'Análisis Predictivo con IA', description: 'Proyecciones de resultados, detección de riesgos, oportunidades', type: 'Core' },
      { id: '6.5', name: 'Reportes de Impacto Multinivel', description: 'Para donantes, directorios, gobiernos, socios — adaptable a cada audiencia', type: 'Core' },
      { id: '6.6', name: 'Simulador de Escenarios', description: 'Impacto financiero y de productividad ante diferentes decisiones', type: 'Add-on Premium' },
    ],
  },
};

const TYPE_COLORS: Record<string, string> = {
  Core: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  'Add-on': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Add-on Premium': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

export default function SolutionPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const system = SYSTEMS_DATA[slug];
  const { data: session } = useSession() || {};
  const [mounted, setMounted] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="min-h-screen bg-slate-950" />;

  if (!system) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Solución no encontrada</h1>
          <Link href="/" className="text-teal-400 hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const Icon = system.icon;
  const coreModules = system.modules.filter(m => m.type === 'Core');
  const addOnModules = system.modules.filter(m => m.type !== 'Core');
  const allSlugs = Object.keys(SYSTEMS_DATA);
  const currentIdx = allSlugs.indexOf(slug);
  const prevSlug = currentIdx > 0 ? allSlugs[currentIdx - 1] : null;
  const nextSlug = currentIdx < allSlugs.length - 1 ? allSlugs[currentIdx + 1] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center font-bold text-sm">E</div>
              <span className="text-lg font-bold tracking-tight">ETHOLYS</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/#soluciones" className="text-slate-300 hover:text-white transition">Soluciones</Link>
              <Link href="/#ecosistema" className="text-slate-300 hover:text-white transition">Ecosistema</Link>
              {session ? (
                <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition">Dashboard</Link>
              ) : (
                <Link href="/login" className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition">Acceder</Link>
              )}
            </div>
            <button className="md:hidden text-slate-300" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-slate-900 border-t border-white/5 p-4 space-y-3">
            <Link href="/#soluciones" className="block text-slate-300" onClick={() => setMobileMenu(false)}>Soluciones</Link>
            <Link href={session ? '/dashboard' : '/login'} className="block px-4 py-2 rounded-lg bg-teal-600 text-white text-center" onClick={() => setMobileMenu(false)}>
              {session ? 'Dashboard' : 'Acceder'}
            </Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <Image src={system.image} alt={system.name} fill className="object-cover opacity-20" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/90 to-slate-950" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/#soluciones" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition">
            <ArrowLeft size={16} /> Todas las soluciones
          </Link>
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${system.color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold">{system.name}</h1>
              <p className={`text-lg ${system.colorAccent} font-medium mt-1`}>{system.tagline}</p>
            </div>
          </div>
          <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mb-8">{system.fullDescription}</p>

          <div className="p-5 rounded-xl bg-red-500/5 border border-red-500/10 mb-8">
            <p className="text-sm text-red-300">
              <span className="font-semibold">Problema que resuelve:</span> {system.problem}
            </p>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8">Módulos del Sistema</h2>

          {/* Core */}
          <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-4">Módulos Core (incluidos en el plan base)</h3>
          <div className="grid md:grid-cols-2 gap-3 mb-10">
            {coreModules.map((mod) => (
              <div key={mod.id} className="p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-teal-500/20 transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold">{mod.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[mod.type]}`}>{mod.type}</span>
                </div>
                <p className="text-sm text-slate-400">{mod.description}</p>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          {addOnModules.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Add-ons (expansiones opcionales)</h3>
              <div className="grid md:grid-cols-2 gap-3 mb-10">
                {addOnModules.map((mod) => (
                  <div key={mod.id} className="p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-blue-500/20 transition">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold">{mod.name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[mod.type]}`}>{mod.type}</span>
                    </div>
                    <p className="text-sm text-slate-400">{mod.description}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* AUDIENCE + REVENUE */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <h3 className="text-xl font-bold mb-4">Público Objetivo</h3>
              <div className="space-y-3">
                {system.audience.map((a) => (
                  <div key={a} className="flex items-start gap-3">
                    <Check size={16} className="text-teal-400 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-300 text-sm">{a}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Modelo de Negocio</h3>
              <div className="space-y-3">
                {system.revenue.map((r) => (
                  <div key={r} className="flex items-start gap-3">
                    <Zap size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-300 text-sm">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NAVIGATION */}
      <section className="py-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {prevSlug ? (
            <Link href={`/solutions/${prevSlug}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
              <ArrowLeft size={16} /> {SYSTEMS_DATA[prevSlug].name}
            </Link>
          ) : <div />}
          {nextSlug ? (
            <Link href={`/solutions/${nextSlug}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
              {SYSTEMS_DATA[nextSlug].name} <ArrowRight size={16} />
            </Link>
          ) : <div />}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">¿Listo para transformar tu organización?</h2>
          <p className="text-slate-400 mb-8">Accede a la plataforma y comienza a usar {system.name} hoy.</p>
          <div className="flex gap-4 justify-center">
            {session ? (
              <Link href="/dashboard" className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold">Ir al Dashboard</Link>
            ) : (
              <Link href="/login" className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold">Acceder</Link>
            )}
            <Link href="/" className="px-8 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5">Volver al inicio</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center font-bold text-xs">E</div>
            <span className="text-sm text-slate-400">ETHOLYS © 2026</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/#soluciones" className="hover:text-slate-300 transition">Soluciones</Link>
            <Link href="/#nosotros" className="hover:text-slate-300 transition">Nosotros</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
