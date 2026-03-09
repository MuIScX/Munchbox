"use client";
import React, { useState } from "react";

export default function SalesReportTable({ tableData, formatCurrency }) {
  const [sortOption, setSortOption] = useState("Top Sell");

  // Local Sorting Logic
  const sortedTableData = [...tableData].sort((a, b) => {
    if (sortOption === "Top Sell") return b.orders - a.orders;
    if (sortOption === "Lowest Sell") return a.orders - b.orders;
    if (sortOption === "Highest Revenue") return b.revenue - a.revenue;
    return 0;
  });

  // Local Totals Logic
  const sumTableOrders = tableData.reduce((acc, curr) => acc + Number(curr.orders), 0);
  const sumTableRevenue = tableData.reduce((acc, curr) => acc + Number(curr.revenue), 0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-lg font-bold italic text-slate-800">Sales report</h2>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1">
          <span className="text-sm text-slate-500">Sort:</span>
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
          >
            <option value="Top Sell">Top Sell</option>
            <option value="Lowest Sell">Lowest Sell</option>
            <option value="Highest Revenue">Highest Revenue</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm italic font-bold">
              <th className="px-6 py-4 rounded-l-xl">Item</th>
              <th className="px-6 py-4">Orders</th>
              <th className="px-6 py-4">Revenue</th>
              <th className="px-6 py-4 rounded-r-xl">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sortedTableData.length > 0 ? (
              sortedTableData.map((row) => (
                <tr key={row.id} className="text-slate-700 text-sm hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 font-medium">{row.item}</td>
                  <td className="px-6 py-5">{row.orders.toLocaleString()}</td>
                  <td className="px-6 py-5">{formatCurrency(row.revenue)}</td>
                  <td className="px-6 py-5">{Number(row.share).toFixed(1)}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-10 text-slate-400 italic">
                  No report data available.
                </td>
              </tr>
            )}
          </tbody>
          
          {sortedTableData.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 text-slate-800 text-sm italic font-bold border-t-2 border-slate-100">
                <td className="px-6 py-4 rounded-l-xl">Total</td>
                <td className="px-6 py-4">{sumTableOrders.toLocaleString()}</td>
                <td className="px-6 py-4">{formatCurrency(sumTableRevenue)}</td>
                <td className="px-6 py-4 rounded-r-xl">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}