"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { CATEGORY_MAP } from "../../lib/schema";

export default function EditIngredientModal({ isOpen, onClose, ingredient, onSave }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    if (ingredient) {
      setName(ingredient.ingredient_name || ingredient.name || "");
      setCategory(String(ingredient.category || ""));
      setUnit(ingredient.unit || "");
    }
  }, [ingredient]);

  if (!isOpen || !ingredient) return null;

  const handleSave = () => {
    if (!name.trim() || !category || !unit.trim()) return;
    onSave({
      ingredient_id: ingredient.ingredient_id || ingredient.id,
      name: name.trim(),
      category: parseInt(category),
      unit: unit.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Edit Ingredient</h2>
            <p className="text-xs text-slate-400 mt-0.5">Update name, category, and unit</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Ingredient Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
              placeholder="e.g. Tomato"
            />
          </div>

          {/* Category + Unit side by side */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer bg-white transition"
              >
                <option value="">Select...</option>
                {Object.entries(CATEGORY_MAP).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>

            <div className="w-32">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                placeholder="e.g. kg"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !category || !unit.trim()}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-sm"
          >
            Update Ingredient
          </button>
        </div>
      </div>
    </div>
  );
}
