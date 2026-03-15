"use client";
import { useState } from "react";
import { Minus, Plus, Check, X, Trash2, Pencil } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema";

export default function IngredientRow({ row, onUpdateStock, showDelete, onDeleteClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(0);

  const currentId = row.ingredient_id || row.id;
  const name = row.ingredient_name || row.name || row.item;
  const minVal = row.min_stock || row.minStock || 0;
  const currentStock = Number(row.stock_left ?? row.stock ?? 0);
  const isOk = currentStock >= minVal;

  const changeAmount = Number(editValue) || 0;
  const previewStock = isEditing ? Number((currentStock + changeAmount).toFixed(3)) : currentStock;

  let stockColorClass = "text-slate-800 font-semibold";
  if (isEditing) {
    if (changeAmount > 0) stockColorClass = "text-emerald-600 font-semibold";
    else if (changeAmount < 0) stockColorClass = "text-red-500 font-semibold";
  }

  const handleSave = () => {
    onUpdateStock(currentId, currentStock, changeAmount);
    setIsEditing(false);
    setEditValue(0);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(0);
  };

  return (
    <tr className="hover:bg-orange-50/40 transition-colors">
      <td className="px-6 py-4 text-slate-800 font-semibold">{name}</td>
      <td className="px-6 py-4 text-slate-500 text-sm">{CATEGORY_MAP[row.category] || row.category || 'Unknown'}</td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
          {isOk ? 'OK' : 'Low Stock'}
        </span>
      </td>
      <td className="px-6 py-4 text-center text-slate-600 font-medium">{minVal}</td>
      <td className={`px-6 py-4 text-center transition-colors duration-200 ${stockColorClass}`}>
        {previewStock}
      </td>
      <td className="px-6 py-4 text-center text-slate-500 text-sm">{row.unit}</td>
      <td className="px-6 py-4">
        <div className="flex justify-center items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center border-2 border-orange-400 rounded-xl px-2 py-1 gap-2 bg-white">
                <button onClick={() => setEditValue(v => (Number(v) || 0) - 1)} className="text-red-400 hover:text-red-600 transition-colors"><Minus size={15}/></button>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="font-bold text-slate-700 w-12 text-center bg-transparent border-none p-0 outline-none focus:ring-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button onClick={() => setEditValue(v => (Number(v) || 0) + 1)} className="text-emerald-500 hover:text-emerald-700 transition-colors"><Plus size={15}/></button>
              </div>
              <button onClick={handleSave} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                <Check className="text-emerald-600" size={16} />
              </button>
              <button onClick={handleCancel} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                <X className="text-red-500" size={16} />
              </button>
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
