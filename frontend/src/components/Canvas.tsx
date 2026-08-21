import React, { useEffect, useRef } from 'react';

interface CanvasProps {
  html: string;
  css: string;
  js: string;
  highlightPath?: string | null;
  hoverPath?: string | null;
  zoom?: number;
  onElementSelect: (selector: string, styles: Record<string, string>, attrs: Record<string, string>, elementPath: string) => void;
  onInlineContentChange?: (elementPath: string, newText: string) => void;
  onDeleteElement?: (elementPath: string) => void;
  onDuplicateElement?: (elementPath: string) => void;
  onMoveElementDirection?: (elementPath: string, direction: 'up' | 'down') => void;
  onSelectParentElement?: (elementPath: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  html,
  css,
  js,
  highlightPath,
  hoverPath,
  zoom = 100,
  onElementSelect,
  onInlineContentChange,
  onDeleteElement,
  onDuplicateElement,
  onMoveElementDirection,
  onSelectParentElement
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const documentContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background: #ffffff;
            color: #0f172a;
            font-family: 'Inter', sans-serif;
            position: relative;
          }
          h1, h2, h3, h4, h5, h6 {
            font-family: 'Outfit', sans-serif;
          }

          /* Selection Box Overlay */
          #studio-selection-box {
            position: absolute;
            display: none;
            border: 2px solid #a855f7;
            pointer-events: none;
            z-index: 999990;
            box-sizing: border-box;
            border-radius: 4px;
            box-shadow: 0 0 0 1px rgba(168,85,247,0.3);
          }

          #studio-hover-box {
            position: absolute;
            display: none;
            border: 2px dashed #06b6d4;
            pointer-events: none;
            z-index: 999980;
            box-sizing: border-box;
            border-radius: 4px;
          }

          /* Floating Quick Action Toolbar (WordPress / Elementor Style) */
          #studio-quick-toolbar {
            position: absolute;
            display: none;
            z-index: 999999;
            pointer-events: auto;
            background: #0f0b18;
            border: 1px solid #7e22ce;
            border-radius: 8px;
            padding: 3px 6px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            align-items: center;
            gap: 4px;
            font-family: sans-serif;
          }

          #studio-tag-badge {
            background: #9333ea;
            color: #ffffff;
            font-family: monospace;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: lowercase;
            margin-right: 4px;
          }

          .studio-tool-btn {
            background: #1e1630;
            border: 1px solid #3b285a;
            color: #e2e8f0;
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 10px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            transition: all 0.15s;
          }
          .studio-tool-btn:hover {
            background: #9333ea;
            color: #ffffff;
          }
          .studio-tool-btn.danger:hover {
            background: #ef4444;
            border-color: #ef4444;
            color: #ffffff;
          }

          /* Inline Editing State */
          [contenteditable="true"] {
            outline: 2px solid #22c55e !important;
            outline-offset: 3px !important;
            cursor: text !important;
            min-width: 1ch;
            border-radius: 2px;
          }

          ${css}
        </style>
      </head>
      <body>
        <div id="canvas-root">
          ${html}
        </div>

        <!-- Overlays -->
        <div id="studio-selection-box"></div>
        <div id="studio-hover-box"></div>

        <!-- Floating Quick Toolbar -->
        <div id="studio-quick-toolbar">
          <span id="studio-tag-badge">div</span>
          <button type="button" class="studio-tool-btn" id="btn-parent" title="Selecionar Elemento Pai">▲ Pai</button>
          <button type="button" class="studio-tool-btn" id="btn-move-up" title="Mover para Cima">↑ Cima</button>
          <button type="button" class="studio-tool-btn" id="btn-move-down" title="Mover para Baixo">↓ Baixo</button>
          <button type="button" class="studio-tool-btn" id="btn-duplicate" title="Duplicar">📋 Duplicar</button>
          <button type="button" class="studio-tool-btn danger" id="btn-delete" title="Excluir Elemento">🗑️ Excluir</button>
        </div>

        <script>
          let currentSelected = null;
          const selectionBox = document.getElementById('studio-selection-box');
          const hoverBox = document.getElementById('studio-hover-box');
          const quickToolbar = document.getElementById('studio-quick-toolbar');
          const tagBadge = document.getElementById('studio-tag-badge');

          function updateOverlayPosition() {
            if (!currentSelected || !currentSelected.isConnected) {
              if (selectionBox) selectionBox.style.display = 'none';
              if (quickToolbar) quickToolbar.style.display = 'none';
              return;
            }
            const rect = currentSelected.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset || 0;
            const scrollY = window.scrollY || window.pageYOffset || 0;

            selectionBox.style.display = 'block';
            selectionBox.style.top = (rect.top + scrollY) + 'px';
            selectionBox.style.left = (rect.left + scrollX) + 'px';
            selectionBox.style.width = rect.width + 'px';
            selectionBox.style.height = rect.height + 'px';

            // Position quick toolbar right above the element
            if (quickToolbar) {
              quickToolbar.style.display = 'flex';
              let toolTop = rect.top + scrollY - 36;
              if (toolTop < 5) toolTop = rect.bottom + scrollY + 8;
              let toolLeft = rect.left + scrollX;
              if (toolLeft + 250 > window.innerWidth) toolLeft = window.innerWidth - 260;
              if (toolLeft < 5) toolLeft = 5;

              quickToolbar.style.top = toolTop + 'px';
              quickToolbar.style.left = toolLeft + 'px';
            }

            const tag = currentSelected.tagName.toLowerCase();
            const id = currentSelected.id ? '#' + currentSelected.id : '';
            const cls = currentSelected.className && typeof currentSelected.className === 'string'
              ? '.' + currentSelected.className.split(' ').filter(c => !c.startsWith('studio-'))[0]
              : '';
            tagBadge.textContent = tag + id + (cls ? cls.slice(0, 12) : '');
          }

          function removeSelection() {
            if (currentSelected) {
              currentSelected.removeAttribute('contenteditable');
              currentSelected = null;
            }
            if (selectionBox) selectionBox.style.display = 'none';
            if (quickToolbar) quickToolbar.style.display = 'none';
          }

          function getIndexPath(target) {
            const canvasRoot = document.getElementById('canvas-root') || document.body;
            const indexParts = [];
            let indexEl = target;
            while (indexEl && indexEl !== canvasRoot && indexEl !== document.body) {
              const parent = indexEl.parentElement;
              if (!parent) break;
              const idx = Array.from(parent.children).indexOf(indexEl);
              indexParts.unshift(idx);
              indexEl = parent;
            }
            return indexParts.join('.');
          }

          function selectElement(target) {
            if (!target || target === document.body || target === document.documentElement || target.id === 'canvas-root' || target.id === 'studio-selection-box' || target.id === 'studio-hover-box' || target.id === 'studio-quick-toolbar' || target.closest('#studio-quick-toolbar')) return;

            removeSelection();
            currentSelected = target;
            updateOverlayPosition();

            // Compute Selector
            const selectorParts = [];
            let selEl = target;
            while (selEl && selEl !== document.body && selEl.id !== 'canvas-root') {
              let name = selEl.nodeName.toLowerCase();
              if (selEl.id) {
                name += '#' + selEl.id;
              } else if (selEl.className && typeof selEl.className === 'string') {
                const cleanClasses = Array.from(selEl.classList)
                  .filter(c => !c.startsWith('studio-'))
                  .join('.');
                if (cleanClasses) name += '.' + cleanClasses;
              }
              selectorParts.unshift(name);
              selEl = selEl.parentNode;
            }
            const selector = selectorParts.join(' > ') || target.tagName.toLowerCase();
            const elementPath = getIndexPath(target);

            // Extract Attributes
            const attrs = {
              _tag: target.tagName.toLowerCase(),
              _textContent: target.childElementCount === 0 ? (target.textContent || '') : (target.innerText || ''),
              _hasChildren: target.childElementCount > 0 ? 'true' : 'false',
            };
            ['id', 'class', 'href', 'src', 'alt', 'target', 'placeholder', 'type', 'name', 'value'].forEach(a => {
              const v = target.getAttribute(a);
              if (v !== null) attrs[a] = v;
            });

            // Extract Computed Styles
            const computedStyle = window.getComputedStyle(target);
            const styles = {
              display: target.style.display || computedStyle.display,
              position: target.style.position || computedStyle.position,
              width: target.style.width || computedStyle.width,
              height: target.style.height || computedStyle.height,
              'margin-top': target.style.marginTop || computedStyle.marginTop,
              'margin-bottom': target.style.marginBottom || computedStyle.marginBottom,
              'margin-left': target.style.marginLeft || computedStyle.marginLeft,
              'margin-right': target.style.marginRight || computedStyle.marginRight,
              'padding-top': target.style.paddingTop || computedStyle.paddingTop,
              'padding-bottom': target.style.paddingBottom || computedStyle.paddingBottom,
              'padding-left': target.style.paddingLeft || computedStyle.paddingLeft,
              'padding-right': target.style.paddingRight || computedStyle.paddingRight,
              color: target.style.color || computedStyle.color,
              'background-color': target.style.backgroundColor || computedStyle.backgroundColor,
              'font-size': target.style.fontSize || computedStyle.fontSize,
              'font-weight': target.style.fontWeight || computedStyle.fontWeight,
              'font-family': target.style.fontFamily || computedStyle.fontFamily,
              'text-align': target.style.textAlign || computedStyle.textAlign,
              'line-height': target.style.lineHeight || computedStyle.lineHeight,
              'letter-spacing': target.style.letterSpacing || computedStyle.letterSpacing,
              'border-radius': target.style.borderRadius || computedStyle.borderRadius,
              'border-width': target.style.borderWidth || computedStyle.borderWidth,
              'border-color': target.style.borderColor || computedStyle.borderColor,
              'border-style': target.style.borderStyle || computedStyle.borderStyle,
              opacity: target.style.opacity || computedStyle.opacity,
              'box-shadow': target.style.boxShadow || computedStyle.boxShadow,
              transition: target.style.transition || computedStyle.transition,
              transform: target.style.transform || computedStyle.transform,
              'flex-direction': target.style.flexDirection || computedStyle.flexDirection,
              'align-items': target.style.alignItems || computedStyle.alignItems,
              'justify-content': target.style.justifyContent || computedStyle.justifyContent,
              gap: target.style.gap || computedStyle.gap,
              'z-index': target.style.zIndex || computedStyle.zIndex,
            };

            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              selector,
              elementPath,
              styles,
              attrs
            }, '*');
          }

          // Toolbar Button Actions
          document.getElementById('btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentSelected) return;
            const path = getIndexPath(currentSelected);
            window.parent.postMessage({ type: 'ACTION_DELETE_ELEMENT', path }, '*');
            removeSelection();
          });

          document.getElementById('btn-duplicate').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentSelected) return;
            const path = getIndexPath(currentSelected);
            window.parent.postMessage({ type: 'ACTION_DUPLICATE_ELEMENT', path }, '*');
          });

          document.getElementById('btn-move-up').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentSelected) return;
            const path = getIndexPath(currentSelected);
            window.parent.postMessage({ type: 'ACTION_MOVE_ELEMENT_DIRECTION', path, direction: 'up' }, '*');
          });

          document.getElementById('btn-move-down').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentSelected) return;
            const path = getIndexPath(currentSelected);
            window.parent.postMessage({ type: 'ACTION_MOVE_ELEMENT_DIRECTION', path, direction: 'down' }, '*');
          });

          document.getElementById('btn-parent').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentSelected) return;
            const parent = currentSelected.parentElement;
            if (parent && parent.id !== 'canvas-root' && parent !== document.body) {
              selectElement(parent);
            }
          });

          // Reposition on resize or scroll
          window.addEventListener('resize', updateOverlayPosition);
          window.addEventListener('scroll', updateOverlayPosition);

          // Click selection
          document.body.addEventListener('click', (e) => {
            if (e.target && e.target.getAttribute('contenteditable') === 'true') {
              return;
            }
            if (e.target.closest('#studio-quick-toolbar')) return;
            e.preventDefault();
            e.stopPropagation();
            selectElement(e.target);
          });

          // Double Click: Smart Inline Text Editing (Support for simple and compound/nested texts)
          document.body.addEventListener('dblclick', (e) => {
            if (e.target.closest('#studio-quick-toolbar')) return;
            e.preventDefault();
            e.stopPropagation();
            const target = e.target;
            if (target && target.id !== 'canvas-root' && target !== document.body) {
              target.setAttribute('contenteditable', 'true');
              target.focus();

              const onBlur = () => {
                target.removeAttribute('contenteditable');
                target.removeEventListener('blur', onBlur);
                const path = getIndexPath(target);
                window.parent.postMessage({
                  type: 'INLINE_TEXT_CHANGED',
                  path,
                  text: target.innerHTML || target.textContent
                }, '*');
                updateOverlayPosition();
              };
              target.addEventListener('blur', onBlur);
            }
          });

          // Hover
          document.body.addEventListener('mouseover', (e) => {
            const t = e.target;
            if (t && t !== document.body && t !== document.documentElement && t.id !== 'canvas-root' && t.id !== 'studio-selection-box' && t.id !== 'studio-hover-box' && !t.closest('#studio-quick-toolbar')) {
              const rect = t.getBoundingClientRect();
              const scrollX = window.scrollX || window.pageXOffset || 0;
              const scrollY = window.scrollY || window.pageYOffset || 0;
              hoverBox.style.display = 'block';
              hoverBox.style.top = (rect.top + scrollY) + 'px';
              hoverBox.style.left = (rect.left + scrollX) + 'px';
              hoverBox.style.width = rect.width + 'px';
              hoverBox.style.height = rect.height + 'px';
            }
          });
          document.body.addEventListener('mouseout', (e) => {
            if (hoverBox) hoverBox.style.display = 'none';
          });

          // Incoming messages
          window.addEventListener('message', (msg) => {
            if (!msg.data) return;

            if (msg.data.type === 'HIGHLIGHT_ELEMENT') {
              const hPath = msg.data.path;
              if (hPath === null || hPath === undefined || hPath === '') {
                removeSelection();
                return;
              }
              const canvasRoot = document.getElementById('canvas-root') || document.body;
              const parts = String(hPath).split('.').map(Number);
              let el = canvasRoot;
              for (const idx of parts) {
                const kids = Array.from(el.children);
                if (!kids[idx]) { el = null; break; }
                el = kids[idx];
              }
              if (el && el !== canvasRoot) {
                selectElement(el);
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }

            if (msg.data.type === 'HOVER_ELEMENT') {
              const hoverP = msg.data.path;
              if (!hoverP) {
                if (hoverBox) hoverBox.style.display = 'none';
                return;
              }
              const canvasRoot = document.getElementById('canvas-root') || document.body;
              const parts = String(hoverP).split('.').map(Number);
              let el = canvasRoot;
              for (const idx of parts) {
                const kids = Array.from(el.children);
                if (!kids[idx]) { el = null; break; }
                el = kids[idx];
              }
              if (el && el !== canvasRoot) {
                const rect = el.getBoundingClientRect();
                const scrollX = window.scrollX || window.pageXOffset || 0;
                const scrollY = window.scrollY || window.pageYOffset || 0;
                hoverBox.style.display = 'block';
                hoverBox.style.top = (rect.top + scrollY) + 'px';
                hoverBox.style.left = (rect.left + scrollX) + 'px';
                hoverBox.style.width = rect.width + 'px';
                hoverBox.style.height = rect.height + 'px';
              }
            }
          });

          try {
            ${js}
          } catch(err) {
            console.warn('Erro de execução no script do usuário:', err);
          }
        </script>
      </body>
      </html>
    `;

    iframe.srcdoc = documentContent;
  }, [html, css, js]);

  // Sync Highlight Path
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage({ type: 'HIGHLIGHT_ELEMENT', path: highlightPath ?? null }, '*');
    };
    if (iframe.contentDocument?.readyState === 'complete') {
      send();
    } else {
      iframe.addEventListener('load', send, { once: true });
    }
  }, [highlightPath]);

  // Sync Hover Path from Tree
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({ type: 'HOVER_ELEMENT', path: hoverPath ?? null }, '*');
  }, [hoverPath]);

  // Handle Incoming Messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ELEMENT_SELECTED') {
        onElementSelect(
          event.data.selector,
          event.data.styles,
          event.data.attrs || {},
          event.data.elementPath || ''
        );
      }
      if (event.data?.type === 'INLINE_TEXT_CHANGED' && onInlineContentChange) {
        onInlineContentChange(event.data.path, event.data.text);
      }
      if (event.data?.type === 'ACTION_DELETE_ELEMENT' && onDeleteElement) {
        onDeleteElement(event.data.path);
      }
      if (event.data?.type === 'ACTION_DUPLICATE_ELEMENT' && onDuplicateElement) {
        onDuplicateElement(event.data.path);
      }
      if (event.data?.type === 'ACTION_MOVE_ELEMENT_DIRECTION' && onMoveElementDirection) {
        onMoveElementDirection(event.data.path, event.data.direction);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, onInlineContentChange, onDeleteElement, onDuplicateElement, onMoveElementDirection]);

  const scale = zoom / 100;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-4 select-none">
      <div 
        className="w-full h-full bg-white rounded-xl shadow-2xl border border-slate-800/80 overflow-hidden transition-transform duration-150 origin-center"
        style={{
          transform: `scale(${scale})`,
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        <iframe
          ref={iframeRef}
          title="Studio Visual Engine Canvas"
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
};
