import React, { useEffect, useRef } from 'react';

interface CanvasProps {
  html: string;
  css: string;
  js: string;
  onElementSelect: (selector: string, styles: Record<string, string>) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ html, css, js, onElementSelect }) => {
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

            // Build selector path
            const path = [];
            let current = target;
            while (current && current !== document.body) {
              let name = current.nodeName.toLowerCase();
              if (current.id) {
                name += '#' + current.id;
              } else if (current.className) {
                // Filter out editor selection styles
                const cleanClasses = Array.from(current.classList)
                  .filter(c => c !== 'selected-element')
                  .join('.');
                if (cleanClasses) {
                  name += '.' + cleanClasses;
                }
              }
              path.unshift(name);
              current = current.parentNode;
            }
            const selector = path.join(' > ');

            // Extract styles
            const computedStyle = window.getComputedStyle(target);
            const styles = {
              display: computedStyle.display,
              position: computedStyle.position,
              width: computedStyle.width,
              height: computedStyle.height,
              marginTop: computedStyle.marginTop,
              marginBottom: computedStyle.marginBottom,
              marginLeft: computedStyle.marginLeft,
              marginRight: computedStyle.marginRight,
              paddingTop: computedStyle.paddingTop,
              paddingBottom: computedStyle.paddingBottom,
              paddingLeft: computedStyle.paddingLeft,
              paddingRight: computedStyle.paddingRight,
              color: computedStyle.color,
              backgroundColor: computedStyle.backgroundColor,
              fontSize: computedStyle.fontSize,
              fontWeight: computedStyle.fontWeight,
              fontFamily: computedStyle.fontFamily,
              textAlign: computedStyle.textAlign,
            };

            // Post back to Editor Host
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              selector,
              styles
            }, '*');
          });

          // Inject user JavaScript safely
          try {
            ${js}
          } catch(err) {
            console.error("Erro no script do usuário:", err);
          }
        </script>
      </body>
      </html>
    `;

    iframe.srcdoc = documentContent;
  }, [html, css, js]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ELEMENT_SELECTED') {
        onElementSelect(event.data.selector, event.data.styles);
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
