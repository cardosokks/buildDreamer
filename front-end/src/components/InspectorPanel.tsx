import React from 'react';
import { ComponentNode } from '../types/canvas';

interface InspectorPanelProps {
  node: ComponentNode;
  onUpdate: (updatedNode: ComponentNode) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ node, onUpdate }) => {
  return (
    <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-white">
      <h3 className="font-bold text-sm mb-4">Inspector: {node.type}</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Text Content</label>
          <input
            type="text"
            value={node.text || ''}
            onChange={(e) => onUpdate({ ...node, text: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">CSS Class</label>
          <input
            type="text"
            value={node.props.className || ''}
            onChange={(e) => onUpdate({ ...node, props: { ...node.props, className: e.target.value } })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
    </div>
  );
};
