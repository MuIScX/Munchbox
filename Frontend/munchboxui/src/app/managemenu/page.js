"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import AddMenuModal from "../components/AddMenuModal";
import DeleteMenuModal from "../components/DeleteMenuModal";
import MenuRow from "../components/MenuRow";
import Toast from "../components/Toast";
import IngredientFilterPopover from "../components/IngredientFilterPopover";
import CategorySortPopover from "../components/CategorySortPopover";
import { MenuAPI, IngredientAPI, RecipeAPI } from "../../lib/api";
import { useRouter } from "next/navigation";
import { Search, Loader2, Trash2, UtensilsCrossed, Plus, SlidersHorizontal, ArrowUpDown, X } from "lucide-react";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

export default function ManageMenuPage() {
  const router = useRouter();
  const filterBtnRef = useRef(null);

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState(null);

  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [showSortPopover, setShowSortPopover] = useState(false);
  const [typeOrder, setTypeOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("recipe_type_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        const allKeys = Object.keys(TYPE_MAP);
        return [...parsed.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !parsed.includes(k))];
      }
    } catch {}
    return Object.keys(TYPE_MAP);
  });

  const handleTypeOrderChange = (newOrder) => {
    setTypeOrder(newOrder);
    localStorage.setItem("recipe_type_order", JSON.stringify(newOrder));
  };
  const [allIngredients, setAllIngredients] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [recipeMap, setRecipeMap] = useState([]); // [{menu_id, ingredient_id}]

  const showToast = (type, message) => setToast({ type, message });

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await MenuAPI.list({ restaurant_id: 1 });
      setMenus(Array.isArray(res?.Data) ? res.Data : []);
    } catch {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
    // Fetch ingredients and recipe map for filter
    Promise.allSettled([
      IngredientAPI.list({}),
      RecipeAPI.getMap(),
    ]).then(([ingRes, mapRes]) => {
      if (ingRes.status === "fulfilled" && Array.isArray(ingRes.value?.Data))
        setAllIngredients(ingRes.value.Data);
      if (mapRes.status === "fulfilled" && Array.isArray(mapRes.value?.Data))
        setRecipeMap(mapRes.value.Data);
    });
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

  const handleIngredientToggle = (id) => {
    setSelectedIngredients(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredMenus = menus.filter((m) => {
    const name = (m.menu_name || m.name || "").toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase());
    const typeValue = m.menu_type || m.type;
    const matchesCategory = selectedCategory === "All" || String(typeValue) === selectedCategory;

    let matchesIngredients = true;
    if (selectedIngredients.length > 0) {
      const menuId = m.menu_id || m.id;
      const menuIngredientIds = recipeMap
        .filter(r => String(r.menu_id) === String(menuId))
        .map(r => r.ingredient_id);
      matchesIngredients = selectedIngredients.every(id => menuIngredientIds.includes(id));
    }

    return matchesSearch && matchesCategory && matchesIngredients;
  }).sort((a, b) => {
    const ai = typeOrder.indexOf(String(a.menu_type || a.type));
    const bi = typeOrder.indexOf(String(b.menu_type || b.type));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

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
              <div className="flex justify-between items-start">
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
            </div>
          </div>

          {/* Recipe Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">

            <div className="px-6 py-4 border-b border-slate-100 shrink-0 flex items-center bg-white">
              <div className="shrink-0">
                <h2 className="font-bold text-slate-800 text-lg italic">Recipe List</h2>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{filteredMenus.length} recipes found</p>
              </div>

              <div className="w-px h-8 mx-4 bg-slate-100" />

              <div className="flex gap-3 items-center flex-1 justify-between">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search recipe..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-slate-50 text-xs text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none w-48 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
                >
                  <option value="All">Type: All</option>
                  {Object.entries(TYPE_MAP).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
                </select>

                {/* Filter button with popover — disabled when name search is active */}
                <div className="relative" ref={filterBtnRef}>
                  <button
                    onClick={() => !searchQuery && setShowFilterPopover(v => !v)}
                    title={searchQuery ? "Clear recipe search to use ingredient filter" : undefined}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      searchQuery
                        ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400"
                        : selectedIngredients.length > 0
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <SlidersHorizontal size={13} />
                    Ingredients
                    {selectedIngredients.length > 0 && !searchQuery && (
                      <span className="bg-white/30 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                        {selectedIngredients.length}
                      </span>
                    )}
                  </button>

                  {!searchQuery && (
                    <IngredientFilterPopover
                      isOpen={showFilterPopover}
                      onClose={() => setShowFilterPopover(false)}
                      ingredients={allIngredients}
                      selected={selectedIngredients}
                      onToggle={handleIngredientToggle}
                      onClear={() => setSelectedIngredients([])}
                    />
                  )}
                </div>

                {/* Sort by type popover */}
                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowSortPopover(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      showSortPopover ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <ArrowUpDown size={13} /> Sort
                  </button>
                  <CategorySortPopover
                    isOpen={showSortPopover}
                    onClose={() => setShowSortPopover(false)}
                    categoryOrder={typeOrder}
                    onChange={handleTypeOrderChange}
                    categoryMap={TYPE_MAP}
                    title="Type Order"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-100">
                  <tr className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                    <th className="px-6 py-3">Recipe</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3 text-center">Ingredients</th>
                    <th className="px-6 py-3 text-center">Price</th>
                    <th className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        Action
                        <button onClick={() => setShowDelete(v => !v)} className={`p-1 rounded-md transition-all ${showDelete ? "text-red-500 bg-red-50" : "text-slate-300 hover:text-red-400"}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-orange-500" size={32} />
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
                      <td colSpan={5} className="py-20 text-center">
                        <UtensilsCrossed className="mx-auto mb-3 text-slate-200" size={48} />
                        <p className="text-slate-400 font-medium italic">No recipes match your filters</p>
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
