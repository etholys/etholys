'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  ChevronDown,
  Building2,
  Lightbulb,
  Radar,
  Sprout,
  BookOpen,
  BarChart3,
  Shield,
  Globe,
  Wifi,
  MessageSquare,
  Cpu,
  Lock,
  Zap,
  Users,
  Target,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';

const SYSTEMS = [
  {
    id: 'atlas',
    name: 'ATLAS ERP 360°',
    tagline: 'Gestión Institucional y Empresarial',
    description: 'ERP completo para cualquier organización: empresas, instituciones, ONGs o cooperativas. Controle finanzas, personal, proyectos y operaciones en una sola plataforma adaptable a su sector.',
    icon: Building2,
    image: 'https://cdn.abacus.ai/images/88e2835a-1c92-4ec5-84c6-bb188074a4d5.jpg',
    color: 'from-teal-500 to-emerald-600',
    modules: ['Gestión Financiera', 'RRHH y Nómina', 'Proyectos y Programas', 'Compras', 'Gobernanza'],
    href: '/solutions/atlas',
  },
  {
    id: 'siep',
    name: 'SIEP',
    tagline: 'Ejecución e Innovación de Proyectos',
    description: 'Plataforma de IA para concebir, ejecutar, monitorear y escalar proyectos de innovación técnica y productiva con un ingeniero asistente de IA.',
    icon: Lightbulb,
    image: 'https://cdn.abacus.ai/images/da3a8075-963a-40b4-8b90-4a9b01b19002.jpg',
    color: 'from-emerald-500 to-green-600',
    modules: ['IA Project Designer', 'Monitoreo Técnico', 'Banco de Soluciones', 'Lab Virtual', 'IoT'],
    href: '/solutions/siep',
  },
  {
    id: 'fundhub',
    name: 'FUNDHUB',
    tagline: 'Motor Global de Captación de Recursos',
    description: 'IA que busca automáticamente convocatorias de fondos en toda la web, analiza compatibilidad, ayuda a redactar propuestas y gestiona el ciclo de postulación.',
    icon: Radar,
    image: 'https://cdn.abacus.ai/images/9e2d01e9-ba3a-40d0-aac4-332c3b768b0d.jpg',
    color: 'from-blue-500 to-cyan-600',
    modules: ['Búsqueda Global', 'IA Matching', 'Redacción de Propuestas', 'Gestión Post-Aprobación', 'BI Tendencias'],
    href: '/solutions/fundhub',
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    tagline: 'Desarrollo Integral de MIPYMEs',
    description: 'Plataforma completa para acompañar micro y pequeñas empresas de cualquier sector en su ciclo de desarrollo: diagnóstico 360°, asistencia técnica híbrida IA+humano, inteligencia productiva y acceso a mercados.',
    icon: Sprout,
    image: 'https://cdn.abacus.ai/images/83af9424-81ec-41a7-b4b8-fff96b5c2b51.jpg',
    color: 'from-green-500 to-lime-600',
    modules: ['Diagnóstico 360°', 'Extensión Digital', 'Asesoría Híbrida IA+Humano', 'Inteligencia Productiva', 'Trazabilidad'],
    href: '/solutions/nexus',
  },
  {
    id: 'forge',
    name: 'FORGE',
    tagline: 'Educación y Conexiones',
    description: 'Ecosistema de aprendizaje, capacitación y networking digital para emprendedores y profesionales de cualquier sector. Integrado con WhatsApp, gamificación y rodadas de negocios.',
    icon: BookOpen,
    image: 'https://cdn.abacus.ai/images/3ca7e132-48b9-4384-a464-17f7c209acc0.jpg',
    color: 'from-violet-500 to-purple-600',
    modules: ['Plataforma EAD', 'Rodadas de Negocios', 'Knowledge Hub', 'Gamificación', 'WhatsApp/Jitsi'],
    href: '/solutions/forge',
  },
  {
    id: 'prism',
    name: 'PRISM',
    tagline: 'Panel Ejecutivo y BI 360°',
    description: 'Capa de Business Intelligence que consolida datos de todos los sistemas para ofrecer una visión 360° con análisis predictivo e indicadores ESG.',
    icon: BarChart3,
    image: 'https://cdn.abacus.ai/images/b89b3b9e-7b3a-41c3-85ec-5c523d05b103.jpg',
    color: 'from-amber-500 to-orange-600',
    modules: ['Dashboards Interactivos', 'ESG e Impacto Social', 'IA Predictiva', 'Reportes Multinivel', 'Simulador'],
    href: '/solutions/prism',
  },
];

