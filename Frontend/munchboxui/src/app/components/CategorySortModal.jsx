"use client";
import { useState, useRef } from "react";
import { X, GripVertical } from "lucide-react";

export default function CategorySortModal({ isOpen, onClose, categoryOrder, onApply, categoryMap }) {
  const [order, setOrder] = useState(categoryOrder);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const dragNode = useRef(null);

  if (!isOpen) return null;

  const handleDragStart = (e, index) => {
    dragNode.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // transparent drag image so we control the look
    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (index !== dragIndex) setOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setOrder(next);
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleApply = () => {
    onApply(order);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Sort by Category</h2>
            <p className="text-xs text-slate-400 mt-0.5">Drag to reorder</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-1 select-none">
          {order.map((catId, index) => (
            <div
              key={catId}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all duration-150 cursor-grab active:cursor-grabbing
                ${dragIndex === index ? "opacity-40 scale-95 border-dashed border-orange-300 bg-orange-50" : "border-transparent bg-slate-50 hover:bg-orange-50/50"}
                ${overIndex === index && dragIndex !== index ? "border-orange-400 bg-orange-50 scale-[1.02] shadow-sm" : ""}
              `}
            >
              <GripVertical size={16} className="text-slate-300 shrink-0" />
              <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                {index + 1}
              </span>
              <span className="text-sm font-semibold text-slate-700">{categoryMap[catId]}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-bold rounded-xl transition shadow-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
