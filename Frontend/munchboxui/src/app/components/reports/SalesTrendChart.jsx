"use client";
import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

export default function SalesTrendChart({ 
  data, 
  menuList, 
  selectedMenu, 
  setSelectedMenu, 
  trendLoading, 
  globalLoading 
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col relative">
      {trendLoading && !globalLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold italic text-slate-800">Sales Trend (Last 30 days)</h2>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1">
          <span className="text-sm text-slate-500">Menu:</span>
          <select 
            value={selectedMenu}
            onChange={(e) => setSelectedMenu(e.target.value)}
            className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer max-w-[150px] truncate"
          >
            <option value="All">All</option>
            {menuList.map((menu) => (
              <option key={menu.menu_id || menu.id} value={menu.menu_id || menu.id}>
                {menu.menu_name || menu.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative h-64 w-full">
        <span className="absolute top-0 left-0 text-xs font-bold italic text-slate-800">Order</span>
        <span className="absolute bottom-0 right-0 text-xs font-bold italic text-slate-800">Time</span>
        
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={false} axisLine={false} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line 
                type="monotone" 
                dataKey="order" 
                stroke="#3b82f6" 
                strokeWidth={4} 
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 italic">No trend data available</div>
        )}
      </div>
    </div>
  );
}