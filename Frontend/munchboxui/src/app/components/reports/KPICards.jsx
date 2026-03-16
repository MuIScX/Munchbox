"use client";
import React from "react";
import { ShoppingCart, TrendingUp } from "lucide-react";

function shortCurrency(val) {
  if (val >= 1_000_000) return `฿${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `฿${(val / 1_000).toFixed(1)}K`;
  return `฿${val.toLocaleString()}`;
}

export default function KPICards({ totalOrders, totalRevenue, formatCurrency }) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl shadow-sm p-5 flex items-start gap-4 min-w-[190px]">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <ShoppingCart size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">Total Orders</p>
          <p className="text-3xl font-bold text-amber-900 mt-0.5">{totalOrders.toLocaleString()}</p>
          <p className="text-xs text-amber-500 font-medium mt-0.5">in selected period</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl shadow-sm p-5 flex items-start gap-4 min-w-[190px]">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <TrendingUp size={18} className="text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Total Revenue</p>
          <p className="text-3xl font-bold text-blue-900 mt-0.5" title={formatCurrency(totalRevenue)}>
            {shortCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-blue-500 font-medium mt-0.5">in selected period</p>
        </div>
      </div>
    </div>
  );
}
