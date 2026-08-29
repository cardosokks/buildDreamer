import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API_URL } from '../config';
import { MessageSquare, Send, Mic, Image as ImageIcon, Paperclip, X, Check, CheckCheck, Trash2, Settings, Users, Globe, Lock, Play, Pause, Volume2, Shield } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
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
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const TeamChatPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { token, user: currentUser } = useAuth();
  const { success, error, notify } = useNotification();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('ALL'); // 'ALL' or user ID
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchMessages();

      // Setup Socket.io connection
      const socket = io(window.location.origin, {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      if (currentUser?.id) {
        socket.emit('join_room', currentUser.id);
      }

      socket.on('receive_message', (msg: ChatMessage) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isOpen, selectedRecipientId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users.filter((u: TeamUser) => u.id !== currentUser?.id));
      }
    } catch {}
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const url = selectedRecipientId === 'ALL'
        ? `${API_URL}/api/chat/messages`
        : `${API_URL}/api/chat/messages?targetUserId=${selectedRecipientId}`;

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

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [selectedRecipientId]);

  const handleSendMessage = async (type: 'text' | 'audio' | 'image' | 'file' = 'text', mediaUrl?: string, duration?: number, fileName?: string, fileSize?: number) => {
    if (type === 'text' && !inputText.trim()) return;

    try {
      const payload = {
        content: type === 'text' ? inputText.trim() : (type === 'audio' ? 'Mensagem de Áudio' : type === 'image' ? 'Imagem enviada' : 'Arquivo enviado'),
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
        if (type === 'text') setInputText('');
        setMessages(prev => [...prev, data.message]);
        
        // Emit via socket
        if (socketRef.current) {
          socketRef.current.emit('send_message', data.message);
        }
        scrollToBottom();
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
        success('Imagem enviada no chat!');
      } else {
        error(data.error || 'Erro ao enviar imagem');
      }
    } catch {
      error('Falha ao enviar imagem');
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
            success('Áudio enviado com sucesso!');
          }
        } catch {
          error('Erro ao enviar áudio');
        }

        // Stop all tracks
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

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        success('Mensagem removida.');
      }
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[var(--bg-card)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-500 flex items-center justify-center border border-purple-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Chat Corporativo e Equipe</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {selectedRecipientId === 'ALL' ? 'Canal Geral da Equipe' : 'Chat Direto (1 a 1)'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Recipient Selector */}
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
        <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Conversar com:</label>
        <select
          value={selectedRecipientId}
          onChange={(e) => setSelectedRecipientId(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
        >
          <option value="ALL">🌐 Canal Geral (Todos os Membros)</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              👤 {u.name || u.email} ({u.role})
            </option>
          ))}
        </select>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[var(--bg-app)]/50">
        {loading ? (
          <div className="text-center py-12 text-xs text-[var(--text-secondary)]">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 px-4">
            <MessageSquare className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-secondary)]">Nenhuma mensagem ainda neste canal. Inicie a conversa abaixo!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    {isMe ? 'Você' : msg.senderName || msg.senderEmail}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)]">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative group ${
                    isMe
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-none'
                  }`}
                >
                  {/* Delete button on hover */}
                  {(isMe || currentUser?.role === 'ADMIN') && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/20 transition-opacity"
                      title="Excluir mensagem"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-current opacity-80" />
                    </button>
                  )}

                  {msg.type === 'text' && <p className="leading-relaxed break-words whitespace-pre-wrap pr-4">{msg.content}</p>}

                  {msg.type === 'image' && msg.mediaUrl && (
                    <div className="space-y-2">
                      <img
                        src={`${API_URL.replace('/api', '')}${msg.mediaUrl}`}
                        alt="Anexo"
                        className="rounded-xl max-h-52 object-cover w-full border border-black/10 cursor-pointer"
                        onClick={() => window.open(`${API_URL.replace('/api', '')}${msg.mediaUrl}`, '_blank')}
                      />
                      {msg.content && <p className="text-xs opacity-90">{msg.content}</p>}
                    </div>
                  )}

                  {msg.type === 'audio' && msg.mediaUrl && (
                    <div className="flex items-center gap-3 py-1 min-w-[200px]">
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
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                          isMe ? 'bg-white text-purple-600' : 'bg-purple-600 text-white'
                        }`}
                      >
                        {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <div className="flex-1">
                        <div className="text-xs font-medium flex items-center justify-between">
                          <span>🎤 Mensagem de Voz</span>
                          <span className="text-[10px] opacity-80">{msg.duration ? `${msg.duration}s` : ''}</span>
                        </div>
                        <div className={`h-1.5 w-full rounded-full mt-1.5 ${isMe ? 'bg-purple-400/50' : 'bg-slate-700/30'}`}>
                          <div className={`h-full rounded-full ${playingAudioId === msg.id ? 'w-full animate-pulse bg-current' : 'w-1/3 bg-current'}`} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer */}
      <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]">
        {isRecording ? (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5 text-red-500 font-medium text-xs">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span>Gravando áudio... ({recordingDuration}s)</span>
            </div>
            <button
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 cursor-pointer shadow"
            >
              Parar e Enviar Áudio
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-purple-500 hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              title="Enviar imagem"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              onClick={startRecording}
              className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-purple-500 hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              title="Gravar áudio"
            >
              <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage('text')}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
            />

            <button
              onClick={() => handleSendMessage('text')}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/20 cursor-pointer"
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
