"use client";
import { Trash2, BookOpen } from "lucide-react";

const TYPE_MAP = {
  1: "Main",
  2: "Appetizer",
  3: "Dessert",
  4: "Drink"
};


export default function MenuRow({ menu, onViewRecipe, showDelete, onDeleteClick }) {
  const id = menu.menu_id || menu.id;
  const name = menu.menu_name || menu.name || "Unknown";
  const typeValue = menu.menu_type || menu.type;
  const price = menu.menu_price || menu.price || 0;
  const count = menu.ingredient_count || menu.count || 0;

  return (
    <tr className="hover:bg-orange-50/40 transition-colors">
      <td className="px-6 py-3 text-slate-800 font-semibold break-words">{name}</td>
      <td className="px-6 py-3">
        <span className="inline-block text-slate-500 text-sm">
          {TYPE_MAP[typeValue] || typeValue}
        </span>
      </td>
      <td className="px-6 py-3 text-center text-slate-500">{count}</td>
      <td className="px-6 py-3 text-center text-slate-800 font-semibold">฿{price}</td>
      <td className="px-6 py-3 text-center">
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => onViewRecipe(id)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-500 transition-colors"
          >
            <BookOpen size={14} /> View Recipe
          </button>
          {showDelete && (
            <button onClick={() => onDeleteClick(menu)} className="text-slate-300 hover:text-red-500 transition-colors" title="Delete Recipe">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
