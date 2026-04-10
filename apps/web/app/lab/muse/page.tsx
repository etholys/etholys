'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/app/providers';
import { useSession } from 'next-auth/react';
import { Sparkles, Send, Save, Trash2, RefreshCw, Lightbulb, Cpu, Wrench, Cog, Layers, Link2, Zap, X } from 'lucide-react';

const CATEGORIES = [
  { id: 'system', label: 'Nuevo Sistema', icon: Cpu, color: '#6366f1' },
  { id: 'improvement', label: 'Mejora', icon: Wrench, color: '#0d9488' },
  { id: 'hardware', label: 'Hardware', icon: Cog, color: '#f59e0b' },
  { id: 'methodology', label: 'Metodolog\u00eda', icon: Layers, color: '#8b5cf6' },
  { id: 'process', label: 'Proceso', icon: Zap, color: '#ec4899' },
  { id: 'integration', label: 'Integraci\u00f3n', icon: Link2, color: '#3b82f6' },
];

const STATUSES = [
  { id: 'NEW', label: 'Nuevo', color: '#6366f1' },
  { id: 'REVIEWING', label: 'En Revisi\u00f3n', color: '#f59e0b' },
  { id: 'ACCEPTED', label: 'Aceptado', color: '#10b981' },
  { id: 'IMPLEMENTING', label: 'Implementando', color: '#3b82f6' },
  { id: 'DONE', label: 'Completado', color: '#059669' },
  { id: 'DISMISSED', label: 'Descartado', color: '#94a3b8' },
];

const PRIORITIES = [
  { id: 'LOW', label: 'Baja', color: '#94a3b8' },
  { id: 'MEDIUM', label: 'Media', color: '#f59e0b' },
  { id: 'HIGH', label: 'Alta', color: '#f97316' },
  { id: 'CRITICAL', label: 'Cr\u00edtica', color: '#ef4444' },
];

