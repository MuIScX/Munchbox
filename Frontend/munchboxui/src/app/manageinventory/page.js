"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { IngredientAPI, StaffAPI } from "@/lib/api"; 
import { Search, Plus, Minus, Check, X, Loader2, Trash2 } from 'lucide-react';
import { CATEGORY_MAP } from "@/lib/schema"; 

// --- MODAL COMPONENT ---
function AddIngredientModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "1",
    unit: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await IngredientAPI.create({
        name: formData.name,
        category: Number(formData.category),
        unit: formData.unit
      });
      
      onSuccess(); 
      onClose(); 
      setFormData({ name: "", category: "1", unit: "" });
    } catch (error) {
      alert(error.message || "Failed to add ingredient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold italic text-slate-800">Add New Ingredient</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Ingredient Name</label>
            <input required type="text" placeholder="e.g., Tomato" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Category</label>
            <select required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200  rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700">
              {Object.entries(CATEGORY_MAP).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Unit</label>
            <select 
              required 
              value={formData.unit} 
              onChange={(e) => setFormData({...formData, unit: e.target.value})} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700"
            >
              <option value="" disabled>Select Unit</option>
              <option value="kg">kg (Kilogram)</option>
              <option value="g">g (Gram)</option>
              <option value="liter">liter</option>
              <option value="ml">ml (Milliliter)</option>
              <option value="piece">piece</option>
              <option value="bag">bag</option>
              <option value="pack">pack</option>
              <option value="box">box</option>
              <option value="bottle">bottle</option>
            </select>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Save Ingredient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function Home() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState(0);
  
  // Staff State
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await IngredientAPI.list({});
      if (response && Array.isArray(response.Data)) {
        setIngredients(response.Data);
      } else {
        setIngredients([]);
      }
    } catch (error) {
      console.error("Failed to fetch ingredients:", error);
      setIngredients([]); 
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await StaffAPI.list();
      if (response && Array.isArray(response.Data)) {
        setStaffList(response.Data);
        if (response.Data.length > 0) {
          const firstStaffId = response.Data[0].staff_id || response.Data[0].id;
          setSelectedStaff(firstStaffId);
        }
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    }
  };

  useEffect(() => {
    fetchIngredients();
    fetchStaff();
  }, []);

  const handleUpdateStock = async (row) => {
    if (!selectedStaff) {
      alert("Please select a Staff member from the dropdown before updating stock.");
      return;
    }

    const currentId = row.ingredient_id || row.id;
    const currentStock = parseFloat(row.stock_left ?? row.stock ?? 0);
    
    // Convert editValue to Number to ensure manual typing doesn't act like a string
    const changeAmount = Number(editValue) || 0;
    
    let calculatedNewStock = currentStock + changeAmount;
    calculatedNewStock = Number(calculatedNewStock.toFixed(3));

    try {
      await IngredientAPI.updateStock({
        ingredient_id: currentId,
        new_stock: calculatedNewStock, 
        staff_id: selectedStaff        
      });
      
      setEditingId(null);
      fetchIngredients(); 
    } catch (error) {
      alert(error.message || "Failed to update stock");
    }
  };

  const handleDeleteIngredient = async (ingredientId) => {
  const isConfirmed = window.confirm("Are you sure you want to delete this ingredient?");
  if (!isConfirmed) return;

  try {
    
    await IngredientAPI.delete(ingredientId);

    
    setIngredients(prev =>
      prev.filter(i => (i.ingredient_id || i.id) !== ingredientId)
    );

  } catch (err) {
    alert(err.message || "Delete failed");
  }
};

  const startEditing = (item) => {
    setEditingId(item.ingredient_id || item.id);
    setEditValue(0); 
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      <AddIngredientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchIngredients} 
      />

      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 overflow-y-auto custom-scrollbar">
          
          <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold italic text-slate-800">Manage Inventory</h1>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-md"
            >
              <Plus size={20} /> Add Ingredient
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-8">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search Ingredient..." 
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
              <option value="All">Category: All</option>
              {Object.entries(CATEGORY_MAP).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <select 
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 text-slate-600 shadow-sm min-w-[150px]"
            >
              <option value="" disabled>Select Staff</option>
              {staffList.map((staff) => {
                const id = staff.staff_id || staff.id;
                const name = staff.name || staff.username || `Staff #${id}`;
                return (
                  <option key={id} value={id}>
                    Staff : {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="font-bold italic text-slate-800">Inventory list</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-sm italic">
                    <th className="px-6 py-4 font-semibold">Item</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Unit</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Min Stock</th>
                    <th className="px-6 py-4 font-semibold text-center">Stock</th>
                    <th className="px-6 py-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <Loader2 className="animate-spin text-orange-500 mx-auto" size={24} />
                      </td>
                    </tr>
                  ) : ingredients.length > 0 ? (
                    ingredients
                      .filter(i => (i.ingredient_name || i.name || i.item || "").toLowerCase().includes(searchQuery.toLowerCase()))
                      .filter(i => selectedCategory === "All" || String(i.category) === String(selectedCategory))
                      .map((row) => {
                        const currentId = row.ingredient_id || row.id;
                        const minVal = row.min_stock || row.minStock || 0;
                        const currentStock =Number( row.stock_left ?? row.stock ?? 0);
                        const isOk = currentStock >= minVal;
                        
                        // --- NEW REAL-TIME PREVIEW LOGIC ---
                        const isEditing = editingId === currentId;
                        const changeAmount = Number(editValue) || 0;
                        // Calculate the preview stock
                        const previewStock = isEditing 
                          ? Number((currentStock + changeAmount).toFixed(3)) 
                          : currentStock;
                        
                        // Determine the dynamic color
                        let stockColorClass = "text-slate-800";
                        if (isEditing) {
                          if (changeAmount > 0) stockColorClass = "text-emerald-500";
                          else if (changeAmount < 0) stockColorClass = "text-red-500";
                        }
                        // -----------------------------------

                        return (
                          <tr key={currentId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-slate-700 font-medium">{row.ingredient_name || row.name || row.item}</td>
                            <td className="px-6 py-4 text-slate-500">
                              {CATEGORY_MAP[row.category] || row.category || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{row.unit}</td>
                            <td className="px-6 py-4">
                              <span className={`font-medium ${isOk ? 'text-emerald-500' : 'text-red-500'}`}>
                                {isOk ? 'Ok' : 'Low Stock'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-slate-600">{minVal}</td>
                            
                            {/* UPDATED STOCK COLUMN */}
                            <td className={`px-6 py-4 text-center font-bold transition-colors duration-200 ${stockColorClass}`}>
                              {previewStock}
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex justify-center items-center gap-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center border-2 border-emerald-500 rounded-full px-2 py-1 gap-2 bg-white">
                                      {/* Buttons ensure Numbers are used */}
                                      <button onClick={() => setEditValue(v => (Number(v) || 0) - 1)} className="text-red-500">
                                        <Minus size={16}/>
                                      </button>
                                      
                                      {/* MANUAL INPUT */}
                                      <input 
                                        type="number"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="font-bold text-slate-700 w-12 text-center bg-transparent border-none p-0 outline-none focus:ring-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      
                                      <button onClick={() => setEditValue(v => (Number(v) || 0) + 1)} className="text-emerald-500">
                                        <Plus size={16}/>
                                      </button>
                                    </div>
                                    <button onClick={() => handleUpdateStock(row)} className="p-1 hover:bg-emerald-50 rounded-full">
                                      <Check className="text-emerald-500" size={20} />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="p-1 hover:bg-red-50 rounded-full">
                                      <X className="text-red-500" size={20} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEditing(row)} className="text-blue-500 hover:text-blue-700 font-medium">
                                    Edit
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 italic">
                        No data found
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