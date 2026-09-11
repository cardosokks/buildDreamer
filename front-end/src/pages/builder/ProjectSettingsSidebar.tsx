import React, { useState, useEffect } from 'react';
import { Settings, Image, Phone, Mail, Palette, Check, X, RefreshCw, Save, Globe } from 'lucide-react';

interface ProjectSettingsSidebarProps {
  project: {
    id: string;
    name: string;
    logoUrl?: string;
    contacts?: string;
    email?: string;
    colorPalette?: string;
  };
  onSave: (updatedFields: {
    name: string;
    logoUrl?: string;
    contacts?: string;
    email?: string;
    colorPalette?: string;
  }) => Promise<void>;
  onClose: () => void;
}

interface ColorPalettePreset {
  name: string;
  description: string;
  colors: string[]; // hex preview
}

const PALETTE_PRESETS: ColorPalettePreset[] = [
  {
    name: 'Escuro Premium (Dark Luxury)',
    description: 'Fundo preto/grafite profundo (#090d16), botões e destaques em roxo neon (#a855f7) e rosa magenta (#ec4899), com tipografia branca de alto contraste.',
    colors: ['#090d16', '#a855f7', '#ec4899', '#ffffff']
  },
  {
    name: 'Minimalista Claro (Clean Light)',
    description: 'Fundo branco limpo, tipografia cinza-escura/azulada (#0f172a), botões principais em azul corporativo (#2563eb) e detalhes em azul claro (#0284c7).',
    colors: ['#ffffff', '#0f172a', '#2563eb', '#0284c7']
  },
  {
    name: 'Cyberpunk Neon',
    description: 'Fundo preto puro (#05050a), texto em cinza claro, botões e detalhes em ciano elétrico (#06b6d4) e rosa/coral neon (#f43f5e).',
    colors: ['#05050a', '#06b6d4', '#f43f5e', '#e2e8f0']
  },
  {
    name: 'Editorial Quente (Warm Editorial)',
    description: 'Fundo creme/areia suave (#faf8f5), tipografia marrom-escura terrosa (#1c1917), com botões principais em laranja-âmbar (#d97706) e detalhes terracota (#9a3412).',
    colors: ['#faf8f5', '#1c1917', '#d97706', '#9a3412']
  },
  {
    name: 'Tecnologia Esmeralda (Emerald Tech)',
    description: 'Fundo verde-escuro profundo (#022c22), tipografia verde menta super leve (#ecfdf5), com detalhes em verde esmeralda vibrante (#10b981) e ciano futurista (#06b6d4).',
    colors: ['#022c22', '#ecfdf5', '#10b981', '#06b6d4']
  },
  {
    name: 'Ouro da Meia-Noite (Midnight Gold)',
    description: 'Fundo azul-escuro meia-noite (#0b0f19), tipografia e botões em amarelo dourado (#eab308) e laranja solar (#f97316).',
    colors: ['#0b0f19', '#eab308', '#f97316', '#fef08a']
  }
];

