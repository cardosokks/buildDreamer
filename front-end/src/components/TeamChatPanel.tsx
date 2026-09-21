import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API_URL } from '../config';
import { 
  MessageSquare, Send, Mic, Image as ImageIcon, X, Minus, ChevronLeft, 
  Users, Lock, Globe, Play, Pause, Trash2, Smile, Search, ShieldCheck, 
  CheckCheck, ArrowLeft, MoreHorizontal, Sparkles
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderRole?: string;
  recipientId: string;
  content: string;
  type: 'text' | 'audio' | 'image' | 'file';
  mediaUrl?: string | null;
  duration?: number | null;
  fileName?: string | null;
  fileSize?: number | null;
  createdAt: string;
  read?: boolean;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ConversationSummary {
  user: TeamUser;
  lastMessage: {
    id: string;
    content: string;
    type: string;
    senderId: string;
    createdAt: string;
    fileName?: string | null;
  } | null;
  unreadCount: number;
}

export const TeamChatPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { token, user: currentUser } = useAuth();
  const { success, error } = useNotification();

  // Mode: 'inbox' (contacts list) or 'chat' (active 1-to-1 or general conversation)
  const [viewMode, setViewMode] = useState<'inbox' | 'chat'>('inbox');
  const [isMinimized, setIsMinimized] = useState(false);

  // Active recipient: 'ALL' for General Team Channel or userId for 1-to-1 Private Chat
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);

  // Data state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [generalLastMessage, setGeneralLastMessage] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Socket ref
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickEmojis = ['👍', '❤️', '🔥', '👏', '😊', '🎉', '🚀', '💡', '✅', '🙏'];

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Socket Setup
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
      fetchUsers();

      const socket = io(window.location.origin, {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      if (currentUser?.id) {
        socket.emit('join_room', currentUser.id);
      }

      socket.on('receive_message', (msg: ChatMessage) => {
        // If the message is for the currently open conversation
        const isCurrentGeneral = selectedRecipientId === 'ALL' && msg.recipientId === 'ALL';
        const isCurrentPrivate = selectedRecipientId !== 'ALL' && (
          (msg.senderId === selectedRecipientId && msg.recipientId === currentUser?.id) ||
          (msg.senderId === currentUser?.id && msg.recipientId === selectedRecipientId)
        );

        if (isCurrentGeneral || isCurrentPrivate) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          scrollToBottom();
        }

        // Refresh conversation summaries to update last message & unread badges
        fetchConversations();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isOpen, selectedRecipientId, currentUser?.id]);

  useEffect(() => {
    if (viewMode === 'chat') {
      scrollToBottom('auto');
    }
  }, [messages, viewMode]);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.users) {
        const otherUsers = data.users.filter((u: TeamUser) => u.id !== currentUser?.id);
        setUsers(otherUsers);
      }
    } catch {}
  };

  // Fetch conversations overview
  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.conversations) setConversations(data.conversations);
        if (data.generalChannel) setGeneralLastMessage(data.generalChannel.lastMessage);
      }
    } catch {}
  };

  // Fetch messages for active conversation
  const fetchMessages = async (recipientId: string) => {
    try {
      setLoading(true);
      const url = recipientId === 'ALL'
        ? `${API_URL}/api/chat/messages`
        : `${API_URL}/api/chat/messages?targetUserId=${recipientId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Open a specific conversation
  const handleOpenConversation = (recipientId: string, user?: TeamUser) => {
    setSelectedRecipientId(recipientId);
    setSelectedUser(user || null);
    setViewMode('chat');
    setIsMinimized(false);
    fetchMessages(recipientId);
  };

  // Send message
  const handleSendMessage = async (
    type: 'text' | 'audio' | 'image' | 'file' = 'text', 
    mediaUrl?: string, 
    duration?: number, 
    fileName?: string, 
    fileSize?: number,
    overrideContent?: string
  ) => {
    const textToSend = overrideContent !== undefined ? overrideContent : inputText;
    if (type === 'text' && !textToSend.trim()) return;

    try {
      const payload = {
        content: type === 'text' ? textToSend.trim() : (type === 'audio' ? 'Mensagem de voz' : type === 'image' ? 'Imagem enviada' : 'Arquivo enviado'),
        type,
        recipientId: selectedRecipientId,
        mediaUrl: mediaUrl || null,
        duration: duration || null,
        fileName: fileName || null,
        fileSize: fileSize || null
      };

      const res = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.message) {
        if (type === 'text' && overrideContent === undefined) setInputText('');
        setShowEmojiPicker(false);
        setMessages(prev => [...prev, data.message]);
        
        // Broadcast via Socket
        if (socketRef.current) {
          socketRef.current.emit('send_message', data.message);
        }
        scrollToBottom();
        fetchConversations();
      } else {
        error(data.error || 'Erro ao enviar mensagem');
      }
    } catch {
      error('Falha de conexão ao enviar mensagem');
    }
  };

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/chat/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        await handleSendMessage('image', data.url, undefined, data.fileName, data.fileSize);
        success('Imagem enviada!');
      } else {
        error(data.error || 'Erro ao enviar imagem');
      }
    } catch {
      error('Falha ao enviar imagem');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Audio Recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, `voice_${Date.now()}.webm`);

        try {
          const res = await fetch(`${API_URL}/api/chat/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
          const data = await res.json();
          if (res.ok && data.url) {
            await handleSendMessage('audio', data.url, recordingDuration, 'Mensagem de voz.webm', audioBlob.size);
            success('Áudio enviado!');
          }
        } catch {
          error('Erro ao enviar áudio');
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch {
      error('Permissão de microfone negada ou indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        success('Mensagem removida.');
        fetchConversations();
      }
    } catch {}
  };

  // Filtered contacts
  const filteredUsers = users.filter(u => {
    const term = searchQuery.toLowerCase();
    return (u.name && u.name.toLowerCase().includes(term)) || u.email.toLowerCase().includes(term);
  });

  // Calculate total unread messages across all conversations
  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Avatar helper with initials & colors
  const getAvatarBg = (name: string) => {
    const colors = [
      'bg-gradient-to-tr from-blue-600 to-indigo-600',
      'bg-gradient-to-tr from-purple-600 to-pink-600',
      'bg-gradient-to-tr from-emerald-600 to-teal-600',
      'bg-gradient-to-tr from-amber-600 to-orange-600',
      'bg-gradient-to-tr from-rose-600 to-red-600',
      'bg-gradient-to-tr from-cyan-600 to-blue-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  // MINIMIZED STATE (Facebook Dock Bar at Bottom-Right)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isMinimized) {
    const displayName = selectedRecipientId === 'ALL' 
      ? 'Canal Geral' 
      : (selectedUser?.name || selectedUser?.email.split('@')[0] || 'Chat Privado');

    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-0 right-4 sm:right-6 z-50 w-72 h-11 bg-white dark:bg-[#1e2024] border-t border-x border-slate-200 dark:border-slate-700/80 rounded-t-xl shadow-2xl px-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-[#25282e] transition-all group select-none animate-in slide-in-from-bottom-3 duration-200"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative shrink-0">
            {selectedRecipientId === 'ALL' ? (
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                <Globe className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${getAvatarBg(displayName)}`}>
                {getInitials(displayName, selectedUser?.email || '')}
              </div>
            )}
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900 absolute -bottom-0.5 -right-0.5" />
          </div>

          <div className="truncate">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1">
              {displayName}
              {selectedRecipientId !== 'ALL' && <Lock className="w-3 h-3 text-blue-500 shrink-0" />}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {totalUnreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {totalUnreadCount}
            </span>
          )}
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
            title="Maximizar"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL FACEBOOK-STYLE MESSENGER POPUP WINDOW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-0 right-3 sm:right-6 z-50 w-[94vw] sm:w-[360px] h-[520px] max-h-[calc(100vh-70px)] bg-white dark:bg-[#18191a] border border-slate-200/90 dark:border-slate-700/80 rounded-t-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 font-sans">
      
      {/* ────────────────────────────────────────────────────────────────────────
          HEADER SECTION (Facebook Messenger Style)
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-[#242526] border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shadow-xs select-none shrink-0">
        
        {viewMode === 'inbox' ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[13px] text-slate-900 dark:text-slate-100 leading-tight">
                Mensagens
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {users.length} {users.length === 1 ? 'membro disponível' : 'membros disponíveis'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-hidden">
            <button
              onClick={() => {
                setViewMode('inbox');
                fetchConversations();
              }}
              className="p-1 -ml-1 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
              title="Voltar para contatos"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              {selectedRecipientId === 'ALL' ? (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-xs">
                  <Globe className="w-4 h-4" />
                </div>
              ) : (
                <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-[11px] font-bold shadow-xs ${getAvatarBg(selectedUser?.name || 'U')}`}>
                  {getInitials(selectedUser?.name || '', selectedUser?.email || '')}
                </div>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#242526] absolute -bottom-0.5 -right-0.5" />
            </div>

            <div className="truncate">
              <h4 className="font-semibold text-[13px] text-slate-900 dark:text-slate-100 truncate leading-tight flex items-center gap-1">
                {selectedRecipientId === 'ALL' ? 'Canal Geral da Equipe' : (selectedUser?.name || selectedUser?.email.split('@')[0])}
                {selectedRecipientId !== 'ALL' && (
                  <span title="Conversa Privada">
                    <Lock className="w-3 h-3 text-blue-500 shrink-0" />
                  </span>
                )}
              </h4>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 leading-none mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {selectedRecipientId === 'ALL' ? 'Canal Público da Equipe' : 'Conversa Privada Direta'}
              </p>
            </div>
          </div>
        )}

        {/* Window Controls */}
        <div className="flex items-center gap-0.5">
          {viewMode === 'chat' && (
            <button
              onClick={() => {
                setViewMode('inbox');
                fetchConversations();
              }}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
              title="Ver todos os contatos"
            >
              <Users className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
            title="Minimizar chat"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          VIEW 1: CONTACTS & INBOX LIST
      ──────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'inbox' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#18191a]">
          
          {/* Search Bar */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar contatos..."
                className="w-full bg-[#f0f2f5] dark:bg-[#242526] text-slate-900 dark:text-slate-100 text-xs rounded-full pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent placeholder-slate-400"
              />
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            
            {/* 1. Canal Geral Pin */}
            <button
              onClick={() => handleOpenConversation('ALL')}
              className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer ${
                selectedRecipientId === 'ALL' 
                  ? 'bg-blue-50/80 dark:bg-blue-950/40' 
                  : 'hover:bg-slate-100 dark:hover:bg-[#242526]'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#18191a] absolute bottom-0 right-0" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                    🌐 Canal Geral da Equipe
                  </span>
                  {generalLastMessage && (
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                      {new Date(generalLastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {generalLastMessage ? (
                    `${generalLastMessage.senderName || 'Membro'}: ${generalLastMessage.content || 'Anexo'}`
                  ) : (
                    'Chat compartilhado com todos os membros'
                  )}
                </p>
              </div>
            </button>

            {/* Separator / Section Label */}
            <div className="px-3 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Conversas Privadas (1 a 1)
              </span>
              <span className="text-[10px] text-slate-400">
                {filteredUsers.length} contatos
              </span>
            </div>

            {/* 2. Direct Private Contacts List */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-400">
                {searchQuery ? 'Nenhum contato encontrado com este nome.' : 'Nenhum outro usuário cadastrado no sistema.'}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const conv = conversations.find(c => c.user.id === user.id);
                const hasUnread = (conv?.unreadCount || 0) > 0;
                const lastMsg = conv?.lastMessage;

                return (
                  <button
                    key={user.id}
                    onClick={() => handleOpenConversation(user.id, user)}
                    className="w-full p-2.5 rounded-xl flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-[#242526] transition-colors text-left cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs ${getAvatarBg(user.name || user.email)}`}>
                        {getInitials(user.name || '', user.email)}
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#18191a] absolute bottom-0 right-0" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`font-semibold text-xs truncate ${hasUnread ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
                            {user.name || user.email.split('@')[0]}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                            {user.role}
                          </span>
                        </div>
                        {lastMsg && (
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                            {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-[11px] truncate ${hasUnread ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                          {lastMsg ? (
                            lastMsg.senderId === currentUser?.id ? `Você: ${lastMsg.content}` : lastMsg.content
                          ) : (
                            <span className="text-blue-500/80 dark:text-blue-400/80 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5 inline" /> Iniciar conversa privada
                            </span>
                          )}
                        </p>
                        {hasUnread && (
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                            {conv?.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}

          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          VIEW 2: ACTIVE CONVERSATION (MESSENGER CHAT BOX)
      ──────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#ffffff] dark:bg-[#18191a]">
          
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-50/50 dark:bg-[#18191a]">
            
            {/* Private Chat Privacy Badge */}
            {selectedRecipientId !== 'ALL' && selectedUser && (
              <div className="my-2 p-2.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-center">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white mx-auto mb-1 flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                  Conversa Privada e Criptografada
                </p>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-300/70 mt-0.5">
                  As mensagens trocadas com <strong>{selectedUser.name || selectedUser.email}</strong> são 100% privadas e visíveis apenas para vocês dois.
                </p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-xs text-slate-400">Carregando conversa...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#242526] text-slate-400 mx-auto mb-2 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nenhuma mensagem ainda</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedRecipientId === 'ALL' 
                    ? 'Envie a primeira mensagem no Canal Geral da Equipe!'
                    : `Inicie uma conversa privada com ${selectedUser?.name || selectedUser?.email}!`
                  }
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.senderId === currentUser?.id;
                const prevMsg = messages[index - 1];
                const isFirstFromSender = !prevMsg || prevMsg.senderId !== msg.senderId;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    {/* Sender Name for incoming messages in General Channel */}
                    {!isMe && isFirstFromSender && selectedRecipientId === 'ALL' && (
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-9 mb-1">
                        {msg.senderName || msg.senderEmail}
                      </span>
                    )}

                    <div className={`flex items-end gap-1.5 max-w-[85%] group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      
                      {/* Avatar on other's messages */}
                      {!isMe && (
                        <div className="shrink-0 mb-0.5">
                          {isFirstFromSender ? (
                            <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold shadow-xs ${getAvatarBg(msg.senderName || 'U')}`}>
                              {getInitials(msg.senderName || '', msg.senderEmail || '')}
                            </div>
                          ) : (
                            <div className="w-6 h-6" />
                          )}
                        </div>
                      )}

                      {/* Message Bubble (Facebook Messenger Styling) */}
                      <div
                        className={`relative rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-xs break-words whitespace-pre-wrap ${
                          isMe
                            ? 'bg-[#0084ff] text-white rounded-br-xs'
                            : 'bg-[#f0f2f5] dark:bg-[#3a3b3c] text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/50 dark:border-transparent'
                        }`}
                      >
                        {/* Text Message */}
                        {msg.type === 'text' && <p>{msg.content}</p>}

                        {/* Image Attachment */}
                        {msg.type === 'image' && msg.mediaUrl && (
                          <div className="space-y-1">
                            <img
                              src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                              alt="Anexo"
                              className="rounded-xl max-h-48 object-cover w-full cursor-pointer hover:opacity-95 transition-opacity border border-black/10"
                              onClick={() => window.open(`${API_URL.replace('/api', '')}${msg.mediaUrl}`, '_blank')}
                            />
                            {msg.content && msg.content !== 'Imagem enviada' && (
                              <p className="text-xs pt-1">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {/* Audio Voice Note */}
                        {msg.type === 'audio' && msg.mediaUrl && (
                          <div className="flex items-center gap-2.5 py-0.5 min-w-[170px]">
                            <button
                              onClick={() => {
                                if (playingAudioId === msg.id) {
                                  if (audioRef.current) audioRef.current.pause();
                                  setPlayingAudioId(null);
                                } else {
                                  if (audioRef.current) audioRef.current.pause();
                                  const audio = new Audio(`${API_URL.replace('/api', '')}${msg.mediaUrl}`);
                                  audioRef.current = audio;
                                  audio.play();
                                  setPlayingAudioId(msg.id);
                                  audio.onended = () => setPlayingAudioId(null);
                                }
                              }}
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-transform hover:scale-105 ${
                                isMe ? 'bg-white text-blue-600' : 'bg-[#0084ff] text-white'
                              }`}
                            >
                              {playingAudioId === msg.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                            </button>
                            
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[11px] font-medium">
                                <span>Áudio de voz</span>
                                <span className="opacity-80 text-[10px]">{msg.duration ? `${msg.duration}s` : ''}</span>
                              </div>
                              <div className={`h-1 w-full rounded-full mt-1 ${isMe ? 'bg-white/40' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <div className={`h-full rounded-full ${playingAudioId === msg.id ? 'w-full animate-pulse bg-current' : 'w-1/3 bg-current'}`} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Message Time & Checkmark */}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${isMe ? 'text-blue-100' : 'text-slate-400 dark:text-slate-400'}`}>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && <CheckCheck className="w-3 h-3 opacity-90" />}
                        </div>
                      </div>

                      {/* Delete Message Action (on hover) */}
                      {(isMe || currentUser?.role === 'ADMIN') && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity cursor-pointer"
                          title="Excluir mensagem"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Emoji Quick Bar Popup */}
          {showEmojiPicker && (
            <div className="px-3 py-2 bg-white dark:bg-[#242526] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                {quickEmojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setInputText(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-lg hover:scale-125 transition-transform p-1 rounded hover:bg-slate-100 dark:hover:bg-[#3a3b3c] cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowEmojiPicker(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────────────
              INPUT FOOTER BAR (Facebook Messenger Style)
          ──────────────────────────────────────────────────────────────────────── */}
          <div className="p-2.5 bg-white dark:bg-[#242526] border-t border-slate-100 dark:border-slate-800 shrink-0">
            {isRecording ? (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-full px-4 py-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                  <span>Gravando... ({recordingDuration}s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelRecording}
                    className="px-2.5 py-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer shadow-xs"
                  >
                    Enviar Áudio
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Upload Image Icon */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full text-[#0084ff] hover:bg-blue-50 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                  title="Enviar foto ou imagem"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                {/* Audio Record Icon */}
                <button
                  onClick={startRecording}
                  className="p-2 rounded-full text-[#0084ff] hover:bg-blue-50 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                  title="Gravar áudio de voz"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Emoji Picker Toggle */}
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                  title="Inserir emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {/* Text Input Pill */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage('text');
                    }
                  }}
                  placeholder="Aa"
                  className="flex-1 bg-[#f0f2f5] dark:bg-[#3a3b3c] text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] rounded-full px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent placeholder-slate-400"
                />

                {/* Send Button or Quick Like Thumb */}
                {inputText.trim() ? (
                  <button
                    onClick={() => handleSendMessage('text')}
                    className="p-2 rounded-full bg-[#0084ff] hover:bg-[#0073e6] text-white transition-all shadow-xs cursor-pointer shrink-0"
                    title="Enviar mensagem"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendMessage('text', undefined, undefined, undefined, undefined, '👍')}
                    className="p-2 rounded-full text-[#0084ff] hover:bg-blue-50 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer shrink-0 text-base"
                    title="Enviar curtida rápida"
                  >
                    👍
                  </button>
                )}

              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
