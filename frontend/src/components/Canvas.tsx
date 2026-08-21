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
}

export const Canvas: React.FC<CanvasProps> = ({
  html,
  css,
  js,
  highlightPath,
  hoverPath,
  zoom = 100,
  onElementSelect,
  onInlineContentChange
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

          /* ─── Selection & Hover Overlay Box System ─── */
          .studio-hovered {
            outline: 2px dashed #06b6d4 !important;
            outline-offset: -2px !important;
          }

          .studio-selected {
            outline: 2px solid #a855f7 !important;
            outline-offset: -2px !important;
            position: relative !important;
          }

          .studio-tag-badge {
            position: absolute;
            top: -22px;
            left: -2px;
            background: #a855f7;
            color: #ffffff;
            font-family: monospace;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            pointer-events: none;
            z-index: 999999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            text-transform: lowercase;
            white-space: nowrap;
          }

          /* Inline Editing State */
          [contenteditable="true"] {
            outline: 2px solid #22c55e !important;
            outline-offset: 2px !important;
            cursor: text !important;
            min-width: 1ch;
          }

          ${css}
        </style>
      </head>
      <body>
        <div id="canvas-root">
          ${html}
        </div>

        <script>
          let currentSelected = null;
          let badgeEl = null;

          function removeSelection() {
            if (currentSelected) {
              currentSelected.classList.remove('studio-selected');
              currentSelected.removeAttribute('contenteditable');
              if (badgeEl && badgeEl.parentNode) {
                badgeEl.parentNode.removeChild(badgeEl);
                badgeEl = null;
              }
              currentSelected = null;
            }
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
            if (!target || target === document.body || target === document.documentElement || target.id === 'canvas-root') return;

            removeSelection();
            currentSelected = target;
            target.classList.add('studio-selected');

            // Attach floating tag badge
            badgeEl = document.createElement('div');
            badgeEl.className = 'studio-tag-badge';
            const tag = target.tagName.toLowerCase();
            const id = target.id ? '#' + target.id : '';
            const cls = target.className ? '.' + target.className.split(' ').filter(c => !c.startsWith('studio-'))[0] : '';
            badgeEl.textContent = tag + id + (cls ? cls.slice(0, 15) : '');
            target.appendChild(badgeEl);

            // Compute Selector
            const selectorParts = [];
            let selEl = target;
            while (selEl && selEl !== document.body && selEl.id !== 'canvas-root') {
              let name = selEl.nodeName.toLowerCase();
              if (selEl.id) {
                name += '#' + selEl.id;
              } else if (selEl.className) {
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
              _textContent: target.childElementCount <= 1 ? (target.textContent || '') : '',
              _hasChildren: target.childElementCount > 1 ? 'true' : 'false',
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

          // Single click -> Select bounding box
          document.body.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectElement(e.target);
          });

          // Double click -> Inline Content Editable for Text
          document.body.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target;
            if (target && target.childElementCount <= 1) {
              target.setAttribute('contenteditable', 'true');
              target.focus();

              const onBlur = () => {
                target.removeAttribute('contenteditable');
                target.removeEventListener('blur', onBlur);
                const path = getIndexPath(target);
                window.parent.postMessage({
                  type: 'INLINE_TEXT_CHANGED',
                  path,
                  text: target.innerText || target.textContent
                }, '*');
              };
              target.addEventListener('blur', onBlur);
            }
          });

          // Hover feedback
          document.body.addEventListener('mouseover', (e) => {
            if (e.target && e.target !== document.body && !e.target.classList.contains('studio-selected')) {
              e.target.classList.add('studio-hovered');
            }
          });
          document.body.addEventListener('mouseout', (e) => {
            if (e.target) {
              e.target.classList.remove('studio-hovered');
            }
          });

          // Window Message Dispatcher
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
              document.querySelectorAll('.studio-hovered').forEach(el => el.classList.remove('studio-hovered'));
              const hoverP = msg.data.path;
              if (!hoverP) return;
              const canvasRoot = document.getElementById('canvas-root') || document.body;
              const parts = String(hoverP).split('.').map(Number);
              let el = canvasRoot;
              for (const idx of parts) {
                const kids = Array.from(el.children);
                if (!kids[idx]) { el = null; break; }
                el = kids[idx];
              }
              if (el && el !== canvasRoot) {
                el.classList.add('studio-hovered');
              }
            }
          });

          // Inject user JavaScript securely
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

  // Handle Incoming Iframe Messages
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
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, onInlineContentChange]);

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
