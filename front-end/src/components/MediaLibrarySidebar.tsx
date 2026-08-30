import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, Plus, Copy, Check, Search, Loader2, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  createdAt?: string;
}

interface MediaLibrarySidebarProps {
  onClose: () => void;
  onSelectImage?: (url: string) => void;
  onInsertImageToCanvas?: (url: string, name: string) => void;
}

export const MediaLibrarySidebar: React.FC<MediaLibrarySidebarProps> = ({
  onClose,
  onSelectImage,
  onInsertImageToCanvas
}) => {
  const { token } = useAuth();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMediaList(data.media || []);
      }
    } catch (err) {
      console.error('Erro ao carregar galeria de mídias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const res = await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          base64Data,
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha no envio da imagem');
      }

      const data = await res.json();
      if (data.media) {
        setMediaList(prev => [data.media, ...prev]);
        const fullUrl = resolveFullImageUrl(data.media.url);
        if (onSelectImage) onSelectImage(fullUrl);
      }
    } catch (err: any) {
      console.error('Erro no upload de mídia MinIO:', err);
      alert(err.message || 'Erro ao enviar imagem.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMedia = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir esta imagem da biblioteca permanentemente?')) return;

    try {
      const res = await fetch(`${API_URL}/api/media/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMediaList(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error('Erro ao excluir mídia:', err);
    }
  };

  const resolveFullImageUrl = (rawUrl: string): string => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const base = (API_URL || window.location.origin).replace(/\/$/, '');
    const pathStr = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${base}${pathStr}`;
  };

  const handleCopyUrl = (url: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = resolveFullImageUrl(url);
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = mediaList.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-80 bg-[#0c0814] border-r border-purple-500/20 h-full flex flex-col z-30 shadow-2xl animate-in slide-in-from-left-3 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/30">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Banco de Imagens</h3>
            <p className="text-[10px] text-slate-400">Galeria & Uploads para o Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={fetchMedia}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Atualizar biblioteca"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar galeria"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Area de Upload */}
      <div className="p-4 border-b border-slate-850 bg-slate-900/30">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enviando Imagem...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Fazer Upload de Imagem</span>
            </>
          )}
        </button>

        {/* Busca */}
        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar imagem pelo nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Lista / Grade de Imagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2 font-mono">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            <span>Carregando mídia...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2 border border-dashed border-slate-850 rounded-xl p-4">
            <ImageIcon className="w-8 h-8 text-slate-600 mb-1" />
            <p className="font-semibold text-slate-400">Nenhuma imagem na biblioteca</p>
            <p className="text-[11px] opacity-70">Clique no botão acima para enviar suas fotos e logotipos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map(media => {
              const fullUrl = resolveFullImageUrl(media.url);

              return (
                <div
                  key={media.id}
                  onClick={() => {
                    if (onSelectImage) onSelectImage(fullUrl);
                    if (onInsertImageToCanvas) onInsertImageToCanvas(fullUrl, media.name);
                  }}
                  className="group bg-slate-950 border border-slate-850 hover:border-purple-500/50 rounded-xl overflow-hidden flex flex-col transition-all cursor-pointer shadow-md relative"
                >
                  <div className="h-28 w-full bg-slate-900 overflow-hidden relative flex items-center justify-center p-1">
                    <img
                      src={fullUrl}
                      alt={media.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2 backdrop-blur-[1px]">
                      {onInsertImageToCanvas && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInsertImageToCanvas(fullUrl, media.name);
                          }}
                          className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors shadow-sm"
                          title="Inserir no Canvas do Editor"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={(e) => handleCopyUrl(media.url, media.id, e)}
                        className="p-1.5 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors"
                        title="Copiar URL da imagem"
                      >
                        {copiedId === media.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={(e) => handleDeleteMedia(media.id, e)}
                        className="p-1.5 bg-red-950/60 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-900 transition-colors"
                        title="Excluir da biblioteca"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-950 border-t border-slate-900">
                    <p className="text-[11px] text-slate-300 font-semibold truncate leading-tight" title={media.name}>
                      {media.name}
                    </p>
                    {media.size && (
                      <span className="text-[9px] text-slate-500 font-mono">
                        {(media.size / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
