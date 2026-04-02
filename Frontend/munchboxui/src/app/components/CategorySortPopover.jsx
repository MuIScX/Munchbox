"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, X } from "lucide-react";

export default function CategorySortPopover({ isOpen, onClose, categoryOrder, onChange, categoryMap }) {
  const ref = useRef(null);
  const [order, setOrder] = useState(categoryOrder);
  const [dragging, setDragging] = useState(null); // index being dragged
  const [ghost, setGhost] = useState(null);        // { x, y, label }
  const overIndexRef = useRef(null);
  const draggingRef = useRef(null);
  const orderRef = useRef(order);

  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => { setOrder(categoryOrder); }, [categoryOrder]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  const handlePointerDown = useCallback((e, index) => {
    e.preventDefault();
    draggingRef.current = index;
    overIndexRef.current = index;
    setDragging(index);
    setGhost({ x: e.clientX, y: e.clientY, label: categoryMap[orderRef.current[index]] });

    const onMove = (e) => {
      setGhost({ x: e.clientX, y: e.clientY, label: categoryMap[orderRef.current[draggingRef.current]] });
    };

    const onUp = () => {
      const finalOrder = [...orderRef.current];
      onChange(finalOrder);
      setDragging(null);
      setGhost(null);
      draggingRef.current = null;
      overIndexRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [categoryMap, onChange]);

  const handlePointerEnter = useCallback((index) => {
    if (draggingRef.current === null || draggingRef.current === index) return;
    overIndexRef.current = index;
    setOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggingRef.current, 1);
      next.splice(index, 0, moved);
      draggingRef.current = index;
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Ghost element following cursor */}
      {ghost && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: ghost.x + 12, top: ghost.y - 16 }}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-orange-300 rounded-xl shadow-lg text-sm font-semibold text-orange-600 opacity-90">
            <GripVertical size={14} className="text-orange-400" />
            {ghost.label}
          </div>
        </div>
      )}

      {/* Popover */}
      <div
        ref={ref}
        className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl w-56 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Category Order</span>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="py-2 select-none">
          {order.map((catId, index) => (
            <div
              key={catId}
              onPointerEnter={() => handlePointerEnter(index)}
              className={`flex items-center gap-2.5 px-3 py-2.5 transition-all duration-100
                ${dragging === index ? "opacity-30" : "opacity-100"}
                ${draggingRef.current !== null && dragging !== index ? "bg-orange-50/40" : ""}
              `}
            >
              <div
                onPointerDown={(e) => handlePointerDown(e, index)}
                className="cursor-grab active:cursor-grabbing touch-none p-0.5"
              >
                <GripVertical size={14} className="text-slate-300 hover:text-slate-400 transition-colors" />
              </div>
              <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">{index + 1}</span>
              <span className="text-sm font-medium text-slate-700">{categoryMap[catId]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
