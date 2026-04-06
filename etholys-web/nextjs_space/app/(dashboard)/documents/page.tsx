'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import {
  FolderOpen, Plus, Trash2, Search, X, Edit2, Download, Upload,
  FileText, File, FileImage, FileSpreadsheet, FileArchive,
  Eye, Filter, MoreVertical
} from 'lucide-react';

const CATEGORIES: Record<string, { label: string; color: string }> = {
  general: { label: 'General', color: 'bg-gray-100 text-gray-700' },
  contrato: { label: 'Contrato', color: 'bg-blue-100 text-blue-700' },
  informe: { label: 'Informe', color: 'bg-teal-100 text-teal-700' },
  politica: { label: 'Pol\u00edtica', color: 'bg-purple-100 text-purple-700' },
  procedimiento: { label: 'Procedimiento', color: 'bg-amber-100 text-amber-700' },
  acta: { label: 'Acta', color: 'bg-pink-100 text-pink-700' },
  legal: { label: 'Legal', color: 'bg-red-100 text-red-700' },
  financiero: { label: 'Financiero', color: 'bg-emerald-100 text-emerald-700' },
  tecnico: { label: 'T\u00e9cnico', color: 'bg-indigo-100 text-indigo-700' },
  otro: { label: 'Otro', color: 'bg-gray-100 text-gray-600' },
};

