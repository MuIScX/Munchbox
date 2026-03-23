"use client";
import React from "react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

const formatTHB = (val) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);

export default function CategoryPieChart({ data }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      <h2 className="text-lg font-bold italic text-slate-800 mb-1">Revenue by Category</h2>
      <p className="text-xs text-slate-400 mb-4">Share of total revenue per menu type</p>
      <div className="flex-1 flex items-center justify-center">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value) => formatTHB(value)} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-400 italic py-10">No category data</div>
        )}
      </div>

      {/* Legend table */}
      {data.length > 0 && (
        <div className="mt-4 space-y-2">
          {sorted.map((entry, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-600 font-medium">{entry.name}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <span>{formatTHB(entry.value)}</span>
                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                  {total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
