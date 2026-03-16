"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AddMenuModal from "../components/AddMenuModal";
import DeleteMenuModal from "../components/DeleteMenuModal";
import MenuRow from "../components/MenuRow";
import Toast from "../components/Toast";
import { MenuAPI } from "../../lib/api";
import { useRouter } from "next/navigation";
import { Search, Loader2, Trash2, UtensilsCrossed, CheckCircle, AlertTriangle, Plus } from "lucide-react";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

export default function ManageMenuPage() {
  const router = useRouter();

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showDelete, setShowDelete] = useState(false);
  const [selectedReadiness, setSelectedReadiness] = useState("All");
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
    const isReady = (m.readiness ?? 0) === 1;
    const matchesReadiness = selectedReadiness === "All" || (selectedReadiness === "ready" ? isReady : !isReady);
    return matchesSearch && matchesCategory && matchesReadiness;
  });

  const unreadyCount = menus.filter((m) => (m.readiness ?? 0) === 0).length;

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

          {/* Header + Summary Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <UtensilsCrossed size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manage Recipe</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Create and manage your restaurant's menu items</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition shadow-sm"
                >
                  <Plus size={18} /> Add Recipe
                </button>
              </div>
              <div className="flex gap-4">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <UtensilsCrossed size={18} className="text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600 font-bold uppercase tracking-wide">Total</p>
                    <p className="text-3xl font-bold text-orange-900 mt-0.5">{menus.length}</p>
                    <p className="text-xs text-orange-500 font-medium mt-0.5">recipes</p>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Ready</p>
                    <p className="text-3xl font-bold text-emerald-900 mt-0.5">{menus.length - unreadyCount}</p>
                    <p className="text-xs text-emerald-500 font-medium mt-0.5">complete</p>
                  </div>
                </div>
                <div className={`rounded-xl border p-4 flex items-center gap-4 flex-1 ${unreadyCount > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unreadyCount > 0 ? "bg-amber-100" : "bg-slate-200"}`}>
                    <AlertTriangle size={18} className={unreadyCount > 0 ? "text-amber-600" : "text-slate-500"} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${unreadyCount > 0 ? "text-amber-600" : "text-slate-500"}`}>Incomplete</p>
                    <p className={`text-3xl font-bold mt-0.5 ${unreadyCount > 0 ? "text-amber-900" : "text-slate-700"}`}>{unreadyCount}</p>
                    <p className={`text-xs font-medium mt-0.5 ${unreadyCount > 0 ? "text-amber-500" : "text-slate-400"}`}>missing recipe</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search recipe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none shadow-sm w-56"
              />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 shadow-sm">
              <option value="All">Type: All</option>
              {Object.entries(TYPE_MAP).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
            </select>
            <select value={selectedReadiness} onChange={(e) => setSelectedReadiness(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 shadow-sm">
              <option value="All">Readiness: All</option>
              <option value="ready">Ready</option>
              <option value="not_ready">Not Ready</option>
            </select>
          </div>

          {/* Recipe Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="font-semibold text-slate-700">Recipe List</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filteredMenus.length} recipes found</p>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5 font-semibold">Recipe</th>
                    <th className="px-6 py-3.5 font-semibold">Type</th>
                    <th className="px-6 py-3.5 font-semibold text-center">Readiness</th>
                    <th className="px-6 py-3.5 font-semibold text-center">Ingredients</th>
                    <th className="px-6 py-3.5 font-semibold text-center">Price</th>
                    <th className="px-6 py-3.5 font-semibold text-center">
                      <div className="flex items-center justify-center gap-2">
                        Action
                        <button onClick={() => setShowDelete(v => !v)} className={`p-1 rounded transition-colors ${showDelete ? "text-red-500 bg-red-50" : "text-slate-400 hover:text-red-400"}`}>
                          <Trash2 size={14} />
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
                        <UtensilsCrossed className="mx-auto mb-3 text-slate-200" size={40} />
                        <p className="text-slate-400 font-medium">No recipes found</p>
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
