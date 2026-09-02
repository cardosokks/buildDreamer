import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderTreeToHtml } from '../utils/renderer';
import { ComponentNode } from '../types/canvas';

interface CanvasProps {
  html?: string;
  components?: ComponentNode[];
  css: string;
  js: string;
  highlightPath?: string | null;
  hoverPath?: string | null;
  zoom?: number;
  onElementSelect: (
    selector: string,
    styles: Record<string, string>,
    attrs: Record<string, string>,
    elementPath: string,
    componentId: string | null
  ) => void;
  onInlineContentChange?: (elementPath: string, newText: string) => void;
  onDeleteElement?: (elementPath: string) => void;
  onDuplicateElement?: (elementPath: string) => void;
  onMoveElementDirection?: (elementPath: string, direction: 'up' | 'down') => void;
  onSelectParentElement?: (elementPath: string) => void;
  onHtmlChange?: (newHtml: string) => void;
  onInsertBlock?: (
    htmlBlock: string,
    cssBlock?: string,
    targetPath?: string,
    position?: 'before' | 'after' | 'inside' | 'append'
  ) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  html,
  components,
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
  onSelectParentElement,
  onHtmlChange,
  onInsertBlock
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isInitializedRef = useRef(false);
  const lastHtmlSentRef = useRef<string>('');
  const lastCssSentRef = useRef<string>('');
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number; bottom: number; right: number } | null>(null);
  const [selectionTagText, setSelectionTagText] = useState<string>('');
  const [activeElementPath, setActiveElementPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
    tagText: string;
  } | null>(null);

  const getRenderedHtml = useCallback(() => {
    if (components && components.length > 0) {
      return renderTreeToHtml(components);
    }
    return html || '';
  }, [components, html]);

  // Construct complete isolated iframe document with engine scripts & UI overlays
  const buildIframeDoc = useCallback((rawHtml: string, rawCss: string, rawJs: string) => {
    return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  
  <style id="studio-core-styles">
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Outfit', 'Inter', sans-serif;
    }

    /* ─── Studio Selection Box (FIXED TO VIEWPORT) ─── */
    #studio-selection-box {
      position: fixed;
      display: none;
      border: 2px solid #a855f7;
      pointer-events: none;
      z-index: 999980;
      box-sizing: border-box;
      border-radius: 4px;
      box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.4), 0 4px 20px rgba(168, 85, 247, 0.25);
      transition: none;
    }

    /* Dimension Badge */
    #studio-dimension-badge {
      position: absolute;
      bottom: -22px;
      right: 0;
      background: #7e22ce;
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    /* Resize Handles */
    .studio-resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #ffffff;
      border: 2px solid #9333ea;
      border-radius: 2px;
      z-index: 999995;
      pointer-events: auto;
      box-shadow: 0 2px 5px rgba(0,0,0,0.35);
    }
    .handle-r { right: -6px; top: calc(50% - 5px); cursor: ew-resize; }
    .handle-b { bottom: -6px; left: calc(50% - 5px); cursor: ns-resize; }
    .handle-br { right: -6px; bottom: -6px; cursor: nwse-resize; }
    .handle-l { left: -6px; top: calc(50% - 5px); cursor: ew-resize; }

    /* Hover Box (FIXED TO VIEWPORT) */
    #studio-hover-box {
      position: fixed;
      display: none;
      border: 1.5px dashed #06b6d4;
      background: rgba(6, 182, 212, 0.05);
      pointer-events: none;
      z-index: 999970;
      box-sizing: border-box;
      border-radius: 4px;
      transition: none;
    }

    /* Drop Indicator Line (FIXED TO VIEWPORT) */
    #studio-drop-indicator {
      position: fixed;
      display: none;
      height: 3px;
      background: #a855f7;
      box-shadow: 0 0 10px #a855f7;
      z-index: 999999;
      pointer-events: none;
      border-radius: 2px;
    }



    /* ContentEditable Active Outline */
    [contenteditable="true"] {
      outline: 2px dashed #a855f7 !important;
      outline-offset: 2px !important;
      cursor: text !important;
    }
  </style>

  <style id="studio-user-styles">
    ${rawCss}
  </style>
