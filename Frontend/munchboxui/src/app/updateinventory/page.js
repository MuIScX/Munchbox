"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Sidebar from "../components/Sidebar";
import AddIngredientModal from "../components/AddIngredientModal";
import IngredientRow from "../components/IngredientRow";
import DeleteIngredientModal from "../components/DeleteIngredientModal";
import EditIngredientModal from "../components/EditIngredientModal";
import CategorySortPopover from "../components/CategorySortPopover";
import { IngredientAPI, StaffSession, ImportAPI } from "../../lib/api";
import Toast from "../components/Toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Search, Plus, Loader2, Trash2, PackageOpen, ArrowUpDown, Check, RefreshCw, Calendar, Upload, Download } from 'lucide-react';
import { CATEGORY_MAP } from "../../lib/schema";

export default function UpdateInventoryPage() {
  const [ingredients, setIngredients]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState("update"); // "update" | "manage"

  // Update Stock state
  const [stockValues, setStockValues]       = useState({});
  const [asOfDate, setAsOfDate]             = useState(new Date());
  const [restockType, setRestockType]       = useState("after"); // "before" | "after"
  const [saving, setSaving]                 = useState(false);
  const [importing, setImporting]           = useState(false);
  const csvInputRef                         = useRef(null);

  // Manage tab state
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [ingredientToDelete, setIngredientToDelete] = useState(null);
  const [showDelete, setShowDelete]         = useState(false);
  const [ingredientToEdit, setIngredientToEdit] = useState(null);
  const [showSortModal, setShowSortModal]   = useState(false);
  const [categoryOrder, setCategoryOrder]   = useState(() => {
    try {
      const saved = localStorage.getItem("inventory_category_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        const allKeys = Object.keys(CATEGORY_MAP);
        return [...parsed.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !parsed.includes(k))];
      }
    } catch {}
    return Object.keys(CATEGORY_MAP);
  });
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => setToast({ type, message });

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await IngredientAPI.list({});
      setIngredients(Array.isArray(response?.Data) ? response.Data : []);
    } catch {
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIngredients(); }, []);

  // ── Update Stock ──
  const handleStockChange = (id, value) => {
    setStockValues(prev => ({ ...prev, [String(id)]: value }));
  };

  const handleSaveStock = async () => {
    const updates = Object.entries(stockValues)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([id, v]) => ({ ingredient_id: parseInt(id), new_stock: parseFloat(v) }));

    if (updates.length === 0) { showToast("error", "No changes to save."); return; }

    const staff = StaffSession.get();
    const asOfStr = asOfDate
      ? `${asOfDate.getFullYear()}-${String(asOfDate.getMonth()+1).padStart(2,"0")}-${String(asOfDate.getDate()).padStart(2,"0")}`
      : null;
    const restockTypeNum = restockType === "before" ? 1 : 2;
    setSaving(true);
    try {
      await IngredientAPI.updateStock(updates, staff ? parseInt(staff.id) : null, asOfStr, restockTypeNum);
      showToast("success", `Updated ${updates.length} ingredient${updates.length > 1 ? "s" : ""}.`);
      setStockValues({});
      fetchIngredients();
    } catch (err) {
      showToast("error", err.message || "Failed to update stock.");
    } finally {
      setSaving(false);
    }
  };

  const changedCount = Object.values(stockValues).filter(v => v !== "").length;

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const res = await ImportAPI.inventory(file);
      const { updated = 0, skipped = 0, errors = [] } = res?.Data ?? {};
      showToast("success", `Imported: ${updated} updated, ${skipped} skipped${errors.length ? `, ${errors.length} errors` : ""}.`);
      fetchIngredients();
    } catch (err) {
      showToast("error", err.message || "CSV import failed.");
    } finally {
      setImporting(false);
    }
  };

  const downloadCSVTemplate = () => {
    const header = "ingredient_name,new_stock,as_of_date,restock_type\n";
    const example = "Chicken,50,2026-04-23,after\n";
    const blob = new Blob([header + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "inventory_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Grouped ingredients for update tab
  const grouped = useMemo(() => {
    const groups = {};
    for (const ing of ingredients) {
      const cat = String(ing.category);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ing);
    }
    return groups;
  }, [ingredients]);

  // ── Manage tab ──
  const filteredIngredients = useMemo(() => {
    return ingredients
      .filter(i => {
        const nameMatch = (i.ingredient_name || i.name || "").toLowerCase().includes(searchQuery.toLowerCase());
        const catMatch = selectedCategory === "All" || String(i.category) === String(selectedCategory);
        return nameMatch && catMatch;
      })
      .sort((a, b) => {
        const ai = categoryOrder.indexOf(String(a.category));
        const bi = categoryOrder.indexOf(String(b.category));
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
  }, [ingredients, searchQuery, selectedCategory, categoryOrder]);

  const handleEditDetail = async (payload) => {
    await IngredientAPI.updateDetail(payload);
    setIngredientToEdit(null);
    showToast("success", "Ingredient updated.");
    fetchIngredients();
  };

  const confirmDelete = async () => {
    if (!ingredientToDelete) return;
    const id = ingredientToDelete.ingredient_id || ingredientToDelete.id;
    try {
      await IngredientAPI.delete(id);
      setIngredients(prev => prev.filter(i => (i.ingredient_id || i.id) !== id));
      setIngredientToDelete(null);
      showToast("success", "Ingredient deleted.");
    } catch (err) {
      showToast("error", err.message || "Delete failed.");
    }
  };

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

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex flex-col gap-4 h-full overflow-hidden">

          {/* Header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <PackageOpen size={20} className="text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Update Inventory</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Track and update ingredient stock levels</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {[["update", "Update Stock"], ["manage", "Manage Ingredients"]].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      tab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Update Stock Tab ── */}
          {tab === "update" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">

              {/* Toolbar */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 shrink-0 flex-wrap">
                {/* As Of date */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <Calendar size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-400 font-medium shrink-0">As Of</span>
                  <span className="text-slate-200 text-xs">|</span>
                  <DatePicker
                    selected={asOfDate}
                    onChange={(d) => setAsOfDate(d)}
                    maxDate={new Date()}
                    dateFormat="dd/MM/yyyy"
                    className="bg-transparent text-xs font-semibold text-slate-600 outline-none cursor-pointer w-[90px]"
                  />
                </div>

                {/* Before/After Restock */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Restock:</span>
                  {[["before", "Before"], ["after", "After"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setRestockType(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        restockType === val
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Hidden CSV file input */}
                  <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />

                  <button onClick={downloadCSVTemplate}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition" title="Download CSV template">
                    <Download size={13} /> Template
                  </button>
                  <button onClick={() => csvInputRef.current?.click()} disabled={importing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50">
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Import CSV
                  </button>
                  <button
                    onClick={() => { setStockValues({}); fetchIngredients(); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition"
                  >
                    <RefreshCw size={13} /> Reset
                  </button>
                  <button
                    onClick={handleSaveStock}
                    disabled={saving || changedCount === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-50 active:scale-95"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Save {changedCount > 0 ? `(${changedCount})` : ""}
                  </button>
                </div>
              </div>

              {/* Column headers */}
              <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/60 shrink-0">
                <div className="grid grid-cols-[1fr_80px_120px_120px] gap-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  <span>Ingredient</span>
                  <span className="text-center">Unit</span>
                  <span className="text-center">Current Stock</span>
                  <span className="text-center">New Stock</span>
                </div>
              </div>

              {/* Scrollable ingredient list */}
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6 custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="animate-spin text-orange-400" size={24} />
                  </div>
                ) : ingredients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
                    <PackageOpen size={32} />
                    <p className="text-sm">No ingredients found</p>
                  </div>
                ) : (
                  categoryOrder.map((catId) => {
                    const items = grouped[catId];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={catId}>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2 pb-1 border-b border-orange-100">
                          {CATEGORY_MAP[catId] || catId}
                        </h3>
                        <div className="space-y-0.5">
                          {items.map((ing) => {
                            const id = ing.ingredient_id || ing.id;
                            const name = ing.ingredient_name || ing.name || "";
                            const currentStock = ing.stock_left ?? ing.stock ?? "—";
                            const newVal = stockValues[String(id)] ?? "";
                            const changed = newVal !== "";
                            return (
                              <div
                                key={id}
                                className={`grid grid-cols-[1fr_80px_120px_120px] gap-4 items-center py-2 px-3 rounded-lg transition-colors ${changed ? "bg-orange-50" : "hover:bg-slate-50"}`}
                              >
                                <span className={`text-sm font-medium truncate ${changed ? "text-orange-700" : "text-slate-700"}`}>{name}</span>
                                <span className="text-xs text-slate-400 text-center">{ing.unit}</span>
                                <span className="text-sm font-semibold text-slate-400 text-center">{currentStock}</span>
                                <div className="flex justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={newVal}
                                    placeholder="—"
                                    onChange={(e) => handleStockChange(id, e.target.value)}
                                    className={`w-24 text-center border rounded-lg px-2 py-1.5 text-sm font-semibold outline-none transition [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:appearance-none ${
                                      changed
                                        ? "border-orange-400 bg-white text-orange-700 focus:ring-2 focus:ring-orange-400"
                                        : "border-slate-200 bg-slate-50 text-slate-600 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                    }`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── Manage Ingredients Tab ── */}
          {tab === "manage" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">

              <div className="px-6 py-4 border-b border-slate-100 shrink-0 flex items-center bg-white">
                <div className="shrink-0">
                  <h2 className="font-bold text-slate-800 text-lg italic leading-tight">Ingredient List</h2>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                    {filteredIngredients.length} items
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-200 mx-6 shrink-0" />
                <div className="flex gap-3 items-center flex-1 justify-between">
                  {/* Search */}
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
                    {showSuggestions && (() => {
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
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer">
                    <option value="All">Category: All</option>
                    {Object.entries(CATEGORY_MAP).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                  <div className="relative ml-auto">
                    <button onClick={() => setShowSortModal(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${showSortModal ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      <ArrowUpDown size={13} /> Sort
                    </button>
                    <CategorySortPopover isOpen={showSortModal} onClose={() => setShowSortModal(false)}
                      categoryOrder={categoryOrder} onChange={(o) => { setCategoryOrder(o); localStorage.setItem("inventory_category_order", JSON.stringify(o)); }}
                      categoryMap={CATEGORY_MAP} />
                  </div>
                  <button onClick={() => setIsModalOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm">
                    <Plus size={15} /> Add
                  </button>
                </div>
              </div>

              <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-full table-fixed text-left border-collapse min-w-[800px]">
                  <colgroup>
                    <col className="w-[30%]" /><col className="w-[20%]" /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[20%]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-100">
                    <tr className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                      <th className="px-6 py-3">Item</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3 text-center">Stock</th>
                      <th className="px-6 py-3 text-center">Unit</th>
                      <th className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          Action
                          <button onClick={() => setShowDelete(v => !v)}
                            className={`p-1 rounded-md transition-all ${showDelete ? "text-red-500 bg-red-50" : "text-slate-300 hover:text-red-400"}`}>
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
                        <IngredientRow key={row.ingredient_id || row.id} row={row} showDelete={showDelete}
                          onDeleteClick={setIngredientToDelete} onEditClick={setIngredientToEdit} />
                      ))
                    ) : (
                      <tr><td colSpan={5} className="py-24 text-center">
                        <PackageOpen className="mx-auto mb-3 text-slate-200" size={48} />
                        <p className="text-slate-400 font-medium italic">No ingredients found</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
