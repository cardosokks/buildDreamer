export type ComponentType = 'container' | 'text' | 'image' | 'button' | 'section';

export interface ComponentNode {
  id: string;
  type: ComponentType;
  props: {
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  };
  children?: ComponentNode[];
  text?: string;
}

export interface PageData {
  id: string;
  components: ComponentNode[];
}

export type CanvasMessage =
  | { type: 'UPDATE_TREE'; tree: ComponentNode[] }
  | { type: 'SELECT_ELEMENT'; path: string | null }
  | { type: 'HIGHLIGHT_ELEMENT'; path: string | null }
  | { type: 'HOVER_ELEMENT'; path: string | null };

export type ParentMessage =
  | { type: 'ELEMENT_SELECTED'; path: string; selector: string; componentId: string | null }
  | { type: 'ELEMENT_HOVERED'; path: string | null }
  | { type: 'INLINE_TEXT_CHANGED'; path: string; text: string };
