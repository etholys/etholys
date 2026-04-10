'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { getInitials } from '@/lib/utils';
import {
  MessageCircle, Plus, Hash, Send, Search, X, Users, Settings,
  Edit2, Trash2, ChevronLeft, Lock, Globe2, Paperclip,
  File, FileText, FileImage, Download, UserPlus, UserMinus, Check
} from 'lucide-react';

type Channel = any;
type Message = any;

function formatFileSize(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type: string) {
  if (!type) return File;
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('pdf') || type.includes('word') || type.includes('text')) return FileText;
  return File;
}

export default function ChatView() {
  const { data: session } = useSession() || {};
  const { activeCompanyId } = useApp();
  const currentUserId = (session?.user as any)?.id || '';

  // State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: '', description: '', type: 'public', memberIds: [] as string[] });
  const [companies, setCompanies] = useState<any[]>([]);
  const [allCompanyUsers, setAllCompanyUsers] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIdx, setMentionIdx] = useState(0);
  const [sideOpen, setSideOpen] = useState(true);
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '' });
  const [memberSearchText, setMemberSearchText] = useState('');
  const [attachFile, setAttachFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTimeRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/channels${activeCompanyId ? `?companyId=${activeCompanyId}` : ''}`);
      const data = await res.json();
      setChannels(data?.channels ?? []);
    } catch { /* ignore */ }
  }, [activeCompanyId]);

  // Fetch companies & all users
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(d?.companies ?? [])).catch(() => {});
    fetch('/api/users').then(r => r.json()).then(d => setAllCompanyUsers(d?.users ?? [])).catch(() => {});
  }, []);

  // Users for current company context
  const companyUsers = useMemo(() => {
    const cid = activeChannel?.companyId || activeCompanyId || companies[0]?.id;
    if (!cid) return allCompanyUsers;
    return allCompanyUsers.filter(u => u.companyUsers?.some((cu: any) => cu.companyId === cid));
  }, [allCompanyUsers, activeChannel?.companyId, activeCompanyId, companies]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchChannels().then(() => setLoading(false));
  }, [fetchChannels]);

  // Fetch messages for active channel
  const fetchMessages = useCallback(async (channelId: string, after?: string) => {
    try {
      let url = `/api/chat/messages?channelId=${channelId}`;
      if (after) url += `&after=${encodeURIComponent(after)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data?.messages ?? [];
    } catch { return []; }
  }, []);

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannel) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const msgs = await fetchMessages(activeChannel.id);
      if (!cancelled) {
        setMessages(msgs);
        lastMsgTimeRef.current = msgs.length > 0 ? msgs[msgs.length - 1].createdAt : null;
        fetch('/api/chat/channels', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markRead', channelId: activeChannel.id }),
        }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [activeChannel?.id, fetchMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Polling
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeChannel) return;
    pollRef.current = setInterval(async () => {
      if (!activeChannel) return;
      const after = lastMsgTimeRef.current;
      const newMsgs = await fetchMessages(activeChannel.id, after || undefined);
      if (newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map((m: any) => m.id));
          const unique = newMsgs.filter((m: any) => !ids.has(m.id));
          return [...prev, ...unique];
        });
        lastMsgTimeRef.current = newMsgs[newMsgs.length - 1].createdAt;
        fetch('/api/chat/channels', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markRead', channelId: activeChannel.id }),
        }).catch(() => {});
      }
      fetchChannels();
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChannel?.id, fetchMessages, fetchChannels]);

  // Upload file to S3 via presigned URL, return public URL
  const uploadFileToS3 = async (file: globalThis.File): Promise<{ fileUrl: string; fileName: string; fileSize: number; fileType: string } | null> => {
    try {
      const presignRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'presign', fileName: file.name, contentType: file.type || 'application/octet-stream', isPublic: true }),
      });
      if (!presignRes.ok) return null;
      const { uploadUrl, cloud_storage_path } = await presignRes.json();
      const uploadHeaders: Record<string, string> = { 'Content-Type': file.type || 'application/octet-stream' };
      try {
        const urlObj = new URL(uploadUrl);
        const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders') || '';
        if (signedHeaders.includes('content-disposition')) uploadHeaders['Content-Disposition'] = 'attachment';
      } catch { /* ignore */ }
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: uploadHeaders, body: file });
      if (!uploadRes.ok) return null;
      // Get public URL
      const dlRes = await fetch(`/api/documents/download?path=${encodeURIComponent(cloud_storage_path)}&isPublic=true`);
      let fileUrl = '';
      if (dlRes.ok) {
        const dlData = await dlRes.json();
        fileUrl = dlData?.url || '';
      }
      if (!fileUrl) {
        // Construct public URL directly
        fileUrl = cloud_storage_path;
      }
      return { fileUrl, fileName: file.name, fileSize: file.size, fileType: file.type || '' };
    } catch { return null; }
  };

  // Send message
  const handleSend = async () => {
    if ((!newMsg.trim() && !attachFile) || !activeChannel || sendLoading) return;
    setSendLoading(true);
    setUploading(!!attachFile);
    try {
      let fileData: any = null;
      if (attachFile) {
        fileData = await uploadFileToS3(attachFile);
        if (!fileData) { alert('Error al subir archivo'); setSendLoading(false); setUploading(false); return; }
      }
      // Extract mentions
      const mentionRegex = /@(\w[\w\s]*?)(?=\s|$|@)/g;
      const mentionNames: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newMsg)) !== null) mentionNames.push(match[1].trim().toLowerCase());
      const mentionedIds = companyUsers.filter(u => mentionNames.some(mn => u.name?.toLowerCase().includes(mn))).map(u => u.id);

      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: activeChannel.id,
          content: newMsg.trim() || (fileData ? `\ud83d\udcce ${fileData.fileName}` : ''),
          mentions: mentionedIds.length > 0 ? mentionedIds.join(',') : null,
          ...(fileData || {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        lastMsgTimeRef.current = data.message.createdAt;
        setNewMsg('');
        setAttachFile(null);
        inputRef.current?.focus();
      }
    } catch { /* ignore */ }
    setSendLoading(false);
    setUploading(false);
  };

  // Create channel
  const handleCreateChannel = async () => {
    if (!channelForm.name.trim()) return;
    const cid = activeCompanyId || companies[0]?.id;
    if (!cid) return;
    try {
      const res = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: cid,
          name: channelForm.name,
          description: channelForm.description,
          type: channelForm.type,
          memberIds: channelForm.memberIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreateChannel(false);
        setChannelForm({ name: '', description: '', type: 'public', memberIds: [] });
        await fetchChannels();
        if (data.channel) setActiveChannel(data.channel);
      }
    } catch { /* ignore */ }
  };

  // Delete message
  const handleDeleteMsg = async (id: string) => {
    try {
      await fetch(`/api/chat/messages?id=${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  };

  // Edit message
  const handleEditMsg = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => m.id === id ? data.message : m));
        setEditingMsg(null);
        setEditContent('');
      }
    } catch { /* ignore */ }
  };

  // Channel settings: update
  const handleUpdateChannel = async () => {
    if (!activeChannel) return;
    try {
      const res = await fetch('/api/chat/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateChannel', channelId: activeChannel.id, name: settingsForm.name, description: settingsForm.description }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChannel(data.channel);
        fetchChannels();
      }
    } catch { /* ignore */ }
  };

  // Delete channel (soft delete)
  const handleDeleteChannel = async () => {
    if (!activeChannel) return;
    if (!window.confirm('¿Estás seguro de que deseas eliminar este canal? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`/api/chat/channels?id=${activeChannel.id}`, { method: 'DELETE' });
      if (res.ok) {
        setActiveChannel(null);
        setShowSettings(false);
        fetchChannels();
      }
    } catch { /* ignore */ }
  };

  // Add member to channel
  const handleAddMember = async (userId: string) => {
    if (!activeChannel) return;
    try {
      await fetch('/api/chat/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addMembers', channelId: activeChannel.id, userIds: [userId] }),
      });
      fetchChannels();
      // Refresh active channel
      const res = await fetch(`/api/chat/channels?companyId=${activeChannel.companyId}`);
      const data = await res.json();
      const updated = (data?.channels ?? []).find((c: any) => c.id === activeChannel.id);
      if (updated) setActiveChannel(updated);
    } catch { /* ignore */ }
  };

  // Remove member from channel
  const handleRemoveMember = async (userId: string) => {
    if (!activeChannel) return;
    try {
      await fetch('/api/chat/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeMember', channelId: activeChannel.id, userId }),
      });
      fetchChannels();
      const res = await fetch(`/api/chat/channels?companyId=${activeChannel.companyId}`);
      const data = await res.json();
      const updated = (data?.channels ?? []).find((c: any) => c.id === activeChannel.id);
      if (updated) setActiveChannel(updated);
    } catch { /* ignore */ }
  };

  // Mention autocomplete
  const handleInputChange = (val: string) => {
    setNewMsg(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(' ') || afterAt.length < 15) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
        setMentionIdx(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const filteredMentionUsers = useMemo(() => {
    if (!showMentions) return [];
    return companyUsers.filter(u =>
      u.id !== currentUserId &&
      (u.name?.toLowerCase().includes(mentionFilter) || u.email?.toLowerCase().includes(mentionFilter))
    ).slice(0, 6);
  }, [showMentions, mentionFilter, companyUsers, currentUserId]);

  const insertMention = (user: any) => {
    const lastAt = newMsg.lastIndexOf('@');
    const before = newMsg.slice(0, lastAt);
    setNewMsg(`${before}@${user.name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const getUnread = (ch: Channel) => {
    if (!ch.isMember) return 0;
    const lastRead = new Date(ch.lastReadAt || 0);
    if (new Date(ch.updatedAt) > lastRead && ch.id !== activeChannel?.id) return -1;
    return 0;
  };

  const filteredChannels = useMemo(() => {
    if (!searchText) return channels;
    const q = searchText.toLowerCase();
    return channels.filter(ch => ch.name?.toLowerCase().includes(q));
  }, [channels, searchText]);

  const renderContent = (content: string) => {
    const parts = content.split(/(@\w[\w\s]*?)(?=\s|$|@)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) return <span key={i} className="bg-teal-100 text-teal-700 px-1 rounded font-medium">{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: Message[] }[] = [];
    let currentDate = '';
    messages.forEach(msg => {
      const d = new Date(msg.createdAt).toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });
      if (d !== currentDate) { currentDate = d; groups.push({ date: d, msgs: [] }); }
      groups[groups.length - 1].msgs.push(msg);
    });
    return groups;
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMentionUsers.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentionUsers[mentionIdx]); return; }
      if (e.key === 'Escape') { setShowMentions(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Members for create-channel selector
  const createChannelUsers = useMemo(() => {
    const cid = activeCompanyId || companies[0]?.id;
    if (!cid) return allCompanyUsers.filter(u => u.id !== currentUserId);
    return allCompanyUsers.filter(u => u.id !== currentUserId && u.companyUsers?.some((cu: any) => cu.companyId === cid));
  }, [allCompanyUsers, activeCompanyId, companies, currentUserId]);

  // Members list for settings panel
  const channelMemberIds = useMemo(() => {
    return (activeChannel?.members ?? []).map((m: any) => m.userId);
  }, [activeChannel]);

  const nonMembers = useMemo(() => {
    const q = memberSearchText.toLowerCase();
    return companyUsers.filter(u => !channelMemberIds.includes(u.id) && (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)));
  }, [companyUsers, channelMemberIds, memberSearchText]);

  const openSettings = () => {
    if (!activeChannel) return;
    setSettingsForm({ name: activeChannel.name || '', description: activeChannel.description || '' });
    setMemberSearchText('');
    setShowSettings(true);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Sidebar - Channel List */}
      <div className={`${sideOpen ? 'w-72' : 'w-0 overflow-hidden'} border-r border-gray-200 bg-white flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-teal-600" />
              <h2 className="font-semibold text-gray-900">Chat</h2>
            </div>
            <button onClick={() => setShowCreateChannel(true)} className="p-1.5 bg-teal-50 hover:bg-teal-100 rounded-lg transition" title="Crear canal">
              <Plus className="w-4 h-4 text-teal-600" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Buscar canales..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /></div>
          ) : filteredChannels.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Hash className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Sin canales</p>
              <button onClick={() => setShowCreateChannel(true)} className="text-teal-600 text-sm mt-1 hover:underline">Crear el primero</button>
            </div>
          ) : (
            filteredChannels.map(ch => {
              const isActive = activeChannel?.id === ch.id;
              const hasUnread = getUnread(ch) !== 0;
              return (
                <button key={ch.id} onClick={() => { setActiveChannel(ch); setShowSettings(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition ${isActive ? 'bg-teal-50 border-r-2 border-teal-600' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-teal-100' : 'bg-gray-100'}`}>
                    {ch.type === 'private' ? <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-gray-500'}`} /> : <Hash className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-gray-500'}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-sm truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{ch.name}</span>
                      {hasUnread && <div className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{ch.company?.shortName || ch.company?.name}{ch.members?.length > 0 && ` \u00b7 ${ch.members.length} miembro${ch.members.length !== 1 ? 's' : ''}`}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500">Selecciona un canal</h3>
              <p className="text-sm text-gray-400 mt-1">Elige un canal del panel izquierdo para comenzar</p>
              {!sideOpen && <button onClick={() => setSideOpen(true)} className="mt-3 text-teal-600 text-sm hover:underline">Mostrar canales</button>}
            </div>
          </div>
        ) : (
          <>
            {/* Channel Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
              <button onClick={() => setSideOpen(!sideOpen)} className="p-1 hover:bg-gray-100 rounded-lg transition lg:hidden">
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                {activeChannel.type === 'private' ? <Lock className="w-4 h-4 text-teal-600" /> : <Hash className="w-4 h-4 text-teal-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 truncate">{activeChannel.name}</h3>
                {activeChannel.description && <p className="text-xs text-gray-400 truncate">{activeChannel.description}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={openSettings} className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-500 transition">
                  <Users className="w-3.5 h-3.5" />
                  {activeChannel.members?.length || 0}
                </button>
                <button onClick={openSettings} className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Configuraci\u00f3n del canal">
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <Hash className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Inicio de #{activeChannel.name}</p>
                      <p className="text-sm text-gray-400 mt-1">Escribe el primer mensaje en este canal</p>
                    </div>
                  ) : (
                    groupedMessages.map((group, gi) => (
                      <div key={gi}>
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400 font-medium">{group.date}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                        {group.msgs.map((msg, mi) => {
                          const isMine = msg.userId === currentUserId;
                          const prevMsg = mi > 0 ? group.msgs[mi - 1] : null;
                          const isConsecutive = prevMsg?.userId === msg.userId && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 300000;
                          const isMentioned = msg.mentions?.split(',').includes(currentUserId);
                          const FIcon = msg.fileType ? getFileIcon(msg.fileType) : File;

                          return (
                            <div key={msg.id} className={`group flex gap-3 ${isConsecutive ? 'mt-0.5' : 'mt-3'} ${isMentioned ? 'bg-amber-50 -mx-2 px-2 py-1 rounded-lg border-l-2 border-amber-400' : ''} hover:bg-gray-50 rounded-lg px-2 py-0.5 transition`}>
                              {!isConsecutive ? (
                                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-xs font-bold text-teal-700">{getInitials(msg.user?.name || '?')}</span>
                                </div>
                              ) : <div className="w-8 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                {!isConsecutive && (
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-semibold text-gray-900">{msg.user?.name}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(msg.createdAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                )}
                                {editingMsg === msg.id ? (
                                  <div className="flex gap-2 mt-1">
                                    <input className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500" value={editContent} onChange={e => setEditContent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditMsg(msg.id); if (e.key === 'Escape') setEditingMsg(null); }} autoFocus />
                                    <button onClick={() => handleEditMsg(msg.id)} className="text-xs text-teal-600 hover:underline">Guardar</button>
                                    <button onClick={() => setEditingMsg(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                                  </div>
                                ) : (
                                  <>
                                    {msg.content && <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{renderContent(msg.content)}{msg.isEdited && <span className="text-[10px] text-gray-400 ml-1">(editado)</span>}</p>}
                                    {msg.fileUrl && (
                                      <div className="mt-1 inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-w-xs">
                                        <FIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium text-gray-700 truncate">{msg.fileName || 'Archivo'}</p>
                                          {msg.fileSize > 0 && <p className="text-[10px] text-gray-400">{formatFileSize(msg.fileSize)}</p>}
                                        </div>
                                        <a href={msg.fileUrl} download={msg.fileName || 'file'} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 rounded transition" onClick={e => e.stopPropagation()}>
                                          <Download className="w-3.5 h-3.5 text-teal-600" />
                                        </a>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              {isMine && editingMsg !== msg.id && (
                                <div className="opacity-0 group-hover:opacity-100 flex items-start gap-0.5 flex-shrink-0 mt-0.5">
                                  <button onClick={() => { setEditingMsg(msg.id); setEditContent(msg.content); }} className="p-1 hover:bg-gray-200 rounded transition" title="Editar"><Edit2 className="w-3 h-3 text-gray-400" /></button>
                                  <button onClick={() => handleDeleteMsg(msg.id)} className="p-1 hover:bg-red-100 rounded transition" title="Eliminar"><Trash2 className="w-3 h-3 text-red-400" /></button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="px-4 py-3 border-t border-gray-200 bg-white relative">
                  {showMentions && filteredMentionUsers.length > 0 && (
                    <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                      {filteredMentionUsers.map((u, i) => (
                        <button key={u.id} onClick={() => insertMention(u)} className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${i === mentionIdx ? 'bg-teal-50' : ''}`}>
                          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center"><span className="text-[10px] font-bold text-teal-700">{getInitials(u.name)}</span></div>
                          <span className="font-medium text-gray-700">{u.name}</span>
                          <span className="text-xs text-gray-400">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Attached file preview */}
                  {attachFile && (
                    <div className="flex items-center gap-2 mb-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                      <Paperclip className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      <span className="text-sm text-teal-800 truncate flex-1">{attachFile.name}</span>
                      <span className="text-xs text-teal-500">{formatFileSize(attachFile.size)}</span>
                      <button onClick={() => setAttachFile(null)} className="p-0.5 hover:bg-teal-100 rounded"><X className="w-3.5 h-3.5 text-teal-600" /></button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0" title="Adjuntar archivo">
                      <Paperclip className="w-4 h-4 text-gray-500" />
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAttachFile(f); e.target.value = ''; }} />
                    <textarea ref={inputRef} className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 max-h-32" placeholder={`Mensaje en #${activeChannel.name}... (usa @ para mencionar)`} value={newMsg} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} rows={1} />
                    <button onClick={handleSend} disabled={(!newMsg.trim() && !attachFile) || sendLoading} className="p-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 flex-shrink-0">
                      {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Shift+Enter para nueva l&iacute;nea &middot; @ para mencionar &middot; \ud83d\udcce para adjuntar</p>
                </div>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 text-sm">Configuraci&oacute;n del canal</h3>
                    <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Channel Info */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Informaci&oacute;n</h4>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                        <input className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={settingsForm.name} onChange={e => setSettingsForm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Descripci&oacute;n</label>
                        <textarea className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" rows={2} value={settingsForm.description} onChange={e => setSettingsForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <button onClick={handleUpdateChannel} disabled={!settingsForm.name.trim()} className="w-full px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition disabled:opacity-50">
                        Guardar cambios
                      </button>
                    </div>

                    {/* Members */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Miembros ({channelMemberIds.length})</h4>
                      <div className="space-y-1">
                        {channelMemberIds.map((uid: string) => {
                          const user = allCompanyUsers.find(u => u.id === uid);
                          if (!user) return null;
                          return (
                            <div key={uid} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                              <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-teal-700">{getInitials(user.name)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800 truncate">{user.name}{uid === currentUserId ? ' (t\u00fa)' : ''}</p>
                                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                              </div>
                              {uid !== currentUserId && uid !== activeChannel?.createdBy && (
                                <button onClick={() => handleRemoveMember(uid)} className="p-1 hover:bg-red-50 rounded transition" title="Quitar del canal">
                                  <UserMinus className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add Members */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agregar miembros</h4>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Buscar usuarios..." value={memberSearchText} onChange={e => setMemberSearchText(e.target.value)} />
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {nonMembers.slice(0, 10).map(u => (
                          <button key={u.id} onClick={() => handleAddMember(u.id)} className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-teal-50 text-left transition">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-gray-500">{getInitials(u.name)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-700 truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                            </div>
                            <UserPlus className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                          </button>
                        ))}
                        {nonMembers.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Todos los usuarios ya son miembros</p>}
                      </div>
                    </div>

                    {/* Delete Channel */}
                    <div className="pt-3 border-t border-gray-200">
                      <button onClick={handleDeleteChannel} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                        <Trash2 className="w-4 h-4" />
                        Eliminar canal
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Crear Canal</h2>
              <button onClick={() => setShowCreateChannel(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del canal *</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={channelForm.name} onChange={e => setChannelForm(p => ({ ...p, name: e.target.value }))} placeholder="ej: general, marketing, soporte" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripci&oacute;n</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" value={channelForm.description} onChange={e => setChannelForm(p => ({ ...p, description: e.target.value }))} placeholder="De qu\u00e9 trata este canal" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="chType" value="public" checked={channelForm.type === 'public'} onChange={() => setChannelForm(p => ({ ...p, type: 'public' }))} className="text-teal-600 focus:ring-teal-500" />
                    <Globe2 className="w-4 h-4 text-gray-500" /> <span className="text-sm text-gray-700">P&uacute;blico</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="chType" value="private" checked={channelForm.type === 'private'} onChange={() => setChannelForm(p => ({ ...p, type: 'private' }))} className="text-teal-600 focus:ring-teal-500" />
                    <Lock className="w-4 h-4 text-gray-500" /> <span className="text-sm text-gray-700">Privado</span>
                  </label>
                </div>
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Miembros {channelForm.type === 'private' && <span className="text-red-500">*</span>}
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  {channelForm.type === 'private' ? 'Selecciona qui\u00e9n puede ver este canal' : 'Opcional: invita miembros al canal'}
                </p>
                {channelForm.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {channelForm.memberIds.map(uid => {
                      const user = createChannelUsers.find(u => u.id === uid);
                      return (
                        <span key={uid} className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {user?.name || uid}
                          <button onClick={() => setChannelForm(p => ({ ...p, memberIds: p.memberIds.filter(id => id !== uid) }))} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                  {createChannelUsers.map(u => {
                    const isSelected = channelForm.memberIds.includes(u.id);
                    return (
                      <button key={u.id} onClick={() => {
                        setChannelForm(p => ({
                          ...p,
                          memberIds: isSelected ? p.memberIds.filter(id => id !== u.id) : [...p.memberIds, u.id]
                        }));
                      }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition ${isSelected ? 'bg-teal-50' : ''}`}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-300'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-gray-500">{getInitials(u.name)}</span>
                        </div>
                        <span className="text-gray-700 truncate">{u.name}</span>
                        <span className="text-xs text-gray-400 truncate">{u.email}</span>
                      </button>
                    );
                  })}
                  {createChannelUsers.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No hay otros usuarios disponibles</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => { setShowCreateChannel(false); setChannelForm({ name: '', description: '', type: 'public', memberIds: [] }); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
              <button onClick={handleCreateChannel} disabled={!channelForm.name.trim() || (channelForm.type === 'private' && channelForm.memberIds.length === 0)} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition disabled:opacity-50">Crear Canal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
