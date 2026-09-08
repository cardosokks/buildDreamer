import { useState, useCallback } from 'react';
import { ComponentNode } from '../types/canvas';
import { updateComponentNode, removeNodeById } from '../utils/tree';
import { parseDocFromHtml, serializeBodyContent, getElementByPath } from '../utils/domUtils';

export const useElementEditor = (
    activePageRef: React.MutableRefObject<any>,
    handleCodeChange: (type: 'html' | 'css' | 'js' | 'components', value: any) => Promise<void>,
    selectedPath: string | null,
    selectedComponentId: string | null,
    setSelectedPath: (path: string | null) => void,
    setSelectedSelector: (selector: string | null) => void,
    setSelectedStyles: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    setSelectedAttrs: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    canvasRef?: React.RefObject<any>
) => {

    const handleStyleChange = useCallback((prop: string, value: string) => {
        const currentPage = activePageRef.current;
        if (!currentPage || !selectedPath) return;

        setSelectedStyles(prev => ({ ...prev, [prop]: value }));

        // 0. Immediate style application to active DOM element in canvas
        if (canvasRef?.current?.applyStyle) {
            canvasRef.current.applyStyle(selectedPath, prop, value);
        }

        // 1. Update old HTML string if it exists
        const doc = parseDocFromHtml(currentPage.html);
        const root = doc.getElementById('canvas-root') || doc.body;
        const el = getElementByPath(root, selectedPath);
        if (el && (el as HTMLElement).style) {
            const styleableEl = el as HTMLElement;
            if (value) {
                styleableEl.style.setProperty(prop, value);
            } else {
                styleableEl.style.removeProperty(prop);
            }
            const newHtml = serializeBodyContent(doc);
            handleCodeChange('html', newHtml);
        }

        // 2. Update component tree if it exists
        if (currentPage.components && selectedComponentId) {
            const newComponents = updateComponentNode(currentPage.components, selectedComponentId, (node) => {
                const newStyles = { ...node.props.style, [prop]: value };
                if (!value) {
                    const temp = { ...newStyles } as Record<string, any>;
                    delete temp[prop];
                    return { ...node, props: { ...node.props, style: temp as React.CSSProperties } };
                }
                return { ...node, props: { ...node.props, style: newStyles } };
            });
            handleCodeChange('components', newComponents);
        }
    }, [activePageRef, handleCodeChange, selectedPath, selectedComponentId, setSelectedStyles]);

    const handleInlineTextChange = useCallback((path: string, newText: string) => {
        const currentPage = activePageRef.current;
        if (!currentPage) return;
        const doc = parseDocFromHtml(currentPage.html);
        const root = doc.getElementById('canvas-root') || doc.body;
        const el = getElementByPath(root, path);
        if (el) {
            el.textContent = newText;
            const newHtml = serializeBodyContent(doc);
            handleCodeChange('html', newHtml);
        }
    }, [activePageRef, handleCodeChange]);

    const handleDuplicateElement = useCallback((path: string) => {
        const currentPage = activePageRef.current;
        if (!currentPage) return;
        
        const doc = parseDocFromHtml(currentPage.html);
        const root = doc.getElementById('canvas-root') || doc.body;
        const el = getElementByPath(root, path);
        if (el && el.parentElement) {
            const clone = el.cloneNode(true) as Element;
            el.parentElement.insertBefore(clone, el.nextSibling);
            const newHtml = serializeBodyContent(doc);
            handleCodeChange('html', newHtml);
        }
    }, [activePageRef, handleCodeChange]);

    const handleAttrChange = useCallback((attr: string, value: string) => {
        const currentPage = activePageRef.current;
        if (!currentPage || !selectedPath) return;
        
        setSelectedAttrs(prev => ({ ...prev, [attr]: value }));
    
        // 0. Immediate attribute application to active DOM element in canvas
        if (canvasRef?.current?.applyAttr) {
            canvasRef.current.applyAttr(selectedPath, attr, value);
        }

        // 1. Update old HTML string if it exists
        const doc = parseDocFromHtml(currentPage.html);
        const root = doc.getElementById('canvas-root') || doc.body;
        const el = getElementByPath(root, selectedPath);
        if (el) {
          if (attr === '_textContent') {
            el.textContent = value;
          } else {
            el.setAttribute(attr, value);
          }
          const newHtml = serializeBodyContent(doc);
          handleCodeChange('html', newHtml);
        }
    
        // 2. Update component tree if it exists
        if (currentPage.components && selectedComponentId) {
          const newComponents = updateComponentNode(currentPage.components, selectedComponentId, (node) => {
            if (attr === '_textContent') return { ...node, text: value };
            const newProps = { ...node.props, [attr]: value };
            return { ...node, props: newProps };
          });
          handleCodeChange('components', newComponents);
        }
    }, [activePageRef, handleCodeChange, selectedPath, selectedComponentId, setSelectedAttrs]);

    const handleMoveElementDirection = useCallback((path: string, direction: 'up' | 'down') => {
        const currentPage = activePageRef.current;
        if (!currentPage || !path) return;
        
        // 1. Update old HTML string if it exists
        const doc = parseDocFromHtml(currentPage.html);
        const root = doc.getElementById('canvas-root') || doc.body;
        const el = getElementByPath(root, path);
        if (el && el.parentElement) {
          const parent = el.parentElement;
          const siblings = Array.from(parent.children);
          const currentIndex = siblings.indexOf(el);
    
          if (direction === 'up' && currentIndex > 0) {
            parent.insertBefore(el, siblings[currentIndex - 1]);
          } else if (direction === 'down' && currentIndex < siblings.length - 1) {
            parent.insertBefore(el, siblings[currentIndex + 1].nextSibling);
          }
          
          const newHtml = serializeBodyContent(doc);
          handleCodeChange('html', newHtml);
        }
    }, [activePageRef, handleCodeChange]);

    const handleDeleteElement = useCallback((path: string) => {
        const currentPage = activePageRef.current;
        if (!currentPage) return;
        
        // 1. Update old HTML string if it exists
        const doc = parseDocFromHtml(currentPage.html);
        const root = doc.getElementById('canvas-root') || doc.body;
        const el = getElementByPath(root, path);
        if (el && el.parentElement) {
          el.parentElement.removeChild(el);
          const newHtml = serializeBodyContent(doc);
          handleCodeChange('html', newHtml);
        }
    
        // 2. Update component tree if it exists
        if (currentPage.components && selectedComponentId) {
          const newComponents = removeNodeById(currentPage.components, selectedComponentId);
          handleCodeChange('components', newComponents);
        }
        
        setSelectedPath(null);
        setSelectedSelector(null);
    }, [activePageRef, handleCodeChange, selectedComponentId, setSelectedPath, setSelectedSelector]);

    return {
        handleStyleChange,
        handleInlineTextChange,
        handleDuplicateElement,
        handleAttrChange,
        handleMoveElementDirection,
        handleDeleteElement
    };
};
