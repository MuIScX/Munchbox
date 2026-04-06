"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ShoppingCart, TrendingUp, AlertTriangle, CheckCircle,
  Package, UtensilsCrossed, Loader2, RefreshCw, BarChart2, AlertCircle,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { ReportAPI, PredictAPI, MenuAPI } from "../../lib/api";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

function safeNum(val) {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

function shortCurrency(val) {
  const n = safeNum(val);
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`;
  return `฿${Math.round(n).toLocaleString()}`;
}

const formatTHB = (val) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency", currency: "THB", maximumFractionDigits: 0,
  }).format(safeNum(val));

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return fmtDate(d);
}

function formatDisplayDate() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(time.getHours()).padStart(2, "0");
  const m = String(time.getMinutes()).padStart(2, "0");
  const s = String(time.getSeconds()).padStart(2, "0");
  return (
    <span className="font-mono text-sm font-semibold text-slate-600 tabular-nums tracking-widest">
      {h}<span className="opacity-40 animate-pulse">:</span>{m}<span className="opacity-40 animate-pulse">:</span>{s}
    </span>
  );
}

// Delta vs yesterday
function Delta({ today, yesterday }) {
  if (!yesterday || yesterday === 0) {
    return <span className="text-xs text-slate-300 flex items-center gap-0.5"><Minus size={10} /> No data</span>;
  }
  const pct = ((today - yesterday) / yesterday) * 100;
  const abs = Math.abs(pct).toFixed(0);
  if (pct > 0) {
    return (
      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
        <ArrowUp size={11} /> {abs}% vs yesterday
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="text-xs font-semibold text-red-500 flex items-center gap-0.5">
        <ArrowDown size={11} /> {abs}% vs yesterday
      </span>
    );
  }
  return (
    <span className="text-xs text-slate-400 flex items-center gap-0.5">
      <Minus size={10} /> Same as yesterday
    </span>
  );
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-sm font-bold text-slate-800">{safeNum(payload[0].value).toLocaleString()} orders</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function SectionError({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-28 gap-2">
      <AlertCircle size={20} className="text-red-300" />
      <p className="text-sm text-slate-400 italic">Failed to load</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-orange-500 hover:text-orange-600 underline font-medium">
          Try again
        </button>
      )}
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} />;
}

export default function DashboardPage() {
  const mountedRef = useRef(true);

  // KPI — today + yesterday
  const [ordersToday, setOrdersToday] = useState(0);
  const [ordersYest, setOrdersYest] = useState(null);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYest, setRevenueYest] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState(false);

  // Predict / stock
  const [lowStockCount, setLowStockCount] = useState(0);
  const [reorderList, setReorderList] = useState([]);
  const [predictLoading, setPredictLoading] = useState(true);
  const [predictError, setPredictError] = useState(false);

  // Menus
  const [unreadyMenus, setUnreadyMenus] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(false);

  // Trend
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(false);
  const [trendStart, setTrendStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return fmtDate(d);
  });
  const [trendEnd, setTrendEnd] = useState(() => fmtDate(new Date()));

  const isAnyLoading = kpiLoading || predictLoading || menuLoading || trendLoading;

  const fetchTrend = async (start, end) => {
    if (!mountedRef.current) return;
    setTrendLoading(true);
    setTrendError(false);
    try {
      const res = await ReportAPI.trendMenu(null, { start_date: start, end_date: end });
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        const map = {};
        const startD = new Date(start + "T00:00:00");
        const endD = new Date(end + "T00:00:00");
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          const key = fmtDate(d);
          map[key] = {
            name: new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            order: 0,
          };
        }
        res.Data.forEach((item) => {
          const d = new Date(item.day);
          if (isNaN(d.getTime())) return;
          const key = fmtDate(d);
          if (map[key]) map[key].order += safeNum(item.sale_amount);
        });
        setTrendData(Object.values(map));
      } else {
        setTrendError(true);
      }
    } catch {
      if (mountedRef.current) setTrendError(true);
    } finally {
      if (mountedRef.current) setTrendLoading(false);
    }
  };

  const fetchAll = async () => {
    if (!mountedRef.current) return;
    const today = dateStr(0);
    const yesterday = dateStr(-1);

    // ── KPIs (today + yesterday in parallel) ──
    setKpiLoading(true);
    setKpiError(false);
    try {
      const [todayOrders, todayRev, yesterdayOrders, yesterdayRev] = await Promise.allSettled([
        ReportAPI.orders(null, { start_date: today, end_date: today }),
        ReportAPI.revenue(null, { start_date: today, end_date: today }),
        ReportAPI.orders(null, { start_date: yesterday, end_date: yesterday }),
        ReportAPI.revenue(null, { start_date: yesterday, end_date: yesterday }),
      ]);
      if (!mountedRef.current) return;

      if (todayOrders.status === "fulfilled" && Array.isArray(todayOrders.value?.Data))
        setOrdersToday(todayOrders.value.Data.reduce((a, c) => a + safeNum(c.total_orders), 0));
      if (todayRev.status === "fulfilled" && Array.isArray(todayRev.value?.Data))
        setRevenueToday(todayRev.value.Data.reduce((a, c) => a + safeNum(c.revenue), 0));
      if (yesterdayOrders.status === "fulfilled" && Array.isArray(yesterdayOrders.value?.Data))
        setOrdersYest(yesterdayOrders.value.Data.reduce((a, c) => a + safeNum(c.total_orders), 0));
      if (yesterdayRev.status === "fulfilled" && Array.isArray(yesterdayRev.value?.Data))
        setRevenueYest(yesterdayRev.value.Data.reduce((a, c) => a + safeNum(c.revenue), 0));

      if (todayOrders.status === "rejected" && todayRev.status === "rejected")
        setKpiError(true);
    } catch {
      if (mountedRef.current) setKpiError(true);
    } finally {
      if (mountedRef.current) setKpiLoading(false);
    }

    // ── Predict / Stock ──
    setPredictLoading(true);
    setPredictError(false);
    try {
      const res = await PredictAPI.report(null);
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        const data = res.Data;
        const lowItems = data.filter((r) => r.status === 0);
        setLowStockCount(lowItems.length);
        setReorderList(
          lowItems
            .sort((a, b) => safeNum(b.urgency_score) - safeNum(a.urgency_score))
            .slice(0, 6)
        );
      } else {
        setPredictError(true);
      }
    } catch {
      if (mountedRef.current) setPredictError(true);
    } finally {
      if (mountedRef.current) setPredictLoading(false);
    }

    // ── Menus ──
    setMenuLoading(true);
    setMenuError(false);
    try {
      const res = await MenuAPI.list({});
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        setUnreadyMenus(res.Data.filter((m) => !((m.readiness ?? 0) === 1 && m.ingredient_count > 0)));
      } else {
        setMenuError(true);
      }
    } catch {
      if (mountedRef.current) setMenuError(true);
    } finally {
      if (mountedRef.current) setMenuLoading(false);
    }

    fetchTrend(trendStart, trendEnd);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <div className="flex h-screen bg-[#f8f7f5] overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 overflow-y-auto h-full space-y-5">

          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                <BarChart2 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
                <p className="text-xs text-slate-400 mt-0.5">{formatDisplayDate()}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white shadow-sm">
                <LiveClock />
              </div>
            <button
              onClick={fetchAll}
              disabled={isAnyLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:bg-slate-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isAnyLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            </div>
          </div>

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-4 gap-4">

            {/* Orders Today */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <ShoppingCart size={15} className="text-orange-500" />
                </div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Orders Today</p>
              </div>
              {kpiLoading
                ? <><Skeleton className="h-9 w-20 mb-2" /><Skeleton className="h-3.5 w-28" /></>
                : kpiError
                  ? <p className="text-slate-400 italic text-sm">—</p>
                  : <>
                    <p className="text-4xl font-bold text-slate-800 leading-none mb-1.5">
                      {ordersToday.toLocaleString()}
                    </p>
                    <Delta today={ordersToday} yesterday={ordersYest} />
                  </>
              }
            </div>

            {/* Revenue Today */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <TrendingUp size={15} className="text-blue-500" />
                </div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Revenue Today</p>
              </div>
              {kpiLoading
                ? <><Skeleton className="h-9 w-24 mb-2" /><Skeleton className="h-3.5 w-28" /></>
                : kpiError
                  ? <p className="text-slate-400 italic text-sm">—</p>
                  : <>
                    <p
                      className="text-4xl font-bold text-slate-800 leading-none mb-1.5 truncate"
                      title={formatTHB(revenueToday)}
                    >
                      {shortCurrency(revenueToday)}
                    </p>
                    <Delta today={revenueToday} yesterday={revenueYest} />
                  </>
              }
            </div>

            {/* Low Stock */}
            <div className={`border rounded-2xl shadow-sm p-5 ${
              !predictLoading && !predictError && lowStockCount > 0
                ? "bg-red-50 border-red-200"
                : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  !predictLoading && !predictError && lowStockCount > 0 ? "bg-red-100" : "bg-slate-100"
                }`}>
                  <AlertTriangle size={15} className={
                    !predictLoading && !predictError && lowStockCount > 0 ? "text-red-500" : "text-slate-400"
                  } />
                </div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Low Stock</p>
              </div>
              {predictLoading
                ? <><Skeleton className="h-9 w-12 mb-2" /><Skeleton className="h-3.5 w-24" /></>
                : predictError
                  ? <p className="text-slate-400 italic text-sm">—</p>
                  : <>
                    <p className={`text-4xl font-bold leading-none mb-1.5 ${
                      lowStockCount > 0 ? "text-red-700" : "text-slate-800"
                    }`}>
                      {lowStockCount}
                    </p>
                    <p className={`text-xs font-medium ${
                      lowStockCount > 0 ? "text-red-500" : "text-slate-400"
                    }`}>
                      {lowStockCount > 0 ? "need reorder now" : "all stocked up"}
                    </p>
                  </>
              }
            </div>

            {/* Menus Can't Serve */}
            <div className={`border rounded-2xl shadow-sm p-5 ${
              !menuLoading && !menuError && unreadyMenus.length > 0
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  !menuLoading && !menuError && unreadyMenus.length > 0 ? "bg-amber-100" : "bg-slate-100"
                }`}>
                  <UtensilsCrossed size={15} className={
                    !menuLoading && !menuError && unreadyMenus.length > 0 ? "text-amber-600" : "text-slate-400"
                  } />
                </div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Can't Serve</p>
              </div>
              {menuLoading
                ? <><Skeleton className="h-9 w-12 mb-2" /><Skeleton className="h-3.5 w-24" /></>
                : menuError
                  ? <p className="text-slate-400 italic text-sm">—</p>
                  : <>
                    <p className={`text-4xl font-bold leading-none mb-1.5 ${
                      unreadyMenus.length > 0 ? "text-amber-700" : "text-slate-800"
                    }`}>
                      {unreadyMenus.length}
                    </p>
                    <p className={`text-xs font-medium ${
                      unreadyMenus.length > 0 ? "text-amber-600" : "text-slate-400"
                    }`}>
                      {unreadyMenus.length > 0 ? "menus blocked" : "all ready to serve"}
                    </p>
                  </>
              }
            </div>
          </div>

          {/* ── Action Alerts ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Reorder Now */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <Package size={13} className="text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Reorder Now</h2>
                    <p className="text-[11px] text-slate-400">Ingredients running low — sorted by urgency</p>
                  </div>
                </div>
                {!predictLoading && !predictError && lowStockCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    {lowStockCount} items
                  </span>
                )}
              </div>

              <div className="px-5 pb-5">
                {predictLoading ? (
                  <div className="space-y-2.5 pt-1">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : predictError ? (
                  <SectionError onRetry={fetchAll} />
                ) : reorderList.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {reorderList.map((r) => {
                      const needed = Math.max(0, Math.ceil(safeNum(r.expected_usage) - safeNum(r.current_stock)));
                      return (
                        <div key={r.ingredient_id}
                          className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {r.ingredient_name || "Unknown"}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Current: {safeNum(r.current_stock)} {r.unit || ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-red-600">+{needed} {r.unit || ""}</p>
                            <p className="text-[10px] text-red-400">to order</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-28 gap-2 pt-1">
                    <CheckCircle size={26} className="text-emerald-300" />
                    <p className="text-sm text-slate-400 italic">All ingredients are stocked</p>
                  </div>
                )}
              </div>
            </div>

            {/* Unable to Serve */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <UtensilsCrossed size={13} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Unable to Serve</h2>
                    <p className="text-[11px] text-slate-400">Menus blocked from today's service</p>
                  </div>
                </div>
                {!menuLoading && !menuError && unreadyMenus.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {unreadyMenus.length} menus
                  </span>
                )}
              </div>

              <div className="px-5 pb-5">
                {menuLoading ? (
                  <div className="space-y-2.5 pt-1">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : menuError ? (
                  <SectionError onRetry={fetchAll} />
                ) : unreadyMenus.length > 0 ? (
                  <div className="space-y-2 pt-1 overflow-y-auto max-h-[260px]">
                    {unreadyMenus.map((m) => {
                      const id = m.menu_id || m.id;
                      const name = m.menu_name || m.name || "Unknown";
                      const typeVal = m.menu_type || m.type;
                      const noIngredients = !m.ingredient_count || m.ingredient_count === 0;
                      return (
                        <div key={id}
                          className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                            <p className="text-[11px] text-slate-400">{TYPE_MAP[typeVal] || "—"}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap bg-amber-100 text-amber-700 border-amber-200">
                            {noIngredients ? "No recipe" : "Low stock"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-28 gap-2 pt-1">
                    <CheckCircle size={26} className="text-emerald-300" />
                    <p className="text-sm text-slate-400 italic">All menus ready to serve</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 7-Day Sales Trend ── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Sales Trend</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Orders per day</p>
              </div>
            </div>

            {/* Date pickers */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">From</span>
                <input
                  type="date"
                  value={trendStart}
                  max={trendEnd}
                  onChange={(e) => {
                    setTrendStart(e.target.value);
                    fetchTrend(e.target.value, trendEnd);
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-orange-300 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">To</span>
                <input
                  type="date"
                  value={trendEnd}
                  min={trendStart}
                  max={fmtDate(new Date())}
                  onChange={(e) => {
                    setTrendEnd(e.target.value);
                    fetchTrend(trendStart, e.target.value);
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-orange-300 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1 ml-1">
                {[
                  { label: "7D", days: 6 },
                  { label: "30D", days: 29 },
                  { label: "90D", days: 89 },
                ].map(({ label, days }) => {
                  const s = fmtDate(new Date(new Date().setDate(new Date().getDate() - days)));
                  const e = fmtDate(new Date());
                  const active = trendStart === s && trendEnd === e;
                  return (
                    <button
                      key={label}
                      onClick={() => { setTrendStart(s); setTrendEnd(e); fetchTrend(s, e); }}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                        active
                          ? "bg-orange-500 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {trendLoading ? (
              <div className="flex items-center justify-center h-36">
                <Loader2 className="animate-spin text-orange-400" size={20} />
              </div>
            ) : trendError ? (
              <SectionError onRetry={() => fetchTrend(trendStart, trendEnd)} />
            ) : trendData.length > 0 ? (
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      interval={Math.max(0, Math.ceil(trendData.length / 6) - 1)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<MiniTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="order"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#weekGrad)"
                      dot={trendData.length <= 14 ? { r: 3, fill: "#f97316", stroke: "#fff", strokeWidth: 2 } : false}
                      activeDot={{ r: 5, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-36 text-slate-300 italic text-sm">
                No data for this period
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
