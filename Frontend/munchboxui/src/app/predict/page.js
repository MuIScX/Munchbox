"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { PredictAPI, IngredientAPI } from "../../lib/api";
import {
  Search, Loader2, TrendingUp, X, Plus,
  Package, BarChart2, Clock, AlertTriangle, CheckCircle, RefreshCw,
} from "lucide-react";

export default function PredictPage() {
  const [forecastDays, setForecastDays]           = useState(7);
  const [report, setReport]                       = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [generating, setGenerating]               = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [trendData, setTrendData]                 = useState([]);
  const [dailyForecast, setDailyForecast]         = useState([]);
  const [trendLoading, setTrendLoading]           = useState(false);
  const [searchQuery, setSearchQuery]             = useState("");
  const [statusFilter, setStatusFilter]           = useState("All");
  const [toast, setToast]                         = useState(null);
  const [modalOpen, setModalOpen]                 = useState(false);
  const [ingredientList, setIngredientList]       = useState([]);
  const [requestForm, setRequestForm]             = useState({
    ingredient_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date:   new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    strategy:   "2",
  });
  const [graphFilters, setGraphFilters] = useState({
    historicalUsage: true,
    futureForecast:  true,
    suggestionRange: true,
    dailyTargetAvg:  true,
  });
  const showToast = (type, message) => setToast({ type, message });

  // ── Fetch trend — accepts days explicitly to avoid stale closure ──
  const fetchTrend = useCallback(async (ingredient_id, days) => {
    try {
      setTrendLoading(true);
      setTrendData([]);
      setDailyForecast([]);

      const [trendRes, actualRes, forecastRes] = await Promise.all([
        PredictAPI.trend(ingredient_id),
        PredictAPI.actual(ingredient_id),
        PredictAPI.dailyForecast(ingredient_id, days),
      ]);

      const trendRaw  = trendRes?.Data?.data || [];
      const actualRaw = actualRes?.Data      || [];
      setDailyForecast(forecastRes?.Data     || []);

      const merged = {};
      trendRaw.forEach((d) => {
        const date = (d.timestamp || "").split(" ")[0];
        merged[date] = {
          ...merged[date],
          date,
          predicted_usage: d.daily_target_average ?? null,
          upper_bound:     d.upper_bound           ?? null,
          lower_bound:     d.lower_bound           ?? null,
        };
      });
      actualRaw.forEach((d) => {
        merged[d.date] = { ...merged[d.date], date: d.date, actual_usage: d.actual_usage ?? null };
      });

      setTrendData(Object.values(merged).sort((a, b) => a.date.localeCompare(b.date)));
    } catch {
      setTrendData([]);
      setDailyForecast([]);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  // ── Fetch report — preserves selected ingredient ──
  const fetchReport = useCallback(async (days) => {
    try {
      setLoading(true);
      const res  = await PredictAPI.report(days);
      const data = Array.isArray(res?.Data) ? res.Data : [];
      setReport(data);

      if (data.length > 0) {
        setSelectedIngredient((prev) => {
          const keep = prev ? data.find((r) => r.ingredient_id === prev.ingredient_id) : null;
          const next = keep ?? data[0];
          fetchTrend(next.ingredient_id, days);
          return next;
        });
      }
    } catch {
      showToast("error", "Failed to load prediction data.");
    } finally {
      setLoading(false);
    }
  }, [fetchTrend]);

  useEffect(() => {
    fetchReport(forecastDays);
    IngredientAPI.list({}).then((res) => {
      setIngredientList(Array.isArray(res?.Data) ? res.Data : []);
    }).catch(() => {});
  }, []);

  const handleSelectIngredient = (ing) => {
    setSelectedIngredient(ing);
    fetchTrend(ing.ingredient_id, forecastDays);
  };

  const handleChangeDays = (days) => {
    setForecastDays(days);
    fetchReport(days);
    // fetchTrend is called inside fetchReport after data arrives
  };

  const handleRequest = async () => {
    if (requestForm.end_date <= requestForm.start_date) {
      showToast("error", "End date must be after start date.");
      return;
    }
    try {
      setGenerating(true);
      setModalOpen(false);
      const res    = await PredictAPI.generate({
        ingredient_id: requestForm.ingredient_id || undefined,
        start_date:    requestForm.start_date,
        end_date:      requestForm.end_date,
        strategy:      requestForm.strategy,
      });
      const total  = res?.Data?.total_processed ?? 0;
      const errors = res?.Data?.errors          ?? [];
      if (total > 0)        showToast("success", `Generated forecasts for ${total} ingredient(s).`);
      else if (errors.length) showToast("error", `Model failed: ${errors[0]?.error || "unknown error"}`);
      else                   showToast("error", "No forecasts generated.");
      await fetchReport(forecastDays);
    } catch (err) {
      showToast("error", err.message || "Failed to generate prediction.");
    } finally {
      setGenerating(false);
    }
  };

const filteredReport = useMemo(() => {
  return report
    .filter((r) => {
      const nameMatch   = (r.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const statusMatch = statusFilter === "All" || (statusFilter === "OK" ? r.status === 1 : r.status === 0);
      return nameMatch && statusMatch;
    })
    .sort((a, b) => {
      // Selected ingredient always first
      if (a.ingredient_id === selectedIngredient?.ingredient_id) return -1;
      if (b.ingredient_id === selectedIngredient?.ingredient_id) return 1;
      return 0;
    });
}, [report, searchQuery, statusFilter, selectedIngredient]);

  const todayStr = new Date().toISOString().split("T")[0];

const chartData = useMemo(() => {
  const historyDays = Math.max(14, forecastDays * 2);
  const cutoff      = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);
  const cutoffStr   = cutoff.toISOString().split("T")[0];

  const dailyAvg = selectedIngredient?.daily_target_average ?? null;

  // ← Only include historical points that are in the past AND have actual usage
  const historical = trendData
    .filter((d) => d.date >= cutoffStr && d.date <= todayStr)  // ← cap at today
    .map((d) => ({ ...d, section: "historical" }));

  const future = dailyForecast.slice(0, forecastDays).map((d) => ({
    date:              d.date,
    section:           "future",
    future_forecast:   d.mean_demand != null ? Math.ceil(d.mean_demand) : null,
    future_band_low:   d.low_bound,
    future_band_range: (d.high_bound != null && d.low_bound != null)
                         ? Math.max(0, d.high_bound - d.low_bound) : null,
    daily_avg:         dailyAvg,
  }));

  const lastActual    = [...historical].reverse().find((d) => d.actual_usage != null);
  const firstForecast = future[0];

  const historicalMerged = historical.map((d) => {
    const forecastVal = d.predicted_usage ?? firstForecast?.future_forecast ?? null;
    return { ...d, future_forecast: forecastVal };
  });

  const existingDates = new Set(historical.map((d) => d.date));
  const gapPoints     = [];
  if (lastActual && firstForecast) {
    const d   = new Date(lastActual.date);
    const end = new Date(firstForecast.date);
    d.setDate(d.getDate() + 1);
    while (d < end) {
      const ds = d.toISOString().split("T")[0];
      if (!existingDates.has(ds)) {
        gapPoints.push({
          date: ds, section: "gap",
          future_forecast:   firstForecast.future_forecast,
          future_band_low:   firstForecast.future_band_low,
          future_band_range: firstForecast.future_band_range,
          daily_avg:         dailyAvg,
        });
      }
      d.setDate(d.getDate() + 1);
    }
  }

  return [...historicalMerged, ...gapPoints, ...future]
    .sort((a, b) => a.date.localeCompare(b.date));

}, [trendData, dailyForecast, selectedIngredient, forecastDays, todayStr]);
  const hasActual          = graphFilters.historicalUsage && chartData.some((d) => d.actual_usage != null);
  const hasFuture          = graphFilters.futureForecast  && chartData.some((d) => d.future_forecast != null);
  const hasSuggestionRange = graphFilters.suggestionRange  && chartData.some((d) => d.future_band_range != null);

const yAxisMax = useMemo(() => {
  const maxActual     = Math.max(0, ...chartData.map((d) => d.actual_usage ?? 0));
  const maxFutureBand = Math.max(0, ...chartData.map((d) => (d.future_band_low ?? 0) + (d.future_band_range ?? 0)));
  const maxForecast   = Math.max(0, ...chartData.map((d) => d.future_forecast ?? 0));
  const raw           = Math.max(maxActual, maxFutureBand, maxForecast);
  return Math.ceil(raw * 1.2) || 10;  // ← 1.2 instead of 1.4 — tighter headroom
}, [chartData]);
  const surplus = selectedIngredient
    ? (selectedIngredient.current_stock - Math.ceil(selectedIngredient.expected_usage)).toFixed(1)
    : 0;

  // ── Custom tooltip ──
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d        = payload[0]?.payload;
    const isFuture = d?.section === "future";
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 min-w-[180px]">
        <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
          {label}
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isFuture ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-600"}`}>
            {isFuture ? "Forecast" : "Actual"}
          </span>
        </p>
        {d?.actual_usage != null && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-500">Used</span>
            <span className="ml-auto font-bold text-slate-700">{d.actual_usage} {selectedIngredient?.unit}</span>
          </div>
        )}
        {d?.future_forecast != null && (
          <div className="flex items-center gap-2 text-sm mt-1">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-slate-500">Forecast</span>
            <span className="ml-auto font-bold text-slate-700">{Math.ceil(d.future_forecast)} {selectedIngredient?.unit}/day</span>
          </div>
        )}
        {d?.future_band_low != null && d?.future_band_range != null && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Range: <span className="font-semibold text-slate-500">
              {Number(d.future_band_low).toFixed(1)} – {Number(d.future_band_low + d.future_band_range).toFixed(1)}
            </span> {selectedIngredient?.unit}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 flex flex-col h-full gap-4">

          {/* ── Header ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="px-6 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Demand Forecast</h1>
                <p className="text-xs text-slate-400 mt-0.5">Bayesian time-series prediction for ingredient usage</p>
              </div>
              <button
                onClick={() => fetchReport(forecastDays)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm font-medium hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={() => setModalOpen(true)}
                disabled={generating}
                className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-sm disabled:opacity-60"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {generating ? "Generating…" : "New Prediction"}
              </button>
            </div>
          </div>

          {/* ── Body: split panel ── */}
          <div className="flex gap-4 flex-1 overflow-hidden min-h-0">

            {/* ── Left panel: ingredient list ── */}
            <div className="w-64 shrink-0 flex flex-col gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search ingredient…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-orange-400 outline-none shadow-sm"
                />
              </div>

              {/* Status filter pills */}
              <div className="flex gap-1.5">
                {[["All", "All"], ["OK", "OK"], ["Reorder", "Low"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      statusFilter === val
                        ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Ingredient cards (scrollable) */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="animate-spin text-orange-400" size={20} />
                  </div>
                ) : filteredReport.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
                    <Package size={24} />
                    <p className="text-xs">No ingredients found</p>
                  </div>
                ) : filteredReport.map((ing) => {
                  const isSelected = selectedIngredient?.ingredient_id === ing.ingredient_id;
                  const isLow      = ing.status === 0;
                  const diff       = (ing.current_stock - Math.ceil(ing.expected_usage)).toFixed(1);
                  return (
                    <button
                      key={ing.ingredient_id}
                      onClick={() => handleSelectIngredient(ing)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        isSelected
                          ? "bg-orange-50 border-orange-300 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLow ? "bg-red-400" : "bg-emerald-400"}`} />
                        <span className={`font-semibold text-sm truncate flex-1 ${isSelected ? "text-orange-700" : "text-slate-700"}`}>
                          {ing.ingredient_name}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                          isLow
                            ? "text-red-500 bg-red-50 border-red-200"
                            : "text-emerald-600 bg-emerald-50 border-emerald-200"
                        }`}>
                          {isLow ? "Low" : "OK"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">Stock</p>
                          <p className="text-xs font-bold text-slate-600">{ing.current_stock} <span className="font-normal text-slate-400 text-[10px]">{ing.unit}</span></p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">Est. {forecastDays}d</p>
                          <p className="text-xs font-bold text-slate-600">{Math.ceil(ing.expected_usage)} <span className="font-normal text-slate-400 text-[10px]">{ing.unit}</span></p>
                        </div>
                      </div>
                      {isLow && (
                        <div className="mt-2 pt-2 border-t border-red-100">
                          <p className="text-[10px] text-red-400 font-medium">Need {Math.abs(diff)} more {ing.unit}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Right panel: stats + chart ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">

              {/* Stat cards */}
              {selectedIngredient && (
                <div className="grid grid-cols-4 gap-3 shrink-0">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Stock</p>
                      <p className="text-xl font-bold text-slate-700 leading-tight">{selectedIngredient.current_stock}</p>
                      <p className="text-[10px] text-slate-400">{selectedIngredient.unit}</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <BarChart2 size={14} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-orange-500 font-bold uppercase tracking-wide">Est. {forecastDays}d</p>
                      <p className="text-xl font-bold text-orange-900 leading-tight">{Math.ceil(selectedIngredient.expected_usage)}</p>
                      <p className="text-[10px] text-orange-400">{selectedIngredient.unit}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wide">Avg / Day</p>
                      <p className="text-xl font-bold text-blue-900 leading-tight">{selectedIngredient.daily_target_average ?? "—"}</p>
                      <p className="text-[10px] text-blue-400">{selectedIngredient.unit}/day</p>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-3.5 flex items-center gap-3 shadow-sm ${selectedIngredient.status === 1 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedIngredient.status === 1 ? "bg-emerald-100" : "bg-red-100"}`}>
                      {selectedIngredient.status === 1
                        ? <CheckCircle size={14} className="text-emerald-600" />
                        : <AlertTriangle size={14} className="text-red-500" />}
                    </div>
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wide ${selectedIngredient.status === 1 ? "text-emerald-600" : "text-red-500"}`}>Status</p>
                      <p className={`text-xl font-bold leading-tight ${selectedIngredient.status === 1 ? "text-emerald-900" : "text-red-900"}`}>
                        {selectedIngredient.status === 1 ? "OK" : "Low"}
                      </p>
                      <p className={`text-[10px] ${selectedIngredient.status === 1 ? "text-emerald-500" : "text-red-400"}`}>
                        {selectedIngredient.status === 1
                          ? `+${surplus} ${selectedIngredient.unit} surplus`
                          : `Need ${Math.abs(surplus)} ${selectedIngredient.unit}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Chart header */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-700 text-sm truncate">
                      {selectedIngredient
                        ? `${selectedIngredient.ingredient_name} — ${forecastDays}-day forecast`
                        : "Select an ingredient to view forecast"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {selectedIngredient?.daily_target_average != null
                        ? `Avg ${selectedIngredient.daily_target_average} ${selectedIngredient.unit}/day · expected ${Math.ceil(selectedIngredient.expected_usage)} ${selectedIngredient.unit} over ${forecastDays} days`
                        : selectedIngredient
                        ? 'No forecast yet — click "New Prediction" to generate one'
                        : "Choose an ingredient from the list on the left"}
                    </p>
                  </div>

                  {/* Forecast days selector */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">Forecast</span>
                    <span className="text-slate-200 text-xs">|</span>
                    <select
                      value={forecastDays}
                      onChange={(e) => handleChangeDays(parseInt(e.target.value))}
                      className="text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>

                  {/* Model selector */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">Model</span>
                    <span className="text-slate-200 text-xs">|</span>
                    <select
                      value={requestForm.strategy}
                      onChange={(e) => setRequestForm((f) => ({ ...f, strategy: e.target.value }))}
                      className="text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="1">Conservative</option>
                      <option value="2">Balanced</option>
                      <option value="3">Aggressive</option>
                    </select>
                  </div>

                  {/* Status badge */}
                  {selectedIngredient && (
                    selectedIngredient.status === 1 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                        <CheckCircle size={11} /> Stock OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg shrink-0">
                        <AlertTriangle size={11} /> Reorder
                      </span>
                    )
                  )}
                </div>

                {/* Graph layer toggles */}
                <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-slate-50/40">
                  {[
                    { key: "historicalUsage", label: "Actual",       color: "#10b981" },
                    { key: "futureForecast",  label: "Forecast",     color: "#6366f1" },
                    { key: "suggestionRange", label: "Range band",   color: "#f97316", opacity: 0.4 },
                    { key: "dailyTargetAvg",  label: "Daily avg",    color: "#f97316", dashed: true },
                  ].map(({ key, label, color, opacity, dashed }) => (
                    <button
                      key={key}
                      onClick={() => setGraphFilters((f) => ({ ...f, [key]: !f[key] }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        graphFilters[key]
                          ? "bg-white border-slate-300 text-slate-700 shadow-sm"
                          : "border-transparent text-slate-400 hover:text-slate-500"
                      }`}
                    >
                      {dashed ? (
                        <svg width="14" height="8" className={!graphFilters[key] ? "opacity-40" : ""}>
                          <line x1="0" y1="4" x2="14" y2="4" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
                        </svg>
                      ) : (
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: color, opacity: graphFilters[key] ? (opacity ?? 1) : 0.3 }}
                        />
                      )}
                      {label}
                    </button>
                  ))}
                </div>

                {/* Chart body */}
                {selectedIngredient ? (
                  trendLoading ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-3">
                      <Loader2 className="animate-spin text-orange-400" size={26} />
                      <p className="text-sm text-slate-400">Loading forecast data…</p>
                    </div>
                  ) : chartData.length > 0 ? (
                    <div className="flex-1 min-h-0 px-2 pt-4 pb-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                            </linearGradient>
                            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.10} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            padding={{ left: 10, right: 10 }}
                            interval={chartData.length <= 21 ? 1 : Math.ceil(chartData.length / 8)}
                            tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, yAxisMax]}
                            allowDataOverflow
                          />
                          <Tooltip content={<CustomTooltip />} />

                          {hasSuggestionRange && (
                            <Area type="monotone" dataKey="future_band_low"   stackId="fb" stroke="none" fill="transparent" legendType="none" />
                          )}
                          {hasSuggestionRange && (
                            <Area type="monotone" dataKey="future_band_range" stackId="fb" stroke="none" fill="#f97316" fillOpacity={0.10} legendType="none" />
                          )}

                          {hasActual && (
                            <Area
                              type="monotone"
                              dataKey="actual_usage"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              fill="url(#actualGrad)"
                              dot={false}
                              activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                              connectNulls={false}
                              legendType="none"
                            />
                          )}

                          {hasFuture && (
                            <Area
                              type="monotone"
                              dataKey="future_forecast"
                              stroke="#6366f1"
                              strokeWidth={2.5}
                              fill="url(#forecastGrad)"
                              dot={false}
                              activeDot={{ r: 4, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                              connectNulls
                              legendType="none"
                            />
                          )}

                          <ReferenceLine
                            x={todayStr}
                            stroke="#cbd5e1"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            label={{ value: "Today", fill: "#94a3b8", fontSize: 10, fontWeight: 600, position: "insideTopRight" }}
                          />

                          {selectedIngredient?.daily_target_average != null && graphFilters.dailyTargetAvg && (
                            <Line
                              type="monotone"
                              dataKey="daily_avg"
                              stroke="#f97316"
                              strokeWidth={1.5}
                              strokeDasharray="5 3"
                              dot={false}
                              activeDot={false}
                              connectNulls={false}
                              legendType="none"
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-2">
                      <TrendingUp className="text-slate-200" size={32} />
                      <p className="text-sm">No data — click <b className="text-slate-500">New Prediction</b> to generate a forecast</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-slate-300 gap-3">
                    <TrendingUp size={36} />
                    <p className="text-sm text-slate-400">Select an ingredient from the left panel</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Request Prediction Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">New Prediction</h2>
                <p className="text-xs text-slate-400 mt-0.5">Run the Bayesian model for selected ingredient</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition p-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ingredient</label>
                <select
                  value={requestForm.ingredient_id}
                  onChange={(e) => setRequestForm((f) => ({ ...f, ingredient_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-orange-400 outline-none"
                >
                  <option value="">All Ingredients</option>
                  {ingredientList.map((r) => (
                    <option key={r.id} value={r.id}>{r.ingredient_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Forecast Period</label>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 mb-1">From</p>
                    <input
                      type="date"
                      value={requestForm.start_date}
                      onChange={(e) => setRequestForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                  </div>
                  <div className="pb-2.5 text-slate-300 font-bold text-lg">→</div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 mb-1">To</p>
                    <input
                      type="date"
                      value={requestForm.end_date}
                      min={requestForm.start_date}
                      onChange={(e) => setRequestForm((f) => ({ ...f, end_date: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-orange-400 outline-none"
                    />
                  </div>
                </div>
                {requestForm.start_date && requestForm.end_date && (() => {
                  const days = Math.round((new Date(requestForm.end_date) - new Date(requestForm.start_date)) / 86400000);
                  return days > 0 ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-orange-500 text-xs font-semibold px-3 py-1 rounded-full">
                      <Clock size={11} /> {days} day{days !== 1 ? "s" : ""} selected
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-red-400 font-medium">⚠ End date must be after start date</p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["1","Conservative"],["2","Balanced"],["3","Aggressive"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setRequestForm((f) => ({ ...f, strategy: val }))}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition ${
                        requestForm.strategy === val
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleRequest}
              disabled={!requestForm.start_date || !requestForm.end_date || new Date(requestForm.end_date) <= new Date(requestForm.start_date)}
              className="mt-6 w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white py-3 rounded-xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run Prediction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}