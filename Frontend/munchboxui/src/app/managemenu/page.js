"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AddMenuModal from "../components/AddMenuModal";
import DeleteMenuModal from "../components/DeleteMenuModal";
import MenuRow from "../components/MenuRow";
import Toast from "../components/Toast";
import { MenuAPI } from "../../lib/api";
import { useRouter } from "next/navigation";
import { Search, Loader2, Trash2, UtensilsCrossed } from "lucide-react";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

export default function ManageMenuPage() {
  const router = useRouter();

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState(null);

  const showToast = (type, message) => setToast({ type, message });

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await MenuAPI.list({ restaurant_id: 1 });
      setMenus(Array.isArray(res?.Data) ? res.Data : []);
    } catch (err) {
      console.error(err.message);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const confirmDelete = async () => {
    if (!menuToDelete) return;
    const menuId = menuToDelete.menu_id || menuToDelete.id;
    try {
      await MenuAPI.delete(menuId);
      setMenus((prev) => prev.filter((m) => (m.menu_id || m.id) !== menuId));
      setMenuToDelete(null);
      showToast("success", "Recipe deleted successfully.");
    } catch (err) {
      showToast("error", err.message || "Delete failed");
    }
  };

  const filteredMenus = menus.filter((m) => {
    const name = (m.menu_name || m.name || "").toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase());
    const typeValue = m.menu_type || m.type;
    const matchesCategory = selectedCategory === "All" || String(typeValue) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const unreadyCount = menus.filter((m) => (m.ingredient_count || m.count || 0) === 0).length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <AddMenuModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMenus}
      />

      <DeleteMenuModal
        isOpen={!!menuToDelete}
        onClose={() => setMenuToDelete(null)}
        onConfirm={confirmDelete}
        menuName={menuToDelete?.menu_name || menuToDelete?.name || "Unknown"}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 flex flex-col gap-6 overflow-hidden h-full">

          {/* Header */}
          <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <h1 className="text-2xl font-bold italic text-slate-800">Manage Recipe</h1>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition active:scale-95 shadow-md"
            >
              + Add Recipe
            </button>
          </div>

          {/* Summary Boxes */}
          <div className="flex gap-4 shrink-0">
            <div className="bg-[#cfe3f1] flex-1 max-w-[220px] rounded-2xl p-5 shadow-sm">
              <p className="text-[#2c6b8a] text-sm font-semibold mb-1">Total Recipes</p>
              <h2 className="text-4xl font-bold text-slate-800">{menus.length}</h2>
            </div>
            <div className="bg-[#fde9d9] flex-1 max-w-[220px] rounded-2xl p-5 shadow-sm">
              <p className="text-[#c0580a] text-sm font-semibold mb-1">Unready Recipe</p>
              <h2 className="text-4xl font-bold text-slate-800">{unreadyCount}</h2>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search Recipe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 text-slate-600 shadow-sm"
            >
              <option value="All">Type: All</option>
              {Object.entries(TYPE_MAP).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Recipe Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="p-5 border-b border-slate-100 shrink-0">
              <h2 className="font-bold italic text-slate-800">All Recipe</h2>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-500 text-sm italic">
                    <th className="px-6 py-4 font-semibold">Recipe</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold text-center">Ingredient Count</th>
                    <th className="px-6 py-4 font-semibold text-center">Food Price</th>
                    <th className="px-6 py-4 font-semibold text-center">
                      <div className="flex items-center justify-center gap-2">
                        Action
                        <button
                          onClick={() => setShowDelete(v => !v)}
                          title={showDelete ? "Hide delete buttons" : "Show delete buttons"}
                          className={`p-1 rounded transition-colors ${showDelete ? "text-red-500 bg-red-50" : "text-slate-400 hover:text-red-400"}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <Loader2 className="animate-spin mx-auto text-orange-500" size={28} />
                      </td>
                    </tr>
                  ) : filteredMenus.length > 0 ? (
                    filteredMenus.map((menu) => (
                      <MenuRow
                        key={menu.menu_id || menu.id}
                        menu={menu}
                        onViewRecipe={(id) => router.push(`/managemenu/${id}`)}
                        showDelete={showDelete}
                        onDeleteClick={setMenuToDelete}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <UtensilsCrossed className="mx-auto mb-3 text-slate-300" size={36} />
                        <p className="text-slate-400 italic">No recipe found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
