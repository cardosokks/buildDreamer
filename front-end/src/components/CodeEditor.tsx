import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Save } from 'lucide-react';

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  onChange: (type: 'html' | 'css' | 'js', value: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ html, css, js, onChange }) => {
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');
  
  // Local code states to prevent real-time updates and apply changes only on save
  const [localHtml, setLocalHtml] = useState(html);
  const [localCss, setLocalCss] = useState(css);
  const [localJs, setLocalJs] = useState(js);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state if props change (e.g. page switched)
  useEffect(() => {
    setLocalHtml(html);
    setLocalCss(css);
    setLocalJs(js);
    setHasChanges(false);
  }, [html, css, js]);

  const getLanguage = () => {
    if (activeTab === 'html') return 'html';
    if (activeTab === 'css') return 'css';
    return 'javascript';
  };

  const getValue = () => {
    if (activeTab === 'html') return localHtml;
    if (activeTab === 'css') return localCss;
    return localJs;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setHasChanges(true);
    if (activeTab === 'html') setLocalHtml(value);
    else if (activeTab === 'css') setLocalCss(value);
    else setLocalJs(value);
  };

  const handleSave = () => {
    if (activeTab === 'html') onChange('html', localHtml);
    else if (activeTab === 'css') onChange('css', localCss);
    else onChange('js', localJs);
    setHasChanges(false);
  };

  return (
    <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
      {/* Abas do Editor */}
      <div className="flex bg-slate-950 border-b border-slate-800/80 px-2 h-10 items-center justify-between shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('html')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'html'
                ? 'bg-slate-900 text-white border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            index.html
          </button>
          <button
            onClick={() => setActiveTab('css')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'css'
                ? 'bg-slate-900 text-white border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            index.css
          </button>
          <button
            onClick={() => setActiveTab('js')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'js'
                ? 'bg-slate-900 text-white border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            index.js
          </button>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-[10px] text-amber-500 font-medium animate-pulse">
              Modificações não salvas
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              hasChanges
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            Salvar Código
          </button>
        </div>
      </div>

      {/* Editor Monaco */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={getLanguage()}
          theme="vs-dark"
          value={getValue()}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 2,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
};
