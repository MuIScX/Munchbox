"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { IngredientAPI, StaffAPI } from "../../lib/api"; 
import { Search, Calendar, User, Loader2, ClipboardList } from 'lucide-react';

export default function InventoryLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("All");
  const [selectedAction, setSelectedAction] = useState("All");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // Passing null to get all logs, or a specific ID if you wanted to filter by ingredient
      const response = await IngredientAPI.log(null); 
      console.log(response.Data)
      if (response && Array.isArray(response.Data)) {
        setLogs(response.Data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
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
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStaff();
  }, []);

  // Filter Logic
  const filteredLogs = logs.filter(log => {
    const ingredientName = (log.ingredient_name || "").toLowerCase();
    const matchesSearch = ingredientName.includes(searchQuery.toLowerCase());
    const matchesStaff = selectedStaff === "All" || String(log.staff_id) === String(selectedStaff);
    const matchesDate = !selectedDate || log.timestamp?.includes(selectedDate);
    const matchesAction = selectedAction === "All" || (selectedAction === "in" ? log.action_type !== 2 : log.action_type === 2);
    return matchesSearch && matchesStaff && matchesDate && matchesAction;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 flex flex-col gap-6 overflow-hidden h-full">

          {/* Header Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <ClipboardList size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inventory Log</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Track all stock changes and updates</p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-500 font-medium">
                  {filteredLogs.length} records
                </div>
              </div>
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" placeholder="Search ingredient..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-slate-50 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none w-52" />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-slate-50 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-slate-50 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none min-w-[170px]">
                    <option value="All">Staff: All</option>
                    {staffList.map((staff) => (<option key={staff.id || staff.staff_id} value={staff.id || staff.staff_id}>{staff.name || staff.username}</option>))}
                  </select>
                </div>
                <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 outline-none">
                  <option value="All">Action: All</option>
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                </select>
              </div>
            </div>
          </div>

          {/* Log Table Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="font-semibold text-slate-700">Stock Records</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filteredLogs.length} records found</p>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5 font-semibold">Date/Time</th>
                    <th className="px-6 py-3.5 font-semibold">Staff</th>
                    <th className="px-6 py-3.5 font-semibold">Action</th>
                    <th className="px-6 py-3.5 font-semibold">Ingredient</th>
                    <th className="px-6 py-3.5 font-semibold">Change</th>
                    <th className="px-6 py-3.5 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin text-orange-500 mx-auto" size={28} /></td></tr>
                  ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log, index) => {
                      const changeAmount = parseFloat(log.amount || 0);
                      const isStockIn = log.action_type !== 2;
                      return (
                        <tr key={index} className="hover:bg-orange-50/40 transition-colors">
                          <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">{log.timestamp}</td>
                          <td className="px-6 py-4 text-slate-800 font-semibold">{log.staff_name}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isStockIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                              {isStockIn ? 'Stock In' : 'Stock Out'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-800 font-semibold">{log.ingredient_name}</td>
                          <td className={`px-6 py-4 font-bold ${isStockIn ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isStockIn ? `+${changeAmount}` : `-${changeAmount}`} {log.unit}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm">
                            New total: <span className="font-semibold text-slate-600">{log.new_current} {log.unit}</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
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
