"use client";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { SaleAPI } from "../../lib/api";
import {
  Plus, Trash2, Send, ShoppingCart, Calendar,
  Hash, Package, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";

const DEFAULT_ITEM = { menu_id: "", amount: "" };

export default function AddSalePage() {
  const [items, setItems]       = useState([{ ...DEFAULT_ITEM }]);
  const [saleDate, setSaleDate] = useState("");
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = (type, message) => setToast({ type, message });

  /* ── item handlers ── */
  const addItem = () => setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);

  const removeItem = (idx) =>
    setItems((prev) => prev.length === 1 ? [{ ...DEFAULT_ITEM }] : prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) =>
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  /* ── validation ── */
  const validItems = items.filter(
    (i) => String(i.menu_id).trim() !== "" && Number(i.amount) > 0
  );

  /* ── submit ── */
  const handleSubmit = async () => {
    if (validItems.length === 0) {
      showToast("error", "Add at least one valid item with menu ID and amount.");
      return;
    }

    setLoading(true);
    try {
      const payload = validItems.map((i) => ({
        menu_id: parseInt(i.menu_id),
        amount:  parseInt(i.amount),
      }));
      const res = await SaleAPI.record(payload, saleDate || null);
      showToast("success", `Recorded ${res?.Data?.menu_recorded ?? validItems.length} menu(s) — ${res?.Data?.total_item ?? ""} items total.`);
      setItems([{ ...DEFAULT_ITEM }]);
      setSaleDate("");
    } catch (err) {
      showToast("error", err.message || "Failed to record sale.");
    } finally {
      setLoading(false);
    }
  };

  const totalItems = items.reduce((s, i) => s + (parseInt(i.amount) || 0), 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">

          {/* ── Header ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-400" />
            <div className="p-6 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <ShoppingCart size={22} className="text-orange-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Add Sale Data</h1>
                <p className="text-sm text-slate-400 mt-0.5">Manually record menu sales by ID and quantity</p>
              </div>
            </div>
          </div>

          {/* ── Date picker ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-3">
              <Calendar size={15} className="text-orange-400" />
              Sale Date
              <span className="text-xs font-normal text-slate-400 ml-1">(optional — defaults to today)</span>
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm
                text-slate-700 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition"
            />
          </div>

          {/* ── Items ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-orange-400" />
                <span className="text-sm font-semibold text-slate-700">Menu Items</span>
                <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              {totalItems > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  {totalItems} total items
                </span>
              )}
            </div>

            <div className="p-5 flex flex-col gap-3">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_1fr_36px] gap-3 px-1">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Hash size={11} /> Menu ID
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <ShoppingCart size={11} /> Amount
                </span>
                <span />
              </div>

              {/* Item rows */}
              {items.map((item, idx) => {
                const hasMenuId = String(item.menu_id).trim() !== "";
                const hasAmount = Number(item.amount) > 0;
                const isValid   = hasMenuId && hasAmount;
                const isEmpty   = !hasMenuId && !hasAmount;

                return (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_36px] gap-3 items-center group">
                    {/* Menu ID */}
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 3"
                        value={item.menu_id}
                        onChange={(e) => updateItem(idx, "menu_id", e.target.value)}
                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-700
                          focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition
                          ${isValid ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}
                      />
                    </div>

                    {/* Amount */}
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 2"
                        value={item.amount}
                        onChange={(e) => updateItem(idx, "amount", e.target.value)}
                        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-700
                          focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition
                          ${isValid ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}
                      />
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(idx)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300
                        hover:text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              {/* Add row button */}
              <button
                onClick={addItem}
                className="mt-1 flex items-center gap-2 text-sm font-medium text-orange-500
                  hover:text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-xl transition-colors w-fit"
              >
                <Plus size={16} /> Add row
              </button>
            </div>
          </div>

          {/* ── Summary + Submit ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            {/* Summary */}
            <div className="flex-1">
              {validItems.length > 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-600">
                    <b className="text-slate-800">{validItems.length}</b> menu{validItems.length !== 1 ? "s" : ""} ready ·{" "}
                    <b className="text-slate-800">{totalItems}</b> total items
                    {saleDate && <span className="text-slate-400"> · {saleDate}</span>}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-slate-300 shrink-0" />
                  <span className="text-sm text-slate-400">Fill in menu ID and amount to submit</span>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading || validItems.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600
                text-white text-sm font-semibold rounded-xl transition-all shadow-sm
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                : <><Send size={15} /> Submit Sale</>
              }
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}