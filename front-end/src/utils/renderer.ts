import { ComponentNode } from '../types/canvas';

export const renderNodeToHtml = (node: ComponentNode): string => {
  const { id, type, props, text, children } = node;
  const className = props.className || '';
  
  // Mapeamento básico de tipos para tags HTML
  const tagMap: Record<string, string> = {
    container: 'div',
    text: 'p',
    image: 'img',
    button: 'button',
    section: 'section'
  };

  const tag = tagMap[type] || 'div';
  const childrenHtml = children ? children.map(renderNodeToHtml).join('') : (text || '');
  
  // Monta atributos
  const attrs = Object.entries(props)
    .filter(([key]) => key !== 'className' && key !== 'style')
    .map(([key, val]) => `${key}="${val}"`)
    .join(' ');

  return `<${tag} data-component-id="${id}" class="${className}" ${attrs}>${childrenHtml}</${tag}>`;
};

export const renderTreeToHtml = (components: ComponentNode[]): string => {
  return components.map(renderNodeToHtml).join('');
};
