import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  onChange: (type: 'html' | 'css' | 'js', value: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ html, css, js, onChange }) => {
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html');

  const getLanguage = () => {
    if (activeTab === 'html') return 'html';
    if (activeTab === 'css') return 'css';
    return 'javascript';
  };

  const getValue = () => {
    if (activeTab === 'html') return html;
    if (activeTab === 'css') return css;
    return js;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(activeTab, value);
    }
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

        <div className="text-[10px] text-slate-500 font-mono pr-2">
          Monaco Editor
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
