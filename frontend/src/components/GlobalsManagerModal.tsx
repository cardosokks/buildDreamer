import React, { useState } from 'react';
import { X, Layers, Code, Check, Globe, Sparkles, RefreshCw, Eye, EyeOff, LayoutTemplate } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

interface GlobalsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialNavbarHtml: string;
  initialFooterHtml: string;
  onSaveGlobals: (navbarHtml: string, footerHtml: string) => void;
}

export const GlobalsManagerModal: React.FC<GlobalsManagerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  initialNavbarHtml,
  initialFooterHtml,
  onSaveGlobals
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'navbar' | 'footer'>('navbar');
  const [navbarHtml, setNavbarHtml] = useState(initialNavbarHtml || '');
  const [footerHtml, setFooterHtml] = useState(initialFooterHtml || '');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/globals`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ navbarHtml, footerHtml })
      });

      if (res.ok) {
        onSaveGlobals(navbarHtml, footerHtml);
        onClose();
      } else {
        alert('Erro ao salvar os blocos globais.');
      }
    } catch (e: any) {
      alert('Falha na requisição: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (type: 'navbar' | 'footer') => {
    if (!confirm(`Deseja restaurar o modelo padrão de ${type === 'navbar' ? 'Navbar' : 'Footer'}?`)) return;
    if (type === 'navbar') {
      setNavbarHtml(`<header class="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center text-white">
  <div class="font-bold text-lg text-purple-400">${projectName}</div>
  <nav class="flex items-center gap-6 text-sm font-medium">
    <a href="index.html" class="hover:text-purple-400 transition-colors">Home</a>
    <a href="servicos.html" class="hover:text-purple-400 transition-colors">Serviços</a>
    <a href="sobre.html" class="hover:text-purple-400 transition-colors">Sobre</a>
    <a href="contato.html" class="hover:text-purple-400 transition-colors">Contato</a>
  </nav>
  <a href="contato.html" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30">Fale Conosco</a>
</header>`);
    } else {
      setFooterHtml(`<footer class="bg-slate-950 border-t border-slate-900 py-10 px-6 text-center text-slate-400 text-xs">
  <div class="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
    <span class="font-semibold text-slate-300">© ${new Date().getFullYear()} ${projectName}. Todos os direitos reservados.</span>
    <div class="flex items-center gap-6">
      <a href="index.html" class="hover:text-white transition-colors">Home</a>
      <a href="contato.html" class="hover:text-white transition-colors">Atendimento</a>
    </div>
  </div>
</footer>`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Gerenciador de Blocos Globais (Template Parts)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30 font-normal">
                  Sincronizado em Todas as Páginas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Altere a Navbar ou o Footer uma única vez para refletir instantaneamente em todo o site.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('navbar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'navbar'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              Header / Navbar Global
            </button>
            <button
              onClick={() => setActiveTab('footer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'footer'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Footer / Rodapé Global
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Ocultar Preview' : 'Exibir Preview'}
            </button>
            <button
              type="button"
              onClick={() => handleReset(activeTab)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-purple-300 bg-slate-800 hover:bg-purple-950/40 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Restaurar padrão"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restaurar Padrão
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showPreview && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Pré-visualização do Bloco
              </label>
              <div 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner p-2"
                dangerouslySetInnerHTML={{
                  __html: activeTab === 'navbar' ? (navbarHtml || '<div class="p-4 text-center text-slate-500 text-xs">Navbar vazia</div>') : (footerHtml || '<div class="p-4 text-center text-slate-500 text-xs">Footer vazio</div>')
                }}
              />
            </div>
          )}

          <div className="space-y-1.5 flex-1 flex flex-col">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Code className="w-3.5 h-3.5 text-purple-400" />
              Código HTML do Bloco {activeTab === 'navbar' ? 'Navbar' : 'Footer'}
            </label>
            <textarea
              rows={9}
              value={activeTab === 'navbar' ? navbarHtml : footerHtml}
              onChange={(e) => activeTab === 'navbar' ? setNavbarHtml(e.target.value) : setFooterHtml(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 font-mono text-xs text-purple-200 border border-slate-800 rounded-xl focus:border-purple-500 focus:outline-none leading-relaxed resize-y"
              placeholder={activeTab === 'navbar' ? '<header>...</header>' : '<footer>...</footer>'}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70">
          <span className="text-xs text-slate-400">
            Dica: No editor visual você também pode clicar e editar o texto ou estilo da Navbar diretamente.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Aplicar a Todas as Páginas'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
