import React from 'react';
import { Settings, Eye } from 'lucide-react';

interface PropertiesPanelProps {
  selectedSelector: string | null;
  selectedStyles: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedSelector,
  selectedStyles,
  onStyleChange
}) => {
  if (!selectedSelector) {
    return (
      <aside className="w-64 border-l border-slate-900 bg-slate-950 p-4 text-center text-slate-500 text-xs italic shrink-0">
        Selecione um elemento no canvas para editar suas propriedades.
      </aside>
    );
  }

  const cleanSelector = selectedSelector.split(' > ').pop() || selectedSelector;

  return (
    <aside className="w-64 border-l border-slate-900 bg-slate-950 flex flex-col h-full shrink-0">
      
      {/* Title */}
      <div className="p-4 border-b border-slate-900 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 truncate">
          <Settings className="w-4 h-4 shrink-0 text-purple-400" />
          Estilos: {cleanSelector}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Layout Properties */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Layout</h4>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Display</label>
              <select
                value={selectedStyles.display || 'block'}
                onChange={(e) => onStyleChange('display', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
              >
                <option value="block">Block</option>
                <option value="flex">Flex</option>
                <option value="grid">Grid</option>
                <option value="inline-block">Inline Block</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Posicionamento</label>
              <select
                value={selectedStyles.position || 'static'}
                onChange={(e) => onStyleChange('position', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
              >
                <option value="static">Static</option>
                <option value="relative">Relative</option>
                <option value="absolute">Absolute</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Spacing Properties */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Espaçamento</h4>
          
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Margin (Top / Bottom)</label>
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="text"
                placeholder="Margin Top"
                value={selectedStyles.marginTop || ''}
                onChange={(e) => onStyleChange('margin-top', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center"
              />
              <input 
                type="text"
                placeholder="Margin Bottom"
                value={selectedStyles.marginBottom || ''}
                onChange={(e) => onStyleChange('margin-bottom', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Padding (Top / Bottom)</label>
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="text"
                placeholder="Padding Top"
                value={selectedStyles.paddingTop || ''}
                onChange={(e) => onStyleChange('padding-top', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center"
              />
              <input 
                type="text"
                placeholder="Padding Bottom"
                value={selectedStyles.paddingBottom || ''}
                onChange={(e) => onStyleChange('padding-bottom', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white text-center"
              />
            </div>
          </div>
        </div>

        {/* Typography Properties */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tipografia</h4>
          
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Tamanho da Fonte</label>
            <input 
              type="text"
              placeholder="Ex: 16px, 1.5rem"
              value={selectedStyles.fontSize || ''}
              onChange={(e) => onStyleChange('font-size', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Alinhamento</label>
              <select
                value={selectedStyles.textAlign || 'left'}
                onChange={(e) => onStyleChange('text-align', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Peso (Weight)</label>
              <select
                value={selectedStyles.fontWeight || '400'}
                onChange={(e) => onStyleChange('font-weight', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
              >
                <option value="300">Light (300)</option>
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="700">Bold (700)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Colors Properties */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cores</h4>
          
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Cor do Texto</label>
            <input 
              type="text"
              placeholder="Ex: #ffffff, red"
              value={selectedStyles.color || ''}
              onChange={(e) => onStyleChange('color', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Fundo (Background)</label>
            <input 
              type="text"
              placeholder="Ex: #000000, transparent"
              value={selectedStyles.backgroundColor || ''}
              onChange={(e) => onStyleChange('background-color', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

      </div>

    </aside>
  );
};
