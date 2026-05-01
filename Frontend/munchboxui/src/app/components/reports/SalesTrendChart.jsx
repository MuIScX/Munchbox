"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
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

export default function SalesTrendChart({
  data,
  menuList,
  selectedMenu,
  setSelectedMenu,
  trendLoading,
  globalLoading,
  shareAllTime,
  startDate,
  endDate,
  tableData = [],
  formatCurrency,
  monthly,
  setMonthly,
}) {
  const fmtDate = (s) => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
  const fmtMonth = (s) => {
    if (!s) return "—";
    const [y, m] = s.split("-");
    const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${MONTH_ABBR[parseInt(m) - 1]} ${y}`;
  };
  const trendLabel = shareAllTime
    ? "All Time"
    : monthly
      ? `${fmtMonth(startDate)} – ${fmtMonth(endDate)}`
      : `${fmtDate(startDate)} to ${fmtDate(endDate)}`;

  const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const displayData = monthly
    ? (() => {
        const map = {};
        data.forEach(({ name, order }) => {
          // name is dd/mm/yyyy or Mon YYYY
          let year, month;
          if (name && name.includes("/")) {
            const parts = name.split("/");
            month = parseInt(parts[1]) - 1;
            year = parseInt(parts[2]);
          } else {
            // already aggregated monthly label — pass through
            const d = new Date(name);
            if (!isNaN(d)) { month = d.getMonth(); year = d.getFullYear(); }
          }
          if (year != null && month != null) {
            const key = `${MONTH_ABBR[month]} ${year}`;
            map[key] = (map[key] || 0) + (order || 0);
          }
        });
        return Object.entries(map).map(([name, order]) => ({ name, order }));
      })()
    : data;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col relative">
      {trendLoading && !globalLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold italic text-slate-800">Sales Trend ({trendLabel})</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="w-3.5 h-3.5" />
            <span className="text-xs font-medium text-slate-500">Monthly</span>
          </label>
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
      </div>

      <div className="relative h-64 w-full">
        <span className="absolute text-xs font-bold italic text-slate-800" style={{ left: 35, top: -5 }}>Order</span>
        <span className="absolute bottom-0 right-0 text-xs font-bold italic text-slate-800">Time</span>

        {displayData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 20, right: 20, left: 10, bottom: displayData.length > 14 ? 36 : 20 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.50} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={{ stroke: '#cbd5e1' }}
                interval={displayData.length <= 14 ? 0 : displayData.length <= 60 ? 6 : Math.ceil(displayData.length / 8)}
                tickFormatter={(v) => v}
                tick={{ fontSize: displayData.length > 14 ? 10 : 12, fill: '#0f172a', fontWeight: 600, angle: displayData.length > 14 ? -35 : 0, textAnchor: displayData.length > 14 ? "end" : "middle", dy: displayData.length > 14 ? 4 : 0 }}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} width={40} allowDecimals={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="order"
                stroke="#3b82f6"
                strokeWidth={displayData.length > 60 ? 2 : displayData.length > 14 ? 2.5 : 4}
                fill="url(#salesGradient)"
                dot={displayData.length > 30 ? false : { r: displayData.length > 14 ? 2 : 4, fill: '#3b82f6', strokeWidth: 1.5, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 italic">No trend data available</div>
        )}
      </div>

      {selectedMenu !== "All" && (() => {
        const row = tableData.find(r => String(r.id) === String(selectedMenu));
        if (!row) return null;
        return (
          <div className="mt-5 rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold italic text-slate-500">Item</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold italic text-slate-500">Orders</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold italic text-slate-500">Revenue</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold italic text-slate-500">Revenue Share</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{row.item}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-500">{row.orders}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-500">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-500">{row.share.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}