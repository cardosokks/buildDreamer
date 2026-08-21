import React, { useState, useRef } from 'react';
import {
  Type,
  Square,
  Layout,
  MousePointer,
  Plus,
  Trash2,
  FileText,
  Copy,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Image,
  Link,
  List,
  AlignLeft,
  Code,
  FormInput,
  Video,
  MoreVertical,
  WrapText,
  ArrowUp,
  ArrowDown,
  Navigation,
  Layers,
  Sparkles,
  Component,
  Boxes,
  Send,
  MessageCircle,
  CreditCard,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

interface ElementNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  children?: ElementNode[];
  // path is a dot-separated index path e.g. "0.1.2"
  path?: string;
}

interface SidebarProps {
  pages: { id: string; name: string; slug: string; isHomepage: boolean }[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  layers: ElementNode[];
  onSelectLayer: (selector: string, path: string) => void;
  onDeleteElement: (path: string) => void;
  onDuplicateElement: (path: string) => void;
  onMoveElement: (sourcePath: string, targetPath: string) => void;
  onWrapElement: (path: string) => void;
  onAddChildElement?: (parentPath: string, tag: string, text?: string) => void;
  onInsertBlock?: (htmlBlock: string, cssBlock?: string) => void;
  selectedPath?: string | null;
}

function getTagIcon(tag: string) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return <Type className={`${cls} text-yellow-400`} />;
    case 'p': case 'span': case 'label': case 'strong': case 'em':
      return <AlignLeft className={`${cls} text-blue-400`} />;
    case 'a':
      return <Link className={`${cls} text-cyan-400`} />;
    case 'img':
      return <Image className={`${cls} text-green-400`} />;
    case 'button': case 'input': case 'textarea': case 'select':
      return <FormInput className={`${cls} text-orange-400`} />;
    case 'ul': case 'ol': case 'li':
      return <List className={`${cls} text-slate-400`} />;
    case 'nav': case 'header': case 'footer':
      return <Navigation className={`${cls} text-pink-400`} />;
    case 'section': case 'article': case 'main': case 'aside':
      return <Layout className={`${cls} text-purple-400`} />;
    case 'div':
      return <Layers className={`${cls} text-indigo-400`} />;
    case 'video': case 'audio': case 'iframe':
      return <Video className={`${cls} text-rose-400`} />;
    case 'code': case 'pre': case 'script':
      return <Code className={`${cls} text-emerald-400`} />;
    default:
      return <Square className={`${cls} text-slate-500`} />;
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onDeletePage,
  layers,
  onSelectLayer,
  onDeleteElement,
  onDuplicateElement,
  onMoveElement,
  onWrapElement,
  onAddChildElement,
  onInsertBlock,
  selectedPath,
}) => {
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [showAddMenuPath, setShowAddMenuPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0', '1', '2']));
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const renderLayers = (nodes: ElementNode[], depth = 0, parentPath = '') => {
    return nodes.map((node, index) => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      const nodeWithPath = { ...node, path };
      const className = typeof node.className === 'string' ? node.className : '';
      const label = `${node.tag}${className ? '.' + className.split(' ')[0] : ''}${node.id ? '#' + node.id : ''}`;
      const selector = node.tag + (className ? '.' + className.split(' ').join('.') : '');
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedPaths.has(path);
      const isSelected = selectedPath === path;
      const isDragOver = dragOver === path;

      return (
        <div key={path}>
          <div
            className={`group flex items-center gap-1 rounded-lg text-xs transition-all duration-100 ${
              isSelected
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : isDragOver
                ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            style={{ paddingLeft: `${depth * 10 + 4}px`, paddingRight: '4px', paddingTop: '3px', paddingBottom: '3px' }}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDragSource(path);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragSource !== path) setDragOver(path);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(null);
              if (dragSource && dragSource !== path) {
                onMoveElement(dragSource, path);
              }
              setDragSource(null);
            }}
          >
            {/* Expand/collapse chevron */}
            <button
              onClick={() => hasChildren && toggleExpanded(path)}
              className={`p-0.5 rounded shrink-0 ${hasChildren ? 'cursor-pointer hover:bg-slate-700' : 'opacity-0 pointer-events-none'}`}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
            </button>

            {/* Tag icon */}
            {getTagIcon(node.tag)}

            {/* Label */}
            <button
              className="flex-1 text-left truncate cursor-pointer py-0.5 font-mono text-[11px]"
              onClick={() => onSelectLayer(selector, path)}
            >
              {label}
            </button>

            {/* Action buttons (hover) */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenPath(menuOpenPath === path ? null : path); }}
                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors cursor-pointer"
                title="Mais ações"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteElement(path); }}
                className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Deletar elemento"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Context Menu */}
          {menuOpenPath === path && (
            <div
              ref={menuRef}
              className="relative z-50 animate-in fade-in slide-in-from-top-1 duration-150"
              style={{ paddingLeft: `${depth * 10 + 24}px` }}
            >
              <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-xs w-44 mb-1">
                {onAddChildElement && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAddMenuPath(showAddMenuPath === path ? null : path)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-purple-400" /> Adicionar Filho
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                    </button>
                    {showAddMenuPath === path && (
                      <div className="absolute left-full top-0 ml-1 bg-slate-850 border border-slate-750 rounded-lg shadow-2xl py-1 w-32 z-50">
                        {[
                          { tag: 'div', label: 'Container (div)' },
                          { tag: 'h1', label: 'Título (h1)', txt: 'Título' },
                          { tag: 'p', label: 'Parágrafo (p)', txt: 'Texto aqui...' },
                          { tag: 'button', label: 'Botão', txt: 'Clique Aqui' },
                          { tag: 'a', label: 'Link (a)', txt: 'Link' },
                          { tag: 'img', label: 'Imagem (img)' }
                        ].map(item => (
                          <button
                            key={item.tag}
                            onClick={() => {
                              onAddChildElement(path, item.tag, item.txt);
                              setShowAddMenuPath(null);
                              setMenuOpenPath(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => { onDuplicateElement(path); setMenuOpenPath(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400" /> Duplicar
                </button>
                <button
                  onClick={() => { onWrapElement(path); setMenuOpenPath(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
                >
                  <WrapText className="w-3.5 h-3.5 text-green-400" /> Wrap em &lt;div&gt;
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => { onDeleteElement(path); setMenuOpenPath(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 text-red-400 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </div>
          )}

          {/* Children */}
          {hasChildren && isExpanded && (
            <div>
              {renderLayers(node.children!, depth + 1, path)}
            </div>
          )}
        </div>
      );
    });
  };

  const [activeTab, setActiveTab] = useState<'layers' | 'blocks'>('layers');

  // Biblioteca de Blocos Prontos Modernos e Responsivos
  const readyBlocks = [
    {
      id: 'hero-modern',
      title: 'Hero Banner Neon',
      category: 'Cabeçalho',
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      html: `
<section class="hero-section" style="padding: 80px 20px; text-align: center; background: radial-gradient(circle at center, rgba(168,85,247,0.15) 0%, rgba(13,7,20,0.9) 100%); border-bottom: 1px solid rgba(168,85,247,0.2);">
  <div style="max-width: 900px; margin: 0 auto;">
    <span style="display: inline-block; padding: 6px 16px; background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.4); border-radius: 99px; color: #d8b4fe; font-size: 13px; font-weight: 600; margin-bottom: 20px;">
      ✨ NOVIDADE EXCLUSIVA
    </span>
    <h1 style="font-size: 42px; font-weight: 800; color: #ffffff; line-height: 1.2; margin-bottom: 20px; text-shadow: 0 0 20px rgba(168,85,247,0.3);">
      Transforme Ideias em Realidade Digital
    </h1>
    <p style="font-size: 17px; color: #94a3b8; line-height: 1.6; max-width: 650px; margin: 0 auto 32px auto;">
      Construa interfaces extraordinárias, rápidas e responsivas para computadores e dispositivos móveis com total precisão.
    </p>
    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
      <a href="#contato" style="padding: 14px 32px; background: #9333ea; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; box-shadow: 0 0 20px rgba(147,51,234,0.4); transition: transform 0.2s;">
        Começar Agora
      </a>
      <a href="#saiba-mais" style="padding: 14px 32px; background: rgba(255,255,255,0.05); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1);">
        Saiba Mais
      </a>
    </div>
  </div>
</section>`
    },
    {
      id: 'features-grid',
      title: 'Grade de Recursos / Serviços',
      category: 'Conteúdo',
      icon: <Boxes className="w-4 h-4 text-cyan-400" />,
      html: `
<section style="padding: 70px 20px; max-width: 1100px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 50px;">
    <h2 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">Nossos Diferenciais</h2>
    <p style="color: #94a3b8; font-size: 15px;">Soluções sob medida para acelerar seu negócio.</p>
  </div>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; transition: transform 0.2s;">
      <div style="width: 44px; height: 44px; background: rgba(168,85,247,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 20px;">⚡</div>
      <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Alta Performance</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Sites otimizados para carregamento instantâneo em qualquer velocidade de rede.</p>
    </div>
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; transition: transform 0.2s;">
      <div style="width: 44px; height: 44px; background: rgba(6,182,212,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 20px;">📱</div>
      <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 8px;">100% Responsivo</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Perfeição visual tanto em smartphones Android e iOS quanto em telas ultrawide.</p>
    </div>
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; transition: transform 0.2s;">
      <div style="width: 44px; height: 44px; background: rgba(236,72,153,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 20px;">🔒</div>
      <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Segurança Máxima</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Certificado SSL automático e infraestrutura blindada em nuvem de alta disponibilidade.</p>
    </div>
  </div>
</section>`
    },
    {
      id: 'whatsapp-cta',
      title: 'Botão Flutuante / CTA WhatsApp',
      category: 'Conversão',
      icon: <MessageCircle className="w-4 h-4 text-green-400" />,
      html: `
<div style="padding: 40px 20px; text-align: center; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); border-radius: 20px; max-width: 800px; margin: 40px auto;">
  <h3 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-bottom: 12px;">Dúvidas ou Orçamentos Imediatos?</h3>
  <p style="color: #cbd5e1; font-size: 15px; margin-bottom: 24px;">Fale diretamente com nossa equipe de especialistas pelo WhatsApp.</p>
  <a href="https://wa.me/5561999999999?text=Ol%C3%A1,%20gostaria%20de%20um%20or%C3%A7amento!" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; background: #22c55e; color: #ffffff; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 0 20px rgba(34,197,94,0.4);">
    <span>💬</span> Conversar no WhatsApp
  </a>
</div>`
    },
    {
      id: 'pricing-table',
      title: 'Tabela de Preços / Planos',
      category: 'Vendas',
      icon: <CreditCard className="w-4 h-4 text-yellow-400" />,
      html: `
<section style="padding: 70px 20px; max-width: 1000px; margin: 0 auto; text-align: center;">
  <h2 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">Planos Flexíveis</h2>
  <p style="color: #94a3b8; margin-bottom: 40px;">Escolha o pacote ideal para alavancar sua presença online.</p>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; text-align: left;">
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 30px;">
      <h3 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-bottom: 6px;">Básico</h3>
      <div style="font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 16px;">R$ 97 <span style="font-size: 14px; color: #94a3b8; font-weight: normal;">/mês</span></div>
      <ul style="color: #94a3b8; font-size: 14px; line-height: 2; list-style: none; padding: 0; margin-bottom: 24px;">
        <li>✔ 1 Website Profissional</li>
        <li>✔ Domínio Próprio Incluso</li>
        <li>✔ Suporte por Email</li>
      </ul>
      <button style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); color: #ffffff; border: none; border-radius: 10px; font-weight: 600; cursor: pointer;">Assinar</button>
    </div>
    <div style="background: linear-gradient(180deg, rgba(147,51,234,0.15) 0%, rgba(13,7,20,0.9) 100%); border: 1px solid rgba(168,85,247,0.5); border-radius: 18px; padding: 30px; box-shadow: 0 0 25px rgba(168,85,247,0.2);">
      <div style="color: #d8b4fe; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Mais Popular</div>
      <h3 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-bottom: 6px;">Profissional Pro</h3>
      <div style="font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 16px;">R$ 197 <span style="font-size: 14px; color: #94a3b8; font-weight: normal;">/mês</span></div>
      <ul style="color: #cbd5e1; font-size: 14px; line-height: 2; list-style: none; padding: 0; margin-bottom: 24px;">
        <li>✔ Websites Ilimitados</li>
        <li>✔ IA Construtora Ilimitada</li>
        <li>✔ WhatsApp & Chatbot Ativo</li>
        <li>✔ Suporte Prioritário 24/7</li>
      </ul>
      <button style="width: 100%; padding: 12px; background: #9333ea; color: #ffffff; border: none; border-radius: 10px; font-weight: 700; box-shadow: 0 0 15px rgba(147,51,234,0.4); cursor: pointer;">Assinar Pro</button>
    </div>
  </div>
</section>`
    },
    {
      id: 'footer-modern',
      title: 'Rodapé Completo',
      category: 'Rodapé',
      icon: <Navigation className="w-4 h-4 text-pink-400" />,
      html: `
<footer style="padding: 50px 20px; background: #05010a; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 60px;">
  <div style="max-width: 1100px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 30px;">
    <div style="max-width: 320px;">
      <div style="font-size: 20px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">Empresa Digital</div>
      <p style="color: #64748b; font-size: 14px; line-height: 1.5;">Criando soluções online elegantes, eficientes e de alto impacto para todo o Brasil.</p>
    </div>
    <div>
      <h4 style="color: #ffffff; font-size: 14px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">Navegação</h4>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <a href="#home" style="color: #94a3b8; text-decoration: none;">Início</a>
        <a href="#sobre" style="color: #94a3b8; text-decoration: none;">Sobre Nós</a>
        <a href="#servicos" style="color: #94a3b8; text-decoration: none;">Serviços</a>
        <a href="#contato" style="color: #94a3b8; text-decoration: none;">Contato</a>
      </div>
    </div>
  </div>
  <div style="max-width: 1100px; margin: 30px auto 0 auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; color: #64748b; font-size: 12px;">
    © 2026 Todos os direitos reservados.
  </div>
</footer>`
    }
  ];

  return (
    <aside className="w-60 border-r border-slate-900 bg-slate-950 flex flex-col h-full shrink-0 select-none">

      {/* Pages Section */}
      <div className="border-b border-slate-900 flex flex-col min-h-0">
        <div className="px-3 py-3 flex items-center justify-between">
          <button
            onClick={() => setPagesCollapsed(!pagesCollapsed)}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-colors"
          >
            {pagesCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <FileText className="w-3.5 h-3.5" />
            Páginas
          </button>
          <button
            onClick={onCreatePage}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Nova página"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {!pagesCollapsed && (
          <div className="px-2 pb-3 space-y-0.5 max-h-36 overflow-y-auto min-h-0">
            {pages.map(page => (
              <div
                key={page.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all group ${
                  page.id === activePageId
                    ? 'bg-purple-600/15 border border-purple-500/20 text-purple-300'
                    : 'hover:bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <button
                  onClick={() => onSelectPage(page.id)}
                  className="flex items-center gap-2 truncate text-left w-full cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">{page.name}</span>
                  {page.isHomepage && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono">HOME</span>}
                </button>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                  <button
                    onClick={() => onDuplicatePage(page.id)}
                    className="p-1 hover:text-purple-400 rounded transition-colors cursor-pointer"
                    title="Duplicar página"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {!page.isHomepage && (
                    <button
                      onClick={() => onDeletePage(page.id)}
                      className="p-1 hover:text-red-400 rounded transition-colors cursor-pointer"
                      title="Deletar página"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Selector: Layers vs Ready Blocks */}
      <div className="flex border-b border-slate-900 bg-slate-900/40 p-1 gap-1">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MousePointer className="w-3 h-3" />
          Estrutura
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'blocks'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Component className="w-3 h-3" />
          Blocos Prontos
        </button>
      </div>

      {/* Main Body depending on Active Tab */}
      {activeTab === 'layers' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto py-2 px-2 min-h-0 space-y-0.5" onClick={() => setMenuOpenPath(null)}>
            {layers.length > 0 ? (
              renderLayers(layers)
            ) : (
              <p className="text-[10px] text-slate-600 italic p-3 text-center">Nenhum elemento no canvas.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block px-1">
            Clique para Adicionar à Página:
          </span>
          {readyBlocks.map((block) => (
            <div
              key={block.id}
              onClick={() => onInsertBlock && onInsertBlock(block.html)}
              className="p-3 bg-slate-900/70 hover:bg-purple-950/40 border border-slate-850 hover:border-purple-500/50 rounded-xl transition-all group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {block.icon}
                  <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                    {block.title}
                  </span>
                </div>
                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Categoria: {block.category}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
