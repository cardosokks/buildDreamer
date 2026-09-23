import React, { useEffect } from 'react';
import { Sparkles, Palette, Type, CheckCircle, RefreshCw, Wand2, ArrowRight, ShieldCheck, Info } from 'lucide-react';

export interface ThemeSuggestion {
  themeName: string;
  visualStyle: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    cardBg: string;
    textColor: string;
    textMuted: string;
    mood: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingStyle: string;
    googleFontsUrl: string;
  };
  designTokens?: {
    borderRadius: string;
    glassmorphism: boolean;
    buttonGlow: string;
    badgeStyle: string;
  };
  reasoning: string;
}

interface ThemeSuggestionCardProps {
  theme: ThemeSuggestion;
  onApply: (theme: ThemeSuggestion) => void;
  onRegenerate?: () => void;
  isGenerating?: boolean;
  applied?: boolean;
}

export const ThemeSuggestionCard: React.FC<ThemeSuggestionCardProps> = ({
  theme,
  onApply,
  onRegenerate,
  isGenerating = false,
  applied = false,
}) => {
  // Carrega dinamicamente a fonte do Google Fonts para a pré-visualização ao vivo
  useEffect(() => {
    if (theme.typography?.googleFontsUrl) {
      const linkId = 'theme-preview-google-fonts';
      let linkElement = document.getElementById(linkId) as HTMLLinkElement;
      if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.id = linkId;
        linkElement.rel = 'stylesheet';
        document.head.appendChild(linkElement);
      }
      linkElement.href = theme.typography.googleFontsUrl;
    }
  }, [theme.typography?.googleFontsUrl]);

  const { colorPalette, typography, designTokens } = theme;

  const fontHeadingStyle: React.CSSProperties = {
    fontFamily: `'${typography.headingFont}', sans-serif`,
  };

  const fontBodyStyle: React.CSSProperties = {
    fontFamily: `'${typography.bodyFont}', sans-serif`,
  };

  return (
    <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-5 shadow-2xl space-y-5 relative overflow-hidden transition-all animate-fade-in">
      {/* Luz Radial de Destaque no Fundo */}
      <div 
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: colorPalette.primary || '#8b5cf6' }}
      />

      {/* Cabeçalho do Tema */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-850 relative z-10">
        <div className="flex items-start gap-3">
          <div 
            className="p-2.5 rounded-xl border flex items-center justify-center shrink-0 shadow-lg"
            style={{ 
              backgroundColor: `${colorPalette.primary}20`,
              borderColor: `${colorPalette.primary}50`,
              color: colorPalette.primary 
            }}
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5" style={fontHeadingStyle}>
                {theme.themeName}
              </h3>
              <span 
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase"
                style={{
                  backgroundColor: `${colorPalette.primary}15`,
                  borderColor: `${colorPalette.primary}40`,
                  color: colorPalette.primary
                }}
              >
                {colorPalette.mood || 'Atmosfera Exclusiva'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {theme.visualStyle}
            </p>
          </div>
        </div>

        {/* Botão de Ação Primária */}
        <div className="flex items-center gap-2 shrink-0">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isGenerating}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Gerar nova sugestão de tema com IA"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recriar</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onApply(theme)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
              applied
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-600 text-white shadow-purple-950/50 hover:scale-[1.02]'
            }`}
          >
            {applied ? (
              <>
                <CheckCircle className="w-4 h-4 text-white" />
                <span>Tema Aplicado!</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Aplicar Tema</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid de Paleta e Tipografia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Paleta de Cores */}
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              Paleta de Cores Harmônica
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {/* Primary */}
            <div className="space-y-1 text-center group">
              <div 
                className="h-10 rounded-lg shadow-inner border border-white/10 group-hover:scale-105 transition-transform" 
                style={{ backgroundColor: colorPalette.primary }}
              />
              <span className="block text-[9px] font-bold text-slate-400 truncate">Primária</span>
              <span className="block text-[8px] font-mono text-slate-500 uppercase">{colorPalette.primary}</span>
            </div>

            {/* Secondary */}
            <div className="space-y-1 text-center group">
              <div 
                className="h-10 rounded-lg shadow-inner border border-white/10 group-hover:scale-105 transition-transform" 
                style={{ backgroundColor: colorPalette.secondary }}
              />
              <span className="block text-[9px] font-bold text-slate-400 truncate">Secundária</span>
              <span className="block text-[8px] font-mono text-slate-500 uppercase">{colorPalette.secondary}</span>
            </div>

            {/* Accent */}
            <div className="space-y-1 text-center group">
              <div 
                className="h-10 rounded-lg shadow-inner border border-white/10 group-hover:scale-105 transition-transform" 
                style={{ backgroundColor: colorPalette.accent }}
              />
              <span className="block text-[9px] font-bold text-slate-400 truncate">Brilho</span>
              <span className="block text-[8px] font-mono text-slate-500 uppercase">{colorPalette.accent}</span>
            </div>

            {/* Background */}
            <div className="space-y-1 text-center group">
              <div 
                className="h-10 rounded-lg shadow-inner border border-white/10 group-hover:scale-105 transition-transform" 
                style={{ backgroundColor: colorPalette.bg }}
              />
              <span className="block text-[9px] font-bold text-slate-400 truncate">Fundo</span>
              <span className="block text-[8px] font-mono text-slate-500 uppercase">{colorPalette.bg}</span>
            </div>

            {/* Card Surface */}
            <div className="space-y-1 text-center group">
              <div 
                className="h-10 rounded-lg shadow-inner border border-white/10 group-hover:scale-105 transition-transform" 
                style={{ backgroundColor: colorPalette.cardBg }}
              />
              <span className="block text-[9px] font-bold text-slate-400 truncate">Cartão</span>
              <span className="block text-[8px] font-mono text-slate-500 uppercase">{colorPalette.cardBg}</span>
            </div>

            {/* Text Color */}
            <div className="space-y-1 text-center group">
              <div 
                className="h-10 rounded-lg shadow-inner border border-white/10 group-hover:scale-105 transition-transform" 
                style={{ backgroundColor: colorPalette.textColor }}
              />
              <span className="block text-[9px] font-bold text-slate-400 truncate">Texto</span>
              <span className="block text-[8px] font-mono text-slate-500 uppercase">{colorPalette.textColor}</span>
            </div>
          </div>
        </div>

        {/* Tipografia */}
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3.5 space-y-3">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-cyan-400" />
            Par Tipográfico Google Fonts
          </span>

          <div className="space-y-2">
            <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Fonte de Títulos</span>
                <span className="text-sm font-bold text-white block mt-0.5" style={fontHeadingStyle}>
                  {typography.headingFont}
                </span>
              </div>
              <span className="text-xs text-purple-400 font-mono font-bold px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                Heading
              </span>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Fonte do Corpo</span>
                <span className="text-xs text-slate-300 block mt-0.5" style={fontBodyStyle}>
                  {typography.bodyFont} — Alta legibilidade e leitura confortável
                </span>
              </div>
              <span className="text-xs text-cyan-400 font-mono font-bold px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20">
                Body
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pré-Visualização Interativa de Componente de UI no Tema */}
      <div 
        className="rounded-xl p-4 border transition-all shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: colorPalette.bg || '#030712',
          borderColor: `${colorPalette.primary}30`,
          color: colorPalette.textColor || '#f8fafc'
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
              style={{
                backgroundColor: `${colorPalette.secondary}20`,
                borderColor: `${colorPalette.secondary}40`,
                color: colorPalette.secondary || '#3b82f6'
              }}
            >
              <span>Exemplo de UI do Layout</span>
            </div>
            <h4 className="text-base font-extrabold tracking-tight" style={fontHeadingStyle}>
              Experiência Digital Exclusiva
            </h4>
            <p className="text-xs opacity-80 max-w-md" style={fontBodyStyle}>
              Como seu site ficará renderizado usando as diretrizes de cores e tipografia da marca.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-transform hover:scale-105"
              style={{
                backgroundColor: colorPalette.primary || '#8b5cf6',
                color: '#ffffff',
                boxShadow: `0 10px 25px -5px ${colorPalette.primary}50`
              }}
            >
              Botão Principal
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
              style={{
                backgroundColor: `${colorPalette.cardBg}80`,
                borderColor: `${colorPalette.textColor}20`,
                color: colorPalette.textColor
              }}
            >
              Saiba Mais
            </button>
          </div>
        </div>
      </div>

      {/* Raciocínio Estratégico da IA */}
      {theme.reasoning && (
        <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-xl text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-purple-300 text-[11px] uppercase tracking-wide">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            Estratégia de Design & Psicologia das Cores
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300 font-sans" style={fontBodyStyle}>
            {theme.reasoning}
          </p>
        </div>
      )}
    </div>
  );
};
