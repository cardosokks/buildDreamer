import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API_URL } from '../config';
import { 
  MessageSquare, Send, Mic, Image as ImageIcon, FileText, Paperclip, X, Minus, 
  Maximize2, Minimize2, Users, Lock, Globe, Play, Pause, Trash2, Smile, Search, 
  ShieldCheck, CheckCheck, ArrowLeft, MoreVertical, Pin, PinOff, Reply, Copy, 
  Edit3, Download, Volume2, VolumeX, Sparkles, CornerDownRight, Check
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

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
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
    type: string;
  } | null;
  reactions?: MessageReaction[];
  pinned?: boolean;
  isEdited?: boolean;
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
  const { success, error, notify } = useNotification();

  // Navigation states
  const [viewMode, setViewMode] = useState<'inbox' | 'chat'>('inbox');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpandedWidth, setIsExpandedWidth] = useState(false);

  // Active recipient: 'ALL' or specific user ID
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);

  // Data states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [allUsers, setAllUsers] = useState<TeamUser[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [generalLastMessage, setGeneralLastMessage] = useState<any>(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'private' | 'unread'>('all');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Input, Reply, Edit states
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Emoji & Floating menu states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [actionMenuMsgId, setActionMenuMsgId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Audio recording & playback state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Record<string, { userName: string; timestamp: number }>>({});
  const typingTimeoutRef = useRef<any>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const reactionEmojis = ['❤️', '👍', '🔥', '😂', '😮', '😢', '👏', '🎉', '🚀', '🙏'];

  // Sound synthesis
  const playSoundEffect = (type: 'sent' | 'received') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'sent') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch {}
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Scroll to specific message when clicking reply quote
  const scrollToMessage = (msgId: string) => {
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  // Socket Connection & Realtime Listeners
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

      // Receive Message
      socket.on('receive_message', (msg: ChatMessage) => {
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
          if (msg.senderId !== currentUser?.id) {
            playSoundEffect('received');
          }
        } else {
          if (msg.senderId !== currentUser?.id) {
            playSoundEffect('received');
          }
        }
        fetchConversations();
      });

      // Typing Indicator
      socket.on('user_typing', (data: { userId: string; userName: string; recipientId: string; isTyping: boolean }) => {
        if (data.userId === currentUser?.id) return;
        const matchesCurrentChat = 
          (selectedRecipientId === 'ALL' && data.recipientId === 'ALL') ||
          (selectedRecipientId === data.userId && data.recipientId === currentUser?.id);

        if (matchesCurrentChat) {
          setTypingUsers(prev => {
            const next = { ...prev };
            if (data.isTyping) {
              next[data.userId] = { userName: data.userName, timestamp: Date.now() };
            } else {
              delete next[data.userId];
            }
            return next;
          });
        }
      });

      // Reaction Updated
      socket.on('message_reaction_updated', (data: { messageId: string; reactions: MessageReaction[] }) => {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
      });

      // Pin Updated
      socket.on('message_pinned_updated', (data: { messageId: string; pinned: boolean }) => {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, pinned: data.pinned } : m));
      });

      // Delete Message
      socket.on('message_deleted', (data: { messageId: string }) => {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
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
  }, [viewMode]);

  // Clean expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([id, val]) => {
          if (now - val.timestamp > 3000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch users & conversations
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.users) {
        setAllUsers(data.users);
        setUsers(data.users.filter((u: TeamUser) => u.id !== currentUser?.id));
      }
    } catch {}
  };

  // Escutar atualizações de perfil disparadas nas configurações
  useEffect(() => {
    const handleProfileUpdated = () => {
      fetchUsers();
      fetchConversations();
      if (selectedRecipientId) {
        fetchMessages(selectedRecipientId);
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('user_profile_updated', handleProfileUpdated);
  }, [selectedRecipientId, token]);

  const resolveSenderName = (msg: { senderId: string; senderName?: string; senderEmail?: string }) => {
    if (msg.senderId === currentUser?.id && currentUser?.name) {
      return currentUser.name;
    }
    const found = allUsers.find(u => u.id === msg.senderId) || users.find(u => u.id === msg.senderId);
    if (found?.name) return found.name;
    return msg.senderName || msg.senderEmail?.split('@')[0] || 'Membro';
  };

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

  const handleOpenConversation = (recipientId: string, user?: TeamUser) => {
    setSelectedRecipientId(recipientId);
    setSelectedUser(user || null);
    setViewMode('chat');
    setIsMinimized(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setChatSearchOpen(false);
    setChatSearchQuery('');
    fetchMessages(recipientId);
  };

  // Handle Typing Broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (socketRef.current) {
      socketRef.current.emit('typing', {
        userId: currentUser?.id,
        userName: currentUser?.name || currentUser?.email?.split('@')[0] || 'Alguém',
        recipientId: selectedRecipientId,
        isTyping: true
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing', {
          userId: currentUser?.id,
          userName: currentUser?.name || currentUser?.email?.split('@')[0],
          recipientId: selectedRecipientId,
          isTyping: false
        });
      }, 1500);
    }
  };

  // Send or Edit Message
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

    // Handle Edit Mode
    if (editingMessage) {
      try {
        const res = await fetch(`${API_URL}/api/chat/messages/${editingMessage.id}/edit`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content: textToSend.trim() })
        });
        const data = await res.json();
        if (res.ok && data.message) {
          setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: textToSend.trim(), isEdited: true } : m));
          setEditingMessage(null);
          setInputText('');
          success('Mensagem editada com sucesso!');
        }
      } catch {
        error('Falha ao editar mensagem');
      }
      return;
    }

    try {
      const payload = {
        content: type === 'text' 
          ? textToSend.trim() 
          : (type === 'audio' ? 'Mensagem de voz' : type === 'image' ? (fileName || 'Imagem enviada') : (fileName || 'Arquivo enviado')),
        type,
        recipientId: selectedRecipientId,
        mediaUrl: mediaUrl || null,
        duration: duration || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          senderName: resolveSenderName(replyingTo),
          content: replyingTo.content,
          type: replyingTo.type
        } : null
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
        setReplyingTo(null);
        setShowEmojiPicker(false);
        setMessages(prev => [...prev, data.message]);
        playSoundEffect('sent');

        if (socketRef.current) {
          socketRef.current.emit('send_message', data.message);
          socketRef.current.emit('typing', {
            userId: currentUser?.id,
            userName: currentUser?.name || currentUser?.email,
            recipientId: selectedRecipientId,
            isTyping: false
          });
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

  // Toggle Emoji Reaction on a message
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${msgId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: data.reactions } : m));
        setActiveReactionMsgId(null);
        setActionMenuMsgId(null);

        if (socketRef.current) {
          socketRef.current.emit('message_reaction', {
            messageId: msgId,
            reactions: data.reactions,
            recipientId: selectedRecipientId,
            senderId: currentUser?.id
          });
        }
      }
    } catch {}
  };

  // Toggle Pinned Message
  const handleTogglePin = async (msg: ChatMessage) => {
    const newPinned = !msg.pinned;
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${msg.id}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pinned: newPinned })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pinned: newPinned } : m));
        setActionMenuMsgId(null);
        success(newPinned ? 'Mensagem fixada no topo!' : 'Mensagem desafixada');

        if (socketRef.current) {
          socketRef.current.emit('message_pinned', {
            messageId: msg.id,
            pinned: newPinned,
            recipientId: selectedRecipientId,
            senderId: currentUser?.id
          });
        }
      }
    } catch {}
  };

  // Delete message
  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setActionMenuMsgId(null);
        success('Mensagem apagada');
        fetchConversations();

        if (socketRef.current) {
          socketRef.current.emit('message_deleted', {
            messageId: msgId,
            recipientId: selectedRecipientId,
            senderId: currentUser?.id
          });
        }
      }
    } catch {}
  };

  // Copy message text to clipboard
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    success('Texto copiado para a área de transferência!');
    setActionMenuMsgId(null);
  };

  // File & Image Uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
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
        await handleSendMessage(
          isImage ? 'image' : 'file',
          data.url,
          undefined,
          data.fileName || file.name,
          data.fileSize || file.size
        );
        success(isImage ? 'Imagem enviada!' : 'Arquivo compartilhado!');
      } else {
        error(data.error || 'Erro ao enviar arquivo');
      }
    } catch {
      error('Falha ao enviar arquivo');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Voice recording
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
      error('Permissão de microfone negada.');
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

  // Audio Playback with speed controls
  const handlePlayAudio = (msg: ChatMessage) => {
    if (!msg.mediaUrl) return;

    if (playingAudioId === msg.id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(`${API_URL.replace('/api', '')}${msg.mediaUrl}`);
      audioRef.current = audio;
      audio.playbackRate = playbackSpeed;
      audio.play();
      setPlayingAudioId(msg.id);

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setPlayingAudioId(null);
        setAudioProgress(0);
      };
    }
  };

  const cyclePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1.0, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Format bytes
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Pinned messages in current conversation
  const pinnedMessages = useMemo(() => {
    return messages.filter(m => m.pinned);
  }, [messages]);

  // Filtered inbox users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const term = searchQuery.toLowerCase();
      const matchesSearch = (u.name && u.name.toLowerCase().includes(term)) || u.email.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (inboxFilter === 'unread') {
        const conv = conversations.find(c => c.user.id === u.id);
        return (conv?.unreadCount || 0) > 0;
      }
      return true;
    });
  }, [users, searchQuery, inboxFilter, conversations]);

  // Filtered messages in active conversation (if chat search is open)
  const displayedMessages = useMemo(() => {
    if (!chatSearchOpen || !chatSearchQuery.trim()) return messages;
    const term = chatSearchQuery.toLowerCase();
    return messages.filter(m => 
      m.content.toLowerCase().includes(term) || 
      (m.fileName && m.fileName.toLowerCase().includes(term)) ||
      m.senderName.toLowerCase().includes(term)
    );
  }, [messages, chatSearchOpen, chatSearchQuery]);

  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

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
  // MINIMIZED FLOATING DOCK (Facebook Messenger Dock Bar)
  // ─────────────────────────────────────────────────────────────────────────────
  const activeUser = selectedRecipientId !== 'ALL'
    ? (allUsers.find(u => u.id === selectedRecipientId) || users.find(u => u.id === selectedRecipientId) || selectedUser)
    : null;

  if (isMinimized) {
    const displayName = selectedRecipientId === 'ALL' 
      ? 'Canal Geral' 
      : (activeUser?.name || activeUser?.email.split('@')[0] || 'Chat Privado');

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
                {getInitials(displayName, activeUser?.email || '')}
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
            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold animate-pulse">
              {totalUnreadCount}
            </span>
          )}
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
            title="Maximizar"
          >
            <Maximize2 className="w-3.5 h-3.5" />
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
  // FULL PROFESSIONAL MESSENGER DOCKED POPUP WINDOW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div 
      className={`fixed bottom-0 right-3 sm:right-6 z-50 ${isExpandedWidth ? 'w-[96vw] sm:w-[480px]' : 'w-[94vw] sm:w-[370px]'} h-[540px] max-h-[calc(100vh-65px)] bg-white dark:bg-[#18191a] border border-slate-200/90 dark:border-slate-700/80 rounded-t-2xl shadow-[0_16px_48px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 font-sans transition-[width]`}
      onClick={() => {
        setActionMenuMsgId(null);
        setActiveReactionMsgId(null);
      }}
    >
      
      {/* ────────────────────────────────────────────────────────────────────────
          HEADER SECTION (Professional Facebook Messenger Style)
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-[#242526] border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shadow-xs select-none shrink-0">
        
        {viewMode === 'inbox' ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[13px] text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1.5">
                Mensagens da Equipe
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {users.length} {users.length === 1 ? 'membro disponível' : 'membros disponíveis'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <button
              onClick={() => {
                setViewMode('inbox');
                fetchConversations();
              }}
              className="p-1 -ml-1 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
              title="Voltar para a lista de conversas"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              {selectedRecipientId === 'ALL' ? (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
                  <Globe className="w-4 h-4" />
                </div>
              ) : (
                <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-[11px] font-bold shadow-xs ${getAvatarBg(activeUser?.name || 'U')}`}>
                  {getInitials(activeUser?.name || '', activeUser?.email || '')}
                </div>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#242526] absolute -bottom-0.5 -right-0.5" />
            </div>

            <div className="truncate flex-1">
              <h4 className="font-semibold text-[13px] text-slate-900 dark:text-slate-100 truncate leading-tight flex items-center gap-1">
                {selectedRecipientId === 'ALL' ? 'Canal Geral da Equipe' : (activeUser?.name || activeUser?.email.split('@')[0])}
                {selectedRecipientId !== 'ALL' && (
                  <span title="Conversa Privada e Direta">
                    <Lock className="w-3 h-3 text-blue-500 shrink-0" />
                  </span>
                )}
              </h4>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 leading-none mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {selectedRecipientId === 'ALL' ? 'Canal Público da Equipe' : 'Conversa Privada • Online'}
              </p>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-0.5">
          {viewMode === 'chat' && (
            <>
              {/* Search Inside Chat */}
              <button
                onClick={() => setChatSearchOpen(!chatSearchOpen)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${chatSearchOpen ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c]'}`}
                title="Pesquisar nesta conversa"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                title={soundEnabled ? 'Sons ativados' : 'Sons silenciados'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-500" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {/* Width Expand Toggle */}
              <button
                onClick={() => setIsExpandedWidth(!isExpandedWidth)}
                className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                title={isExpandedWidth ? 'Tamanho padrão' : 'Expandir largura'}
              >
                {isExpandedWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
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
          VIEW 1: CONTACTS & INBOX LIST (TABELAS DE CONVERSAS E MEMBROS)
      ──────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'inbox' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#18191a]">
          
          {/* Search & Filter Bar */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/60 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar pessoas e conversas..."
                className="w-full bg-[#f0f2f5] dark:bg-[#242526] text-slate-900 dark:text-slate-100 text-xs rounded-full pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent placeholder-slate-400"
              />
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setInboxFilter('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${inboxFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#242526] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setInboxFilter('private')}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${inboxFilter === 'private' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#242526] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
              >
                <Lock className="w-2.5 h-2.5" /> Privadas
              </button>
              {totalUnreadCount > 0 && (
                <button
                  onClick={() => setInboxFilter('unread')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${inboxFilter === 'unread' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300'}`}
                >
                  Não lidas ({totalUnreadCount})
                </button>
              )}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            
            {/* 1. Canal Geral Pin */}
            {inboxFilter !== 'private' && (
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
                      'Canal corporativo aberto a todos os membros'
                    )}
                  </p>
                </div>
              </button>
            )}

            {/* Separator / Section Label */}
            <div className="px-3 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Conversas Privadas e Diretas (1 a 1)
              </span>
              <span className="text-[10px] text-slate-400">
                {filteredUsers.length} membros
              </span>
            </div>

            {/* 2. Direct Private Contacts List */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-400">
                {searchQuery ? 'Nenhum membro encontrado com este termo.' : 'Nenhum contato disponível no momento.'}
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
                            <span className="text-blue-500 dark:text-blue-400 flex items-center gap-1">
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
          VIEW 2: ACTIVE CHAT WINDOW (PROFESSIONAL MESSENGER EXPERIENCE)
      ──────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#18191a]">
          
          {/* Inline Chat Search Header Bar */}
          {chatSearchOpen && (
            <div className="p-2 bg-slate-50 dark:bg-[#242526] border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Buscar mensagens nesta conversa..."
                autoFocus
                className="flex-1 bg-white dark:bg-[#18191a] text-xs text-slate-800 dark:text-slate-100 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 shrink-0">
                {displayedMessages.length} {displayedMessages.length === 1 ? 'resultado' : 'resultados'}
              </span>
              <button
                onClick={() => { setChatSearchOpen(false); setChatSearchQuery(''); }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pinned Messages Header Strip */}
          {pinnedMessages.length > 0 && (
            <div className="px-3 py-1.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 select-none">
              <div 
                onClick={() => scrollToMessage(pinnedMessages[0].id)}
                className="flex items-center gap-2 truncate cursor-pointer hover:underline"
              >
                <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0 fill-amber-600" />
                <span className="font-semibold text-[11px] shrink-0">Fixada:</span>
                <span className="text-[11px] truncate opacity-90">{pinnedMessages[0].content}</span>
              </div>
              {pinnedMessages.length > 1 && (
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0 ml-1">
                  +{pinnedMessages.length - 1}
                </span>
              )}
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50/40 dark:bg-[#18191a]">
            
            {/* Privacy Shield Info Card */}
            {selectedRecipientId !== 'ALL' && activeUser && (
              <div className="my-2 p-2.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-center">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white mx-auto mb-1 flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                  Conversa Privada e Criptografada
                </p>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-300/70 mt-0.5">
                  As mensagens com <strong>{activeUser.name || activeUser.email}</strong> são 100% isoladas e privadas.
                </p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-xs text-slate-400">Carregando mensagens...</div>
            ) : displayedMessages.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#242526] text-slate-400 mx-auto mb-2 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {chatSearchQuery ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem ainda'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedRecipientId === 'ALL' 
                    ? 'Envie uma mensagem no canal da equipe!'
                    : `Comece uma conversa privada com ${activeUser?.name || activeUser?.email}!`
                  }
                </p>
              </div>
            ) : (
              displayedMessages.map((msg, index) => {
                const isMe = msg.senderId === currentUser?.id;
                const prevMsg = displayedMessages[index - 1];
                const isFirstFromSender = !prevMsg || prevMsg.senderId !== msg.senderId;
                const isHighlighted = highlightedMsgId === msg.id;

                // Aggregate reactions
                const reactionCounts: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
                if (Array.isArray(msg.reactions)) {
                  msg.reactions.forEach(r => {
                    if (!reactionCounts[r.emoji]) {
                      reactionCounts[r.emoji] = { count: 0, users: [], hasReacted: false };
                    }
                    reactionCounts[r.emoji].count += 1;
                    reactionCounts[r.emoji].users.push(r.userName);
                    if (r.userId === currentUser?.id) {
                      reactionCounts[r.emoji].hasReacted = true;
                    }
                  });
                }

                return (
                  <div 
                    key={msg.id} 
                    ref={el => { messageRefs.current[msg.id] = el; }}
                    className={`flex flex-col transition-all duration-300 ${isMe ? 'items-end' : 'items-start'} ${isHighlighted ? 'bg-blue-100/50 dark:bg-blue-950/60 -mx-2 px-2 py-1 rounded-xl' : ''}`}
                  >
                    
                    {/* Sender Name for General Channel */}
                    {!isMe && isFirstFromSender && selectedRecipientId === 'ALL' && (
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-8 mb-1 flex items-center gap-1">
                        {resolveSenderName(msg)}
                        {msg.senderRole && (
                          <span className="text-[8px] px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {msg.senderRole}
                          </span>
                        )}
                      </span>
                    )}

                    <div className={`relative flex items-end gap-1.5 max-w-[88%] group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      
                      {/* Avatar on other's messages */}
                      {!isMe && (
                        <div className="shrink-0 mb-0.5">
                          {isFirstFromSender ? (
                            <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold shadow-xs ${getAvatarBg(resolveSenderName(msg))}`}>
                              {getInitials(resolveSenderName(msg), msg.senderEmail || '')}
                            </div>
                          ) : (
                            <div className="w-6 h-6" />
                          )}
                        </div>
                      )}

                      {/* ──────────────────────────────────────────────────
                          FLOATING ACTION TOOLBAR ON HOVER (Messenger Style)
                      ────────────────────────────────────────────────── */}
                      <div 
                        className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-0.5 bg-white dark:bg-[#242526] border border-slate-200 dark:border-slate-700 shadow-md rounded-full px-1.5 py-0.5 select-none ${isMe ? 'right-full mr-1.5' : 'left-full ml-1.5'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Quick Reaction Button */}
                        <button
                          onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                          className="p-1 rounded-full text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                          title="Reagir com emoji"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Reply / Quote Button */}
                        <button
                          onClick={() => {
                            setReplyingTo(msg);
                            setEditingMessage(null);
                          }}
                          className="p-1 rounded-full text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                          title="Responder"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>

                        {/* Pin Message Button */}
                        <button
                          onClick={() => handleTogglePin(msg)}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${msg.pinned ? 'text-amber-500 hover:text-amber-600' : 'text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-[#3a3b3c]'}`}
                          title={msg.pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${msg.pinned ? 'fill-amber-500' : ''}`} />
                        </button>

                        {/* More Menu Toggle */}
                        <button
                          onClick={() => setActionMenuMsgId(actionMenuMsgId === msg.id ? null : msg.id)}
                          className="p-1 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                          title="Mais opções"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Floating Reaction Selector Popover */}
                      {activeReactionMsgId === msg.id && (
                        <div 
                          className="absolute -top-9 z-30 flex items-center gap-1 bg-white dark:bg-[#242526] border border-slate-200 dark:border-slate-700 shadow-xl rounded-full px-2 py-1 animate-in zoom-in-90 duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {reactionEmojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className="text-base hover:scale-130 transition-transform p-0.5 cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Dropdown Actions Menu */}
                      {actionMenuMsgId === msg.id && (
                        <div 
                          className={`absolute top-6 z-30 w-36 bg-white dark:bg-[#242526] border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100 ${isMe ? 'right-0' : 'left-0'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleCopyText(msg.content)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" /> Copiar texto
                          </button>

                          {isMe && msg.type === 'text' && (
                            <button
                              onClick={() => {
                                setEditingMessage(msg);
                                setInputText(msg.content);
                                setReplyingTo(null);
                                setActionMenuMsgId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Editar
                            </button>
                          )}

                          <button
                            onClick={() => handleTogglePin(msg)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#3a3b3c] cursor-pointer"
                          >
                            <Pin className="w-3.5 h-3.5 text-slate-400" /> {msg.pinned ? 'Desafixar' : 'Fixar'}
                          </button>

                          {(isMe || currentUser?.role === 'ADMIN') && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Apagar
                            </button>
                          )}
                        </div>
                      )}

                      {/* ──────────────────────────────────────────────────
                          MESSAGE BUBBLE CONTENT
                      ────────────────────────────────────────────────── */}
                      <div className="flex flex-col">
                        
                        {/* Reply Quote Banner Inside Bubble */}
                        {msg.replyTo && (
                          <div 
                            onClick={() => scrollToMessage(msg.replyTo!.id)}
                            className={`mb-1 px-2.5 py-1.5 rounded-xl border-l-3 text-[11px] cursor-pointer transition-opacity hover:opacity-90 ${
                              isMe 
                                ? 'bg-blue-700/60 border-white text-blue-100' 
                                : 'bg-slate-200/80 dark:bg-slate-700/80 border-blue-500 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className="font-semibold block text-[10px]">
                              {msg.replyTo.senderName}
                            </span>
                            <span className="truncate block opacity-85">
                              {msg.replyTo.content || 'Anexo'}
                            </span>
                          </div>
                        )}

                        <div
                          className={`relative rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-xs break-words ${
                            isMe
                              ? 'bg-[#0084ff] text-white rounded-br-xs'
                              : 'bg-[#f0f2f5] dark:bg-[#3a3b3c] text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/50 dark:border-transparent'
                          }`}
                        >
                          {/* Pinned Marker Badge */}
                          {msg.pinned && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                              <Pin className="w-2.5 h-2.5 fill-white" />
                            </span>
                          )}

                          {/* Text Content */}
                          {msg.type === 'text' && (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Image Attachment */}
                          {msg.type === 'image' && msg.mediaUrl && (
                            <div className="space-y-1">
                              <img
                                src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                                alt="Anexo"
                                className="rounded-xl max-h-52 object-cover w-full cursor-pointer hover:opacity-95 transition-opacity border border-black/10"
                                onClick={() => setLightboxImage(`${API_URL.replace('/api', '')}${msg.mediaUrl}`)}
                              />
                              {msg.content && msg.content !== 'Imagem enviada' && (
                                <p className="text-xs pt-1">{msg.content}</p>
                              )}
                            </div>
                          )}

                          {/* Document / File Attachment */}
                          {msg.type === 'file' && msg.mediaUrl && (
                            <a
                              href={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                              download={msg.fileName || 'arquivo'}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors no-underline ${isMe ? 'bg-blue-700/60 text-white hover:bg-blue-700' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300'}`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-xs truncate block">{msg.fileName || 'Documento'}</span>
                                <span className="text-[10px] opacity-80">{formatFileSize(msg.fileSize)}</span>
                              </div>
                              <Download className="w-3.5 h-3.5 shrink-0 opacity-80" />
                            </a>
                          )}

                          {/* Audio Voice Note with Wave & Speed Toggle */}
                          {msg.type === 'audio' && msg.mediaUrl && (
                            <div className="flex items-center gap-2.5 py-0.5 min-w-[210px]">
                              <button
                                onClick={() => handlePlayAudio(msg)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-transform hover:scale-105 ${
                                  isMe ? 'bg-white text-blue-600' : 'bg-[#0084ff] text-white'
                                }`}
                              >
                                {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                              </button>
                              
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-[11px] font-medium">
                                  <span>Mensagem de voz</span>
                                  <span className="opacity-80 text-[10px]">{msg.duration ? `${msg.duration}s` : ''}</span>
                                </div>
                                <div className={`h-1.5 w-full rounded-full mt-1.5 overflow-hidden ${isMe ? 'bg-white/30' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                  <div 
                                    className="h-full bg-current transition-all duration-100" 
                                    style={{ width: playingAudioId === msg.id ? `${audioProgress}%` : '0%' }}
                                  />
                                </div>
                              </div>

                              {/* Speed Button */}
                              <button
                                onClick={cyclePlaybackSpeed}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200'}`}
                                title="Alterar velocidade de reprodução"
                              >
                                {playbackSpeed}x
                              </button>
                            </div>
                          )}

                          {/* Message Time, Edited Tag, & Checkmark */}
                          <div className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${isMe ? 'text-blue-100' : 'text-slate-400 dark:text-slate-400'}`}>
                            {msg.isEdited && <span className="italic opacity-80">(editada)</span>}
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && <CheckCheck className="w-3 h-3 opacity-90" />}
                          </div>
                        </div>

                        {/* Reaction Badges Container */}
                        {Object.keys(reactionCounts).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(reactionCounts).map(([emoji, data]) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                title={`Reações: ${data.users.join(', ')}`}
                                className={`px-1.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 shadow-xs border transition-transform hover:scale-110 cursor-pointer ${
                                  data.hasReacted 
                                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-bold' 
                                    : 'bg-white dark:bg-[#242526] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px]">{data.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                      </div>

                    </div>
                  </div>
                );
              })
            )}

            {/* Realtime Typing Indicator */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="flex items-center gap-2 py-1 animate-in fade-in duration-200">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  {Object.values(typingUsers).map(u => u.userName).join(', ')} está digitando...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Reply or Edit Banner Above Input */}
          {(replyingTo || editingMessage) && (
            <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 border-t border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {editingMessage ? (
                  <Edit3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                ) : (
                  <CornerDownRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                )}
                <div className="truncate">
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    {editingMessage ? 'Editando mensagem:' : `Respondendo a ${replyingTo ? resolveSenderName(replyingTo) : ''}:`}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 ml-1 truncate">
                    {editingMessage ? editingMessage.content : replyingTo?.content}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setEditingMessage(null);
                  setInputText('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Emoji Quick Bar Popup */}
          {showEmojiPicker && (
            <div className="px-3 py-2 bg-white dark:bg-[#242526] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 animate-in slide-in-from-bottom-2 duration-150 select-none">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                {reactionEmojis.map(emoji => (
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
              INPUT FOOTER BAR (Messenger Modern Composer)
          ──────────────────────────────────────────────────────────────────────── */}
          <div className="p-2.5 bg-white dark:bg-[#242526] border-t border-slate-100 dark:border-slate-800 shrink-0">
            {isRecording ? (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-full px-4 py-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                  <span>Gravando áudio ({recordingDuration}s)...</span>
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
                
                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, true)}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={docInputRef}
                  onChange={(e) => handleFileUpload(e, false)}
                  accept=".pdf,.doc,.docx,.zip,.rar,.xls,.xlsx,.txt"
                  className="hidden"
                />

                {/* Upload Image Icon */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full text-[#0084ff] hover:bg-blue-50 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                  title="Enviar imagem / foto"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                {/* Upload Document / File Icon */}
                <button
                  onClick={() => docInputRef.current?.click()}
                  className="p-2 rounded-full text-[#0084ff] hover:bg-blue-50 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                  title="Enviar documento (PDF, ZIP, DOCX...)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Audio Record Icon */}
                <button
                  onClick={startRecording}
                  className="p-2 rounded-full text-[#0084ff] hover:bg-blue-50 dark:hover:bg-[#3a3b3c] transition-colors cursor-pointer"
                  title="Gravar mensagem de áudio"
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
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage('text');
                    }
                  }}
                  placeholder={editingMessage ? 'Editar mensagem...' : 'Escreva uma mensagem...'}
                  className="flex-1 bg-[#f0f2f5] dark:bg-[#3a3b3c] text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] rounded-full px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent placeholder-slate-400"
                />

                {/* Send Button or Quick Like Thumb */}
                {inputText.trim() ? (
                  <button
                    onClick={() => handleSendMessage('text')}
                    className="p-2 rounded-full bg-[#0084ff] hover:bg-[#0073e6] text-white transition-all shadow-xs cursor-pointer shrink-0"
                    title={editingMessage ? 'Salvar edição' : 'Enviar mensagem'}
                  >
                    {editingMessage ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
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

      {/* ────────────────────────────────────────────────────────────────────────
          IMAGE LIGHTBOX MODAL
      ──────────────────────────────────────────────────────────────────────── */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 text-white hover:bg-white/40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={lightboxImage} 
              alt="Visualização" 
              className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </div>
  );
};
