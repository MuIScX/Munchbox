"use client";
import { useState } from "react";
import { Minus, Plus, Check, X, Trash2 } from 'lucide-react';
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

  let stockColorClass = "text-slate-800";
  if (isEditing) {
    if (changeAmount > 0) stockColorClass = "text-emerald-500";
    else if (changeAmount < 0) stockColorClass = "text-red-500";
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
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 text-slate-700 font-medium">{name}</td>
      <td className="px-6 py-4 text-slate-500">{CATEGORY_MAP[row.category] || row.category || 'Unknown'}</td>
      <td className="px-6 py-4 text-slate-500">{row.unit}</td>
      <td className="px-6 py-4">
        <span className={`font-medium ${isOk ? 'text-emerald-500' : 'text-red-500'}`}>
          {isOk ? 'Ok' : 'Low Stock'}
        </span>
      </td>
      <td className="px-6 py-4 text-center text-slate-600">{minVal}</td>
      <td className={`px-6 py-4 text-center font-bold transition-colors duration-200 ${stockColorClass}`}>
        {previewStock}
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-center items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center border-2 border-emerald-500 rounded-full px-2 py-1 gap-2 bg-white">
                <button onClick={() => setEditValue(v => (Number(v) || 0) - 1)} className="text-red-500"><Minus size={16}/></button>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="font-bold text-slate-700 w-12 text-center bg-transparent border-none p-0 outline-none focus:ring-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button onClick={() => setEditValue(v => (Number(v) || 0) + 1)} className="text-emerald-500"><Plus size={16}/></button>
              </div>
              <button onClick={handleSave} className="p-1 hover:bg-emerald-50 rounded-full">
                <Check className="text-emerald-500" size={20} />
              </button>
              <button onClick={handleCancel} className="p-1 hover:bg-red-50 rounded-full">
                <X className="text-red-500" size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => setIsEditing(true)} className="text-blue-500 hover:text-blue-700 font-medium hover:underline transition-all">Edit</button>
              {showDelete && (
                <button
                  onClick={() => onDeleteClick(row)}
                  className="text-red-400 hover:text-red-600 transition-colors animate-fade-in"
                  title="Delete Ingredient"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
