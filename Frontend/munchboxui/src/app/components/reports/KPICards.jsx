"use client";
import React from "react";

function shortCurrency(val) {
  if (val >= 1_000_000) return `฿${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `฿${(val / 1_000).toFixed(1)}K`;
  return `฿${val.toLocaleString()}`;
}

export default function KPICards({ totalOrders, totalRevenue, formatCurrency }) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="bg-[#fef3c7] w-[200px] p-5 rounded-2xl shadow-sm">
        <p className="text-[#b45309] text-sm font-semibold mb-1">Total Orders</p>
        <h2 className="text-4xl font-bold text-slate-800 italic">
          {totalOrders.toLocaleString()}
        </h2>
      </div>
      <div className="bg-[#e0f2fe] w-[240px] p-5 rounded-2xl shadow-sm">
        <p className="text-[#0369a1] text-sm font-semibold mb-1">Total Revenue</p>
        <h2 className="text-3xl font-bold text-slate-800 italic leading-tight" title={formatCurrency(totalRevenue)}>
          {shortCurrency(totalRevenue)}
        </h2>
      </div>
    </div>
  );
}