export default function MusePage() {
  const { locale } = useApp();
  const { data: session } = useSession() || {};
  const [activeView, setActiveView] = useState<'chat' | 'suggestions'>('chat');
  const [prompt, setPrompt] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [sugLoading, setSugLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [saveMode, setSaveMode] = useState(false);
  const [saveForm, setSaveForm] = useState({ title: '', category: 'improvement', priority: 'MEDIUM', description: '' });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchSuggestions = () => {
    setSugLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (catFilter) params.set('category', catFilter);
    fetch(`/api/muse?${params}`).then(r => r.json()).then(d => {
      setSuggestions(d?.suggestions ?? []); setSugLoading(false);
    }).catch(() => setSugLoading(false));
  };

  useEffect(() => { fetchSuggestions(); }, [statusFilter, catFilter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamText]);

  const analyze = async () => {
    if (!prompt.trim() && chatHistory.length === 0) return;
    const userMsg = prompt.trim() || 'Analiza los datos del sistema y genera sugerencias estrat\u00e9gicas.';
    setPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);
    setStreamText('');

    try {
      const res = await fetch('/api/muse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      });

      if (!res.ok) throw new Error('Error al consultar MUSE');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let partialRead = '';

      while (true) {
        const { done, value } = await (reader as any).read();
        if (done) break;
        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              fullText += content;
              setStreamText(fullText);
            } catch (e) { /* skip */ }
          }
        }
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
      setStreamText('');
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setStreaming(false);
    }
  };

  const saveSuggestion = async () => {
    if (!saveForm.title.trim()) return;
    await fetch('/api/muse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', ...saveForm, source: 'auto' }),
    });
    setSaveMode(false);
    setSaveForm({ title: '', category: 'improvement', priority: 'MEDIUM', description: '' });
    fetchSuggestions();
  };

  const updateSuggestion = async (id: string, updates: any) => {
    await fetch('/api/muse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, ...updates }),
    });
    fetchSuggestions();
  };

  const deleteSuggestion = async (id: string) => {
    if (!confirm('\u00bfEliminar esta sugerencia?')) return;
    await fetch('/api/muse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    fetchSuggestions();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      analyze();
    }
  };

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex items-center gap-3">
        <button onClick={() => setActiveView('chat')} className={`px-4 py-2 text-sm rounded-lg font-medium transition ${activeView === 'chat' ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
          <Sparkles className="w-4 h-4 inline mr-1.5" />{locale === 'es' ? 'Analizar' : locale === 'pt' ? 'Analisar' : 'Analyze'}
        </button>
        <button onClick={() => setActiveView('suggestions')} className={`px-4 py-2 text-sm rounded-lg font-medium transition ${activeView === 'suggestions' ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
          <Lightbulb className="w-4 h-4 inline mr-1.5" />{locale === 'es' ? 'Sugerencias' : locale === 'pt' ? 'Sugest\u00f5es' : 'Suggestions'} ({suggestions.length})
        </button>
      </div>

      {/* Chat View */}
      {activeView === 'chat' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col" style={{ minHeight: '520px' }}>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: '520px' }}>
            {chatHistory.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-5">
                  <Sparkles className="w-10 h-10 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">{locale === 'es' ? '\u00bfQu\u00e9 deseas analizar?' : locale === 'pt' ? 'O que deseja analisar?' : 'What would you like to analyze?'}</h3>
                <p className="text-sm text-slate-500 max-w-lg mb-6">
                  {locale === 'es'
                    ? 'MUSE observa proyectos, finanzas, riesgos y objetivos de todo el ecosistema ETHOLYS para generar sugerencias estrat\u00e9gicas de innovaci\u00f3n.'
                    : 'MUSE observa projetos, finan\u00e7as, riscos e objetivos de todo o ecossistema ETHOLYS para gerar sugest\u00f5es estrat\u00e9gicas de inova\u00e7\u00e3o.'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    { es: 'Analiza el estado general del portafolio', pt: 'Analise o estado geral do portf\u00f3lio', en: 'Analyze the overall portfolio status' },
                    { es: 'Identifica oportunidades de mejora', pt: 'Identifique oportunidades de melhoria', en: 'Identify improvement opportunities' },
                    { es: 'Sugiere nuevos sistemas o herramientas', pt: 'Sugira novos sistemas ou ferramentas', en: 'Suggest new systems or tools' },
                    { es: 'Eval\u00faa riesgos y brechas', pt: 'Avalie riscos e lacunas', en: 'Evaluate risks and gaps' },
                    { es: 'Propone evoluci\u00f3n de hardware existente', pt: 'Proponha evolu\u00e7\u00e3o de hardware existente', en: 'Propose evolution of existing hardware' },
                  ].map((s, i) => (
                    <button key={i} onClick={() => setPrompt(s[locale] || s.es)} className="px-3 py-2 text-xs bg-slate-800 text-violet-300 rounded-lg hover:bg-slate-700 transition border border-slate-700">
                      {s[locale] || s.es}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}

            {streaming && streamText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-4 py-3 bg-slate-800 text-slate-200 border border-slate-700">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{streamText}<span className="inline-block w-2 h-4 bg-violet-500 animate-pulse ml-0.5" /></div>
                </div>
              </div>
            )}

            {streaming && !streamText && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3 bg-slate-800 border border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {locale === 'es' ? 'Analizando datos del ecosistema...' : locale === 'pt' ? 'Analisando dados do ecossistema...' : 'Analyzing ecosystem data...'}
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={locale === 'es' ? 'Escribe una pregunta o solicitud para MUSE...' : locale === 'pt' ? 'Escreva uma pergunta ou solicita\u00e7\u00e3o para MUSE...' : 'Write a question or request for MUSE...'}
                className="flex-1 resize-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={streaming}
              />
              <button onClick={analyze} disabled={streaming} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 transition disabled:opacity-50 font-medium text-sm">
                <Send className="w-4 h-4" />{streaming ? (locale === 'es' ? 'Analizando...' : locale === 'pt' ? 'Analisando...' : 'Analyzing...') : (locale === 'es' ? 'Enviar' : locale === 'pt' ? 'Enviar' : 'Send')}
              </button>
            </div>
            {chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'assistant' && (
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => { setSaveMode(true); setSaveForm(prev => ({ ...prev, description: chatHistory[chatHistory.length - 1]?.content || '' })); }} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-500/15 text-violet-300 rounded-lg hover:bg-violet-500/25 transition border border-violet-500/20">
                  <Save className="w-3 h-3" />{locale === 'es' ? 'Guardar como Sugerencia' : locale === 'pt' ? 'Salvar como Sugest\u00e3o' : 'Save as Suggestion'}
                </button>
                <button onClick={() => { setChatHistory([]); setStreamText(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 rounded-lg transition">
                  <RefreshCw className="w-3 h-3" />{locale === 'es' ? 'Nueva Conversaci\u00f3n' : locale === 'pt' ? 'Nova Conversa' : 'New Conversation'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestions View */}
      {activeView === 'suggestions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20">
              <option value="">{locale === 'es' ? 'Todos los estados' : locale === 'pt' ? 'Todos os estados' : 'All statuses'}</option>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20">
              <option value="">{locale === 'es' ? 'Todas las categor\u00edas' : locale === 'pt' ? 'Todas as categorias' : 'All categories'}</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button onClick={() => setSaveMode(true)} className="ml-auto flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium">
              <Lightbulb className="w-4 h-4" />{locale === 'es' ? 'Nueva Sugerencia' : locale === 'pt' ? 'Nova Sugest\u00e3o' : 'New Suggestion'}
            </button>
          </div>

          {/* Suggestions List */}
          {sugLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-16">
              <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">{locale === 'es' ? 'A\u00fan no hay sugerencias guardadas' : locale === 'pt' ? 'Ainda n\u00e3o h\u00e1 sugest\u00f5es salvas' : 'No suggestions saved yet'}</p>
              <p className="text-xs text-slate-600 mt-1">{locale === 'es' ? 'Usa el chat de MUSE para generar an\u00e1lisis y guardarlos aqu\u00ed' : locale === 'pt' ? 'Use o chat do MUSE para gerar an\u00e1lises e salv\u00e1-las aqui' : 'Use MUSE chat to generate analyses and save them here'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((sug: any) => {
                const cat = CATEGORIES.find(c => c.id === sug.category);
                const st = STATUSES.find(s => s.id === sug.status);
                const pr = PRIORITIES.find(p => p.id === sug.priority);
                const CatIcon = cat?.icon || Lightbulb;
                return (
                  <div key={sug.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-violet-500/30 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (cat?.color || '#6366f1') + '15' }}>
                          <CatIcon className="w-4 h-4" style={{ color: cat?.color || '#6366f1' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-100">{sug.title}</h3>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: (st?.color || '#6366f1') + '20', color: st?.color || '#6366f1' }}>{st?.label || sug.status}</span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: (pr?.color || '#f59e0b') + '20', color: pr?.color || '#f59e0b' }}>{pr?.label || sug.priority}</span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{sug.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span>{cat?.label || sug.category}</span>
                            {sug.createdBy && <span>{`\u00b7 ${sug.createdBy.name}`}</span>}
                            {sug.company && <span>{`\u00b7 ${sug.company.shortName}`}</span>}
                            <span>{`\u00b7 ${new Date(sug.createdAt).toLocaleDateString()}`}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <select value={sug.status} onChange={e => updateSuggestion(sug.id, { status: e.target.value })} className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none">
                          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button onClick={() => deleteSuggestion(sug.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {saveMode && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{locale === 'es' ? 'Guardar Sugerencia' : locale === 'pt' ? 'Salvar Sugest\u00e3o' : 'Save Suggestion'}</h3>
                <button onClick={() => setSaveMode(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1 block">{locale === 'es' ? 'T\u00edtulo' : locale === 'pt' ? 'T\u00edtulo' : 'Title'}</label>
                  <input value={saveForm.title} onChange={e => setSaveForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20" placeholder={locale === 'es' ? 'T\u00edtulo de la sugerencia' : locale === 'pt' ? 'T\u00edtulo da sugest\u00e3o' : 'Suggestion title'} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1 block">{locale === 'es' ? 'Categor\u00eda' : locale === 'pt' ? 'Categoria' : 'Category'}</label>
                    <select value={saveForm.category} onChange={e => setSaveForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20">
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1 block">{locale === 'es' ? 'Prioridad' : locale === 'pt' ? 'Prioridade' : 'Priority'}</label>
                    <select value={saveForm.priority} onChange={e => setSaveForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20">
                      {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1 block">{locale === 'es' ? 'Descripci\u00f3n' : locale === 'pt' ? 'Descri\u00e7\u00e3o' : 'Description'}</label>
                  <textarea value={saveForm.description} onChange={e => setSaveForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 min-h-[120px]" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setSaveMode(false)} className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg transition">{locale === 'es' ? 'Cancelar' : locale === 'pt' ? 'Cancelar' : 'Cancel'}</button>
                <button onClick={saveSuggestion} disabled={!saveForm.title.trim()} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition disabled:opacity-50 font-medium">{locale === 'es' ? 'Guardar' : locale === 'pt' ? 'Salvar' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
