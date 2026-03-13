"use client";
import React from "react";

export default function KPICards({ totalOrders, totalRevenue, formatCurrency }) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="bg-[#fef3c7] flex-1 max-w-[220px] p-5 rounded-2xl shadow-sm">
        <p className="text-[#b45309] text-sm font-semibold mb-1">Total Orders</p>
        <h2 className="text-4xl font-bold text-slate-800 italic">
          {totalOrders.toLocaleString()}
        </h2>
      </div>
      <div className="bg-[#e0f2fe] flex-1 max-w-[220px] p-5 rounded-2xl shadow-sm">
        <p className="text-[#0369a1] text-sm font-semibold mb-1">Total Revenue</p>
        <h2 className="text-4xl font-bold text-slate-800 italic break-all leading-tight">
          {formatCurrency(totalRevenue)}
        </h2>
      </div>
    </div>
  );
}