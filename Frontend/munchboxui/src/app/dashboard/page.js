"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ShoppingCart, TrendingUp, AlertTriangle, CheckCircle,
  Package, UtensilsCrossed, Loader2, RefreshCw, BarChart2,
  ClipboardList,
} from "lucide-react";
import { ReportAPI, PredictAPI, MenuAPI } from "../../lib/api";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

function shortCurrency(val) {
  if (val >= 1_000_000) return `฿${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `฿${(val / 1_000).toFixed(1)}K`;
  return `฿${Number(val).toLocaleString()}`;
}

const formatTHB = (val) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(val);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #f1f5f9", borderRadius: 10, padding: "8px 12px", boxShadow: "0 4px 12px rgb(0 0 0 / 0.10)" }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>{payload[0].value}</p>
      <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0 0" }}>{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const today = todayStr();

  const [ordersToday, setOrdersToday] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [okStockCount, setOkStockCount] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(true);

  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  const [predictReport, setPredictReport] = useState([]);
  const [predictLoading, setPredictLoading] = useState(true);

  const [reorderList, setReorderList] = useState([]);
  const [unreadyMenus, setUnreadyMenus] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);

  const fetchAll = async () => {
    // KPIs
    setKpiLoading(true);
    Promise.allSettled([
      ReportAPI.orders(null, { start_date: today, end_date: today }),
      ReportAPI.revenue(null, { start_date: today, end_date: today }),
    ]).then(([ordersRes, revenueRes]) => {
      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value?.Data))
        setOrdersToday(ordersRes.value.Data.reduce((a, c) => a + (c.total_orders || 0), 0));
      if (revenueRes.status === "fulfilled" && Array.isArray(revenueRes.value?.Data))
        setRevenueToday(revenueRes.value.Data.reduce((a, c) => a + (c.revenue || 0), 0));
      setKpiLoading(false);
    });

    // Predict report — used for Low/OK counts, prep checklist, stock overview, reorder list
    setPredictLoading(true);
    try {
      const res = await PredictAPI.report(null);
      if (Array.isArray(res?.Data)) {
        const data = res.Data;
        setPredictReport(data);
        setLowStockCount(data.filter((r) => r.status === 0).length);
        setOkStockCount(data.filter((r) => r.status === 1).length);
        setReorderList(
          data
            .filter((r) => r.status === 0)
            .sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0))
            .slice(0, 5)
        );
      }
    } catch {}
    setPredictLoading(false);

    // Sales trend (last 30 days)
    setTrendLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const fmt = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const res = await ReportAPI.trendMenu(null, { start_date: fmt(start), end_date: fmt(end) });
      if (Array.isArray(res?.Data)) {
        const monthMap = {};
        res.Data.forEach((item) => {
          const d = new Date(item.day);
          const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          monthMap[key] = (monthMap[key] || 0) + (item.sale_amount || 0);
        });
        setTrendData(Object.entries(monthMap).map(([name, order]) => ({ name, order })));
      }
    } catch {}
    setTrendLoading(false);

    // Unready menus
    setMenuLoading(true);
    try {
      const res = await MenuAPI.list({});
      if (Array.isArray(res?.Data)) {
        setUnreadyMenus(
          res.Data.filter((m) => !((m.readiness ?? 0) === 1 && m.ingredient_count > 0))
        );
      }
    } catch {}
    setMenuLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Prep checklist — ingredients with daily_target_average, sorted by urgency
  const prepList = useMemo(() =>
    predictReport
      .filter((r) => r.daily_target_average != null && r.daily_target_average > 0)
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 0 ? -1 : 1))
      .slice(0, 7),
    [predictReport]
  );

  // Stock overview — all ingredients sorted by stock deficit ratio
  const stockOverview = useMemo(() =>
    predictReport
      .filter((r) => r.expected_usage != null && r.expected_usage > 0)
      .sort((a, b) => {
        const ratioA = a.current_stock / a.expected_usage;
        const ratioB = b.current_stock / b.expected_usage;
        return ratioA - ratioB;
      })
      .slice(0, 8),
    [predictReport]
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 overflow-y-auto h-full space-y-4">

          {/* ── Header ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <BarChart2 size={20} className="text-orange-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">{getGreeting()} 👋</h1>
                  <p className="text-sm text-slate-400 mt-0.5">{formatDisplayDate()}</p>
                </div>
              </div>
              <button
                onClick={fetchAll}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Row 1: KPI Cards ── */}
          <div className="grid grid-cols-4 gap-4 shrink-0">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShoppingCart size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">Orders Today</p>
                {kpiLoading
                  ? <div className="h-8 w-16 bg-slate-100 rounded animate-pulse mt-1" />
                  : <p className="text-3xl font-bold text-slate-800 mt-0.5">{ordersToday.toLocaleString()}</p>}
                <p className="text-xs text-slate-400 mt-0.5">total orders</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Revenue Today</p>
                {kpiLoading
                  ? <div className="h-8 w-20 bg-slate-100 rounded animate-pulse mt-1" />
                  : <p className="text-3xl font-bold text-slate-800 mt-0.5" title={formatTHB(revenueToday)}>{shortCurrency(revenueToday)}</p>}
                <p className="text-xs text-slate-400 mt-0.5">in THB</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs text-red-500 font-bold uppercase tracking-wide">Low Stock</p>
                {predictLoading
                  ? <div className="h-8 w-10 bg-red-100 rounded animate-pulse mt-1" />
                  : <p className="text-3xl font-bold text-red-700 mt-0.5">{lowStockCount}</p>}
                <p className="text-xs text-red-400 mt-0.5">need reorder</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Stock OK</p>
                {predictLoading
                  ? <div className="h-8 w-10 bg-emerald-100 rounded animate-pulse mt-1" />
                  : <p className="text-3xl font-bold text-emerald-700 mt-0.5">{okStockCount}</p>}
                <p className="text-xs text-emerald-500 mt-0.5">sufficient</p>
              </div>
            </div>
          </div>

          {/* ── Row 2: Trend + Prep Checklist ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Sales Trend */}
            <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="mb-4">
                <h2 className="text-base font-bold italic text-slate-800">Sales Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last 30 days — orders per day</p>
              </div>
              {trendLoading ? (
                <div className="flex items-center justify-center h-44">
                  <Loader2 className="animate-spin text-orange-400" size={22} />
                </div>
              ) : trendData.length > 0 ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                        interval={Math.ceil(trendData.length / 7)} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<MiniTooltip />} />
                      <Area type="monotone" dataKey="order" stroke="#3b82f6" strokeWidth={2.5}
                        fill="url(#dashGrad)" dot={false}
                        activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-300 italic text-sm">No trend data</div>
              )}
            </div>

            {/* Today's Prep Checklist */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <ClipboardList size={13} className="text-orange-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold italic text-slate-800">Today's Prep</h2>
                  <p className="text-xs text-slate-400">Daily avg usage to prepare</p>
                </div>
              </div>
              {predictLoading ? (
                <div className="flex items-center justify-center flex-1 h-32">
                  <Loader2 className="animate-spin text-orange-400" size={20} />
                </div>
              ) : prepList.length > 0 ? (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {prepList.map((r) => {
                    const isLow = r.status === 0;
                    return (
                      <div key={r.ingredient_id}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
                          isLow
                            ? "bg-red-50 border-red-100"
                            : "bg-slate-50 border-slate-100"
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLow ? "bg-red-400" : "bg-emerald-400"}`} />
                        <p className="text-xs font-semibold text-slate-700 truncate flex-1">{r.ingredient_name}</p>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${isLow ? "text-red-600" : "text-slate-600"}`}>
                            {r.daily_target_average} <span className="font-normal text-slate-400">{r.unit}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 text-slate-300 italic text-sm">No prep data</div>
              )}
            </div>
          </div>

          {/* ── Row 3: Stock Level Overview (full width) ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Package size={13} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold italic text-slate-800">Stock Level Overview</h2>
                  <p className="text-xs text-slate-400">Current stock vs expected usage — most critical first</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                  <span>Sufficient</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                  <span>Low stock</span>
                </div>
              </div>
            </div>

            {predictLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-orange-400" size={22} />
              </div>
            ) : stockOverview.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {stockOverview.map((r) => {
                  const isLow = r.status === 0;
                  const ratio = Math.min((r.current_stock / r.expected_usage) * 100, 100);
                  const pct = isNaN(ratio) ? 0 : Math.round(ratio);
                  return (
                    <div key={r.ingredient_id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLow ? "bg-red-400" : "bg-emerald-400"}`} />
                          <p className="text-xs font-semibold text-slate-700 truncate">{r.ingredient_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] text-slate-400">
                            {r.current_stock} / {Math.ceil(r.expected_usage)} {r.unit}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isLow ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"
                          }`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isLow ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-300 italic text-sm">No stock data</div>
            )}
          </div>

          {/* ── Row 4: Reorder Alerts + Unready Menus ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Reorder Alerts */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <Package size={13} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold italic text-slate-800">Reorder Alerts</h2>
                  <p className="text-xs text-slate-400">Top urgent ingredients needing stock</p>
                </div>
                {lowStockCount > 0 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                    {lowStockCount} low
                  </span>
                )}
              </div>
              {predictLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="animate-spin text-orange-400" size={20} />
                </div>
              ) : reorderList.length > 0 ? (
                <div className="space-y-2">
                  {reorderList.map((r) => {
                    const needed = Math.ceil(r.expected_usage - r.current_stock);
                    return (
                      <div key={r.ingredient_id}
                        className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{r.ingredient_name}</p>
                          <p className="text-[10px] text-slate-400">Stock: {r.current_stock} {r.unit}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-600">+{needed} {r.unit}</p>
                          <p className="text-[10px] text-red-400">to order</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <CheckCircle size={28} className="text-emerald-300" />
                  <p className="text-sm italic text-slate-400">All ingredients are sufficient!</p>
                </div>
              )}
            </div>

            {/* Unready Menus */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <UtensilsCrossed size={13} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold italic text-slate-800">Unable to Serve</h2>
                  <p className="text-xs text-slate-400">Menus not ready for service</p>
                </div>
                {unreadyMenus.length > 0 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                    {unreadyMenus.length} menus
                  </span>
                )}
              </div>
              {menuLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="animate-spin text-orange-400" size={20} />
                </div>
              ) : unreadyMenus.length > 0 ? (
                <div className="space-y-2 overflow-y-auto max-h-[220px]">
                  {unreadyMenus.map((m) => {
                    const id = m.menu_id || m.id;
                    const name = m.menu_name || m.name || "Unknown";
                    const isReady = (m.readiness ?? 0) === 1 && m.ingredient_count > 0;
                    const typeVal = m.menu_type || m.type;
                    return (
                      <div key={id}
                        className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
                          <p className="text-[10px] text-slate-400">{TYPE_MAP[typeVal] || "—"}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isReady
                            ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                            : "text-red-500 bg-red-50 border-red-200"
                        }`}>
                          {isReady ? "Ready" : "Not Ready"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <CheckCircle size={28} className="text-emerald-300" />
                  <p className="text-sm italic text-slate-400">All menus ready to serve!</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}