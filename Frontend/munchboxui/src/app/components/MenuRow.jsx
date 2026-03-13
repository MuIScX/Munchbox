"use client";
import { Trash2 } from "lucide-react";

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
  const isReady = (menu.readiness ?? 0) === 1;
  const price = menu.menu_price || menu.price || 0;
  const count = menu.ingredient_count || menu.count || 0;

  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 text-slate-700 font-medium">{name}</td>
      <td className="px-6 py-4 text-slate-500">{TYPE_MAP[typeValue] || typeValue}</td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${isReady ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {isReady ? 'Ready' : 'Not Ready'}
        </span>
      </td>

      <td className="px-6 py-4 text-center text-slate-600">{count}</td>
      <td className="px-6 py-4 text-center text-slate-800 font-medium">{price} Baht</td>
      <td className="px-6 py-4 text-center">
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => onViewRecipe(id)}
            className="text-blue-500 hover:underline font-medium text-sm transition-colors"
          >
            View Recipe
          </button>
          {showDelete && (
            <button
              onClick={() => onDeleteClick(menu)}
              className="text-red-400 hover:text-red-600 transition-colors"
              title="Delete Recipe"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
