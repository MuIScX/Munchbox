"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, X } from "lucide-react";

const ITEM_H = 44;

export default function CategorySortPopover({ isOpen, onClose, categoryOrder, onChange, categoryMap, title = "Category Order" }) {
  const ref = useRef(null);
  const listRef = useRef(null);
  const [order, setOrder] = useState(categoryOrder);
  const orderRef = useRef(order);

  // dragRef holds all mutable drag state — avoids stale closures entirely
  const dragRef = useRef(null); // { fromIndex, overIndex }
  const [dragState, setDragState] = useState(null); // { fromIndex, overIndex, ghostX, ghostY }

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    setOrder(categoryOrder);
    orderRef.current = categoryOrder;
  }, [categoryOrder]);

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

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    dragRef.current = { fromIndex: index, overIndex: index };

    setDragState({
      fromIndex: index,
      overIndex: index,
      ghostX: e.clientX,
      ghostY: e.clientY,
      offsetX,
      offsetY,
      active: false,
    });

    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const listRect = listRef.current?.getBoundingClientRect();
      if (!listRect) return;
      const relY = e.clientY - listRect.top;
      const over = Math.max(0, Math.min(orderRef.current.length - 1, Math.floor(relY / ITEM_H)));
      dragRef.current.overIndex = over;
      setDragState(prev => prev ? {
        ...prev,
        overIndex: over,
        ghostX: e.clientX,
        ghostY: e.clientY,
        active: prev.active || Math.sqrt(dx * dx + dy * dy) > 5,
      } : null);
    };

    const onUp = () => {
      const { fromIndex, overIndex } = dragRef.current;
      if (fromIndex !== overIndex) {
        const next = [...orderRef.current];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(overIndex, 0, moved);
        setOrder(next);
        orderRef.current = next;
        setTimeout(() => onChange(next), 0);
      }
      dragRef.current = null;
      setDragState(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [onChange]);

  if (!isOpen) return null;

  const getTranslateY = (index) => {
    if (!dragState) return 0;
    const { fromIndex, overIndex } = dragState;
    if (index === fromIndex) return 0;
    if (fromIndex < overIndex && index > fromIndex && index <= overIndex) return -ITEM_H;
    if (fromIndex > overIndex && index < fromIndex && index >= overIndex) return ITEM_H;
    return 0;
  };

  return (
    <>
      {/* Ghost chip following cursor */}
      {dragState?.active && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: dragState.ghostX - dragState.offsetX, top: dragState.ghostY - dragState.offsetY }}
        >
          <div className="flex items-center gap-2 pl-2 pr-4 py-2.5 bg-white border border-orange-300 rounded-xl shadow-xl text-sm font-semibold text-slate-700 w-44">
            <GripVertical size={14} className="text-orange-400 shrink-0" />
            {categoryMap[order[dragState.fromIndex]]}
          </div>
        </div>
      )}

      {/* Popover */}
      <div
        ref={ref}
        className="absolute top-full right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl w-52 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</span>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div
          ref={listRef}
          className="relative select-none"
          style={{ height: order.length * ITEM_H }}
        >
          {order.map((catId, index) => {
            const isDragging = dragState?.fromIndex === index;
            return (
              <div
                key={catId}
                style={{
                  position: "absolute",
                  top: index * ITEM_H,
                  left: 0,
                  right: 0,
                  height: ITEM_H,
                  transform: `translateY(${getTranslateY(index)}px)`,
                  transition: isDragging ? "none" : "transform 150ms ease",
                  opacity: isDragging && dragState?.active ? 0 : 1,
                }}
                onPointerDown={(e) => handlePointerDown(e, index)}
                className="flex items-center gap-2.5 px-3 cursor-grab active:cursor-grabbing"
              >
                  <GripVertical size={14} className="text-slate-300 shrink-0" />
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
