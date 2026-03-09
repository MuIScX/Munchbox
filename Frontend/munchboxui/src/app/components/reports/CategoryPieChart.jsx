"use client";
import React from "react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function CategoryPieChart({ data }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      <h2 className="text-lg font-bold italic text-slate-800 mb-4">Category Breakdown</h2>
      <div className="flex-1 flex items-center justify-center">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={100}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value) => `${value} orders`} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-400 italic">No category data</div>
        )}
      </div>
    </div>
  );
}