</head>
<body>
  <div id="canvas-root">${rawHtml}</div>

  <!-- Selection Box Overlay & Handles -->
  <div id="studio-selection-box">
    <div class="studio-resize-handle handle-r" data-handle="r" title="Redimensionar Largura"></div>
    <div class="studio-resize-handle handle-b" data-handle="b" title="Redimensionar Altura"></div>
    <div class="studio-resize-handle handle-br" data-handle="br" title="Redimensionar Ambos"></div>
    <div class="studio-resize-handle handle-l" data-handle="l" title="Redimensionar Largura"></div>
    <div id="studio-dimension-badge"></div>
  </div>

  <!-- Hover Box & Drop Indicator -->
  <div id="studio-hover-box"></div>
  <div id="studio-drop-indicator"></div>



  <script>
    (function() {
      let currentSelected = null;
      let currentSelectedPath = null;
      let isEditingInline = false;
      let resizeObserver = null;

      const selectionBox = document.getElementById('studio-selection-box');
      const hoverBox = document.getElementById('studio-hover-box');
      const dropIndicator = document.getElementById('studio-drop-indicator');
      const quickToolbar = document.getElementById('studio-quick-toolbar');
      const tagBadge = document.getElementById('studio-tag-badge');
      const dimensionBadge = document.getElementById('studio-dimension-badge');
      const canvasRoot = document.getElementById('canvas-root');

      function isInternalStudioNode(node) {
        if (!node || node === document.body || node === document.documentElement || node === canvasRoot) return true;
        if (node.id && node.id.startsWith('studio-')) return true;
        if (node.closest && (node.closest('#studio-quick-toolbar') || node.closest('#studio-selection-box') || node.closest('#studio-hover-box'))) return true;
        return false;
      }

      function getIndexPath(target) {
        if (!target || target === canvasRoot || target === document.body) return '';
        const indexParts = [];
        let indexEl = target;
        while (indexEl && indexEl !== canvasRoot && indexEl !== document.body) {
          const parent = indexEl.parentElement;
          if (!parent) break;
          const validSiblings = Array.from(parent.children).filter(c => !c.id || !c.id.startsWith('studio-'));
          const idx = validSiblings.indexOf(indexEl);
          if (idx !== -1) {
            indexParts.unshift(idx);
          }
          indexEl = parent;
        }
        return indexParts.join('.');
      }

      function getElementByIndexPath(path) {
        if (!path && path !== '0') return null;
        const root = document.getElementById('canvas-root') || document.body;
        if (path === '') return null;
        const parts = String(path).split('.').map(Number);
        let el = root;
        for (const idx of parts) {
          if (!el) return null;
          const validKids = Array.from(el.children).filter(c => !c.id || !c.id.startsWith('studio-'));
          if (idx < 0 || idx >= validKids.length) return null;
          el = validKids[idx];
        }
        return el !== root ? el : null;
      }

      function updateOverlayPosition() {
        if (!currentSelected || !currentSelected.isConnected || isEditingInline) {
          if (selectionBox) selectionBox.style.display = 'none';
          window.parent.postMessage({ type: 'HIDE_SELECTION_RECT' }, '*');
          return;
        }

        const rect = currentSelected.getBoundingClientRect();

        // Check if element is completely off-screen or hidden
        if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
          if (selectionBox) selectionBox.style.display = 'none';
          window.parent.postMessage({ type: 'HIDE_SELECTION_RECT' }, '*');
          return;
        }

        // Position Selection Box (FIXED coords relative to viewport)
        if (selectionBox) {
          selectionBox.style.display = 'block';
          selectionBox.style.top = rect.top + 'px';
          selectionBox.style.left = rect.left + 'px';
          selectionBox.style.width = Math.max(rect.width, 2) + 'px';
          selectionBox.style.height = Math.max(rect.height, 2) + 'px';

          if (dimensionBadge) {
            dimensionBadge.textContent = Math.round(rect.width) + ' × ' + Math.round(rect.height) + 'px';
          }
        }

        const tag = currentSelected.tagName.toLowerCase();
        const id = currentSelected.id ? '#' + currentSelected.id : '';
        const cls = currentSelected.className && typeof currentSelected.className === 'string'
          ? '.' + currentSelected.className.split(' ').filter(c => c && !c.startsWith('studio-'))[0]
          : '';
        const tagText = tag + id + (cls ? cls.slice(0, 14) : '');

        window.parent.postMessage({
          type: 'UPDATE_SELECTION_RECT',
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
          tagText,
          path: currentSelectedPath
        }, '*');
      }

      function removeSelection() {
        if (isEditingInline && currentSelected) {
          currentSelected.removeAttribute('contenteditable');
          isEditingInline = false;
        }
        if (resizeObserver && currentSelected) {
          try { resizeObserver.unobserve(currentSelected); } catch(e) {}
        }
        currentSelected = null;
        currentSelectedPath = null;
        if (selectionBox) selectionBox.style.display = 'none';
        window.parent.postMessage({ type: 'HIDE_SELECTION_RECT' }, '*');
      }

      function selectElement(target, shouldScroll) {
        if (isInternalStudioNode(target)) return;

        // Normalize if clicked inside SVG or nested text node
        let normalizedTarget = target;
        if (normalizedTarget.nodeType === Node.TEXT_NODE) {
          normalizedTarget = normalizedTarget.parentElement;
        }
        if (!normalizedTarget || isInternalStudioNode(normalizedTarget)) return;

        removeSelection();
        currentSelected = normalizedTarget;
        currentSelectedPath = getIndexPath(normalizedTarget);

        // Bind ResizeObserver to track layout changes
        if (window.ResizeObserver) {
          if (!resizeObserver) {
            resizeObserver = new ResizeObserver(function() {
              updateOverlayPosition();
            });
          }
          resizeObserver.observe(currentSelected);
        }

        updateOverlayPosition();

        if (shouldScroll) {
          normalizedTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Build Selector Chain
        const selectorParts = [];
        let selEl = normalizedTarget;
        while (selEl && selEl !== document.body && selEl.id !== 'canvas-root') {
          let name = selEl.nodeName.toLowerCase();
          if (selEl.id) {
            name += '#' + selEl.id;
          } else if (selEl.className && typeof selEl.className === 'string') {
            const cleanClasses = Array.from(selEl.classList || [])
              .filter(c => !c.startsWith('studio-'))
              .join('.');
            if (cleanClasses) name += '.' + cleanClasses;
          }
          selectorParts.unshift(name);
          selEl = selEl.parentNode;
        }
        const selector = selectorParts.join(' > ') || normalizedTarget.tagName.toLowerCase();

        // Extract Attributes & Text Info
        const tagLower = normalizedTarget.tagName.toLowerCase();
        const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'li', 'label', 'b', 'strong', 'em', 'small', 'blockquote', 'caption', 'td', 'th'];
        const hasDirectOnlyText = normalizedTarget.childElementCount === 0 || Array.from(normalizedTarget.childNodes).every(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && ['span', 'b', 'strong', 'em', 'i', 'br'].includes(n.nodeName.toLowerCase())));
        const isTextEditable = textTags.includes(tagLower) || (hasDirectOnlyText && normalizedTarget.childElementCount === 0);

        const attrs = {
          _tag: tagLower,
          _textContent: isTextEditable ? (normalizedTarget.innerHTML || normalizedTarget.textContent || '') : '',
          _isTextEditable: isTextEditable ? 'true' : 'false',
          _hasChildren: normalizedTarget.childElementCount > 0 ? 'true' : 'false',
        };
        ['id', 'class', 'href', 'src', 'alt', 'target', 'placeholder', 'type', 'name', 'value'].forEach(a => {
          const v = normalizedTarget.getAttribute(a);
          if (v !== null) attrs[a] = v;
        });

        // Extract Styles
        const computed = window.getComputedStyle(normalizedTarget);
        const styles = {
          display: normalizedTarget.style.display || computed.display,
          position: normalizedTarget.style.position || computed.position,
          width: normalizedTarget.style.width || computed.width,
          height: normalizedTarget.style.height || computed.height,
          'margin-top': normalizedTarget.style.marginTop || computed.marginTop,
          'margin-bottom': normalizedTarget.style.marginBottom || computed.marginBottom,
          'margin-left': normalizedTarget.style.marginLeft || computed.marginLeft,
          'margin-right': normalizedTarget.style.marginRight || computed.marginRight,
          'padding-top': normalizedTarget.style.paddingTop || computed.paddingTop,
          'padding-bottom': normalizedTarget.style.paddingBottom || computed.paddingBottom,
          'padding-left': normalizedTarget.style.paddingLeft || computed.paddingLeft,
          'padding-right': normalizedTarget.style.paddingRight || computed.paddingRight,
          color: normalizedTarget.style.color || computed.color,
          'background-color': normalizedTarget.style.backgroundColor || computed.backgroundColor,
          'font-size': normalizedTarget.style.fontSize || computed.fontSize,
          'font-weight': normalizedTarget.style.fontWeight || computed.fontWeight,
          'font-family': normalizedTarget.style.fontFamily || computed.fontFamily,
          'text-align': normalizedTarget.style.textAlign || computed.textAlign,
          'line-height': normalizedTarget.style.lineHeight || computed.lineHeight,
          'letter-spacing': normalizedTarget.style.letterSpacing || computed.letterSpacing,
          'border-radius': normalizedTarget.style.borderRadius || computed.borderRadius,
          'border-width': normalizedTarget.style.borderWidth || computed.borderWidth,
          'border-color': normalizedTarget.style.borderColor || computed.borderColor,
          'border-style': normalizedTarget.style.borderStyle || computed.borderStyle,
          opacity: normalizedTarget.style.opacity || computed.opacity,
          'box-shadow': normalizedTarget.style.boxShadow || computed.boxShadow,
          transition: normalizedTarget.style.transition || computed.transition,
          transform: normalizedTarget.style.transform || computed.transform,
          'flex-direction': normalizedTarget.style.flexDirection || computed.flexDirection,
          'align-items': normalizedTarget.style.alignItems || computed.alignItems,
          'justify-content': normalizedTarget.style.justifyContent || computed.justifyContent,
          gap: normalizedTarget.style.gap || computed.gap,
          'z-index': normalizedTarget.style.zIndex || computed.zIndex,
        };

        window.parent.postMessage({
          type: 'ELEMENT_SELECTED',
          selector,
          elementPath: currentSelectedPath,
          styles,
          attrs,
          componentId: normalizedTarget.getAttribute('data-component-id')
        }, '*');
      }

      function startInlineEdit(target) {
        if (!target || isInternalStudioNode(target)) return;
        isEditingInline = true;
        target.setAttribute('contenteditable', 'true');
        target.focus();

        if (selectionBox) selectionBox.style.display = 'none';
        if (quickToolbar) quickToolbar.style.display = 'none';

        const onBlur = () => {
          target.removeAttribute('contenteditable');
          isEditingInline = false;
          target.removeEventListener('blur', onBlur);
          target.removeEventListener('keydown', onKey);

          const path = getIndexPath(target);
          window.parent.postMessage({
            type: 'INLINE_TEXT_CHANGED',
            path,
            text: target.innerHTML || target.textContent || ''
          }, '*');

          updateOverlayPosition();
        };

        const onKey = (e) => {
          if (e.key === 'Enter' && !['P', 'BLOCKQUOTE', 'LI'].includes(target.tagName)) {
            e.preventDefault();
            target.blur();
          } else if (e.key === 'Escape') {
            target.blur();
          }
        };

        target.addEventListener('blur', onBlur);
        target.addEventListener('keydown', onKey);
      }

      // ─── Click Listener ───
      document.addEventListener('click', function(e) {
        if (e.target.closest('#studio-quick-toolbar') || e.target.closest('.studio-resize-handle')) {
          return;
        }

        const target = e.target;
        if (isInternalStudioNode(target)) {
          removeSelection();
          window.parent.postMessage({ type: 'ELEMENT_SELECTED', selector: '', styles: {}, attrs: {}, elementPath: '', componentId: null }, '*');
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        selectElement(target, false);
      }, true);

      // ─── Double Click for Direct Inline Text Editing ───
      document.addEventListener('dblclick', function(e) {
        if (isInternalStudioNode(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        startInlineEdit(e.target);
      }, true);

      // ─── Context Menu Listener (Right-click) ───
      document.addEventListener('contextmenu', function(e) {
        if (isInternalStudioNode(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        selectElement(target, false);
        const tag = target.tagName.toLowerCase();
        const id = target.id ? '#' + target.id : '';
        const cls = target.className && typeof target.className === 'string'
          ? '.' + target.className.split(' ').filter(c => c && !c.startsWith('studio-'))[0]
          : '';
        const tagText = tag + id + (cls ? cls.slice(0, 14) : '');
        const path = getIndexPath(target);

        window.parent.postMessage({
          type: 'OPEN_CONTEXT_MENU',
          x: e.clientX,
          y: e.clientY,
          path,
          tagText
        }, '*');
      }, true);

      // ─── Hover Listener (FIXED coords) ───
      document.body.addEventListener('mousemove', function(e) {
        if (isEditingInline) {
          if (hoverBox) hoverBox.style.display = 'none';
          return;
        }
        const t = e.target;
        if (!t || isInternalStudioNode(t) || t === currentSelected || (currentSelected && currentSelected.contains(t))) {
          if (hoverBox) hoverBox.style.display = 'none';
          return;
        }
        const rect = t.getBoundingClientRect();
        if (hoverBox) {
          hoverBox.style.display = 'block';
          hoverBox.style.top = rect.top + 'px';
          hoverBox.style.left = rect.left + 'px';
          hoverBox.style.width = Math.max(rect.width, 2) + 'px';
          hoverBox.style.height = Math.max(rect.height, 2) + 'px';
        }
      });

      document.body.addEventListener('mouseleave', function() {
        if (hoverBox) hoverBox.style.display = 'none';
      });

      // ─── Incoming Actions From Parent ───
      window.addEventListener('message', function(msg) {
        if (!msg.data) return;
        if (msg.data.type === 'ACTION_SELECT_PARENT' && currentSelected) {
          const parent = currentSelected.parentElement;
          if (parent && !isInternalStudioNode(parent)) {
            selectElement(parent, false);
          }
        }
        if (msg.data.type === 'ACTION_START_INLINE_EDIT' && currentSelected) {
          startInlineEdit(currentSelected);
        }
        if (msg.data.type === 'REQUEST_UPDATE_RECT') {
          updateOverlayPosition();
        }
        if (msg.data.type === 'ACTION_TOGGLE_LOCK' && msg.data.path) {
          const root = document.getElementById('canvas-root') || document.body;
          const el = getElementByPath(root, msg.data.path);
          if (el) {
            const isLocked = el.getAttribute('data-locked') === 'true';
            if (isLocked) {
              el.removeAttribute('data-locked');
              el.style.pointerEvents = '';
              el.style.userSelect = '';
            } else {
              el.setAttribute('data-locked', 'true');
              el.style.pointerEvents = 'none';
              el.style.userSelect = 'none';
              removeSelection();
            }
            const canvasRoot = document.getElementById('canvas-root');
            if (canvasRoot) {
              window.parent.postMessage({
                type: 'CANVAS_HTML_CHANGED',
                html: canvasRoot.innerHTML
              }, '*');
            }
          }
        }
      });

      // ─── Resize Handles Drag Logic ───
      let isResizing = false;
      let activeHandle = null;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;

      document.querySelectorAll('.studio-resize-handle').forEach(function(h) {
        h.addEventListener('mousedown', function(e) {
          e.stopPropagation();
          e.preventDefault();
          if (!currentSelected) return;

          isResizing = true;
          activeHandle = h.getAttribute('data-handle');
          startX = e.clientX;
          startY = e.clientY;
          const rect = currentSelected.getBoundingClientRect();
          startW = rect.width;
          startH = rect.height;

          function onMouseMove(ev) {
            if (!isResizing || !currentSelected) return;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            if (activeHandle === 'r' || activeHandle === 'br') {
              const newW = Math.max(20, Math.round(startW + dx));
              currentSelected.style.width = newW + 'px';
            } else if (activeHandle === 'l') {
              const newW = Math.max(20, Math.round(startW - dx));
              currentSelected.style.width = newW + 'px';
            }

            if (activeHandle === 'b' || activeHandle === 'br') {
              const newH = Math.max(15, Math.round(startH + dy));
              currentSelected.style.height = newH + 'px';
            }

            updateOverlayPosition();
          }

          function onMouseUp() {
            if (isResizing) {
              isResizing = false;
              activeHandle = null;
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);

              const root = document.getElementById('canvas-root');
              if (root) {
                window.parent.postMessage({
                  type: 'CANVAS_HTML_CHANGED',
                  html: root.innerHTML
                }, '*');
              }
            }
          }

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });
      });

      // ─── Drag and Drop Template Block Insertion (FIXED coords) ───
      document.body.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const t = e.target;
        if (isInternalStudioNode(t)) return;

        const rect = t.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;

        if (dropIndicator) {
          dropIndicator.style.display = 'block';
          dropIndicator.style.left = rect.left + 'px';
          dropIndicator.style.width = rect.width + 'px';

          if (offsetY < rect.height * 0.35) {
            dropIndicator.style.top = (rect.top - 2) + 'px';
          } else {
            dropIndicator.style.top = (rect.bottom - 2) + 'px';
          }
        }
      });

      document.body.addEventListener('dragleave', function() {
        if (dropIndicator) dropIndicator.style.display = 'none';
      });

      document.body.addEventListener('drop', function(e) {
        e.preventDefault();
        if (dropIndicator) dropIndicator.style.display = 'none';
        const templateHtml = e.dataTransfer.getData('application/x-template-html');
        const templateCss = e.dataTransfer.getData('application/x-template-css');
        if (!templateHtml) return;

        const t = e.target;
        if (isInternalStudioNode(t)) {
          window.parent.postMessage({
            type: 'ACTION_INSERT_BLOCK',
            html: templateHtml,
            css: templateCss || '',
            position: 'append'
          }, '*');
          return;
        }

        const targetPath = getIndexPath(t);
        const rect = t.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        let position = 'inside';
        if (offsetY < rect.height * 0.35) position = 'before';
        else if (offsetY > rect.height * 0.65) position = 'after';

        window.parent.postMessage({
          type: 'ACTION_INSERT_BLOCK',
          html: templateHtml,
          css: templateCss || '',
          targetPath,
          position
        }, '*');
      });

      // ─── Keyboard Navigation Inside Canvas ───
      window.addEventListener('keydown', function(e) {
        if (isEditingInline) return;
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea') return;

        if (e.key === 'Escape') {
          removeSelection();
          window.parent.postMessage({ type: 'ELEMENT_SELECTED', selector: '', styles: {}, attrs: {}, elementPath: '', componentId: null }, '*');
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && currentSelected) {
          e.preventDefault();
          const path = getIndexPath(currentSelected);
          removeSelection();
          window.parent.postMessage({ type: 'ACTION_DELETE_ELEMENT', path }, '*');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && currentSelected) {
          e.preventDefault();
          const path = getIndexPath(currentSelected);
          window.parent.postMessage({ type: 'ACTION_DUPLICATE_ELEMENT', path }, '*');
        }
      });

      // Continuous alignment on scroll and window resize
      window.addEventListener('resize', updateOverlayPosition, true);
      window.addEventListener('scroll', updateOverlayPosition, true);
      document.addEventListener('scroll', updateOverlayPosition, true);

      // ─── Incoming Messages From Parent ───
      window.addEventListener('message', function(msg) {
        if (!msg.data) return;

        if (msg.data.type === 'UPDATE_HTML_SEAMLESS') {
          const scrollX = window.scrollX;
          const scrollY = window.scrollY;
          const root = document.getElementById('canvas-root');

          if (root && typeof msg.data.html === 'string') {
            root.innerHTML = msg.data.html;
          }

          const userStyles = document.getElementById('studio-user-styles');
          if (userStyles && typeof msg.data.css === 'string') {
            userStyles.textContent = msg.data.css;
          }

          window.scrollTo(scrollX, scrollY);

          // Restore selection safely
          if (currentSelectedPath) {
            const el = getElementByIndexPath(currentSelectedPath);
            if (el) {
              currentSelected = el;
              if (window.ResizeObserver && resizeObserver) {
                try { resizeObserver.observe(currentSelected); } catch(e) {}
              }
              updateOverlayPosition();
            } else {
              removeSelection();
            }
          }
        }

        if (msg.data.type === 'HIGHLIGHT_ELEMENT') {
          const path = msg.data.path;
          if (path === null || path === undefined || path === '') {
            removeSelection();
            return;
          }
          const el = getElementByIndexPath(path);
          if (el) {
            selectElement(el, true);
          } else {
            removeSelection();
          }
        }

        if (msg.data.type === 'HOVER_ELEMENT') {
          const hoverP = msg.data.path;
          if (!hoverP) {
            if (hoverBox) hoverBox.style.display = 'none';
            return;
          }
          const el = getElementByIndexPath(hoverP);
          if (el && hoverBox) {
            const rect = el.getBoundingClientRect();
            hoverBox.style.display = 'block';
            hoverBox.style.top = rect.top + 'px';
            hoverBox.style.left = rect.left + 'px';
            hoverBox.style.width = Math.max(rect.width, 2) + 'px';
            hoverBox.style.height = Math.max(rect.height, 2) + 'px';
          }
        }
      });

      try {
        ${rawJs}
      } catch (err) {
        console.warn('Erro na execução do script personalizado:', err);
      }
    })();
  </script>
