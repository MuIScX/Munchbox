"use client";
import { Trash2, BookOpen } from "lucide-react";

const TYPE_MAP = {
  1: "Main",
  2: "Appetizer",
  3: "Dessert",
  4: "Drink"
};

const TYPE_STYLE = {
  1: "bg-orange-100 text-orange-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-pink-100 text-pink-700",
  4: "bg-cyan-100 text-cyan-700",
};

export default function MenuRow({ menu, onViewRecipe, showDelete, onDeleteClick }) {
  const id = menu.menu_id || menu.id;
  const name = menu.menu_name || menu.name || "Unknown";
  const typeValue = menu.menu_type || menu.type;
  const isReady = (menu.readiness ?? 0) === 1;
  const price = menu.menu_price || menu.price || 0;
  const count = menu.ingredient_count || menu.count || 0;
  const typeStyle = TYPE_STYLE[typeValue] || "bg-slate-100 text-slate-600";

  return (
    <tr className="hover:bg-orange-50/40 transition-colors">
      <td className="px-6 py-4 text-slate-800 font-semibold">{name}</td>
      <td className="px-6 py-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${typeStyle}`}>
          {TYPE_MAP[typeValue] || typeValue}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
          {isReady ? 'Ready' : 'Not Ready'}
        </span>
      </td>
      <td className="px-6 py-4 text-center text-slate-600 font-medium">{count}</td>
      <td className="px-6 py-4 text-center text-slate-800 font-semibold">฿{price}</td>
      <td className="px-6 py-4 text-center">
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
