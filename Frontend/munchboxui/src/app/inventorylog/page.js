"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { IngredientAPI, StaffAPI } from "@/lib/api"; 
import { Search, Calendar, User, Loader2 } from 'lucide-react';

export default function InventoryLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("All");

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
    return matchesSearch && matchesStaff && matchesDate;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="p-8 overflow-y-auto custom-scrollbar">
          
          {/* Page Title Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h1 className="text-2xl font-bold italic text-slate-800">View Inventory Log</h1>
          </div>

          {/* Filters Section */}
          <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search Ingredient..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-600"
              />
            </div>
            
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-600"
              />
            </div>

            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select 
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-600 min-w-[180px]"
              >
                <option value="All">Staff : All</option>
                {staffList.map((staff) => (
                  <option key={staff.id || staff.staff_id} value={staff.id || staff.staff_id}>
                    Staff : {staff.name || staff.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Log Table Container */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-bold italic text-slate-800 text-lg">Record Inventory log</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-sm italic sticky top-0 z-10">
                    <th className="px-6 py-4 font-semibold">Date/Time</th>
                    <th className="px-6 py-4 font-semibold">Staff</th>
                    <th className="px-6 py-4 font-semibold">Action</th>
                    <th className="px-6 py-4 font-semibold">Ingredient</th>
                    <th className="px-6 py-4 font-semibold">Change</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <Loader2 className="animate-spin text-orange-500 mx-auto" size={32} />
                      </td>
                    </tr>
                  ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log, index) => {
                      // Determine Stock In vs Stock Out based on change value or action text
                      const changeAmount = parseFloat(log.amount || 0);
                      let newTotal = 0
                      let isStockIn = true
                      
                      if(log.action_type == 2){
                            isStockIn = false;
                            newTotal = log.stock_left - changeAmount
                      }
                      else{
                        isStockIn = true;
                        newTotal = log.stock_left + changeAmount
                      }
    
                      const stockBefore = log.stock_left || 0;

                     
                      
                      return (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-600 text-sm whitespace-nowrap">{log.timestamp}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{log.staff_name}</td>
                          <td className="px-6 py-4">
                            <span className={`font-bold text-xs ${isStockIn ? 'text-emerald-500' : 'text-red-500'}`}>
                              {isStockIn ? 'STOCK IN' : 'STOCK OUT'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{log.ingredient_name}</td>
                          <td className={`px-6 py-4 font-bold ${isStockIn ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isStockIn ? `+${changeAmount}` : `-${changeAmount}`} {log.unit}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm italic">
                            {log.ingredient_name} stock {isStockIn ? 'in' : 'out'}: {isStockIn ? '+' : '-'}{log.amount} {log.unit} (New total: {newTotal} {log.unit})
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 italic">
                        No history records found.
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