const CORE_FEATURES = [
  { icon: Lock, label: 'SSO Unificado', desc: 'Login único para todos los sistemas' },
  { icon: Cpu, label: 'IA Asistente', desc: 'Chatbot contextual en cada módulo' },
  { icon: Globe, label: 'Multilingüe', desc: 'ES / PT / EN / FR automático' },
  { icon: Wifi, label: 'Modo Offline', desc: 'Funciona sin conexión, sincroniza después' },
  { icon: MessageSquare, label: 'SMS / WhatsApp', desc: 'Canal alternativo para zonas sin internet' },
  { icon: Shield, label: 'Seguridad', desc: 'Roles granulares y multi-tenant' },
];

export default function Home() {
  const { data: session } = useSession() || {};
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="min-h-screen bg-slate-950" />;

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
              <a href="#soluciones" className="text-slate-300 hover:text-white transition">Soluciones</a>
              <a href="#ecosistema" className="text-slate-300 hover:text-white transition">Ecosistema</a>
              <a href="#nosotros" className="text-slate-300 hover:text-white transition">Nosotros</a>
              {session ? (
                <Link href="/hub" className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition">Ir al Hub</Link>
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
            <a href="#soluciones" className="block text-slate-300 hover:text-white" onClick={() => setMobileMenu(false)}>Soluciones</a>
            <a href="#ecosistema" className="block text-slate-300 hover:text-white" onClick={() => setMobileMenu(false)}>Ecosistema</a>
            <a href="#nosotros" className="block text-slate-300 hover:text-white" onClick={() => setMobileMenu(false)}>Nosotros</a>
            <Link href={session ? '/hub' : '/login'} className="block px-4 py-2 rounded-lg bg-teal-600 text-white text-center font-medium" onClick={() => setMobileMenu(false)}>
              {session ? 'Ir al Hub' : 'Acceder'}
            </Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <Image
            src="https://cdn.abacus.ai/images/a6748b49-2ef1-431a-aa5b-d77b248f7f63.jpg"
            alt="ETHOLYS Laboratorio de Innovación"
            fill
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm mb-6">
            <Zap size={14} />
            Fábrica de Soluciones | Laboratorio I+D+i
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
            Convertimos problemas complejos en{' '}
            <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
              activos digitales escalables
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Soluciones integradas de software, hardware y metodologías propietarias para cualquier sector económico.
            Desde la gestión institucional hasta la innovación productiva, adaptables a la realidad de cada organización.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#soluciones" className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-teal-500/25 transition-all flex items-center justify-center gap-2">
              Explorar Soluciones <ArrowRight size={18} />
            </a>
            <a href="#nosotros" className="px-8 py-3.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
              Conocer ETHOLYS
            </a>
          </div>
        </div>
        <a href="#soluciones" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-slate-500">
          <ChevronDown size={28} />
        </a>
      </section>

      {/* SOLUTIONS */}
      <section id="soluciones" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-teal-400 font-semibold text-sm uppercase tracking-wider mb-3">Ecosistema de Soluciones</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Un ecosistema en constante evolución</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Cada sistema tiene vida propia con sus módulos y planes. Juntos, crean un efecto multiplicador imposible de replicar. Y esto es solo el comienzo — nuevas soluciones se suman continuamente.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SYSTEMS.map((sys) => {
              const Icon = sys.icon;
              return (
                <Link key={sys.id} href={sys.href} className="group relative bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden hover:border-teal-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/5">
                  <div className="relative aspect-[2/1] overflow-hidden">
                    <Image src={sys.image} alt={sys.name} fill className="object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
                    <div className={`absolute top-4 left-4 w-10 h-10 rounded-xl bg-gradient-to-br ${sys.color} flex items-center justify-center`}>
                      <Icon size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold mb-1">{sys.name}</h3>
                    <p className="text-teal-400 text-sm font-medium mb-3">{sys.tagline}</p>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{sys.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sys.modules.map((mod) => (
                        <span key={mod} className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-slate-400">{mod}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-teal-400 text-sm font-medium group-hover:gap-2 transition-all">
                      Ver solución <ArrowRight size={14} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ECOSYSTEM / CORE */}
      <section id="ecosistema" className="py-24 relative">
        <div className="absolute inset-0">
          <Image
            src="https://cdn.abacus.ai/images/27ce465b-11e6-445f-a416-a08dec09dec4.jpg"
            alt="Sistemas interconectados"
            fill
            className="object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-teal-400 font-semibold text-sm uppercase tracking-wider mb-3">Infraestructura Transversal</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">ETHOLYS CORE</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">La capa que conecta todos los sistemas. Incluida en cada producto, es lo que hace posible la integración total.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.label} className="flex items-start gap-4 p-5 rounded-xl bg-slate-900/50 border border-white/5">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{feat.label}</h4>
                    <p className="text-sm text-slate-400">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Integration Map */}
          <div className="mt-16 p-8 rounded-2xl bg-slate-900/50 border border-white/5">
            <h3 className="text-xl font-bold text-center mb-6">Mapa de Integraciones</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {SYSTEMS.map((sys, i) => {
                const Icon = sys.icon;
                return (
                  <div key={sys.id} className={`flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-gradient-to-br ${sys.color} bg-opacity-10`} style={{background: `linear-gradient(135deg, rgba(20,30,50,0.9), rgba(20,30,50,0.7))`}}>
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${sys.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{sys.name}</p>
                      <p className="text-xs text-slate-400">{sys.tagline}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-slate-500 text-sm mt-6">Cada sistema alimenta a los demás. El ERP provee datos administrativos, el SIEP genera innovación, FORGE capacita, NEXUS desarrolla negocios, FUNDHUB financia y PRISM monitorea el impacto total.</p>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="https://cdn.abacus.ai/images/083d43d3-0218-41ea-bb56-cafbced24afc.png"
                alt="Tecnología rural integrada"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-teal-400 font-semibold text-sm uppercase tracking-wider mb-3">Propuesta de Valor</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-8">Certeza Operativa como Servicio</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                    <Target size={20} className="text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Para Instituciones y Organizaciones</h4>
                    <p className="text-slate-400 text-sm">Infraestructura de gestión de nivel Fortune 500 al alcance de cualquier organización. Transparencia total, trazabilidad y reportes automáticos para stakeholders.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Users size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Para MIPYMEs de Cualquier Sector</h4>
                    <p className="text-slate-400 text-sm">Acompañamiento integral con IA + técnico humano. Diagnóstico, ruta de desarrollo, herramientas de gestión adaptadas a su rubro, acceso a mercados y financiamiento.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Para Gobiernos y Multilaterales</h4>
                    <p className="text-slate-400 text-sm">Caja de cristal donde cada centavo es trazable. Dashboards de impacto ESG, gestión de portfolios y compliance automático.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="nosotros" className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 mb-6">
            <span className="text-2xl font-bold">E</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">ETHOLYS</h2>
          <p className="text-xl text-slate-300 mb-4">Fábrica de Soluciones y Laboratorio de I+D+i</p>
          <p className="text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto">
            Identificamos problemas complejos en cualquier sector económico y desarrollamos soluciones integradas:
            dispositivos físicos, software inteligente y metodologías propietarias. Operamos bajo un modelo de
            holding de propiedad intelectual, creando, poseyendo y licenciando tecnología de alto valor.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            <div className="p-6 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-3xl font-bold text-teal-400 mb-2">6+</p>
              <p className="text-sm text-slate-400">Sistemas y creciendo</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-3xl font-bold text-emerald-400 mb-2">80+</p>
              <p className="text-sm text-slate-400">Módulos Especializados</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-3xl font-bold text-blue-400 mb-2">Multi</p>
              <p className="text-sm text-slate-400">Sector, Idioma, Moneda</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#soluciones" className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold transition-all flex items-center justify-center gap-2">
              Explorar Soluciones <ArrowRight size={18} />
            </a>
            {session ? (
              <Link href="/hub" className="px-8 py-3.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                Ir al Hub <ArrowRight size={18} />
              </Link>
            ) : (
              <Link href="/login" className="px-8 py-3.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                Acceder a la Plataforma <ArrowRight size={18} />
              </Link>
            )}
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
            <a href="#soluciones" className="hover:text-slate-300 transition">Soluciones</a>
            <a href="#ecosistema" className="hover:text-slate-300 transition">Ecosistema</a>
            <a href="#nosotros" className="hover:text-slate-300 transition">Nosotros</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
