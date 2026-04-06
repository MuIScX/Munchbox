"use client";
import { Trash2, Pencil } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema";

export default function IngredientRow({ row, showDelete, onDeleteClick, onEditClick }) {
  const name = row.ingredient_name || row.name || row.item;
  const currentStock = Number(row.stock_left ?? row.stock ?? 0);

  return (
    <tr className="hover:bg-orange-50/40 transition-colors">
      <td className="px-6 py-3 text-slate-800 font-semibold break-words">{name}</td>
      <td className="px-6 py-3 text-slate-500 text-sm">{CATEGORY_MAP[row.category] || row.category || 'Unknown'}</td>
      <td className="px-6 py-3 text-center text-slate-800 font-semibold">{currentStock}</td>
      <td className="px-6 py-3 text-center text-slate-500 text-sm">{row.unit}</td>
      <td className="px-6 py-3">
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => onEditClick(row)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-500 transition-colors"
          >
            <Pencil size={14} /> Edit Detail
          </button>
          {showDelete && (
            <button
              onClick={() => onDeleteClick(row)}
              className="text-slate-300 hover:text-red-500 transition-colors"
              title="Delete Ingredient"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
