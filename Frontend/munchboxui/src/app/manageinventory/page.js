"use client";
import { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import AddIngredientModal from "../components/AddIngredientModal";
import StaffGateModal from "../components/StaffGateModal";
import IngredientRow from "../components/IngredientRow";
import DeleteIngredientModal from "../components/DeleteIngredientModal"; // <-- Make sure this is imported!
import { IngredientAPI, StaffAPI } from "../../lib/api"; 
import { Search, Plus, Loader2 } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema"; 

export default function Home() {
  // --- STATE ---
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Staff State
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [isStaffGateOpen, setIsStaffGateOpen] = useState(true);

  // Filters & Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Modal state for tracking which ingredient to delete
  const [ingredientToDelete, setIngredientToDelete] = useState(null);

  // --- API CALLS ---
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

  const fetchStaff = async () => {
    try {
      const response = await StaffAPI.list();
      if (response && Array.isArray(response.Data)) {
        setStaffList(response.Data);
        if (response.Data.length > 0) {
          setSelectedStaff(response.Data[0].staff_id || response.Data[0].id);
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

  const handleUpdateStock = async (ingredientId, currentStock, changeAmount) => {
    if (!selectedStaff) {
      alert("Please select a Staff member from the dropdown before updating stock.");
      return;
    }

    const calculatedNewStock = Number((currentStock + changeAmount).toFixed(3));

    try {
      await IngredientAPI.updateStock({
        ingredient_id: ingredientId,
        new_stock: calculatedNewStock, 
        staff_id: selectedStaff        
      });
      fetchIngredients(); 
    } catch (error) {
      alert(error.message || "Failed to update stock");
    }
  };

  // NEW DELETE FUNCTION (Replaces handleDeleteIngredient)
  const confirmDelete = async () => {
    if (!ingredientToDelete) return;

    const ingredientId = ingredientToDelete.ingredient_id || ingredientToDelete.id;

    try {
      await IngredientAPI.delete(ingredientId);
      setIngredients(prev => prev.filter(i => (i.ingredient_id || i.id) !== ingredientId));
      setIngredientToDelete(null); 
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  };

  // --- FILTERING ---
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(i => {
      const nameMatch = (i.ingredient_name || i.name || i.item || "").toLowerCase().includes(searchQuery.toLowerCase());
      const categoryMatch = selectedCategory === "All" || String(i.category) === String(selectedCategory);
      return nameMatch && categoryMatch;
    });
  }, [ingredients, searchQuery, selectedCategory]);

  // --- RENDER ---
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* --- MODALS --- */}
      <AddIngredientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchIngredients} 
      />
      
      <StaffGateModal 
        isOpen={isStaffGateOpen}
        staffList={staffList}
        selectedStaff={selectedStaff}
        onSelect={setSelectedStaff}
        onConfirm={() => setIsStaffGateOpen(false)}
      />

      <DeleteIngredientModal 
        isOpen={!!ingredientToDelete}
        onClose={() => setIngredientToDelete(null)}
        onConfirm={confirmDelete}
        ingredientName={ingredientToDelete?.ingredient_name || ingredientToDelete?.name || ingredientToDelete?.item || "Unknown Item"}
      />

      {/* --- LAYOUT --- */}
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 overflow-y-auto custom-scrollbar">
          
          {/* Header */}
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
                return <option key={id} value={id}>Staff: {staff.name || staff.username || `#${id}`}</option>;
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
                  ) : filteredIngredients.length > 0 ? (
                    filteredIngredients.map((row) => (
                      <IngredientRow 
                        key={row.ingredient_id || row.id} 
                        row={row} 
                        onUpdateStock={handleUpdateStock}
                        onDeleteClick={setIngredientToDelete} // <-- This is where the magic happens now!
                      />
                    ))
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