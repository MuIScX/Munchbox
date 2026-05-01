"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ShoppingCart, TrendingUp, AlertTriangle, CheckCircle, Package,
  UtensilsCrossed, Loader2, RefreshCw, BarChart2, AlertCircle,
  ArrowUp, ArrowDown, Minus, Users, Target, BookOpen, Search, X, Calendar,
} from "lucide-react";
import { ReportAPI, PredictAPI, MenuAPI, StaffAPI, IngredientAPI, StaffSession } from "../../lib/api";

const MANAGER_ROLES = [2, 3];

const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

/* ── Helpers ── */
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
function accuracyColor(acc) {
  if (acc === null) return "text-slate-400";
  if (acc >= 85) return "text-emerald-600";
  if (acc >= 70) return "text-amber-600";
  return "text-red-500";
}

/* ── Sub-components ── */
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
  if (yesterday === null || yesterday === 0)
    return <span className="text-xs font-medium text-slate-400 flex items-center gap-0.5 mt-0.5"><Minus size={10} /> No data for yesterday</span>;
  const pct = ((today - yesterday) / yesterday) * 100;
  const abs = Math.abs(pct).toFixed(0);
  if (pct > 0.5) return <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5 mt-0.5"><ArrowUp size={11} /> {abs}% vs yesterday</span>;
  if (pct < -0.5) return <span className="text-xs font-medium text-red-500 flex items-center gap-0.5 mt-0.5"><ArrowDown size={11} /> {abs}% vs yesterday</span>;
  return <span className="text-xs font-medium text-slate-400 flex items-center gap-0.5 mt-0.5"><Minus size={10} /> Same as yesterday</span>;
}

function Skeleton({ className }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />;
}

function SectionError({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-28 gap-2">
      <AlertCircle size={20} className="text-red-300" />
      <p className="text-sm text-slate-400 italic">Failed to load data</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-orange-500 hover:text-orange-600 underline font-medium">
          Try again
        </button>
      )}
    </div>
  );
}

function SaleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-sm font-bold text-slate-800">{safeNum(payload[0].value).toLocaleString()} orders</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function fmtDisplayDate(v) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

function AccTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = safeNum(payload[0].value);
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-lg">
      <p className={`text-sm font-bold ${accuracyColor(val)}`}>{val.toFixed(1)}%</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDisplayDate(label)}</p>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ icon: Icon, iconColor, iconBg, label, loading, error, value, sub, children, href }) {
  const inner = (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-start gap-4 ${href ? "hover:border-orange-300 hover:shadow-md transition cursor-pointer" : ""}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{label}</p>
        {loading
          ? <Skeleton className="h-8 w-14 mt-1 mb-1" />
          : error
            ? <p className="text-slate-400 italic text-sm mt-1">—</p>
            : <p className="text-3xl font-bold text-slate-800 mt-0.5 truncate">{value}</p>
        }
        {!loading && !error && (sub || children) && (
          <div className="mt-0.5">{sub ?? children}</div>
        )}
      </div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

/* ── Days Ahead Pill Selector ── */
function DaysSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Calendar size={11} className="text-slate-400" />
      {[3, 7].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${
            value === d
              ? "bg-orange-500 text-white shadow-sm"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

/* ── Main Page ── */
export default function DashboardPage() {
  const mountedRef = useRef(true);
  const router = useRouter();

  /* KPI */
  const [ordersToday, setOrdersToday] = useState(0);
  const [ordersYest, setOrdersYest] = useState(null);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYest, setRevenueYest] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState(false);

  /* Prep Summary (replaces old predict report for low stock) */
  const [daysAhead, setDaysAhead] = useState(7);
  const [prepSummary, setPrepSummary] = useState([]);
  const [prepLoading, setPrepLoading] = useState(true);
  const [prepError, setPrepError] = useState(false);

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

  /* Accuracy */
  const [accuracy, setAccuracy] = useState(null);
  const [accuracyChartData, setAccuracyChartData] = useState([]);
  const [accuracyLoading, setAccuracyLoading] = useState(true);

  /* Sales Trend */
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(false);
  const [trendStart, setTrendStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return fmtDate(d); });
  const [trendEnd, setTrendEnd] = useState(() => fmtDate(new Date()));

  /* Unable to Serve search */
  const [unreadySearch, setUnreadySearch] = useState("");

  const isAnyLoading = kpiLoading || prepLoading || menuLoading || staffLoading || ingredientLoading || trendLoading;

  /* ── Fetch Prep Summary ── */
  const fetchPrepSummary = async (days) => {
    if (!mountedRef.current) return;
    setPrepLoading(true);
    setPrepError(false);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setDate(end.getDate() + days);
      const fmt = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const res = await PredictAPI.prepSummary(fmt(start), fmt(end));
      if (!mountedRef.current) return;
      const data = Array.isArray(res?.Data) ? res.Data : [];
      setPrepSummary(data.filter((r) => r.has_data && r.status === 0));
    } catch {
      if (mountedRef.current) setPrepError(true);
    } finally {
      if (mountedRef.current) setPrepLoading(false);
    }
  };

  /* ── Fetch Sales Trend ── */
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

  /* ── Main Fetch ── */
  const fetchAll = async () => {
    if (!mountedRef.current) return;
    const today = dateOffset(0);
    const yesterday = dateOffset(-1);

    /* KPIs */
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
    StaffAPI.list()
      .then((res) => { if (mountedRef.current) setTotalStaff(Array.isArray(res?.Data) ? res.Data.length : 0); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setStaffLoading(false); });

    /* Ingredients */
    setIngredientLoading(true);
    IngredientAPI.list({})
      .then((res) => { if (mountedRef.current) setTotalIngredients(Array.isArray(res?.Data) ? res.Data.length : 0); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setIngredientLoading(false); });

    /* Menus */
    setMenuLoading(true); setMenuError(false);
    MenuAPI.list({})
      .then((res) => {
        if (!mountedRef.current) return;
        if (Array.isArray(res?.Data)) {
          setTotalMenus(res.Data.length);
          setUnreadyMenus(res.Data.filter((m) => !((m.readiness ?? 0) === 1 && m.ingredient_count > 0)));
        } else { setMenuError(true); }
      })
      .catch(() => { if (mountedRef.current) setMenuError(true); })
      .finally(() => { if (mountedRef.current) setMenuLoading(false); });

    /* Accuracy via /predict/accuracy (all ingredients) */
    setAccuracyLoading(true);
    PredictAPI.accuracy(null).then((res) => {
      if (!mountedRef.current) return;
      const data = Array.isArray(res?.Data) ? res.Data : [];
      setAccuracyChartData(data);
      if (data.length > 0) {
        const avg = data.reduce((s, d) => s + d.accuracy, 0) / data.length;
        setAccuracy(parseFloat(avg.toFixed(1)));
      } else {
        setAccuracy(null);
      }
    }).catch(() => {})
      .finally(() => { if (mountedRef.current) setAccuracyLoading(false); });

    /* Prep Summary + Sales Trend */
    fetchPrepSummary(daysAhead);
    fetchTrend(trendStart, trendEnd);
  };

  useEffect(() => {
    mountedRef.current = true;
    const staff = StaffSession.get();
    if (staff && !MANAGER_ROLES.includes(staff.role)) {
      router.replace("/updateinventory");
      return;
    }
    fetchAll();
    return () => { mountedRef.current = false; };
  }, []);

  /* low stock count from prep summary */
  const lowStockCount = prepSummary.length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 overflow-y-auto h-full flex flex-col gap-6">

          {/* ── Header ── */}
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

          {/* ── Row 1: Today's Performance ── */}
          <div className="grid grid-cols-4 gap-4 shrink-0">
            <KpiCard
              icon={ShoppingCart} iconBg="bg-orange-100" iconColor="text-orange-500"
              label="Orders Today" loading={kpiLoading} error={kpiError}
              value={ordersToday.toLocaleString()} href="/reports"
            >
              <Delta today={ordersToday} yesterday={ordersYest} />
            </KpiCard>

            <KpiCard
              icon={TrendingUp} iconBg="bg-blue-100" iconColor="text-blue-500"
              label="Revenue Today" loading={kpiLoading} error={kpiError}
              value={<span title={formatTHB(revenueToday)}>{shortCurrency(revenueToday)}</span>}
              href="/reports"
            >
              <Delta today={revenueToday} yesterday={revenueYest} />
            </KpiCard>

            <KpiCard
              icon={AlertTriangle}
              iconBg={!prepLoading && lowStockCount > 0 ? "bg-red-100" : "bg-slate-100"}
              iconColor={!prepLoading && lowStockCount > 0 ? "text-red-500" : "text-slate-400"}
              label="Low Stock"
              loading={prepLoading} error={prepError}
              value={prepSummary.length} href="/updateinventory"
              sub={
                <span className={`text-xs font-medium ${lowStockCount > 0 ? "text-red-400" : "text-slate-400"}`}>
                  {lowStockCount > 0 ? `need reorder (${daysAhead}d forecast)` : "all ingredients sufficient"}
                </span>
              }
            />

            <KpiCard
              icon={UtensilsCrossed}
              iconBg={!menuLoading && unreadyMenus.length > 0 ? "bg-amber-100" : "bg-slate-100"}
              iconColor={!menuLoading && unreadyMenus.length > 0 ? "text-amber-600" : "text-slate-400"}
              label="Unable to Serve"
              loading={menuLoading} error={menuError}
              value={unreadyMenus.length} href="/managemenu"
              sub={
                <span className={`text-xs font-medium ${unreadyMenus.length > 0 ? "text-amber-500" : "text-slate-400"}`}>
                  {unreadyMenus.length > 0 ? "recipes unavailable" : "all recipes ready"}
                </span>
              }
            />
          </div>

          {/* ── Row 2: Operations Overview ── */}
          <div className="grid grid-cols-4 gap-4 shrink-0">
            <KpiCard
              icon={Users} iconBg="bg-violet-100" iconColor="text-violet-600"
              label="Total Staff" loading={staffLoading} error={false}
              value={totalStaff} href="/managestaff"
              sub={<span className="text-xs text-slate-400 font-medium">active members</span>}
            />

            <KpiCard
              icon={Package} iconBg="bg-teal-100" iconColor="text-teal-600"
              label="Total Ingredients" loading={ingredientLoading} error={false}
              value={totalIngredients} href="/updateinventory"
              sub={<span className="text-xs text-slate-400 font-medium">tracked items</span>}
            />

            <KpiCard
              icon={BookOpen} iconBg="bg-sky-100" iconColor="text-sky-600"
              label="Total Recipes" loading={menuLoading} error={false}
              value={totalMenus} href="/managemenu"
              sub={<span className="text-xs text-slate-400 font-medium">in recipe list</span>}
            />

            <KpiCard
              icon={Target} iconBg="bg-emerald-100" iconColor="text-emerald-600"
              label="Model Accuracy" loading={accuracyLoading} error={false}
              value={
                accuracy !== null
                  ? <span className={accuracyColor(accuracy)}>{accuracy}%</span>
                  : <span className="text-slate-400 text-2xl italic">—</span>
              }
              href="/accuracy"
              sub={<span className="text-xs text-slate-400 font-medium">AI forecast performance</span>}
            />
          </div>

          {/* ── Row 3: Charts ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Sales Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                <Link href="/reports" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <TrendingUp size={15} className="text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Sales Trend</h2>
                    <p className="text-[11px] text-slate-400">Daily order volume over selected period</p>
                  </div>
                </Link>
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
                    <span className="text-slate-300 text-xs">–</span>
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
                    <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false}
                        interval={Math.max(0, Math.ceil(trendData.length / 6) - 1)}
                        label={{ value: "Time", position: "insideBottom", offset: -12, style: { fontSize: 10, fill: "#94a3b8" } }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false} allowDecimals={false}
                        label={{ value: "Orders", angle: -90, position: "insideLeft", offset: 16, style: { fontSize: 10, fill: "#94a3b8" } }}
                      />
                      <Tooltip content={<SaleTooltip />} />
                      <Area type="monotone" dataKey="order" stroke="#3b82f6" strokeWidth={2.5}
                        fill="url(#saleGrad)"
                        dot={trendData.length <= 14 ? { r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 } : false}
                        activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-300 italic text-sm">No data for this period</div>
              )}
            </div>

            {/* Model Accuracy Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <Link href="/accuracy" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Target size={15} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Forecast Accuracy — All Ingredients</h2>
                    <p className="text-[11px] text-slate-400">Predicted vs. actual usage across all tracked ingredients</p>
                  </div>
                </Link>
              </div>

              {accuracyLoading ? (
                <div className="flex items-center justify-center h-44">
                  <Loader2 className="animate-spin text-orange-400" size={22} />
                </div>
              ) : accuracyChartData.length > 0 ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accuracyChartData} margin={{ top: 4, right: 8, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false}
                        interval={Math.max(0, Math.ceil(accuracyChartData.length / 6) - 1)}
                        tickFormatter={fmtDisplayDate}
                        label={{ value: "Time", position: "insideBottom", offset: -12, style: { fontSize: 10, fill: "#94a3b8" } }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                        label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft", offset: 20, style: { fontSize: 10, fill: "#94a3b8" } }}
                      />
                      <Tooltip content={<AccTooltip />} />
                      <ReferenceLine y={85} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5}
                        label={{ value: "85%", position: "insideTopRight", style: { fontSize: 9, fill: "#10b981" } }} />
                      <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}
                        label={{ value: "70%", position: "insideTopRight", style: { fontSize: 9, fill: "#f59e0b" } }} />
                      <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2.5}
                        dot={accuracyChartData.length <= 20 ? { r: 3, fill: "#10b981", stroke: "#fff", strokeWidth: 2 } : false}
                        activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-300 italic text-sm">No accuracy data available</div>
              )}
            </div>
          </div>

          {/* ── Row 4: Action Alerts ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* ── Low Stock Items (Prep Summary) ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                <Link href="/predict" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-800">Low Stock Items</h2>
                    <p className="text-[11px] text-slate-400">
                      Ingredients insufficient for the next {daysAhead} days of predicted demand
                    </p>
                  </div>
                </Link>

                {/* Days-ahead selector */}
                <DaysSelector
                  value={daysAhead}
                  onChange={(d) => {
                    setDaysAhead(d);
                    fetchPrepSummary(d);
                  }}
                />

                {!prepLoading && !prepError && lowStockCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">
                    {lowStockCount} items
                  </span>
                )}
              </div>

              <div className="px-5 pb-5">
                {prepLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : prepError ? (
                  <SectionError onRetry={() => fetchPrepSummary(daysAhead)} />
                ) : prepSummary.length > 0 ? (
                  <div className="space-y-2 overflow-y-auto max-h-[220px]">
                    {prepSummary
                      .sort((a, b) => (safeNum(b.urgency_score) - safeNum(a.urgency_score)))
                      .slice(0, 6)
                      .map((r) => {
                        const needed = Math.max(0, Math.ceil(safeNum(r.expected_usage) - safeNum(r.current_stock)));
                        return (
                          <div key={r.ingredient_id}
                            className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{r.ingredient_name || "Unknown"}</p>
                              <p className="text-[11px] text-slate-400">
                                Current: {safeNum(r.current_stock)} {r.unit || ""}
                                &nbsp;·&nbsp;Need ({daysAhead}d): {Math.ceil(safeNum(r.expected_usage))} {r.unit || ""}
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
                  <div className="flex flex-col items-center justify-center h-24 gap-2">
                    <CheckCircle size={24} className="text-emerald-300" />
                    <p className="text-sm text-slate-400 italic">
                      All ingredients sufficient for {daysAhead} days
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Unable to Serve ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 pt-5 pb-3 flex items-center gap-3 shrink-0">
                <Link href="/managemenu" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <UtensilsCrossed size={14} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-800">Unable to Serve</h2>
                    <p className="text-[11px] text-slate-400">Recipes unavailable for today's service</p>
                  </div>
                </Link>
                {!menuLoading && !menuError && unreadyMenus.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                    {unreadyMenus.length}
                  </span>
                )}
              </div>
              {!menuLoading && !menuError && unreadyMenus.length > 0 && (
                <div className="px-5 pb-2 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="text"
                      placeholder="Search recipes..."
                      value={unreadySearch}
                      onChange={(e) => setUnreadySearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 bg-slate-50 text-xs text-slate-700 border border-slate-200 rounded-lg focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none"
                    />
                    {unreadySearch && (
                      <button onClick={() => setUnreadySearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="px-5 pb-5">
                {menuLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : menuError ? <SectionError onRetry={fetchAll} />
                : unreadyMenus.length > 0 ? (() => {
                  const filtered = [...unreadyMenus]
                    .sort((a, b) => (a.menu_name || a.name || "").localeCompare(b.menu_name || b.name || ""))
                    .filter((m) => {
                      const name = (m.menu_name || m.name || "").toLowerCase();
                      return !unreadySearch || name.includes(unreadySearch.toLowerCase());
                    });
                  return filtered.length > 0 ? (
                    <div className="space-y-1.5 overflow-y-auto max-h-[200px]">
                      {filtered.map((m) => {
                        const id = m.menu_id || m.id;
                        const name = m.menu_name || m.name || "Unknown";
                        const typeVal = m.menu_type || m.type;
                        return (
                          <Link key={id} href={`/managemenu/${id}`}
                            className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 min-w-0 hover:bg-amber-100 hover:border-amber-300 transition cursor-pointer group">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-amber-700">{name}</p>
                              <p className="text-[11px] text-slate-400">{TYPE_MAP[typeVal] || "—"}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-16 text-slate-400 italic text-sm">No recipes match "{unreadySearch}"</div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center h-24 gap-2">
                    <CheckCircle size={24} className="text-emerald-300" />
                    <p className="text-sm text-slate-400 italic">All recipes are ready to serve</p>
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