export const ProjectSettingsSidebar: React.FC<ProjectSettingsSidebarProps> = ({
  project,
  onSave,
  onClose
}) => {
  const [name, setName] = useState(project.name || '');
  const [logoUrl, setLogoUrl] = useState(project.logoUrl || '');
  const [contacts, setContacts] = useState(project.contacts || '');
  const [email, setEmail] = useState(project.email || '');
  const [colorPalette, setColorPalette] = useState(project.colorPalette || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(project.name || '');
    setLogoUrl(project.logoUrl || '');
    setContacts(project.contacts || '');
    setEmail(project.email || '');
    setColorPalette(project.colorPalette || '');
  }, [project]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        contacts: contacts.trim() || undefined,
        email: email.trim() || undefined,
        colorPalette: colorPalette.trim() || undefined
      });
    } catch (err) {
      console.error('Erro ao salvar configurações do projeto:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectPresetPalette = (preset: ColorPalettePreset) => {
    setColorPalette(preset.description);
  };

  return (
    <aside className="w-80 h-full bg-slate-950 border-r border-slate-900/80 flex flex-col shrink-0 text-slate-200 select-none overflow-hidden shadow-2xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 bg-[var(--bg-app)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Configurações Globais</h2>
            <p className="text-[10px] text-slate-400">Variáveis e Identidade da IA</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        
        {/* Nome do Site */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            Nome do Site / Marca
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Minha Empresa de Advocacia"
            className="w-full bg-slate-900/50 border border-slate-850 hover:border-slate-800 focus:border-purple-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-white transition-all shadow-sm placeholder:text-slate-600"
            required
          />
          <p className="text-[10px] text-slate-500">
            Nome oficial que será colocado em títulos, navbar e rodapés gerados pela IA.
          </p>
        </div>

        {/* Imagem da Logo */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5 text-cyan-400" />
            URL da Logo
          </label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="Ex: https://link-da-imagem.com/logo.png"
            className="w-full bg-slate-900/50 border border-slate-850 hover:border-slate-800 focus:border-cyan-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-white transition-all shadow-sm placeholder:text-slate-600 font-mono"
          />
          {logoUrl ? (
            <div className="mt-2 p-2 bg-slate-900/30 rounded-xl border border-slate-850 flex items-center justify-center h-16 relative group">
              <img
                src={logoUrl}
                alt="Logo do Site"
                referrerPolicy="no-referrer"
                className="max-h-12 max-w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <p className="text-[10px] text-slate-500">
              Insira o link da imagem do seu logotipo para que a IA incorpore-o nos cabeçalhos e seções de mídia.
            </p>
          )}
        </div>

        {/* Contatos / Telefone */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            Contatos / Telefone
          </label>
          <input
            type="text"
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
            placeholder="Ex: (11) 99999-9999"
            className="w-full bg-slate-900/50 border border-slate-850 hover:border-slate-800 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-white transition-all shadow-sm placeholder:text-slate-600"
          />
          <p className="text-[10px] text-slate-500">
            Será integrado nas seções de contato, botões de WhatsApp e rodapé.
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-rose-400" />
            E-mail Comercial
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ex: contato@empresa.com"
            className="w-full bg-slate-900/50 border border-slate-850 hover:border-slate-800 focus:border-rose-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-white transition-all shadow-sm placeholder:text-slate-600"
          />
          <p className="text-[10px] text-slate-500">
            Utilizado em formulários, textos de contato e links 'mailto'.
          </p>
        </div>

        {/* Paleta de Cores */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            Regra de Paleta de Cores para a IA
          </label>
          <textarea
            value={colorPalette}
            onChange={(e) => setColorPalette(e.target.value)}
            placeholder="Descreva a paleta ou clique em um preset abaixo..."
            rows={4}
            className="w-full bg-slate-900/50 border border-slate-850 hover:border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl p-3 text-xs text-slate-200 transition-all shadow-sm placeholder:text-slate-600 leading-relaxed resize-none font-sans"
          />
          <p className="text-[10px] text-slate-500">
            A IA usará esta regra em todos os prompts futuros para preencher ou manter o site nessas cores.
          </p>

          {/* Presets Grid */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold text-slate-500">Presets de IA Rápidos:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PALETTE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => selectPresetPalette(p)}
                  className="p-1.5 bg-slate-900/60 border border-slate-850 hover:border-purple-500/40 rounded-lg text-left transition-all cursor-pointer select-none"
                >
                  <span className="block text-[9px] font-bold text-slate-300 truncate mb-1">{p.name}</span>
                  <div className="flex gap-0.5">
                    {p.colors.map((c, i) => (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 rounded-full border border-slate-950"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Guardar Alterações Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_12px_rgba(168,85,247,0.2)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </>
            )}
          </button>
        </div>
      </form>
    </aside>
  );
};
