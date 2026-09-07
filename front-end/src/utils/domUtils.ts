export const parseDocFromHtml = (htmlStr: string) => {
  const parser = new DOMParser();
  const cleanStr = String(htmlStr || '').trim();
  // Se o HTML não tiver wrapper <div id="canvas-root">, envolve para manter a árvore normalizada
  if (cleanStr.includes('id="canvas-root"')) {
    return parser.parseFromString(cleanStr, 'text/html');
  } else {
    return parser.parseFromString(`<div id="canvas-root">${cleanStr}</div>`, 'text/html');
  }
};

export const serializeBodyContent = (doc: Document) => {
  const canvasRoot = doc.getElementById('canvas-root');
  if (canvasRoot) return canvasRoot.innerHTML;
  return doc.body ? doc.body.innerHTML : '';
};

export const getElementByPath = (root: Element, path: string): Element | null => {
  if (path === undefined || path === null || path === '') return null;
  const parts = String(path).split('.').map(p => parseInt(p, 10)).filter(n => !isNaN(n));
  if (parts.length === 0) return null;

  let current: Element | null = root;
  for (const idx of parts) {
    if (!current) return null;
    const validChildren: Element[] = Array.from(current.children).filter(
      (c: Element) => {
        let idStr = '';
        if (c.id && typeof c.id === 'string') {
          idStr = c.id;
        } else if (c.id && typeof c.id === 'object' && (c.id as any).animVal) {
          idStr = (c.id as any).animVal;
        }
        return !idStr.startsWith('studio-') && !c.classList.contains('studio-tool-btn');
      }
    );
    if (idx < 0 || idx >= validChildren.length) return null;
    current = validChildren[idx];
  }
  return current;
};
