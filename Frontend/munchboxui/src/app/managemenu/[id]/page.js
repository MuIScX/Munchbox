"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import Toast from "../../components/Toast";
import EditMenuModal from "../../components/EditRecipeModal";
import { MenuAPI, RecipeAPI, IngredientAPI } from "../../../lib/api";
import { ArrowLeft, Utensils, Receipt, ListChecks, Loader2, Edit3, AlertTriangle, Info, Search} from "lucide-react";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

export default function RecipeDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [menu, setMenu] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockSearch, setRestockSearch] = useState("");
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => setToast({ type, message });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [menuRes, recipeRes, stockRes] = await Promise.allSettled([
        MenuAPI.getById(1, id),
        RecipeAPI.getDetail(id),
        IngredientAPI.list({ menu_id: id })
      ]);

      if (menuRes.status === "fulfilled" && menuRes.value?.Data) setMenu(menuRes.value.Data);

      if (recipeRes.status === "fulfilled" && stockRes.status === "fulfilled") {
        const recipeData = recipeRes.value?.Data || [];
        const stockData = stockRes.value?.Data || [];
        const merged = recipeData.map(recipeIng => {
          const stockInfo = stockData.find(s => String(s.id) === String(recipeIng.ingredient_id));
          return { ...recipeIng, stock_left: stockInfo ? stockInfo.stock_left : 0 };
        });
        setIngredients(merged);
      }
    } catch (err) {
      console.error("Error fetching recipe details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchData(); }, [id]);

  const portionsAvailable = (ingredients && ingredients.length > 0) 
    ? Math.min(...ingredients.map(ing => Math.floor((Number(ing.stock_left) || 0) / (Number(ing.amount) || 1)))) 
    : 0;

  const getStatusColor = (ing) => {
    const ratio = (ing.stock_left || 0) / (ing.amount || 1);
    if (ratio <= 0) return "bg-red-500";
    if (ratio < 5) return "bg-amber-500";
    return "bg-emerald-500";
  };
  
  const filteredForRestock = ingredients.filter(ing => {
    const stock = Number(ing.stock_left) || 0;
    const req = Number(ing.amount) || 1;
    
    // Logic: Show if ratio is less than 5 (Low or Out)
    const ratio = stock / req;
    const isLowOrOut = ratio < 5;
    
    const matchesSearch = ing.ingredient_name?.toLowerCase().includes(restockSearch.toLowerCase());
    
    return isLowOrOut && matchesSearch;
  })
  .sort((a, b) => {
    // Optional: Sort by most critical (lowest ratio) first
    const ratioA = (Number(a.stock_left) || 0) / (Number(a.amount) || 1);
    const ratioB = (Number(b.stock_left) || 0) / (Number(b.amount) || 1);
    return ratioA - ratioB;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto flex flex-col">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 mb-6 text-slate-400 hover:text-slate-500 font-bold transition-colors group shrink-0"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Back to Manage Recipe</span>
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 className="animate-spin mb-2" size={32} />
          </div>
        ) : menu ? (
          <div className="flex flex-col xl:flex-row gap-6 items-stretch flex-1 min-h-0">
            
            {/* LEFT SIDE: Identity & Ingredients */}
            <div className="flex-1 w-full max-w-2xl flex flex-col min-w-0">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
                {/* Header */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-white relative shrink-0">
                  <div className="absolute right-0 -bottom-5 opacity-5 rotate-12">
                    <Utensils size={200} />
                  </div>
                  
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-3 bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Active Menu</span>
                      </div>
                      <h1 className="text-5xl font-black italic tracking-tight mb-2 uppercase">
                        {menu.menu_name || menu.name}
                      </h1>
                      <div className="flex items-center gap-4 text-slate-300">
                     <div className="flex items-center gap-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Receipt size={16} className="text-orange-500" />
                          <span className="font-bold text-lg text-white">{menu.menu_price || 0} Baht</span>
                        </div>
                        <span className="opacity-30 text-xl">|</span>
                        <span className="text-sm font-semibold uppercase tracking-widest bg-orange-500/20 text-orange-400 px-3 py-1 rounded-lg">
                          {TYPE_MAP[menu.menu_type] || "Main Dish"}
                        </span>
                      </div>
                      
                    </div>
                    </div>
                    <button onClick={() => setIsEditingMenu(true)} className="bg-orange-500 hover:bg-orange-600 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20">
                      <Edit3 size={16} /> Edit
                    </button>
                  </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-[#1a2233] italic flex items-center gap-2">
                      <ListChecks size={24} className="text-orange-500" /> Ingredients
                    </h2>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      {ingredients.length} Total Items
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50/50 p-5 rounded-2xl border border-slate-100 transition-all hover:border-orange-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full shadow-sm ${getStatusColor(ing)}`} />
                          <div>
                            <p className="font-bold text-slate-700 text-base leading-none mb-1">{ing.ingredient_name}</p>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Requirement</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-slate-800">{ing.amount}</span>
                          <span className="text-[10px] text-slate-400 ml-1 font-bold lowercase">{ing.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* RIGHT SIDE: Sidebar Insights */}
            <div className="w-full xl:w-[450px] flex flex-col gap-4 shrink-0">
              
              {/* Top Row: Legend and Capacity side-by-side */}
              <div className="flex gap-4 h-44">
                {/* 1. Stock Legend */}
                <div className="flex-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                  <div className="flex items-center gap-2 mb-3 text-slate-400">
                    <Info size={14} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Legend</p>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { color: "bg-emerald-500", label: "Safe (5+ orders)" },
                      { color: "bg-amber-500", label: "Low (< 5 orders)" },
                      { color: "bg-red-500", label: "Out / Critical" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Service Capacity (Compact Square) */}
                <div className="w-44 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                  <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-3">Service Capacity</p>
                  
                  {/* The Ring is now always neutral slate */}
                  <div className="relative w-24 h-24 flex flex-col items-center justify-center rounded-full border-[6px] border-slate-50 ring-1 ring-slate-100">
                    
                    {/* Only the Number and Subtext carry the status color */}
                    <span className={`text-3xl font-black italic ${portionsAvailable >= 5 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {portionsAvailable}
                    </span>
                    
                    <p className={`text-[7px] font-black text-slate-500 uppercase`}>
                      Orders Left
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Ingredients Restock Table (Fills remaining height) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
                <div className="p-5 pb-0">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black italic text-[#1a2233]">Ingredients Restock</h3>
                    {filteredForRestock.length > 0 && (
                    <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md uppercase">
                      {filteredForRestock.length} Attention Needed
                    </span>
                  )}
                  </div>
                  
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search Ingredient..." 
                      value={restockSearch}
                      onChange={(e) => setRestockSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-500 transition-all text-slate-600"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto min-h-[300px]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-slate-100 text-slate-400 font-bold uppercase text-[9px]">
                      <tr>
                        <th className="px-5 py-3">Ingredient</th>
                        <th className="px-5 py-3 text-center">Requirement</th>
                        <th className="px-5 py-3 text-right">Stock left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredForRestock.length > 0 ? (
                        filteredForRestock.map((ing, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-4 font-bold text-slate-600 italic">{ing.ingredient_name}</td>

                            <td className="px-5 py-4 text-center font-bold text-slate-500">
                              {ing.amount} <span className="opacity-50 lowercase">{ing.unit}</span>
                            </td>

                            <td className="px-5 py-4 text-right font-bold text-slate-500">
                              {ing.stock_left} <span className="opacity-50 lowercase">{ing.unit}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" className="px-5 py-10 text-center text-slate-300 italic">No ingredient need to restock</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <EditMenuModal 
          isOpen={isEditingMenu}
          onClose={() => setIsEditingMenu(false)}
          onSuccess={() => { fetchData(); showToast("success", "Recipe Updated Successfully"); }}
          initialMenu={menu}
          initialIngredients={ingredients}
        />
      </main>
    </div>
  );
}