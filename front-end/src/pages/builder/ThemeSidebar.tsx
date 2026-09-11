import React, { useState } from 'react';
import { Palette, Type, Sliders, Check, Sparkles, X, RefreshCw } from 'lucide-react';

interface ThemeSidebarProps {
  css: string;
  onCssChange: (newCss: string) => void;
  onClose: () => void;
}

interface ColorPreset {
  id: string;
  name: string;
  bg: string;
  text: string;
  primary: string;
  accent: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'dark-luxury',
    name: 'Dark Luxury',
    bg: '#090d16',
    text: '#f8fafc',
    primary: '#a855f7',
    accent: '#ec4899'
  },
  {
    id: 'clean-light',
    name: 'Clean Light',
    bg: '#ffffff',
    text: '#0f172a',
    primary: '#2563eb',
    accent: '#0284c7'
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyber',
    bg: '#05050a',
    text: '#e2e8f0',
    primary: '#06b6d4',
    accent: '#f43f5e'
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    bg: '#faf8f5',
    text: '#1c1917',
    primary: '#d97706',
    accent: '#9a3412'
  },
  {
    id: 'emerald-tech',
    name: 'Emerald Tech',
    bg: '#022c22',
    text: '#ecfdf5',
    primary: '#10b981',
    accent: '#06b6d4'
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    bg: '#0b0f19',
    text: '#fef08a',
    primary: '#eab308',
    accent: '#f97316'
  }
];

