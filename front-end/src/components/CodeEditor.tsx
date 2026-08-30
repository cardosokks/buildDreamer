import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Save, Plus, Trash2, FileCode, Code, FileText } from 'lucide-react';

interface CodeFile {
  id: string;
  name: string;
  type: 'html' | 'css' | 'js';
  content: string;
}

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  onChange: (type: 'html' | 'css' | 'js', value: string) => void;
}

// Utilitário para extrair arquivos individuais a partir de marcadores /* === FILE: nome.css === */
function parseCodeFiles(code: string, defaultName: string, type: 'css' | 'js'): CodeFile[] {
  if (!code || !code.trim()) {
    return [{ id: `${type}_default`, name: defaultName, type, content: '' }];
  }

  const headerRegex = /(?:\/\*|\/\/)\s*(?:===|---)?\s*FILE:\s*([^\s*]+|\S+.*?)\s*(?:===|---)?\s*(?:\*\/)?/gi;
  const matches = [...code.matchAll(headerRegex)];

  if (matches.length === 0) {
    return [{ id: `${type}_1`, name: defaultName, type, content: code }];
  }

  const files: CodeFile[] = [];

  // Conteúdo prévio ao primeiro marcador
  const firstIndex = matches[0].index || 0;
  if (firstIndex > 0) {
    const pre = code.slice(0, firstIndex).trim();
    if (pre) {
      files.push({
        id: `${type}_pre`,
        name: `main.${type}`,
        type,
        content: pre
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    let fileName = m[1].trim().replace(/^['"]|['"]$/g, '');
    if (!fileName.endsWith(`.${type}`)) {
      fileName = `${fileName}.${type}`;
    }

    const startIdx = m.index! + m[0].length;
    const endIdx = i < matches.length - 1 ? matches[i + 1].index! : code.length;
    const fileContent = code.slice(startIdx, endIdx).trim();

    files.push({
      id: `${type}_${i + 1}_${fileName}`,
      name: fileName,
      type,
      content: fileContent
    });
  }

  return files.length > 0 ? files : [{ id: `${type}_default`, name: defaultName, type, content: code }];
}

// Utilitário para serializar múltiplos arquivos em uma string única com marcadores
function serializeCodeFiles(files: CodeFile[]): string {
  if (files.length === 0) return '';
  if (files.length === 1 && (files[0].name.startsWith('index.') || files[0].name.startsWith('main.'))) {
    return files[0].content;
  }
  return files.map(f => `/* === FILE: ${f.name} === */\n${f.content}`).join('\n\n');
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ html, css, js, onChange }) => {
  const [localHtml, setLocalHtml] = useState<string>(html);
  const [cssFiles, setCssFiles] = useState<CodeFile[]>([]);
  const [jsFiles, setJsFiles] = useState<CodeFile[]>([]);
  
  const [activeTabType, setActiveTabType] = useState<'html' | 'css' | 'js'>('html');
  const [activeFileId, setActiveFileId] = useState<string>('html_file');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Inicializa ou sincroniza o estado a partir das props
  useEffect(() => {
    setLocalHtml(html);
    const parsedCss = parseCodeFiles(css, 'index.css', 'css');
    const parsedJs = parseCodeFiles(js, 'index.js', 'js');
    setCssFiles(parsedCss);
    setJsFiles(parsedJs);
    setHasChanges(false);
  }, [html, css, js]);

  // Obter o arquivo atualmente selecionado
  const getActiveFile = (): { type: 'html' | 'css' | 'js'; name: string; content: string } => {
    if (activeTabType === 'html') {
      return { type: 'html', name: 'index.html', content: localHtml };
    }
    if (activeTabType === 'css') {
      const f = cssFiles.find(file => file.id === activeFileId) || cssFiles[0];
      return f ? { type: 'css', name: f.name, content: f.content } : { type: 'css', name: 'index.css', content: '' };
    }
    const f = jsFiles.find(file => file.id === activeFileId) || jsFiles[0];
    return f ? { type: 'js', name: f.name, content: f.content } : { type: 'js', name: 'index.js', content: '' };
  };

  const activeFile = getActiveFile();

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setHasChanges(true);

    if (activeTabType === 'html') {
      setLocalHtml(value);
    } else if (activeTabType === 'css') {
      setCssFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));
    } else {
      setJsFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));
    }
  };

  const handleSave = () => {
    const combinedCss = serializeCodeFiles(cssFiles);
    const combinedJs = serializeCodeFiles(jsFiles);

    onChange('html', localHtml);
    onChange('css', combinedCss);
    onChange('js', combinedJs);

    setHasChanges(false);
  };

  const handleAddFile = (type: 'css' | 'js') => {
    const ext = type;
    const currentFiles = type === 'css' ? cssFiles : jsFiles;
    const defaultName = `style-${currentFiles.length + 1}.${ext}`;
    const fileName = prompt(`Nome do novo arquivo ${type.toUpperCase()}:`, defaultName);
    
    if (!fileName) return;

    const formattedName = fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;
    const newFile: CodeFile = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: formattedName,
      type,
      content: `/* Arquivo ${formattedName} */\n`
    };

    if (type === 'css') {
      setCssFiles([...cssFiles, newFile]);
    } else {
      setJsFiles([...jsFiles, newFile]);
    }

    setActiveTabType(type);
    setActiveFileId(newFile.id);
    setHasChanges(true);
  };

  const handleDeleteFile = (e: React.MouseEvent, fileId: string, type: 'css' | 'js') => {
    e.stopPropagation();
    const files = type === 'css' ? cssFiles : jsFiles;
    if (files.length <= 1) {
      alert(`Não é possível excluir o único arquivo de ${type.toUpperCase()}.`);
      return;
    }

    if (!confirm('Deseja realmente remover este arquivo?')) return;

    if (type === 'css') {
      const nextFiles = cssFiles.filter(f => f.id !== fileId);
      setCssFiles(nextFiles);
      if (activeFileId === fileId) {
        setActiveFileId(nextFiles[0].id);
      }
    } else {
      const nextFiles = jsFiles.filter(f => f.id !== fileId);
      setJsFiles(nextFiles);
      if (activeFileId === fileId) {
        setActiveFileId(nextFiles[0].id);
      }
    }
    setHasChanges(true);
  };

  return (
    <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
      {/* Barra Principal de Arquivos e Abas do Editor */}
      <div className="flex bg-slate-950 border-b border-slate-800/80 px-2 min-h-11 items-center justify-between shrink-0 overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto">
          {/* Aba HTML */}
          <button
            onClick={() => {
              setActiveTabType('html');
              setActiveFileId('html_file');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTabType === 'html'
                ? 'bg-slate-900 text-amber-400 border border-slate-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            index.html
          </button>

          {/* Divisor */}
          <div className="h-4 w-px bg-slate-800 my-auto mx-1" />

          {/* Abas CSS */}
          <div className="flex items-center gap-1">
            {cssFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => {
                  setActiveTabType('css');
                  setActiveFileId(file.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 group ${
                  activeTabType === 'css' && activeFileId === file.id
                    ? 'bg-slate-900 text-sky-400 border border-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Code className="w-3.5 h-3.5 text-sky-400" />
                <span>{file.name}</span>
                {cssFiles.length > 1 && (
                  <span
                    onClick={(e) => handleDeleteFile(e, file.id, 'css')}
                    className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    title="Remover este CSS"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => handleAddFile('css')}
              className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-sky-400 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
              title="Adicionar Novo Arquivo CSS"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">+ CSS</span>
            </button>
          </div>

          {/* Divisor */}
          <div className="h-4 w-px bg-slate-800 my-auto mx-1" />

          {/* Abas JS */}
          <div className="flex items-center gap-1">
            {jsFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => {
                  setActiveTabType('js');
                  setActiveFileId(file.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 group ${
                  activeTabType === 'js' && activeFileId === file.id
                    ? 'bg-slate-900 text-amber-300 border border-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-300" />
                <span>{file.name}</span>
                {jsFiles.length > 1 && (
                  <span
                    onClick={(e) => handleDeleteFile(e, file.id, 'js')}
                    className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    title="Remover este JS"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => handleAddFile('js')}
              className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-amber-300 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
              title="Adicionar Novo Arquivo JS"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">+ JS</span>
            </button>
          </div>
        </div>

        {/* Botão de Salvar Alterações */}
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {hasChanges && (
            <span className="text-[10px] text-amber-400 font-medium animate-pulse hidden sm:inline">
              Alterações pendentes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-md ${
              hasChanges
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Código</span>
          </button>
        </div>
      </div>

      {/* Editor Monaco */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={activeFile.type === 'html' ? 'html' : activeFile.type === 'css' ? 'css' : 'javascript'}
          theme="vs-dark"
          value={activeFile.content}
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

