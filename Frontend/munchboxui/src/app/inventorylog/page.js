"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { IngredientAPI, StaffAPI } from "../../lib/api";
import { Search, Calendar, User, Loader2, ClipboardList, X, BookOpen } from 'lucide-react';

export default function InventoryLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [detailBatch, setDetailBatch] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("All");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await IngredientAPI.log(null);
      if (response && Array.isArray(response.Data)) {
        setLogs(response.Data);
      }
    } catch {
      // logs unavailable
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await StaffAPI.list();
      if (response && Array.isArray(response.Data)) {
        setStaffList(response.Data);
      }
    } catch {
      // staff list unavailable
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStaff();
  }, []);

  // Group logs by timestamp — each unique timestamp = one batch update session
  const batches = (() => {
    const map = new Map();
    for (const log of logs) {
      const key = log.timestamp;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(log);
    }
    // Convert to array sorted by timestamp desc (already ordered from API)
    return Array.from(map.entries()).map(([timestamp, rows]) => ({
      timestamp,
      staff_id:    rows[0].staff_id,
      staff_name:  rows[0].staff_name,
      as_of_date:  rows[0].as_of_date  ?? null,
      restock_type: rows[0].restock_type ?? null,
      rows,
    }));
  })();

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.rows.some(r =>
      (r.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStaff = selectedStaff === "All" || String(batch.staff_id) === String(selectedStaff);
    const matchesDate = !selectedDate || batch.timestamp?.includes(selectedDate);
    return matchesSearch && matchesStaff && matchesDate;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      {/* Detail Modal */}
      {detailBatch && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300 shrink-0" />
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">Stock Update Detail</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="font-semibold text-slate-600">Updated by:</span> {detailBatch.staff_name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="font-semibold text-slate-600">Logged at:</span> {detailBatch.timestamp}
                  </p>
                  {detailBatch.as_of_date && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-600">As Of:</span> {detailBatch.as_of_date}
                      {detailBatch.restock_type != null && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${detailBatch.restock_type === 1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {detailBatch.restock_type === 1 ? "Before Restock" : "After Restock"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button onClick={() => setDetailBatch(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-3 custom-scrollbar">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="py-2 text-left font-semibold">Ingredient</th>
                      <th className="py-2 text-center font-semibold">Before</th>
                      <th className="py-2 text-center font-semibold">After</th>
                      <th className="py-2 text-left font-semibold pl-2">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailBatch.rows.map((r) => (
                      <tr key={r.ingredient_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 text-sm text-slate-700 font-medium">{r.ingredient_name}</td>
                        <td className="py-2.5 text-center text-sm text-slate-400">{r.previous_stock ?? '—'}</td>
                        <td className="py-2.5 text-center text-sm font-bold text-orange-500">{r.new_current}</td>
                        <td className="py-2.5 text-xs text-slate-400 pl-2">{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
                {detailBatch.rows.length} ingredient{detailBatch.rows.length !== 1 ? "s" : ""} updated
              </div>
            </div>
          </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 flex flex-col gap-6 overflow-hidden h-full">

          {/* Header Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <ClipboardList size={20} className="text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inventory Log</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Track all stock changes and updates</p>
                </div>
              </div>
            </div>
          </div>

          {/* Log Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex items-center bg-white">
              <div className="shrink-0">
                <h2 className="font-bold text-slate-800 text-lg italic leading-tight">Stock Records</h2>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                  {filteredBatches.length} records found
                </p>
              </div>

              <div className="w-px h-8 bg-slate-200 mx-6 shrink-0" />

              <div className="flex gap-3 items-center flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" placeholder="Search ingredient..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 text-xs text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none w-48 transition-all hover:border-slate-300" />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 text-xs text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 text-xs text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none min-w-[150px] cursor-pointer hover:border-slate-300">
                    <option value="All">Staff: All</option>
                    {staffList.map((staff) => (<option key={staff.staff_id} value={staff.staff_id}>{staff.name}</option>))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5 font-semibold">Date/Time</th>
                    <th className="px-6 py-3.5 font-semibold">Staff</th>
                    <th className="px-6 py-3.5 font-semibold text-center">Action</th>
                    <th className="px-6 py-3.5 font-semibold">Description</th>
                    <th className="px-6 py-3.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" size={28} /></td></tr>
                  ) : filteredBatches.length > 0 ? (
                    filteredBatches.map((batch, index) => (
                      <tr key={index} className="hover:bg-orange-50/40 transition-colors">
                        <td className="px-6 py-3 text-slate-500 text-sm whitespace-nowrap">{batch.timestamp}</td>
                        <td className="px-6 py-3 text-slate-800 font-semibold">{batch.staff_name}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-600">
                            STOCK UPDATE
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-sm">
                          <span className="font-semibold text-slate-700">{batch.staff_name}</span> updated stock at{" "}
                          <span className="font-semibold text-slate-700">{batch.timestamp}</span>
                          {" "}({batch.rows.length} ingredient{batch.rows.length > 1 ? "s" : ""})
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => setDetailBatch(batch)}
                            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-500 transition-colors"
                          >
                            <BookOpen size={14} /> Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <ClipboardList className="mx-auto mb-3 text-slate-200" size={40} />
                        <p className="text-slate-400 font-medium">No records found</p>
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
