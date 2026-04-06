"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ShoppingCart, TrendingUp, AlertTriangle, CheckCircle, Package,
  UtensilsCrossed, Loader2, RefreshCw, BarChart2, AlertCircle,
  ArrowUp, ArrowDown, Minus, Users, ClipboardList, Target, BookOpen,
} from "lucide-react";
import { ReportAPI, PredictAPI, MenuAPI, StaffAPI, IngredientAPI } from "../../lib/api";

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

/* ── helpers ── */
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
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(safeNum(val));

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateOffset(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset); return fmtDate(d);
}
function formatDisplayDate() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* accuracy */
function computeAccuracy(actualData, trendData) {
  const actualMap = {};
  (actualData || []).forEach((d) => { actualMap[d.date] = d.actual_usage; });
  const predPoints = (trendData?.data || [])
    .filter((d) => d.prediction_type === 1 && d.expected_usage != null)
    .map((d) => ({ date: (d.timestamp || "").split(" ")[0], predicted: d.expected_usage }));
  const merged = predPoints
    .map((d) => ({ ...d, actual: actualMap[d.date] ?? null }))
    .filter((d) => d.actual !== null && d.actual > 0);
  if (!merged.length) return null;
  const dailyAcc = merged.map((d) =>
    d.predicted >= d.actual ? 100 : Math.max(0, (d.predicted / d.actual) * 100)
  );
  return parseFloat(Math.min(100, dailyAcc.reduce((a, b) => a + b, 0) / merged.length).toFixed(1));
}

/* ── sub-components ── */
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
    <span className="font-mono text-sm font-semibold text-slate-500 tabular-nums tracking-widest">
      {h}<span className="opacity-40 animate-pulse">:</span>{m}<span className="opacity-40 animate-pulse">:</span>{s}
    </span>
  );
}

function Delta({ today, yesterday }) {
  if (yesterday === null || yesterday === 0) return <span className="text-xs text-slate-300 flex items-center gap-0.5 mt-0.5"><Minus size={10} /> no yesterday data</span>;
  const pct = ((today - yesterday) / yesterday) * 100;
  const abs = Math.abs(pct).toFixed(0);
  if (pct > 0.5) return <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5"><ArrowUp size={11} /> {abs}% vs yesterday</span>;
  if (pct < -0.5) return <span className="text-xs font-semibold text-red-500 flex items-center gap-0.5 mt-0.5"><ArrowDown size={11} /> {abs}% vs yesterday</span>;
  return <span className="text-xs text-slate-400 flex items-center gap-0.5 mt-0.5"><Minus size={10} /> Same as yesterday</span>;
}

function Skeleton({ className }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />;
}

function SectionError({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-28 gap-2">
      <AlertCircle size={20} className="text-red-300" />
      <p className="text-sm text-slate-400 italic">Failed to load</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-orange-500 hover:text-orange-600 underline font-medium">Try again</button>
      )}
    </div>
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

function AccuracyColor(acc) {
  if (acc === null) return { text: "text-slate-400", bg: "bg-slate-50 border-slate-200", icon: null };
  if (acc >= 85) return { text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "emerald" };
  if (acc >= 70) return { text: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "amber" };
  return { text: "text-red-600", bg: "bg-red-50 border-red-200", icon: "red" };
}

