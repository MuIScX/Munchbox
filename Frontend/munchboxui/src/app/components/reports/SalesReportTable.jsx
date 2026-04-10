"use client";
import { useState } from "react";
import { Search } from "lucide-react";

export default function SalesReportTable({
  tableData,
  formatCurrency,
  shareAllTime,
  startDate,
  endDate,
}) {
  const [sortOption, setSortOption] = useState("Top Sell");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sortedTableData = [...tableData]
    .filter(row => (row.item || "").toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === "Top Sell") return b.orders - a.orders;
      if (sortOption === "Lowest Sell") return a.orders - b.orders;
      if (sortOption === "Highest Revenue") return b.revenue - a.revenue;
      return 0;
    });

  const sumTableOrders = tableData.reduce((acc, curr) => acc + Number(curr.orders), 0);
  const sumTableRevenue = tableData.reduce((acc, curr) => acc + Number(curr.revenue), 0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="shrink-0">
          <h2 className="font-bold text-slate-800 text-lg italic">Sales Report</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
            {shareAllTime ? "All Time" : `${startDate ? startDate.split("-").reverse().join("/") : "—"} – ${endDate ? endDate.split("-").reverse().join("/") : "—"}`}
          </p>
        </div>

        <div className="w-px h-8 mx-0 bg-slate-100" />

        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative w-48">
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent transition">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search recipe..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
              />
            </div>
            {showSuggestions && (() => {
              const suggestions = tableData.filter(row => (row.item || "").toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6);
              if (suggestions.length === 0) return null;
              return (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  {suggestions.map(row => (
                    <button key={row.id} onMouseDown={(e) => { e.preventDefault(); setSearchQuery(row.item); setShowSuggestions(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-600 font-medium transition-colors">
                      {row.item}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-xs text-slate-400">Sort:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer font-semibold"
            >
              <option value="Top Sell">Top Sell</option>
              <option value="Lowest Sell">Lowest Sell</option>
              <option value="Highest Revenue">Highest Revenue</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="overflow-auto custom-scrollbar h-[370px]">
          <table className="w-full table-fixed text-left border-separate border-spacing-0 min-w-[600px]">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[23%]" />
              <col className="w-[27%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                <th className="px-6 py-3 bg-slate-50/90 backdrop-blur-sm rounded-tl-xl">Item</th>
                <th className="px-6 py-3 bg-slate-50/90 backdrop-blur-sm">Orders</th>
                <th className="px-6 py-3 bg-slate-50/90 backdrop-blur-sm">Revenue</th>
                <th className="px-6 py-3 bg-slate-50/90 backdrop-blur-sm rounded-tr-xl">Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableData.length > 0 ? (
                sortedTableData.map((row) => (
                  <tr key={row.id} className="text-slate-700 text-sm hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3 font-medium break-words">{row.item}</td>
                    <td className="px-6 py-3">{row.orders.toLocaleString()}</td>
                    <td className="px-6 py-3">{formatCurrency(row.revenue)}</td>
                    <td className="px-6 py-3">{Number(row.share).toFixed(1)}%</td>
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
          </table>
        </div>

        {/* Fixed total row always at bottom */}
        <div>
          <table className="w-full table-fixed text-left border-separate border-spacing-0 min-w-[600px]">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[23%]" />
              <col className="w-[27%]" />
              <col className="w-[20%]" />
            </colgroup>
            <tbody>
              <tr className="text-slate-800 text-sm italic font-bold">
                <td className="px-6 py-4 bg-slate-50 rounded-bl-xl rounded-tl-xl">Total</td>
                <td className="px-6 py-4 bg-slate-50">{sumTableOrders.toLocaleString()}</td>
                <td className="px-6 py-4 bg-slate-50">{formatCurrency(sumTableRevenue)}</td>
                <td className="px-6 py-4 bg-slate-50 rounded-br-xl rounded-tr-xl">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}