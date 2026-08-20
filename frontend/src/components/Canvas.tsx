import React, { useEffect, useRef } from 'react';

interface CanvasProps {
  html: string;
  css: string;
  js: string;
  highlightPath?: string | null;
  onElementSelect: (selector: string, styles: Record<string, string>, attrs: Record<string, string>, elementPath: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ html, css, js, highlightPath, onElementSelect }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const documentContent = `
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          /* Base Styles */
          body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            cursor: pointer;
            box-sizing: border-box;
          }
          /* Hover & Selection Visualizer */
          *:hover {
            outline: 2px dashed rgba(168, 85, 247, 0.4);
            outline-offset: -2px;
          }
          .selected-element {
            outline: 2px solid rgb(168, 85, 247) !important;
            outline-offset: -2px;
          }
          ${css}
        </style>
      </head>
      <body>
        <div id="canvas-root">
          ${html}
        </div>
        <script>
          // Selection logic inside Sandbox Iframe
          document.body.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.target;
            if (target === document.body || target === document.documentElement) return;

            // Clear previous selection
            document.querySelectorAll('.selected-element').forEach(el => {
              el.classList.remove('selected-element');
            });

            // Mark new selection
            target.classList.add('selected-element');

            // Build CSS selector path (for display)
            const selectorParts = [];
            let selectorEl = target;
            while (selectorEl && selectorEl !== document.body) {
              let name = selectorEl.nodeName.toLowerCase();
              if (selectorEl.id) {
                name += '#' + selectorEl.id;
              } else if (selectorEl.className) {
                const cleanClasses = Array.from(selectorEl.classList)
                  .filter(c => c !== 'selected-element')
                  .join('.');
                if (cleanClasses) name += '.' + cleanClasses;
              }
              selectorParts.unshift(name);
              selectorEl = selectorEl.parentNode;
            }
            const selector = selectorParts.join(' > ');

            // Calculate index-based path (e.g. "0.1.2") relative to canvas-root or body
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
            const elementPath = indexParts.join('.');

            // Extract attributes
            const attrs = {
              _tag: target.tagName.toLowerCase(),
              _textContent: target.childElementCount === 0 ? (target.textContent || '') : '',
              _hasChildren: target.childElementCount > 0 ? 'true' : 'false',
            };
            const relevantAttrs = ['id', 'class', 'href', 'src', 'alt', 'target', 'placeholder', 'type', 'name', 'value'];
            relevantAttrs.forEach(a => {
              const v = target.getAttribute(a);
              if (v !== null) attrs[a] = v;
            });

            // Extract inline styles
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
              cursor: target.style.cursor || computedStyle.cursor,
            };

            // Post back to Editor Host
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              selector,
              elementPath,
              styles,
              attrs
            }, '*');
          });

          // Listen for parent highlight messages
          window.addEventListener('message', (msg) => {
            if (!msg.data || msg.data.type !== 'HIGHLIGHT_ELEMENT') return;
            const hPath = msg.data.path;
            // Clear all selections first
            document.querySelectorAll('.selected-element').forEach(el => {
              el.classList.remove('selected-element');
            });
            if (hPath === null || hPath === undefined || hPath === '') return;
            // Navigate to element by index path
            const canvasRoot = document.getElementById('canvas-root') || document.body;
            const parts = String(hPath).split('.').map(Number);
            let el = canvasRoot;
            for (const idx of parts) {
              const kids = Array.from(el.children);
              if (!kids[idx]) { el = null; break; }
              el = kids[idx];
            }
            if (el && el !== canvasRoot) {
              el.classList.add('selected-element');
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          });

          // Inject user JavaScript safely
          try {
            ${js}
          } catch(err) {
            console.error('Erro no script do usuário:', err);
          }
        </script>
      </body>
      </html>
    `;

    iframe.srcdoc = documentContent;
  }, [html, css, js]);

  // When highlightPath changes (from layer click), tell the iframe to highlight that element
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage({ type: 'HIGHLIGHT_ELEMENT', path: highlightPath ?? null }, '*');
    };
    // If iframe is still loading, wait for it
    if (iframe.contentDocument?.readyState === 'complete') {
      send();
    } else {
      iframe.addEventListener('load', send, { once: true });
    }
  }, [highlightPath]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ELEMENT_SELECTED') {
        onElementSelect(event.data.selector, event.data.styles, event.data.attrs || {}, event.data.elementPath || '');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-2xl relative">
      <iframe
        ref={iframeRef}
        title="Visual Site Builder Canvas"
        className="w-full h-full bg-white"
        sandbox="allow-scripts"
      />
    </div>
  );
};
