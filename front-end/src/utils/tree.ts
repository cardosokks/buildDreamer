import { ComponentNode } from '../types/canvas';

export const findNodeById = (nodes: ComponentNode[], id: string): ComponentNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const updateComponentNode = (nodes: ComponentNode[], id: string, updater: (node: ComponentNode) => ComponentNode): ComponentNode[] => {
  return nodes.map(node => {
    if (node.id === id) {
      return updater(node);
    }
    if (node.children) {
      return { ...node, children: updateComponentNode(node.children, id, updater) };
    }
    return node;
  });
};

export const removeNodeById = (nodes: ComponentNode[], id: string): ComponentNode[] => {
  return nodes.filter(node => node.id !== id).map(node => {
    if (node.children) {
      return { ...node, children: removeNodeById(node.children, id) };
    }
    return node;
  });
};

export const addNodeToParentById = (nodes: ComponentNode[], parentId: string, newNode: ComponentNode, index: number): ComponentNode[] => {
  return nodes.map(node => {
    if (node.id === parentId) {
      const newChildren = node.children ? [...node.children] : [];
      newChildren.splice(index, 0, newNode);
      return { ...node, children: newChildren };
    }
    if (node.children) {
      return { ...node, children: addNodeToParentById(node.children, parentId, newNode, index) };
    }
    return node;
  });
};
