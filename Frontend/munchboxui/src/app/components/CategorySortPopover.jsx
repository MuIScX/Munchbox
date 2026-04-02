"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, X } from "lucide-react";

const ITEM_H = 44;

export default function CategorySortPopover({ isOpen, onClose, categoryOrder, onChange, categoryMap }) {
  const ref = useRef(null);
  const listRef = useRef(null);
  const [order, setOrder] = useState(categoryOrder);
  const [dragState, setDragState] = useState(null);
  // dragState: { fromIndex, overIndex, ghostX, ghostY, label }

  useEffect(() => { setOrder(categoryOrder); }, [categoryOrder]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  const handlePointerDown = useCallback((e, index) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const startY = e.clientY;
    const listTop = listRef.current?.getBoundingClientRect().top ?? 0;

    setDragState({
      fromIndex: index,
      overIndex: index,
      ghostX: e.clientX,
      ghostY: e.clientY,
      label: categoryMap[order[index]],
    });

    const onMove = (e) => {
      const relY = e.clientY - listTop;
      const over = Math.max(0, Math.min(order.length - 1, Math.floor(relY / ITEM_H)));
      setDragState(prev => prev ? { ...prev, overIndex: over, ghostX: e.clientX, ghostY: e.clientY } : null);
    };

    const onUp = () => {
      setDragState(prev => {
        if (prev) {
          setOrder(old => {
            const next = [...old];
            const [moved] = next.splice(prev.fromIndex, 1);
            next.splice(prev.overIndex, 0, moved);
            setTimeout(() => onChange(next), 0);
            return next;
          });
        }
        return null;
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [order, categoryMap, onChange]);

  if (!isOpen) return null;

  // Calculate visual Y offset for each item during drag
  const getTranslateY = (index) => {
    if (!dragState) return 0;
    const { fromIndex, overIndex } = dragState;
    if (index === fromIndex) return 0; // ghost handles the dragged item visually
    if (fromIndex < overIndex) {
      // dragging downward: items between shift up
      if (index > fromIndex && index <= overIndex) return -ITEM_H;
    } else {
      // dragging upward: items between shift down
      if (index < fromIndex && index >= overIndex) return ITEM_H;
    }
    return 0;
  };

  return (
    <>
      {/* Floating ghost chip following cursor */}
      {dragState && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: dragState.ghostX - 12, top: dragState.ghostY - ITEM_H / 2 }}
        >
          <div className="flex items-center gap-2 pl-2 pr-4 py-2.5 bg-white border border-orange-300 rounded-xl shadow-xl text-sm font-semibold text-slate-700 opacity-95 w-44">
            <GripVertical size={14} className="text-orange-400 shrink-0" />
            {dragState.label}
          </div>
        </div>
      )}

      {/* Popover */}
      <div
        ref={ref}
        className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl w-52 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Category Order</span>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* List with fixed height so items can shift via transform */}
        <div
          ref={listRef}
          className="py-1 select-none relative"
          style={{ height: order.length * ITEM_H }}
        >
          {order.map((catId, index) => {
            const isDragging = dragState?.fromIndex === index;
            const translateY = getTranslateY(index);
            return (
              <div
                key={catId}
                style={{
                  transform: `translateY(${translateY}px)`,
                  transition: isDragging ? "none" : "transform 150ms ease",
                  opacity: isDragging ? 0 : 1,
                  height: ITEM_H,
                  position: "absolute",
                  top: index * ITEM_H,
                  left: 0,
                  right: 0,
                }}
                className="flex items-center gap-2.5 px-3"
              >
                <div
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
                >
                  <GripVertical size={14} className="text-slate-300 hover:text-slate-400 transition-colors" />
                </div>
                <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">{index + 1}</span>
                <span className="text-sm font-medium text-slate-700">{categoryMap[catId]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
