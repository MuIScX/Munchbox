"use client";
import { useState, useMemo } from "react";
import { X, Check } from "lucide-react";
import { CATEGORY_MAP } from "../../lib/schema";

export default function UpdateInventoryModal({ isOpen, onClose, ingredients, onSave }) {
  const [stockValues, setStockValues] = useState({});

  const grouped = useMemo(() => {
    const groups = {};
    for (const ing of ingredients) {
      const cat = String(ing.category);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ing);
    }
    return groups;
  }, [ingredients]);

  if (!isOpen) return null;

  const handleChange = (id, value) => {
    setStockValues(prev => ({ ...prev, [String(id)]: value }));
  };

  const handleSave = () => {
    const updates = Object.entries(stockValues)
      .filter(([, v]) => v !== "")
      .map(([id, v]) => ({ id, value: parseFloat(v) }));
    onSave(updates);
    setStockValues({});
  };

  const handleClose = () => {
    setStockValues({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300 shrink-0" />
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Update Stock</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter the current amount for any ingredient</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6 custom-scrollbar">
          {Object.entries(grouped).map(([catId, items]) => (
            <div key={catId}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2 pb-1 border-b border-orange-100">
                {CATEGORY_MAP[catId] || catId}
              </h3>
              <div className="space-y-0.5">
                {items.map((ing) => {
                  const id = ing.ingredient_id || ing.id;
                  const name = ing.ingredient_name || ing.name || ing.item;
                  return (
                    <div key={id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <span className="flex-1 text-sm text-slate-700 font-medium">{name}</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={stockValues[String(id)] ?? ""}
                        placeholder="—"
                        onChange={(e) => handleChange(id, e.target.value)}
                        className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="w-10 text-xs text-slate-400 text-right shrink-0">{ing.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition shadow-sm"
          >
            <Check size={15} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
