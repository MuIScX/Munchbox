"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { PredictAPI, IngredientAPI } from "../../lib/api";
import { Search, Loader2, TrendingUp, SlidersHorizontal, X, Plus, Package, BarChart2, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export default function PredictPage() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [actualData, setActualData] = useState([]);
  const [dailyForecast, setDailyForecast] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ingredientList, setIngredientList] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ ingredient_id: "", days: 7, strategy: "2" });
  const [graphFilters, setGraphFilters] = useState({
    historicalUsage: true,
    futureForecast: true,
    suggestionRange: true,
    dailyTargetAvg: true,
  });
  const filterRef = useRef(null);

  const showToast = (type, message) => setToast({ type, message });

  useEffect(() => {
    fetchReport();
    IngredientAPI.list({}).then((res) => {
      setIngredientList(Array.isArray(res?.Data) ? res.Data : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await PredictAPI.report();
      const data = Array.isArray(res?.Data) ? res.Data : [];
      setReport(data);
      if (data.length > 0) {
        setSelectedIngredient(data[0]);
        fetchTrend(data[0].ingredient_id);
      }
    } catch {
      showToast("error", "Failed to load prediction data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrend = async (ingredient_id) => {
    try {
      setTrendLoading(true);
      const [trendRes, actualRes, forecastRes] = await Promise.all([
        PredictAPI.trend(ingredient_id),
        PredictAPI.actual(ingredient_id),
        PredictAPI.dailyForecast(ingredient_id),
      ]);

      const trendRaw = trendRes?.Data?.data || [];
      const actualRaw = actualRes?.Data || [];
      setDailyForecast(forecastRes?.Data || []);

      // Build a map keyed by date so we can merge both datasets
      const merged = {};

      trendRaw.forEach((d) => {
        const date = (d.timestamp || "").split(" ")[0];
        merged[date] = {
          ...merged[date],
          date,
          predicted_usage: d.daily_target_average ?? null,
          upper_bound: d.upper_bound ?? null,
          lower_bound: d.lower_bound ?? null,
        };
      });

      actualRaw.forEach((d) => {
        merged[d.date] = {
          ...merged[d.date],
          date: d.date,
          actual_usage: d.actual_usage ?? null,
        };
      });

      const sorted = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
      setTrendData(sorted);
      setActualData(actualRaw);
    } catch {
      setTrendData([]);
      setActualData([]);
      setDailyForecast([]);
    } finally {
      setTrendLoading(false);
    }
  };

  const handleSelectIngredient = (ing) => {
    setSelectedIngredient(ing);
    fetchTrend(ing.ingredient_id);
  };

  const handleRequest = async () => {
    try {
      setGenerating(true);
      setModalOpen(false);
      const res = await PredictAPI.generateMenu({
        days: requestForm.days,
        strategy: requestForm.strategy,
      });
      const total = res?.Data?.total_processed ?? 0;
      const errors = res?.Data?.errors ?? [];
      if (total > 0) {
        showToast("success", `Generated forecasts for ${total} menu(s) successfully.`);
      } else if (errors.length > 0) {
        showToast("error", `Model failed: ${errors[0]?.error || "unknown error"}`);
      } else {
        showToast("error", "No menu forecasts generated. Check server logs.");
      }
      await fetchReport();
    } catch (err) {
      showToast("error", err.message || "Failed to generate prediction.");
    } finally {
      setGenerating(false);
    }
  };

  const filteredReport = useMemo(() => {
    return report.filter((r) => {
      const nameMatch = (r.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const statusMatch = statusFilter === "All" || (statusFilter === "OK" ? r.status === 1 : r.status === 0);
      return nameMatch && statusMatch;
    });
  }, [report, searchQuery, statusFilter]);

  const todayStr = new Date().toISOString().split("T")[0];

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const historical = trendData
      .filter((d) => d.date >= cutoffStr)
      .map((d) => ({ ...d, section: "historical" }));

    const dailyAvg = selectedIngredient?.daily_target_average ?? null;

    const future = dailyForecast.map((d) => ({
      date: d.date,
      section: "future",
      future_forecast: d.mean_demand != null ? Math.ceil(d.mean_demand) : null,
      future_band_low: d.low_bound,
      future_band_range: (d.high_bound != null && d.low_bound != null)
        ? Math.max(0, d.high_bound - d.low_bound) : null,
      daily_avg: dailyAvg,
    }));

    // Connect actual line → forecast line at the last actual data point
    const lastActual = [...historical].reverse().find((d) => d.actual_usage != null);
    const firstForecast = future[0];

    // Merge future_forecast into every historical point between lastActual and firstForecast
    // (covers points already in trendData like prediction-run dates)
    const historicalMerged = historical.map((d) => {
      if (!firstForecast) return d;
      if (d.date >= lastActual?.date && d.date < firstForecast.date) {
        return { ...d,
          future_forecast: firstForecast.future_forecast,
          future_band_low: firstForecast.future_band_low,
          future_band_range: firstForecast.future_band_range };
      }
      return d;
    });

    // Fill gap dates that don't already exist in historical
    const existingDates = new Set(historical.map((d) => d.date));
    const gapPoints = [];
    if (lastActual && firstForecast) {
      const d = new Date(lastActual.date);
      const end = new Date(firstForecast.date);
      d.setDate(d.getDate() + 1);
      while (d < end) {
        const ds = d.toISOString().split("T")[0];
        if (!existingDates.has(ds)) {
          gapPoints.push({
            date: ds,
            section: "gap",
            future_forecast: firstForecast.future_forecast,
            future_band_low: firstForecast.future_band_low,
            future_band_range: firstForecast.future_band_range,
            daily_avg: dailyAvg,
          });
        }
        d.setDate(d.getDate() + 1);
      }
    }

    return [...historicalMerged, ...gapPoints, ...future].sort((a, b) => a.date.localeCompare(b.date));
  }, [trendData, dailyForecast, todayStr, selectedIngredient]);

  const hasActual = graphFilters.historicalUsage && chartData.some((d) => d.actual_usage != null);
  const hasFuture = graphFilters.futureForecast && chartData.some((d) => d.future_forecast != null);
  const hasSuggestionRange = graphFilters.suggestionRange && chartData.some((d) => d.future_band_range != null);

  const yAxisMax = useMemo(() => {
    const maxActual = Math.max(0, ...chartData.map((d) => d.actual_usage ?? 0));
    const maxFuture = Math.max(0, ...chartData.map((d) => (d.future_band_low ?? 0) + (d.future_band_range ?? 0)));
    const maxForecast = Math.max(0, ...chartData.map((d) => d.future_forecast ?? 0));
    return Math.ceil(Math.max(maxActual, maxFuture, maxForecast) * 1.4) || 10;
  }, [chartData, selectedIngredient]);

  const surplus = selectedIngredient
    ? (selectedIngredient.current_stock - Math.ceil(selectedIngredient.expected_usage)).toFixed(1)
    : 0;

  return (
    <div className="flex h-screen bg-[#f6f7fb] overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 flex flex-col gap-6 max-w-screen-2xl w-full mx-auto">

          {/* ── Header + Stat cards panel ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              {/* Title row */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <TrendingUp size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Demand Forecast</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Bayesian time-series prediction for ingredient usage</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(true)}
                  disabled={generating}
                  className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition shadow-sm disabled:opacity-60"
                >
                  {generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {generating ? "Generating…" : "New Prediction"}
                </button>
              </div>

              {/* Stat cards */}
              {selectedIngredient ? (
                <div className="flex gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                      <Package size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Current Stock</p>
                      <p className="text-3xl font-bold text-slate-700 mt-0.5">{selectedIngredient.current_stock}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{selectedIngredient.unit}</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <BarChart2 size={18} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 font-bold uppercase tracking-wide">Est. Usage ({requestForm.days}d)</p>
                      <p className="text-3xl font-bold text-orange-900 mt-0.5">{Math.ceil(selectedIngredient.expected_usage)}</p>
                      <p className="text-xs text-orange-500 font-medium mt-0.5">{selectedIngredient.unit}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Clock size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Avg / Day</p>
                      <p className="text-3xl font-bold text-blue-900 mt-0.5">{selectedIngredient.daily_target_average ?? "—"}</p>
                      <p className="text-xs text-blue-500 font-medium mt-0.5">{selectedIngredient.unit}/day</p>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-4 flex items-center gap-4 flex-1 ${selectedIngredient.status === 1 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedIngredient.status === 1 ? "bg-emerald-100" : "bg-red-100"}`}>
                      {selectedIngredient.status === 1
                        ? <CheckCircle size={18} className="text-emerald-600" />
                        : <AlertTriangle size={18} className="text-red-500" />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wide ${selectedIngredient.status === 1 ? "text-emerald-600" : "text-red-500"}`}>Status</p>
                      <p className={`text-3xl font-bold mt-0.5 ${selectedIngredient.status === 1 ? "text-emerald-900" : "text-red-900"}`}>
                        {selectedIngredient.status === 1 ? "OK" : "Low"}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${selectedIngredient.status === 1 ? "text-emerald-500" : "text-red-400"}`}>
                        {selectedIngredient.status === 1
                          ? `+${surplus} ${selectedIngredient.unit} surplus`
                          : `Need ${Math.abs(surplus)} ${selectedIngredient.unit} more`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-slate-300 text-sm italic">
                  Select an ingredient to view stats
                </div>
              )}
            </div>
          </div>

          {/* ── Controls bar ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Ingredient", node: (
                <select value={selectedIngredient?.ingredient_id || ""} onChange={(e) => { const ing = report.find((r) => String(r.ingredient_id) === e.target.value); if (ing) handleSelectIngredient(ing); }} className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer max-w-[130px]">
                  {report.map((r) => <option key={r.ingredient_id} value={r.ingredient_id}>{r.ingredient_name}</option>)}
                </select>
              )},
              { label: "Forecast", node: (
                <select value={requestForm.days} onChange={(e) => setRequestForm((f) => ({ ...f, days: parseInt(e.target.value) }))} className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer">
                  <option value={7}>Next 7 days</option>
                  <option value={14}>Next 14 days</option>
                  <option value={30}>Next 30 days</option>
                </select>
              )},
              { label: "Model", node: (
                <select value={requestForm.strategy} onChange={(e) => setRequestForm((f) => ({ ...f, strategy: e.target.value }))} className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer">
                  <option value="1">Conservative</option>
                  <option value="2">Balanced</option>
                  <option value="3">Aggressive</option>
                </select>
              )},
            ].map(({ label, node }) => (
              <div key={label} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                <span className="text-xs text-slate-400 font-medium">{label}</span>
                <span className="text-slate-300">|</span>
                {node}
              </div>
            ))}

            <div className="flex-1" />

            {/* Graph filter */}
            <div className="relative" ref={filterRef}>
              <button onClick={() => setFilterOpen((o) => !o)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition shadow-sm ${filterOpen ? "bg-orange-50 border-orange-300 text-orange-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                <SlidersHorizontal size={14} />
                Filters
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-20 w-52">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Show / Hide</p>
                  {[
                    { key: "historicalUsage", label: "Historical Usage", color: "bg-emerald-500" },
                    { key: "futureForecast", label: "Future Forecast", color: "bg-blue-500" },
                    { key: "suggestionRange", label: "Suggestion Range", color: "bg-blue-200" },
                    { key: "dailyTargetAvg", label: "Daily Target Avg", color: "bg-orange-400" },
                  ].map(({ key, label, color }) => (
                    <label key={key} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition ${graphFilters[key] ? "border-orange-500 bg-orange-500" : "border-slate-300"}`} onClick={() => setGraphFilters((f) => ({ ...f, [key]: !f[key] }))}>
                        {graphFilters[key] && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l2.5 3L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                      </div>
                      <span className="text-sm text-slate-600 group-hover:text-slate-800 select-none">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Chart card ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Chart header with plain-language insight */}
            {selectedIngredient && (
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-700 text-sm">
                    {selectedIngredient.ingredient_name} — Daily Usage (last 30 days + {requestForm.days}-day forecast)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedIngredient.daily_target_average != null
                      ? `On average you use ${selectedIngredient.daily_target_average} ${selectedIngredient.unit}/day. In the next ${requestForm.days} days, expect to use about ${selectedIngredient.expected_usage} ${selectedIngredient.unit}.`
                      : 'No forecast data yet. Click "New Prediction" to generate one.'}
                  </p>
                </div>
                {/* Inline status badge */}
                {selectedIngredient.status === 1 ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0">
                    <CheckCircle size={13} /> Stock is OK
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-500 text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0">
                    <AlertTriangle size={13} /> Reorder needed
                  </div>
                )}
              </div>
            )}

            {selectedIngredient ? (
              trendLoading ? (
                <div className="flex items-center justify-center h-72">
                  <Loader2 className="animate-spin text-orange-400" size={28} />
                </div>
              ) : chartData.length > 0 ? (
                <>
                  <div className="h-80 px-2 pt-4 pb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 28, left: -14, bottom: 0 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          interval={Math.ceil(chartData.length / 8)}
                          tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, yAxisMax]} allowDataOverflow={true} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            const isFuture = d?.section === "future";
                            return (
                              <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgb(0 0 0/0.10)", border: "1px solid #e2e8f0", minWidth: 170 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px 0" }}>
                                  {label} {isFuture ? "🔮 Forecast" : "📊 Actual"}
                                </p>
                                {d?.actual_usage != null && (
                                  <p style={{ fontSize: 13, color: "#10b981", margin: "3px 0 0 0" }}>
                                    Used: <b>{d.actual_usage}</b> {selectedIngredient.unit}
                                  </p>
                                )}
                                {d?.future_forecast != null && (
                                  <p style={{ fontSize: 13, color: "#6366f1", margin: "3px 0 0 0" }}>
                                    Forecast: <b>{Math.ceil(d.future_forecast)}</b> {selectedIngredient.unit}/day
                                  </p>
                                )}
                                {d?.future_band_low != null && d?.future_band_range != null && (
                                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0 0", borderTop: "1px solid #f1f5f9", paddingTop: 4 }}>
                                    Expected range: {Number(d.future_band_low).toFixed(1)} – {Number(d.future_band_low + d.future_band_range).toFixed(1)} {selectedIngredient.unit}
                                  </p>
                                )}
                              </div>
                            );
                          }}
                        />

                        {/* Section backgrounds — plain white */}

                        {/* Suggestion range band (future confidence) */}
                        {hasSuggestionRange && <Area type="monotone" dataKey="future_band_low" stackId="fb" stroke="none" fill="transparent" legendType="none" />}
                        {hasSuggestionRange && <Area type="monotone" dataKey="future_band_range" stackId="fb" stroke="none" fill="#f97316" fillOpacity={0.15} legendType="none" />}

                        {/* Historical usage — LINE */}
                        {hasActual && (
                          <Line
                            type="monotone"
                            dataKey="actual_usage"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                            connectNulls={false}
                            legendType="none"
                          />
                        )}

                        {/* Future forecast line */}
                        {hasFuture && (
                          <Line
                            type="monotone"
                            dataKey="future_forecast"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                            connectNulls={true}
                            legendType="none"
                          />
                        )}

                        {/* Today divider */}
                        <ReferenceLine x={todayStr} stroke="#94a3b8" strokeWidth={2} label={{ value: "Today ▶", fill: "#64748b", fontSize: 11, fontWeight: 600, position: "insideTopLeft" }} />

                        {/* Daily target avg — only shown in forecast period */}
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

                  {/* Legend */}
                  <div className="flex items-center gap-6 px-6 py-3 border-t border-slate-100 flex-wrap">
                    {hasActual && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#10b981" strokeWidth="2.5" /></svg>
                        Actual usage
                      </div>
                    )}
                    {hasFuture && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#6366f1" strokeWidth="2.5" /></svg>
                        Forecast (next {requestForm.days}d)
                      </div>
                    )}
                    {hasSuggestionRange && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-6 h-3.5 rounded" style={{ background: "rgba(249,115,22,0.2)" }} />
                        Expected range
                      </div>
                    )}
                    {selectedIngredient?.daily_target_average != null && graphFilters.dailyTargetAvg && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>
                        Daily average
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2">
                  <TrendingUp className="text-slate-300" size={36} />
                  <p className="text-sm">No data yet — click <b>New Prediction</b> to generate a forecast</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2">
                <TrendingUp className="text-slate-300" size={36} />
                <p className="text-sm italic">Select an ingredient to view the forecast</p>
              </div>
            )}
          </div>

          {/* ── Prediction Results Table ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
              <div>
                <h2 className="font-bold text-slate-800">Prediction Results</h2>
                <p className="text-xs text-slate-400 mt-0.5">Click a row to view forecast chart</p>
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input
                  type="text"
                  placeholder="Search ingredient…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-orange-400 outline-none w-52"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-orange-400 outline-none"
              >
                <option value="All">All Status</option>
                <option value="OK">Sufficient</option>
                <option value="Reorder">Reorder</option>
              </select>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Ingredient</th>
                  <th className="px-6 py-3 font-semibold text-right">Current Stock</th>
                  <th className="px-6 py-3 font-semibold text-right">Est. Usage</th>
                  <th className="px-6 py-3 font-semibold text-right">Avg / Day</th>
                  <th className="px-6 py-3 font-semibold text-center">Unit</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-14 text-center"><Loader2 className="animate-spin text-orange-400 mx-auto" size={24} /></td></tr>
                ) : filteredReport.length > 0 ? (
                  filteredReport.map((row) => {
                    const isSelected = selectedIngredient?.ingredient_id === row.ingredient_id;
                    const diff = (row.current_stock - row.expected_usage).toFixed(1);
                    return (
                      <tr
                        key={row.ingredient_id}
                        onClick={() => handleSelectIngredient(row)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-orange-50" : "hover:bg-slate-50/60"}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {isSelected && <div className="w-1 h-6 bg-orange-400 rounded-full" />}
                            <span className={`font-semibold text-sm ${isSelected ? "text-orange-600" : "text-slate-700"}`}>{row.ingredient_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">{row.current_stock}</td>
                        <td className="px-6 py-4 text-right text-sm text-slate-600">{row.expected_usage}</td>
                        <td className="px-6 py-4 text-right text-sm text-slate-500">{row.daily_target_average ?? "—"}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-400">{row.unit}</td>
                        <td className="px-6 py-4 text-center">
                          {row.status === 1 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <CheckCircle size={11} /> OK +{diff}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                              <AlertTriangle size={11} /> Need {Math.abs(diff)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={6} className="py-14 text-center">
                    <TrendingUp className="mx-auto mb-2 text-slate-200" size={32} />
                    <p className="text-slate-400 text-sm italic">No prediction data</p>
                  </td></tr>
                )}
              </tbody>
            </table>
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
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Forecast Horizon</label>
                <div className="flex gap-3">
                  <input
                    type="number" min={1} max={90}
                    value={requestForm.days}
                    onChange={(e) => setRequestForm((f) => ({ ...f, days: parseInt(e.target.value) || 7 }))}
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-orange-400 outline-none"
                    placeholder="days"
                  />
                  <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 font-medium">days</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["1","Conservative"],["2","Balanced"],["3","Aggressive"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setRequestForm((f) => ({ ...f, strategy: val }))}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition ${requestForm.strategy === val ? "bg-orange-500 border-orange-500 text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleRequest}
              className="mt-6 w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white py-3 rounded-xl font-bold text-sm transition"
            >
              Run Prediction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
