"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import Toast from "../../components/Toast";
import EditMenuModal from "../../components/EditRecipeModal";
import { MenuAPI, RecipeAPI } from "../../../lib/api";
import { ArrowLeft, Utensils, Receipt, ListChecks, Loader2, Edit3 } from "lucide-react";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

const TYPE_OPTIONS = [
  { value: 1, label: "Main Course" },
  { value: 2, label: "Appetizer" },
  { value: 3, label: "Dessert" },
  { value: 4, label: "Drink" }
];

export default function RecipeDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [menu, setMenu] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit menu state
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => setToast({ type, message });

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

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
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
                  </div>

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
          <EditMenuModal 
            isOpen={isEditingMenu}
            onClose={() => setIsEditingMenu(false)}
            onSuccess={fetchData} // Refresh data after update
            initialMenu={menu}
            initialIngredients={ingredients}
          />
        )}
      </main>
    </div>
  );
}
