"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import AddIngredientModal from "../components/AddIngredientModal";
import IngredientRow from "../components/IngredientRow";
import DeleteIngredientModal from "../components/DeleteIngredientModal";
import UpdateInventoryModal from "../components/UpdateInventoryModal";
import EditIngredientModal from "../components/EditIngredientModal";
import CategorySortPopover from "../components/CategorySortPopover";
import { IngredientAPI, StaffSession } from "../../lib/api";
import Toast from "../components/Toast";
import { Search, Plus, Loader2, Trash2, PackageOpen, ArrowUpDown } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema";

export default function Home() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [ingredientToDelete, setIngredientToDelete] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [ingredientToEdit, setIngredientToEdit] = useState(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("inventory_category_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        // ensure all current categories are included
        const allKeys = Object.keys(CATEGORY_MAP);
        const merged = [...parsed.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !parsed.includes(k))];
        return merged;
      }
    } catch {}
    return Object.keys(CATEGORY_MAP);
  });

  const handleCategoryOrderChange = (newOrder) => {
    setCategoryOrder(newOrder);
    localStorage.setItem("inventory_category_order", JSON.stringify(newOrder));
  };
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => setToast({ type, message });

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await IngredientAPI.list({});
      setIngredients(Array.isArray(response?.Data) ? response.Data : []);
    } catch (error) {
      console.error("Failed to fetch ingredients:", error);
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  const handleBulkUpdate = async (updates) => {
    setShowUpdateModal(false);
    const staff = StaffSession.get();
    try {
      if (updates.length > 0) {
        await IngredientAPI.updateStock(
          updates.map(({ id, value }) => ({ ingredient_id: parseInt(id), new_stock: value })),
          staff ? parseInt(staff.id) : null,
        );
        showToast("success", `Updated ${updates.length} ingredient${updates.length > 1 ? "s" : ""}.`);
        fetchIngredients();
      }
    } catch (error) {
      showToast("error", error.message || "Failed to update stock");
    }
  };

  const handleEditDetail = async (payload) => {
    await IngredientAPI.updateDetail(payload);
    setIngredientToEdit(null);
    showToast("success", "Ingredient updated.");
    fetchIngredients();
  };

  const confirmDelete = async () => {
    if (!ingredientToDelete) return;
    const ingredientId = ingredientToDelete.ingredient_id || ingredientToDelete.id;
    try {
      await IngredientAPI.delete(ingredientId);
      setIngredients(prev => prev.filter(i => (i.ingredient_id || i.id) !== ingredientId));
      setIngredientToDelete(null);
      showToast("success", "Ingredient deleted successfully.");
    } catch (err) {
      showToast("error", err.message || "Delete failed");
    }
  };

  const filteredIngredients = useMemo(() => {
    return ingredients
      .filter(i => {
        const nameMatch = (i.ingredient_name || i.name || i.item || "").toLowerCase().includes(searchQuery.toLowerCase());
        const categoryMatch = selectedCategory === "All" || String(i.category) === String(selectedCategory);
        return nameMatch && categoryMatch;
      })
      .sort((a, b) => {
        const ai = categoryOrder.indexOf(String(a.category));
        const bi = categoryOrder.indexOf(String(b.category));
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
  }, [ingredients, searchQuery, selectedCategory, categoryOrder]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <AddIngredientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchIngredients}
        existingIngredients={ingredients}
      />

      <UpdateInventoryModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        ingredients={ingredients}
        onSave={handleBulkUpdate}
      />

      <EditIngredientModal
        isOpen={!!ingredientToEdit}
        onClose={() => setIngredientToEdit(null)}
        ingredient={ingredientToEdit}
        onSave={handleEditDetail}
      />

      <DeleteIngredientModal
        isOpen={!!ingredientToDelete}
        onClose={() => setIngredientToDelete(null)}
        onConfirm={confirmDelete}
        ingredientName={ingredientToDelete?.ingredient_name || ingredientToDelete?.name || "Unknown Item"}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 flex flex-col gap-6 overflow-hidden h-full">

          {/* 1. Header + Original Summary Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <PackageOpen size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Update Inventory</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Track and update ingredient stock levels</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    className="bg-white border border-orange-300 hover:bg-orange-50 active:scale-95 text-orange-500 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm"
                  >
                    Update Stock
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition shadow-sm"
                  >
                    <Plus size={18} /> Add Ingredient
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Table Container with Filters moved Aside Title */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            
            <div className="px-6 py-4 border-b border-slate-100 shrink-0 flex items-center bg-white">
              <div className="shrink-0">
                <h2 className="font-bold text-slate-800 text-lg italic leading-tight">Inventory List</h2>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                  {filteredIngredients.length} items found
                </p>
              </div>

              {/* Spaced Vertical Divider */}
              <div className="w-px h-8 bg-slate-200 mx-6 shrink-0" />

              {/* Filters Group moved here */}
              <div className="flex gap-3 items-center flex-1 justify-between">
                <div className="relative w-52">
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent transition">
                    <Search size={13} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search ingredient..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                      className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
                    />
                  </div>
                  {showSuggestions && searchQuery && (() => {
                    const suggestions = ingredients.filter(i => (i.ingredient_name || i.name || "").toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6);
                    if (suggestions.length === 0) return null;
                    return (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        {suggestions.map(i => (
                          <button key={i.ingredient_id || i.id} onMouseDown={(e) => { e.preventDefault(); setSearchQuery(i.ingredient_name || i.name); setShowSuggestions(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-600 font-medium transition-colors">
                            {i.ingredient_name || i.name}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)} 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer hover:border-slate-300"
                >
                  <option value="All">Category: All</option>
                  {Object.entries(CATEGORY_MAP).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>

                {/* Sort popover */}
                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowSortModal(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      showSortModal ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <ArrowUpDown size={13} /> Sort
                  </button>
                  <CategorySortPopover
                    isOpen={showSortModal}
                    onClose={() => setShowSortModal(false)}
                    categoryOrder={categoryOrder}
                    onChange={handleCategoryOrderChange}
                    categoryMap={CATEGORY_MAP}
                  />
                </div>

              </div>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-100">
                  <tr className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                    <th className="px-6 py-3 w-[30%]">Item</th>
                    <th className="px-6 py-3 w-[20%]">Category</th>
                    <th className="px-6 py-3 w-[15%] text-center">Stock</th>
                    <th className="px-6 py-3 w-[15%] text-center">Unit</th>
                    <th className="px-6 py-3 w-[20%] text-center">
                      <div className="flex items-center justify-center gap-2">
                        Action
                        <button
                          onClick={() => setShowDelete(v => !v)}
                          className={`p-1 rounded-md transition-all ${showDelete ? "text-red-500 bg-red-50" : "text-slate-300 hover:text-red-400"}`}
                          title="Toggle delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" size={32} /></td></tr>
                  ) : filteredIngredients.length > 0 ? (
                    filteredIngredients.map((row) => (
                      <IngredientRow
                        key={row.ingredient_id || row.id}
                        row={row}
                        showDelete={showDelete}
                        onDeleteClick={setIngredientToDelete}
                        onEditClick={setIngredientToEdit}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <PackageOpen className="mx-auto mb-3 text-slate-200" size={48} />
                        <p className="text-slate-400 font-medium italic">No ingredients found</p>
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