/* ── Main Page ── */
export default function DashboardPage() {
  const mountedRef = useRef(true);

  /* KPI */
  const [ordersToday, setOrdersToday] = useState(0);
  const [ordersYest, setOrdersYest] = useState(null);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYest, setRevenueYest] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState(false);

  /* Predict/stock */
  const [lowStockCount, setLowStockCount] = useState(0);
  const [reorderList, setReorderList] = useState([]);
  const [predictLoading, setPredictLoading] = useState(true);
  const [predictError, setPredictError] = useState(false);

  /* Menus */
  const [totalMenus, setTotalMenus] = useState(0);
  const [unreadyMenus, setUnreadyMenus] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(false);

  /* Staff */
  const [totalStaff, setTotalStaff] = useState(0);
  const [staffLoading, setStaffLoading] = useState(true);

  /* Ingredients */
  const [totalIngredients, setTotalIngredients] = useState(0);
  const [ingredientLoading, setIngredientLoading] = useState(true);

  /* Prep Summary */
  const [prepSummary, setPrepSummary] = useState([]);
  const [prepLoading, setPrepLoading] = useState(true);
  const [prepError, setPrepError] = useState(false);

  /* Accuracy */
  const [accuracy, setAccuracy] = useState(null);
  const [accuracyLoading, setAccuracyLoading] = useState(true);

  /* Trend */
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(false);
  const [trendStart, setTrendStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return fmtDate(d); });
  const [trendEnd, setTrendEnd] = useState(() => fmtDate(new Date()));

  const isAnyLoading = kpiLoading || predictLoading || menuLoading || staffLoading || ingredientLoading || prepLoading || trendLoading;

  /* ── fetch trend separately ── */
  const fetchTrend = async (start, end) => {
    if (!mountedRef.current) return;
    setTrendLoading(true);
    setTrendError(false);
    try {
      const res = await ReportAPI.trendMenu(null, { start_date: start, end_date: end });
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        const map = {};
        const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const key = fmtDate(d);
          map[key] = { name: new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }), order: 0 };
        }
        res.Data.forEach((item) => {
          const d = new Date(item.day);
          if (isNaN(d.getTime())) return;
          const key = fmtDate(d);
          if (map[key]) map[key].order += safeNum(item.sale_amount);
        });
        setTrendData(Object.values(map));
      } else { setTrendError(true); }
    } catch { if (mountedRef.current) setTrendError(true); }
    finally { if (mountedRef.current) setTrendLoading(false); }
  };

  /* ── main fetch ── */
  const fetchAll = async () => {
    if (!mountedRef.current) return;
    const today = dateOffset(0);
    const yesterday = dateOffset(-1);

    /* KPI */
    setKpiLoading(true); setKpiError(false);
    Promise.allSettled([
      ReportAPI.orders(null, { start_date: today, end_date: today }),
      ReportAPI.revenue(null, { start_date: today, end_date: today }),
      ReportAPI.orders(null, { start_date: yesterday, end_date: yesterday }),
      ReportAPI.revenue(null, { start_date: yesterday, end_date: yesterday }),
    ]).then(([tO, tR, yO, yR]) => {
      if (!mountedRef.current) return;
      if (tO.status === "fulfilled" && Array.isArray(tO.value?.Data))
        setOrdersToday(tO.value.Data.reduce((a, c) => a + safeNum(c.total_orders), 0));
      if (tR.status === "fulfilled" && Array.isArray(tR.value?.Data))
        setRevenueToday(tR.value.Data.reduce((a, c) => a + safeNum(c.revenue), 0));
      if (yO.status === "fulfilled" && Array.isArray(yO.value?.Data))
        setOrdersYest(yO.value.Data.reduce((a, c) => a + safeNum(c.total_orders), 0));
      if (yR.status === "fulfilled" && Array.isArray(yR.value?.Data))
        setRevenueYest(yR.value.Data.reduce((a, c) => a + safeNum(c.revenue), 0));
      if (tO.status === "rejected" && tR.status === "rejected") setKpiError(true);
      setKpiLoading(false);
    });

    /* Staff */
    setStaffLoading(true);
    StaffAPI.list().then((res) => {
      if (!mountedRef.current) return;
      setTotalStaff(Array.isArray(res?.Data) ? res.Data.length : 0);
    }).catch(() => {}).finally(() => { if (mountedRef.current) setStaffLoading(false); });

    /* Ingredients */
    setIngredientLoading(true);
    IngredientAPI.list({}).then((res) => {
      if (!mountedRef.current) return;
      setTotalIngredients(Array.isArray(res?.Data) ? res.Data.length : 0);
    }).catch(() => {}).finally(() => { if (mountedRef.current) setIngredientLoading(false); });

    /* Menus */
    setMenuLoading(true); setMenuError(false);
    MenuAPI.list({}).then((res) => {
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        setTotalMenus(res.Data.length);
        setUnreadyMenus(res.Data.filter((m) => !((m.readiness ?? 0) === 1 && m.ingredient_count > 0)));
      } else { setMenuError(true); }
    }).catch(() => { if (mountedRef.current) setMenuError(true); })
      .finally(() => { if (mountedRef.current) setMenuLoading(false); });

    /* Predict report + reorder */
    setPredictLoading(true); setPredictError(false);
    PredictAPI.report(null).then(async (res) => {
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        const data = res.Data;
        const lowItems = data.filter((r) => r.status === 0);
        setLowStockCount(lowItems.length);
        setReorderList(lowItems.sort((a, b) => safeNum(b.urgency_score) - safeNum(a.urgency_score)).slice(0, 6));

        /* Accuracy — compute asynchronously from top ingredients */
        setAccuracyLoading(true);
        const sample = data.slice(0, 10); // limit for speed
        const results = await Promise.allSettled(
          sample.map((ing) => Promise.all([
            PredictAPI.actual(ing.ingredient_id),
            PredictAPI.trend(ing.ingredient_id),
          ]))
        );
        if (!mountedRef.current) return;
        const accs = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => computeAccuracy(r.value[0]?.Data, r.value[1]?.Data))
          .filter((a) => a !== null);
        setAccuracy(accs.length > 0 ? parseFloat((accs.reduce((a, b) => a + b, 0) / accs.length).toFixed(1)) : null);
        setAccuracyLoading(false);
      } else { setPredictError(true); }
    }).catch(() => { if (mountedRef.current) setPredictError(true); })
      .finally(() => { if (mountedRef.current) setPredictLoading(false); });

    /* Prep Summary — today */
    setPrepLoading(true); setPrepError(false);
    PredictAPI.prepSummary(today, today).then((res) => {
      if (!mountedRef.current) return;
      if (Array.isArray(res?.Data)) {
        setPrepSummary(res.Data.slice(0, 10));
      } else { setPrepError(true); }
    }).catch(() => { if (mountedRef.current) setPrepError(true); })
      .finally(() => { if (mountedRef.current) setPrepLoading(false); });

    /* Trend */
    fetchTrend(trendStart, trendEnd);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    return () => { mountedRef.current = false; };
  }, []);

  const accColor = AccuracyColor(accuracy);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 overflow-y-auto h-full flex flex-col gap-6">

          {/* ── Header Panel ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <BarChart2 size={20} className="text-orange-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
                  <p className="text-sm text-slate-400 mt-0.5">{formatDisplayDate()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
                  <LiveClock />
                </div>
                <button
                  onClick={fetchAll}
                  disabled={isAnyLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:bg-slate-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={13} className={isAnyLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* ── Row 1: Performance KPIs ── */}
          <div className="grid grid-cols-4 gap-4 shrink-0">

            {/* Orders Today */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShoppingCart size={18} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">Orders Today</p>
                {kpiLoading ? <Skeleton className="h-8 w-16 mt-1 mb-1" /> :
                  kpiError ? <p className="text-slate-400 italic text-sm mt-1">—</p> :
                  <p className="text-3xl font-bold text-amber-900 mt-0.5">{ordersToday.toLocaleString()}</p>}
                {!kpiLoading && !kpiError && <Delta today={ordersToday} yesterday={ordersYest} />}
              </div>
            </div>

            {/* Revenue Today */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Revenue Today</p>
                {kpiLoading ? <Skeleton className="h-8 w-20 mt-1 mb-1" /> :
                  kpiError ? <p className="text-slate-400 italic text-sm mt-1">—</p> :
                  <p className="text-3xl font-bold text-blue-900 mt-0.5 truncate" title={formatTHB(revenueToday)}>
                    {shortCurrency(revenueToday)}
                  </p>}
                {!kpiLoading && !kpiError && <Delta today={revenueToday} yesterday={revenueYest} />}
              </div>
            </div>

            {/* Low Stock */}
            <div className={`border rounded-2xl shadow-sm p-5 flex items-start gap-4 ${
              !predictLoading && lowStockCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !predictLoading && lowStockCount > 0 ? "bg-red-100" : "bg-slate-100"
              }`}>
                <AlertTriangle size={18} className={!predictLoading && lowStockCount > 0 ? "text-red-500" : "text-slate-400"} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold uppercase tracking-wide ${
                  !predictLoading && lowStockCount > 0 ? "text-red-600" : "text-slate-500"
                }`}>Low Stock</p>
                {predictLoading ? <Skeleton className="h-8 w-10 mt-1 mb-1" /> :
                  predictError ? <p className="text-slate-400 italic text-sm mt-1">—</p> :
                  <p className={`text-3xl font-bold mt-0.5 ${lowStockCount > 0 ? "text-red-700" : "text-slate-700"}`}>
                    {lowStockCount}
                  </p>}
                <p className={`text-xs mt-0.5 font-medium ${
                  !predictLoading && lowStockCount > 0 ? "text-red-400" : "text-slate-400"
                }`}>
                  {!predictLoading && lowStockCount > 0 ? "need reorder" : "ingredients"}
                </p>
              </div>
            </div>

            {/* Can't Serve */}
            <div className={`border rounded-2xl shadow-sm p-5 flex items-start gap-4 ${
              !menuLoading && unreadyMenus.length > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !menuLoading && unreadyMenus.length > 0 ? "bg-orange-100" : "bg-slate-100"
              }`}>
                <UtensilsCrossed size={18} className={!menuLoading && unreadyMenus.length > 0 ? "text-orange-500" : "text-slate-400"} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold uppercase tracking-wide ${
                  !menuLoading && unreadyMenus.length > 0 ? "text-orange-600" : "text-slate-500"
                }`}>Can't Serve</p>
                {menuLoading ? <Skeleton className="h-8 w-10 mt-1 mb-1" /> :
                  menuError ? <p className="text-slate-400 italic text-sm mt-1">—</p> :
                  <p className={`text-3xl font-bold mt-0.5 ${unreadyMenus.length > 0 ? "text-orange-700" : "text-slate-700"}`}>
                    {unreadyMenus.length}
                  </p>}
                <p className={`text-xs mt-0.5 font-medium ${
                  !menuLoading && unreadyMenus.length > 0 ? "text-orange-400" : "text-slate-400"
                }`}>
                  {!menuLoading && unreadyMenus.length > 0 ? "menus blocked" : "all ready"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Row 2: Ops Overview ── */}
          <div className="grid grid-cols-4 gap-4 shrink-0">

            {/* Total Staff */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Users size={18} className="text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Total Staff</p>
                {staffLoading ? <Skeleton className="h-8 w-10 mt-1 mb-1" /> :
                  <p className="text-3xl font-bold text-slate-800 mt-0.5">{totalStaff}</p>}
                <p className="text-xs text-slate-400 mt-0.5 font-medium">people</p>
              </div>
            </div>

            {/* Total Ingredients */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                <Package size={18} className="text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Ingredients</p>
                {ingredientLoading ? <Skeleton className="h-8 w-10 mt-1 mb-1" /> :
                  <p className="text-3xl font-bold text-slate-800 mt-0.5">{totalIngredients}</p>}
                <p className="text-xs text-slate-400 mt-0.5 font-medium">tracked items</p>
              </div>
            </div>

            {/* Total Menus */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Total Menus</p>
                {menuLoading ? <Skeleton className="h-8 w-10 mt-1 mb-1" /> :
                  <p className="text-3xl font-bold text-slate-800 mt-0.5">{totalMenus}</p>}
                <p className="text-xs text-slate-400 mt-0.5 font-medium">in menu list</p>
              </div>
            </div>

            {/* Overall Accuracy */}
            <div className={`border rounded-2xl shadow-sm p-5 flex items-start gap-4 ${
              !accuracyLoading && accuracy !== null ? accColor.bg : "bg-white border-slate-200"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !accuracyLoading && accuracy !== null ? accColor.bg : "bg-slate-100"
              }`}>
                <Target size={18} className={
                  !accuracyLoading && accuracy !== null ? accColor.text : "text-slate-400"
                } />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Model Accuracy</p>
                {accuracyLoading ? <Skeleton className="h-8 w-16 mt-1 mb-1" /> :
                  accuracy === null
                    ? <p className="text-slate-400 italic text-sm mt-1">No data</p>
                    : <p className={`text-3xl font-bold mt-0.5 ${accColor.text}`}>{accuracy}%</p>
                }
                <p className="text-xs text-slate-400 mt-0.5 font-medium">AI forecast accuracy</p>
              </div>
            </div>
          </div>

          {/* ── Row 3: Trend + Prep Summary ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Sales Trend */}
            <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <TrendingUp size={15} className="text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Sales Trend</h2>
                    <p className="text-[11px] text-slate-400">Orders per day</p>
                  </div>
                </div>
                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    {[{ label: "7D", days: 6 }, { label: "30D", days: 29 }, { label: "90D", days: 89 }].map(({ label, days }) => {
                      const s = fmtDate(new Date(new Date().setDate(new Date().getDate() - days)));
                      const e = fmtDate(new Date());
                      const active = trendStart === s && trendEnd === e;
                      return (
                        <button key={label}
                          onClick={() => { setTrendStart(s); setTrendEnd(e); fetchTrend(s, e); }}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                        >{label}</button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input type="date" value={trendStart} max={trendEnd}
                      onChange={(e) => { setTrendStart(e.target.value); fetchTrend(e.target.value, trendEnd); }}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-orange-300 cursor-pointer" />
                    <span className="text-slate-300 text-xs">—</span>
                    <input type="date" value={trendEnd} min={trendStart} max={fmtDate(new Date())}
                      onChange={(e) => { setTrendEnd(e.target.value); fetchTrend(trendStart, e.target.value); }}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-orange-300 cursor-pointer" />
                  </div>
                </div>
              </div>

              {trendLoading ? (
                <div className="flex items-center justify-center h-44">
                  <Loader2 className="animate-spin text-orange-400" size={22} />
                </div>
              ) : trendError ? (
                <SectionError onRetry={() => fetchTrend(trendStart, trendEnd)} />
              ) : trendData.length > 0 ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                        interval={Math.max(0, Math.ceil(trendData.length / 6) - 1)} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<MiniTooltip />} />
                      <Area type="monotone" dataKey="order" stroke="#f97316" strokeWidth={2.5}
                        fill="url(#trendGrad)"
                        dot={trendData.length <= 14 ? { r: 3, fill: "#f97316", stroke: "#fff", strokeWidth: 2 } : false}
                        activeDot={{ r: 5, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-300 italic text-sm">No data for this period</div>
              )}
            </div>

            {/* Prep Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <ClipboardList size={15} className="text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Today's Prep</h2>
                  <p className="text-[11px] text-slate-400">Estimated usage to prepare</p>
                </div>
              </div>

              {prepLoading ? (
                <div className="flex items-center justify-center flex-1 h-36">
                  <Loader2 className="animate-spin text-orange-400" size={20} />
                </div>
              ) : prepError ? (
                <SectionError onRetry={fetchAll} />
              ) : prepSummary.length > 0 ? (
                <div className="space-y-1.5 overflow-y-auto flex-1">
                  {prepSummary.map((r, i) => {
                    const name = r.ingredient_name || r.name || `Item ${i + 1}`;
                    const qty = safeNum(r.total_usage ?? r.daily_target_average ?? r.amount);
                    const unit = r.unit || "";
                    const isLow = r.status === 0;
                    return (
                      <div key={r.ingredient_id ?? i}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${isLow ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLow ? "bg-red-400" : "bg-emerald-400"}`} />
                        <p className="text-xs font-semibold text-slate-700 truncate flex-1">{name}</p>
                        <p className={`text-xs font-bold shrink-0 ${isLow ? "text-red-600" : "text-slate-600"}`}>
                          {qty} <span className="font-normal text-slate-400">{unit}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 h-36 gap-2">
                  <CheckCircle size={24} className="text-emerald-300" />
                  <p className="text-sm text-slate-400 italic">No prep data for today</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 4: Reorder Alerts + Unable to Serve ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Reorder Alerts */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <Package size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-slate-800">Reorder Alerts</h2>
                  <p className="text-[11px] text-slate-400">Ingredients running low — sorted by urgency</p>
                </div>
                {!predictLoading && !predictError && lowStockCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">
                    {lowStockCount} items
                  </span>
                )}
              </div>
              <div className="px-5 pb-5">
                {predictLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : predictError ? <SectionError onRetry={fetchAll} />
                : reorderList.length > 0 ? (
                  <div className="space-y-2">
                    {reorderList.map((r) => {
                      const needed = Math.max(0, Math.ceil(safeNum(r.expected_usage) - safeNum(r.current_stock)));
                      return (
                        <div key={r.ingredient_id}
                          className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{r.ingredient_name || "Unknown"}</p>
                            <p className="text-[11px] text-slate-400">Stock: {safeNum(r.current_stock)} {r.unit || ""}</p>
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
                  <div className="flex flex-col items-center justify-center h-24 gap-2">
                    <CheckCircle size={24} className="text-emerald-300" />
                    <p className="text-sm text-slate-400 italic">All ingredients are stocked</p>
                  </div>
                )}
              </div>
            </div>

            {/* Unable to Serve */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <UtensilsCrossed size={14} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-slate-800">Unable to Serve</h2>
                  <p className="text-[11px] text-slate-400">Menus blocked from today's service</p>
                </div>
                {!menuLoading && !menuError && unreadyMenus.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                    {unreadyMenus.length} menus
                  </span>
                )}
              </div>
              <div className="px-5 pb-5">
                {menuLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : menuError ? <SectionError onRetry={fetchAll} />
                : unreadyMenus.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto max-h-[220px]">
                    {unreadyMenus.map((m) => {
                      const id = m.menu_id || m.id;
                      const name = m.menu_name || m.name || "Unknown";
                      const typeVal = m.menu_type || m.type;
                      const noIngredients = !m.ingredient_count || m.ingredient_count === 0;
                      return (
                        <div key={id}
                          className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
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
                  <div className="flex flex-col items-center justify-center h-24 gap-2">
                    <CheckCircle size={24} className="text-emerald-300" />
                    <p className="text-sm text-slate-400 italic">All menus ready to serve</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
