"use client";
import { useState } from "react";
import { Check, X, Trash2, Pencil } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema";

export default function IngredientRow({ row, onUpdateStock, showDelete, onDeleteClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const currentId = row.ingredient_id || row.id;
  const name = row.ingredient_name || row.name || row.item;
  const currentStock = Number(row.stock_left ?? row.stock ?? 0);

  const newStock = editValue === "" ? currentStock : Number(editValue);
  const hasChanged = isEditing && newStock !== currentStock;

  const stockColorClass = (isEditing && hasChanged) ? "text-emerald-600 font-semibold" : "text-slate-800 font-semibold";

  const handleSave = () => {
    if (editValue === "") return;
    onUpdateStock(currentId, newStock);
    setIsEditing(false);
    setEditValue("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  return (
    <tr className="hover:bg-orange-50/40 transition-colors">
      <td className="px-6 py-3 text-slate-800 font-semibold">{name}</td>
      <td className="px-6 py-3 text-slate-500 text-sm">{CATEGORY_MAP[row.category] || row.category || 'Unknown'}</td>
      <td className={`px-6 py-3 text-center transition-colors duration-200 ${stockColorClass}`}>
        {isEditing && editValue !== "" ? newStock : currentStock}
      </td>
      <td className="px-6 py-3 text-center text-slate-500 text-sm">{row.unit}</td>
      <td className="px-6 py-3">
        <div className="flex justify-center items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={editValue}
                placeholder={currentStock}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                autoFocus
                className="font-bold text-slate-700 w-24 text-center border-2 border-orange-400 rounded-xl px-2 py-1 outline-none focus:ring-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex gap-1">
              <button onClick={handleSave} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                <Check className="text-emerald-600" size={16} />
              </button>
              <button onClick={handleCancel} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                <X className="text-red-500" size={16} />
              </button>
            </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-500 transition-colors"
              >
                <Pencil size={14} /> Edit
              </button>
              {showDelete && (
                <button onClick={() => onDeleteClick(row)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete Ingredient">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
