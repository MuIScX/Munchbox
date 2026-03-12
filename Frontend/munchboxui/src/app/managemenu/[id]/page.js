"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { MenuAPI, RecipeAPI, IngredientAPI } from "../../../lib/api";
import { ArrowLeft, Utensils, Receipt, ListChecks, Loader2, Edit3, Plus, Save, X } from "lucide-react";

const TYPE_MAP = {
  1: "Main Course",
  2: "Appetizer",
  3: "Dessert",
};

const TYPE_OPTIONS = [
  { value: 1, label: "Main Course" },
  { value: 2, label: "Appetizer" },
  { value: 3, label: "Dessert" },
];

export default function RecipeDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [menu, setMenu] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit menu state
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [editForm, setEditForm] = useState({ menu_name: "", menu_type: 1, menu_price: 0 });
  const [saving, setSaving] = useState(false);

  // Add ingredient state
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [allIngredients, setAllIngredients] = useState([]);
  const [addIngForm, setAddIngForm] = useState({ ingredient_id: "", amount: "" });
  const [addingIng, setAddingIng] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [menuRes, recipeRes] = await Promise.allSettled([
        MenuAPI.getById(1, id),
        RecipeAPI.getDetail(id),
      ]);

      if (menuRes.status === "fulfilled" && menuRes.value?.Data) {
        const m = menuRes.value.Data;
        setMenu(m);
        setEditForm({
          menu_name: m.menu_name || m.name || "",
          menu_type: m.menu_type || m.type || 1,
          menu_price: m.menu_price || m.price || 0,
        });
      }

      if (recipeRes.status === "fulfilled" && Array.isArray(recipeRes.value?.Data)) {
        setIngredients(recipeRes.value.Data);
      }
    } catch (err) {
      console.error("Error fetching recipe details:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllIngredients = async () => {
    try {
      const res = await IngredientAPI.list({});
      setAllIngredients(Array.isArray(res?.Data) ? res.Data : []);
    } catch {
      setAllIngredients([]);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
      fetchAllIngredients();
    }
  }, [id]);

  const handleSaveMenu = async () => {
    try {
      setSaving(true);
      await MenuAPI.update({
        menu_id: Number(id),
        menu_name: editForm.menu_name,
        menu_type: Number(editForm.menu_type),
        menu_price: Number(editForm.menu_price),
      });
      await fetchData();
      setIsEditingMenu(false);
    } catch (err) {
      alert(err.message || "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  const handleAddIngredient = async () => {
    if (!addIngForm.ingredient_id || !addIngForm.amount) {
      alert("Please select an ingredient and enter an amount.");
      return;
    }
    try {
      setAddingIng(true);
      await MenuAPI.addIngredientToRecipe({
        menu_id: Number(id),
        ingredient_id: Number(addIngForm.ingredient_id),
        amount: Number(addIngForm.amount),
      });
      await fetchData();
      setAddIngForm({ ingredient_id: "", amount: "" });
      setIsAddingIngredient(false);
    } catch (err) {
      alert(err.message || "Failed to add ingredient");
    } finally {
      setAddingIng(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-6 text-slate-500 hover:text-orange-500 font-bold transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Manage Recipe</span>
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="italic">Loading recipe details...</p>
          </div>
        ) : menu ? (
          <div className="max-w-3xl">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

              {/* Orange header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-white">
                <div className="flex items-center gap-2 mb-2 opacity-80 uppercase tracking-widest text-xs font-bold">
                  <Utensils size={14} />
                  <span>Recipe Details</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-4xl font-bold italic">{menu.menu_name || menu.name || "Unnamed Menu"}</h1>
                  <button
                    onClick={() => setIsEditingMenu(true)}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
                  >
                    <Edit3 size={15} />
                    Edit Recipe
                  </button>
                </div>
              </div>

              <div className="p-8">
                {/* Menu info */}
                <div className="flex gap-4 mb-8">
                  <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-slate-400 text-xs uppercase font-bold mb-1">Menu Type</p>
                    <p className="text-slate-700 font-semibold">
                      {TYPE_MAP[menu.menu_type || menu.type] || "General"}
                    </p>
                  </div>
                  <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-slate-400 text-xs uppercase font-bold mb-1">Price</p>
                    <div className="flex items-center gap-1 text-slate-800 font-bold">
                      <Receipt size={16} className="text-orange-500" />
                      <span>{menu.menu_price || menu.price || 0} Baht</span>
                    </div>
                  </div>
                </div>

                {/* Ingredients section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ListChecks size={20} className="text-orange-500" />
                      <h2 className="text-xl font-bold text-slate-800 italic">Ingredients</h2>
                    </div>
                    <button
                      onClick={() => setIsAddingIngredient(true)}
                      className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      <Plus size={15} />
                      Add Ingredient
                    </button>
                  </div>

                  {/* Add Ingredient Form */}
                  {isAddingIngredient && (
                    <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[180px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Ingredient</label>
                        <select
                          value={addIngForm.ingredient_id}
                          onChange={(e) => setAddIngForm(f => ({ ...f, ingredient_id: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        >
                          <option value="">Select ingredient</option>
                          {allIngredients.map((ing) => (
                            <option key={ing.ingredient_id || ing.id} value={ing.ingredient_id || ing.id}>
                              {ing.ingredient_name || ing.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                        <input
                          type="number"
                          value={addIngForm.amount}
                          onChange={(e) => setAddIngForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="e.g. 200"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddIngredient}
                          disabled={addingIng}
                          className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
                        >
                          {addingIng ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
                        </button>
                        <button
                          onClick={() => { setIsAddingIngredient(false); setAddIngForm({ ingredient_id: "", amount: "" }); }}
                          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {ingredients.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ingredients.map((ing, i) => (
                        <div
                          key={ing.ingredient_id || ing.id || i}
                          className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 text-slate-600"
                        >
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-orange-400 mr-3"></div>
                            <span className="font-medium">
                              {ing.ingredient_name || ing.name || "Unknown Ingredient"}
                            </span>
                          </div>
                          {(ing.amount || ing.amount === 0) && (
                            <span className="text-sm font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md">
                              {ing.amount} {ing.unit || ""}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 italic">
                      No ingredients found for this recipe.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-10 rounded-xl text-center border border-slate-200">
            <p className="text-slate-500">Menu item not found.</p>
          </div>
        )}

        {/* Edit Recipe Modal */}
        {isEditingMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
              <h2 className="text-lg font-bold italic text-slate-800 mb-5">Edit Recipe</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Recipe Name</label>
                  <input
                    type="text"
                    value={editForm.menu_name}
                    onChange={(e) => setEditForm(f => ({ ...f, menu_name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <select
                    value={editForm.menu_type}
                    onChange={(e) => setEditForm(f => ({ ...f, menu_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Price (Baht)</label>
                  <input
                    type="number"
                    value={editForm.menu_price}
                    onChange={(e) => setEditForm(f => ({ ...f, menu_price: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setIsEditingMenu(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMenu}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