const FONT_PRESETS = [
  { name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif" },
  { name: 'Inter', family: "'Inter', sans-serif" },
  { name: 'Outfit', family: "'Outfit', sans-serif" },
  { name: 'Syne', family: "'Syne', sans-serif" },
  { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
  { name: 'Poppins', family: "'Poppins', sans-serif" },
  { name: 'Montserrat', family: "'Montserrat', sans-serif" },
  { name: 'Playfair Display', family: "'Playfair Display', serif" },
  { name: 'Cinzel', family: "'Cinzel', serif" },
  { name: 'Sora', family: "'Sora', sans-serif" },
  { name: 'DM Sans', family: "'DM Sans', sans-serif" },
  { name: 'Roboto', family: "'Roboto', sans-serif" }
];

export const ThemeSidebar: React.FC<ThemeSidebarProps> = ({
  css,
  onCssChange,
  onClose
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [bodyBg, setBodyBg] = useState('#090d16');
  const [bodyText, setBodyText] = useState('#f8fafc');
  const [primaryColor, setPrimaryColor] = useState('#a855f7');
  const [accentColor, setAccentColor] = useState('#ec4899');
  const [bodyFont, setBodyFont] = useState("'Plus Jakarta Sans', sans-serif");
  const [headingFont, setHeadingFont] = useState("'Syne', sans-serif");
  const [borderRadius, setBorderRadius] = useState('0.75rem');

  const applyThemeToCss = (
    bg: string,
    text: string,
    primary: string,
    accent: string,
    bFont: string,
    hFont: string,
    radius: string
  ) => {
    // Inject / Replace Root variables block and Body styling in CSS
    const themeBlock = `
/* ─── Global Design Tokens ─── */
:root {
  --bg-main: ${bg};
  --text-main: ${text};
  --primary: ${primary};
  --accent: ${accent};
  --radius-main: ${radius};
  --font-body: ${bFont};
  --font-heading: ${hFont};
}

body {
  background-color: var(--bg-main) !important;
  color: var(--text-main) !important;
  font-family: var(--font-body) !important;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading) !important;
}
`.trim();

    let cleanCss = css || '';
    // Remove previous design tokens block if exists
    cleanCss = cleanCss.replace(/\/\* ─── Global Design Tokens ─── \*\/[\s\S]*?(?=\n\n|\n[a-zA-Z.#]|$)/, '').trim();

    const newCss = cleanCss ? `${themeBlock}\n\n${cleanCss}` : themeBlock;
    onCssChange(newCss);
  };

  const handleSelectPreset = (preset: ColorPreset) => {
    setSelectedPreset(preset.id);
    setBodyBg(preset.bg);
    setBodyText(preset.text);
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);

    applyThemeToCss(
      preset.bg,
      preset.text,
      preset.primary,
      preset.accent,
      bodyFont,
      headingFont,
      borderRadius
    );
  };

  const handleCustomChange = () => {
    applyThemeToCss(
      bodyBg,
      bodyText,
      primaryColor,
      accentColor,
      bodyFont,
      headingFont,
      borderRadius
    );
  };

  return (
    <aside className="w-80 h-full bg-slate-950 border-r border-slate-900/80 flex flex-col shrink-0 text-slate-200 select-none overflow-hidden shadow-2xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 bg-[var(--bg-app)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Tema & Estilos Globais</h2>
            <p className="text-[10px] text-slate-400">Paleta, Tipografia e Tokens do Site</p>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Presets de Cores Prontos */}
        <div>
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Paletas de Cores Prontas
          </label>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  selectedPreset === preset.id
                    ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 truncate">{preset.name}</span>
                  {selectedPreset === preset.id && (
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full border border-slate-700" style={{ backgroundColor: preset.bg }} title="Background" />
                  <span className="w-4 h-4 rounded-full border border-slate-700" style={{ backgroundColor: preset.primary }} title="Principal" />
                  <span className="w-4 h-4 rounded-full border border-slate-700" style={{ backgroundColor: preset.accent }} title="Acento" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tipografia Global */}
        <div className="space-y-3 pt-2 border-t border-slate-900">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-purple-400" />
            Tipografia do Site
          </label>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Fonte dos Títulos (H1 - H6)</span>
            <select
              value={headingFont}
              onChange={(e) => {
                setHeadingFont(e.target.value);
                applyThemeToCss(bodyBg, bodyText, primaryColor, accentColor, bodyFont, e.target.value, borderRadius);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {FONT_PRESETS.map(f => (
                <option key={f.name} value={f.family}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Fonte do Corpo (Textos)</span>
            <select
              value={bodyFont}
              onChange={(e) => {
                setBodyFont(e.target.value);
                applyThemeToCss(bodyBg, bodyText, primaryColor, accentColor, e.target.value, headingFont, borderRadius);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {FONT_PRESETS.map(f => (
                <option key={f.name} value={f.family}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ajuste Fino de Cores Personalizadas */}
        <div className="space-y-3 pt-2 border-t border-slate-900">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Cores Personalizadas
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Fundo (Body)</span>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                <input
                  type="color"
                  value={bodyBg}
                  onChange={(e) => {
                    setBodyBg(e.target.value);
                    handleCustomChange();
                  }}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                />
                <span className="text-xs font-mono text-slate-300 uppercase">{bodyBg}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Texto Principal</span>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                <input
                  type="color"
                  value={bodyText}
                  onChange={(e) => {
                    setBodyText(e.target.value);
                    handleCustomChange();
                  }}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                />
                <span className="text-xs font-mono text-slate-300 uppercase">{bodyText}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Cor Primária</span>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    handleCustomChange();
                  }}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                />
                <span className="text-xs font-mono text-slate-300 uppercase">{primaryColor}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Cor de Acento</span>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    handleCustomChange();
                  }}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                />
                <span className="text-xs font-mono text-slate-300 uppercase">{accentColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Borda Global */}
        <div className="pt-2 border-t border-slate-900 space-y-2">
          <span className="text-[11px] font-medium text-slate-400 block">Arredondamento de Bordas (Border Radius)</span>
          <div className="flex items-center gap-1.5">
            {[
              { label: 'Reto', value: '0px' },
              { label: 'Suave', value: '0.5rem' },
              { label: 'Padrão', value: '0.75rem' },
              { label: 'Redondo', value: '1.25rem' }
            ].map(r => (
              <button
                key={r.value}
                onClick={() => {
                  setBorderRadius(r.value);
                  applyThemeToCss(bodyBg, bodyText, primaryColor, accentColor, bodyFont, headingFont, r.value);
                }}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                  borderRadius === r.value
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