</body>
</html>`;
  }, []);

  // Initialization & Live Content Sync
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const renderedHtml = getRenderedHtml();

    // If iframe is already initialized and DOM is alive, update via seamless message
    if (isInitializedRef.current && iframe.contentDocument && iframe.contentDocument.getElementById('canvas-root')) {
      if (lastHtmlSentRef.current !== renderedHtml || lastCssSentRef.current !== css) {
        lastHtmlSentRef.current = renderedHtml;
        lastCssSentRef.current = css;
        iframe.contentWindow?.postMessage({
          type: 'UPDATE_HTML_SEAMLESS',
          html: renderedHtml,
          css
        }, '*');
      }
      return;
    }

    // Initial load into iframe
    lastHtmlSentRef.current = renderedHtml;
    lastCssSentRef.current = css;
    const documentContent = buildIframeDoc(renderedHtml, css, js);
    iframe.srcdoc = documentContent;
    isInitializedRef.current = true;
  }, [getRenderedHtml, css, js, buildIframeDoc]);

  // Sync Highlight Path from Sidebar / Layers
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendHighlight = () => {
      iframe.contentWindow?.postMessage({
        type: 'HIGHLIGHT_ELEMENT',
        path: highlightPath ?? null
      }, '*');
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      sendHighlight();
    } else {
      iframe.addEventListener('load', sendHighlight, { once: true });
    }
  }, [highlightPath]);

  // Sync Hover Path from Layers tree
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({
      type: 'HOVER_ELEMENT',
      path: hoverPath ?? null
    }, '*');
  }, [hoverPath]);

  // Global click to close context menu
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Handle Incoming Messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      switch (event.data.type) {
        case 'ELEMENT_SELECTED':
          onElementSelect(
            event.data.selector || '',
            event.data.styles || {},
            event.data.attrs || {},
            event.data.elementPath || '',
            event.data.componentId || null
          );
          break;

        case 'INLINE_TEXT_CHANGED':
          if (onInlineContentChange) {
            onInlineContentChange(event.data.path, event.data.text);
          }
          break;

        case 'ACTION_DELETE_ELEMENT':
          if (onDeleteElement) {
            onDeleteElement(event.data.path);
          }
          break;

        case 'ACTION_DUPLICATE_ELEMENT':
          if (onDuplicateElement) {
            onDuplicateElement(event.data.path);
          }
          break;

        case 'ACTION_MOVE_ELEMENT_DIRECTION':
          if (onMoveElementDirection) {
            onMoveElementDirection(event.data.path, event.data.direction);
          }
          break;

        case 'CANVAS_HTML_CHANGED':
          if (onHtmlChange) {
            onHtmlChange(event.data.html);
          }
          break;

        case 'ACTION_INSERT_BLOCK':
          if (onInsertBlock) {
            onInsertBlock(event.data.html, event.data.css, event.data.targetPath, event.data.position);
          }
          break;

        case 'UPDATE_SELECTION_RECT':
          if (iframeRef.current) {
            const iframeRect = iframeRef.current.getBoundingClientRect();
            const scale = zoom / 100;
            const screenTop = iframeRect.top + event.data.rect.top * scale;
            const screenLeft = iframeRect.left + event.data.rect.left * scale;
            const screenBottom = iframeRect.top + event.data.rect.bottom * scale;
            const screenRight = iframeRect.left + event.data.rect.right * scale;
            setSelectionRect({
              top: screenTop,
              left: screenLeft,
              width: event.data.rect.width * scale,
              height: event.data.rect.height * scale,
              bottom: screenBottom,
              right: screenRight
            });
            setSelectionTagText(event.data.tagText);
            setActiveElementPath(event.data.path);
          }
          break;

        case 'HIDE_SELECTION_RECT':
          setSelectionRect(null);
          setActiveElementPath(null);
          break;

        case 'OPEN_CONTEXT_MENU':
          if (iframeRef.current) {
            const iframeRect = iframeRef.current.getBoundingClientRect();
            const scale = zoom / 100;
            const screenX = iframeRect.left + event.data.x * scale;
            const screenY = iframeRect.top + event.data.y * scale;
            setContextMenu({
              visible: true,
              x: screenX,
              y: screenY,
              path: event.data.path,
              tagText: event.data.tagText
            });
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    onElementSelect,
    onInlineContentChange,
    onDeleteElement,
    onDuplicateElement,
    onMoveElementDirection,
    onSelectParentElement,
    onHtmlChange,
    onInsertBlock
  ]);

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

      {selectionRect && createPortal(
        <div
          id="studio-quick-toolbar"
          role="toolbar"
          aria-label="Ações do Elemento"
          className="fixed z-[999999] bg-[#0f0b18] border border-purple-500/50 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-1.5 text-xs text-white select-none animate-in fade-in duration-100"
          style={{
            top: (() => {
              let t = selectionRect.top - 46;
              if (t < 8) t = selectionRect.bottom + 8;
              return t;
            })(),
            left: Math.max(8, Math.min(selectionRect.left, window.innerWidth - 380))
          }}
        >
          <span className="bg-purple-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider max-w-[120px] truncate">
            {selectionTagText || 'element'}
          </span>
          <button
            type="button"
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage({ type: 'ACTION_SELECT_PARENT' }, '*');
            }}
            className="px-2 py-1 bg-slate-900 hover:bg-purple-600 border border-slate-700 hover:border-purple-400 rounded-lg font-medium transition-all cursor-pointer"
            title="Selecionar Elemento Pai"
          >
            ▲ Pai
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeElementPath && onMoveElementDirection) {
                onMoveElementDirection(activeElementPath, 'up');
                setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: 'REQUEST_UPDATE_RECT' }, '*'), 50);
              }
            }}
            className="px-2 py-1 bg-slate-900 hover:bg-purple-600 border border-slate-700 hover:border-purple-400 rounded-lg font-medium transition-all cursor-pointer"
            title="Mover para Cima"
          >
            ↑ Cima
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeElementPath && onMoveElementDirection) {
                onMoveElementDirection(activeElementPath, 'down');
                setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: 'REQUEST_UPDATE_RECT' }, '*'), 50);
              }
            }}
            className="px-2 py-1 bg-slate-900 hover:bg-purple-600 border border-slate-700 hover:border-purple-400 rounded-lg font-medium transition-all cursor-pointer"
            title="Mover para Baixo"
          >
            ↓ Baixo
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeElementPath && onDuplicateElement) {
                onDuplicateElement(activeElementPath);
              }
            }}
            className="px-2 py-1 bg-slate-900 hover:bg-purple-600 border border-slate-700 hover:border-purple-400 rounded-lg font-medium transition-all cursor-pointer"
            title="Duplicar Elemento"
          >
            📋 Duplicar
          </button>
          <button
            type="button"
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage({ type: 'ACTION_START_INLINE_EDIT' }, '*');
            }}
            className="px-2 py-1 bg-slate-900 hover:bg-purple-600 border border-slate-700 hover:border-purple-400 rounded-lg font-medium transition-all cursor-pointer"
            title="Editar Texto Diretamente"
          >
            ✏️ Texto
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeElementPath && onDeleteElement) {
                onDeleteElement(activeElementPath);
                setSelectionRect(null);
              }
            }}
            className="px-2 py-1 bg-rose-950/40 hover:bg-rose-600 border border-rose-900/60 hover:border-rose-500 text-rose-300 hover:text-white rounded-lg font-medium transition-all cursor-pointer"
            title="Excluir Elemento"
          >
            🗑️ Excluir
          </button>
        </div>,
        document.body
      )}

      {contextMenu && contextMenu.visible && createPortal(
        <div
          className="fixed z-[999999] bg-[#0f0b18] border border-purple-500/40 rounded-xl shadow-2xl py-1.5 w-52 text-xs text-white select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 240),
            left: Math.min(contextMenu.x, window.innerWidth - 220)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>{contextMenu.tagText}</span>
            <button 
              onClick={() => setContextMenu(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="p-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                if (onDuplicateElement) onDuplicateElement(contextMenu.path);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-600/30 hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              📋 Duplicar
            </button>
            <button
              type="button"
              onClick={() => {
                if (onMoveElementDirection) {
                  onMoveElementDirection(contextMenu.path, 'down');
                  setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: 'REQUEST_UPDATE_RECT' }, '*'), 50);
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-600/30 hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              ⬆️ Trazer para Frente
            </button>
            <button
              type="button"
              onClick={() => {
                if (onMoveElementDirection) {
                  onMoveElementDirection(contextMenu.path, 'up');
                  setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: 'REQUEST_UPDATE_RECT' }, '*'), 50);
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-600/30 hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              ⬇️ Enviar para Trás
            </button>
            <button
              type="button"
              onClick={() => {
                iframeRef.current?.contentWindow?.postMessage({
                  type: 'ACTION_TOGGLE_LOCK',
                  path: contextMenu.path
                }, '*');
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-600/30 hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-800/80 mt-1 pt-1.5"
            >
              🔒 Bloquear / Desbloquear
            </button>
            <button
              type="button"
              onClick={() => {
                if (onDeleteElement) onDeleteElement(contextMenu.path);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-600/20 hover:text-rose-300 text-rose-400 flex items-center gap-2 transition-colors cursor-pointer"
            >
              🗑️ Excluir
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
