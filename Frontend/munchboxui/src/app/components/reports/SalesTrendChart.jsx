"use client";
import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '10px 16px', boxShadow: '0 4px 12px rgb(0 0 0 / 0.12)', border: '1px solid #f1f5f9' }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
        {payload[0].value}
      </p>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0 0', fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function SalesTrendChart({
  data,
  menuList,
  selectedMenu,
  setSelectedMenu,
  trendLoading,
  globalLoading,
  shareAllTime,
  selectedMonth,
  selectedYear,
}) {
  const trendLabel = shareAllTime
    ? "All Time"
    : `${MONTHS[selectedMonth]} ${selectedYear}`;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col relative">
      {trendLoading && !globalLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold italic text-slate-800">Sales Trend ({trendLabel})</h2>
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
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#0f172a', fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
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