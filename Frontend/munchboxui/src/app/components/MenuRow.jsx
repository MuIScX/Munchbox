"use client";

const TYPE_MAP = {
  1: "Main",
  2: "Appetizer",
  3: "Dessert",
};

export default function MenuRow({ menu, onViewRecipe }) {
  const id = menu.menu_id || menu.id;
  const name = menu.menu_name || menu.name || "Unknown";
  const typeValue = menu.menu_type || menu.type;
  const price = menu.menu_price || menu.price || 0;
  const count = menu.ingredient_count || menu.count || 0;

  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 text-slate-700 font-medium">{name}</td>
      <td className="px-6 py-4 text-slate-500">{TYPE_MAP[typeValue] || typeValue}</td>
      <td className="px-6 py-4 text-center text-slate-600">{count}</td>
      <td className="px-6 py-4 text-center text-slate-800 font-medium">{price} Baht</td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={() => onViewRecipe(id)}
          className="text-blue-500 hover:underline font-medium text-sm transition-colors"
        >
          View Recipe
        </button>
      </td>
    </tr>
  );
}