function getFileIcon(fileType: string) {
  if (!fileType) return File;
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet;
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar') || fileType.includes('gz')) return FileArchive;
  if (fileType.includes('pdf') || fileType.includes('word') || fileType.includes('document') || fileType.includes('text')) return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const EMPTY_FORM = {
  companyId: '', name: '', description: '', category: 'general', tags: '', isPublic: false,
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function DocumentsPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [items, setItems] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/documents${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`),
        fetch('/api/companies'),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      setItems(d1?.documents ?? []);
      setCompanies(d2?.companies ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeCompanyId]);

  const filtered = useMemo(() => {
    let list = items;
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.fileName?.toLowerCase().includes(q) ||
        d.tags?.toLowerCase().includes(q)
      );
    }
    if (filterCategory) list = list.filter(d => d.category === filterCategory);
    return list;
  }, [items, searchText, filterCategory]);

  const stats = useMemo(() => {
    const total = items.length;
    const totalSize = items.reduce((s, d) => s + (d.fileSize || 0), 0);
    const byCat: Record<string, number> = {};
    items.forEach(d => { byCat[d.category] = (byCat[d.category] || 0) + 1; });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    return { total, totalSize, topCat };
  }, [items]);

  const openCreate = () => {
    setEditId(null);
    const cid = activeCompanyId || companies[0]?.id || '';
    setForm({ ...EMPTY_FORM, companyId: cid });
    setSelectedFile(null);
    setShowForm(true);
  };

  const openEdit = (doc: any) => {
    setEditId(doc.id);
    setForm({
      companyId: doc.companyId,
      name: doc.name || '',
      description: doc.description || '',
      category: doc.category || 'general',
      tags: doc.tags || '',
      isPublic: doc.isPublic || false,
    });
    setSelectedFile(null);
    setShowForm(true);
    setMenuOpen(null);
  };

  const handleUploadAndSave = async () => {
    if (!form.companyId) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      if (editId) {
        // Update metadata only
        const res = await fetch('/api/documents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editId,
            name: form.name,
            description: form.description || null,
            category: form.category,
            tags: form.tags || null,
          }),
        });
        if (!res.ok) throw new Error('Error al actualizar');
      } else {
        if (!selectedFile) { setUploading(false); return; }
        // Step 1: Get presigned URL
        setUploadProgress(20);
        const presignRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'presign',
            fileName: selectedFile.name,
            contentType: selectedFile.type || 'application/octet-stream',
            isPublic: form.isPublic,
          }),
        });
        if (!presignRes.ok) throw new Error('Error obteniendo URL de subida');
        const { uploadUrl, cloud_storage_path } = await presignRes.json();

        // Step 2: Upload to S3
        setUploadProgress(40);
        const uploadHeaders: Record<string, string> = {
          'Content-Type': selectedFile.type || 'application/octet-stream',
        };
        // Check if Content-Disposition is in signed headers
        try {
          const urlObj = new URL(uploadUrl);
          const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders') || '';
          if (signedHeaders.includes('content-disposition')) {
            uploadHeaders['Content-Disposition'] = 'attachment';
          }
        } catch { /* ignore */ }

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: selectedFile,
        });
        if (!uploadRes.ok) throw new Error('Error al subir archivo');

        // Step 3: Save document record
        setUploadProgress(80);
        const saveRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: form.companyId,
            name: form.name || selectedFile.name,
            description: form.description || null,
            category: form.category,
            tags: form.tags || null,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type || '',
            cloud_storage_path,
            isPublic: form.isPublic,
          }),
        });
        if (!saveRes.ok) throw new Error(L(ml('Error saving document','Error al guardar documento','Erro ao salvar documento')));
      }
      setUploadProgress(100);
      setShowForm(false);
      setSelectedFile(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error');
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(ml('Delete this document?','¿Eliminar este documento?','Excluir este documento?')))) return;
    try {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  const handleDownload = async (doc: any) => {
    try {
      const res = await fetch(`/api/documents/download?id=${doc.id}`);
      const data = await res.json();
      if (data?.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = doc.fileName || doc.name || 'file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Repositorio Documental</h1>
            <p className="text-sm text-gray-500">{stats.total} {L(ml('document','documento','documento'))}{stats.total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium">
          <Upload className="w-4 h-4" /> {L(ml('Upload Document','Subir Documento','Enviar Documento'))}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{L(ml('Total Documents','Total Documentos','Total Documentos'))}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Almacenamiento</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{formatSize(stats.totalSize)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Categor&iacute;a Principal</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {stats.topCat ? `${CATEGORIES[stats.topCat[0]]?.label || stats.topCat[0]} (${stats.topCat[1]})` : '\u2014'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder={L(ml("Search documents...","Buscar documentos...","Buscar documentos..."))}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <select
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categor&iacute;as</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{L(ml('No documents found','No se encontraron documentos','Nenhum documento encontrado'))}</p>
          <button onClick={openCreate} className="mt-3 text-teal-600 text-sm font-medium hover:underline">
            {L(ml('Upload your first document','Subir el primer documento','Enviar o primeiro documento'))}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Categor&iacute;a</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Tama&ntilde;o</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">{L(ml("Company","Empresa","Empresa"))}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(doc => {
                  const Icon = getFileIcon(doc.fileType);
                  const cat = CATEGORIES[doc.category] || CATEGORIES.general;
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400 truncate">{doc.fileName}</p>
                            {doc.description && <p className="text-xs text-gray-400 truncate mt-0.5">{doc.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                        {doc.tags && <p className="text-xs text-gray-400 mt-1">{doc.tags}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatSize(doc.fileSize)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('es-UY') : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">
                        {doc.company?.shortName || doc.company?.name || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setMenuOpen(menuOpen === doc.id ? null : doc.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {menuOpen === doc.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                              <button
                                onClick={() => handleDownload(doc)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Download className="w-3.5 h-3.5" /> Descargar
                              </button>
                              <button
                                onClick={() => openEdit(doc)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Editar
                              </button>
                              <button
                                onClick={() => handleDelete(doc.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editId ? L(ml('Edit Document','Editar Documento','Editar Documento')) : L(ml('Upload Document','Subir Documento','Enviar Documento'))}
              </h2>
              <button onClick={() => { setShowForm(false); setSelectedFile(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('File *','Archivo *','Arquivo *'))}</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-400 transition cursor-pointer"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-teal-600" />
                        <span className="text-sm font-medium text-gray-700">{selectedFile.name}</span>
                        <span className="text-xs text-gray-400">({formatSize(selectedFile.size)})</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Haz clic para seleccionar un archivo</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, im&aacute;genes, etc.</p>
                      </>
                    )}
                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setSelectedFile(f);
                          if (!form.name) setForm(prev => ({ ...prev, name: f.name.replace(/\.[^.]+$/, '') }));
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {companies.length > 1 && !editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={form.companyId}
                    onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))}
                  >
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={L(ml('Document name','Nombre del documento','Nome do documento'))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{L(ml("Description","Descripción","Descrição"))}</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={L(ml("Brief description","Descripción breve del documento","Descrição breve do documento"))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categor&iacute;a</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={form.tags}
                    onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="Separadas por comas"
                  />
                </div>
              </div>

              {!editId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={form.isPublic}
                    onChange={e => setForm(p => ({ ...p, isPublic: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-600">{L(ml('Public file (accessible without authentication)','Archivo público (accesible sin autenticación)','Arquivo público (acessível sem autenticação)'))}</label>
                </div>
              )}

              {uploading && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-teal-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 text-center">Subiendo... {uploadProgress}%</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button
                onClick={() => { setShowForm(false); setSelectedFile(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadAndSave}
                disabled={uploading || (!editId && !selectedFile)}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
              >
                {uploading ? L(ml('Processing...','Procesando...','Processando...')) : editId ? L(ml('Save Changes','Guardar Cambios','Salvar Alterações')) : L(ml('Upload','Subir','Enviar'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside menu to close */}
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
