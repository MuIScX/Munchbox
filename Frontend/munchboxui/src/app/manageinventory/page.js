"use client";
import { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import AddIngredientModal from "../components/AddIngredientModal";
import StaffGateModal from "../components/StaffGateModal";
import IngredientRow from "../components/IngredientRow";
import DeleteIngredientModal from "../components/DeleteIngredientModal";
import { IngredientAPI, StaffAPI } from "../../lib/api";
import Toast from "../components/Toast";
import { Search, Plus, Loader2, Trash2, PackageOpen, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema";

export default function Home() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [isStaffGateOpen, setIsStaffGateOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [ingredientToDelete, setIngredientToDelete] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
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
      showToast("error", "Please select a staff member before updating stock.");
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
      showToast("error", error.message || "Failed to update stock");
    }
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
    return ingredients.filter(i => {
      const nameMatch = (i.ingredient_name || i.name || i.item || "").toLowerCase().includes(searchQuery.toLowerCase());
      const categoryMatch = selectedCategory === "All" || String(i.category) === String(selectedCategory);
      const stock = Number(i.stock_left ?? i.stock ?? 0);
      const min = i.min_stock || i.minStock || 0;
      const isOk = stock >= min;
      const statusMatch = selectedStatus === "All" || (selectedStatus === "ok" ? isOk : !isOk);
      return nameMatch && categoryMatch && statusMatch;
    });
  }, [ingredients, searchQuery, selectedCategory, selectedStatus]);

  const understockCount = useMemo(() => {
    return ingredients.filter(i => {
      const stock = Number(i.stock_left ?? i.stock ?? 0);
      const min = i.min_stock || i.minStock || 0;
      return stock < min;
    }).length;
  }, [ingredients]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      <Toast toast={toast} onClose={() => setToast(null)} />

      <AddIngredientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchIngredients}
        existingIngredients={ingredients}
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

      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 flex flex-col gap-6 overflow-hidden h-full">

          {/* Header + Summary Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <PackageOpen size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manage Inventory</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Track and update ingredient stock levels</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition shadow-sm"
                >
                  <Plus size={18} /> Add Ingredient
                </button>
              </div>
              <div className="flex gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Package size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Total</p>
                    <p className="text-3xl font-bold text-blue-900 mt-0.5">{ingredients.length}</p>
                    <p className="text-xs text-blue-500 font-medium mt-0.5">ingredients</p>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">OK Stock</p>
                    <p className="text-3xl font-bold text-emerald-900 mt-0.5">{ingredients.length - understockCount}</p>
                    <p className="text-xs text-emerald-500 font-medium mt-0.5">sufficient</p>
                  </div>
                </div>
                <div className={`rounded-xl border p-4 flex items-center gap-4 flex-1 ${understockCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${understockCount > 0 ? "bg-red-100" : "bg-slate-200"}`}>
                    <AlertTriangle size={18} className={understockCount > 0 ? "text-red-600" : "text-slate-500"} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${understockCount > 0 ? "text-red-600" : "text-slate-500"}`}>Understock</p>
                    <p className={`text-3xl font-bold mt-0.5 ${understockCount > 0 ? "text-red-900" : "text-slate-700"}`}>{understockCount}</p>
                    <p className={`text-xs font-medium mt-0.5 ${understockCount > 0 ? "text-red-500" : "text-slate-400"}`}>need reorder</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search ingredient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none shadow-sm w-56"
              />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 shadow-sm">
              <option value="All">Category: All</option>
              {Object.entries(CATEGORY_MAP).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
            </select>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 shadow-sm">
              <option value="All">Status: All</option>
              <option value="ok">OK</option>
              <option value="low_stock">Low Stock</option>
            </select>
            <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 shadow-sm">
              <option value="" disabled>Select Staff</option>
              {staffList.map((staff) => { const id = staff.staff_id || staff.id; return <option key={id} value={id}>Staff: {staff.name || staff.username || `#${id}`}</option>; })}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-semibold text-slate-700">Inventory List</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filteredIngredients.length} items found</p>
              </div>
            </div>
            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5 font-semibold w-[25%]">Item</th>
                    <th className="px-6 py-3.5 font-semibold w-[15%]">Category</th>
                    <th className="px-6 py-3.5 font-semibold w-[12%] text-center">Status</th>
                    <th className="px-6 py-3.5 font-semibold w-[12%] text-center">Stock</th>
                    <th className="px-6 py-3.5 font-semibold w-[12%] text-center">Require Stock</th>
                    <th className="px-6 py-3.5 font-semibold w-[10%] text-center">Unit</th>
                    <th className="px-6 py-3.5 font-semibold w-[14%] text-center">
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
                    <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" size={28} /></td></tr>
                  ) : filteredIngredients.length > 0 ? (
                    filteredIngredients.map((row) => (
                      <IngredientRow key={row.ingredient_id || row.id} row={row} onUpdateStock={handleUpdateStock} showDelete={showDelete} onDeleteClick={setIngredientToDelete} />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center">
                        <PackageOpen className="mx-auto mb-3 text-slate-200" size={40} />
                        <p className="text-slate-400 font-medium">No ingredients found</p>
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
