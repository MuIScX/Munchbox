"use client";
import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { PredictAPI } from "../../lib/api";
import {
  Target, Loader2, Search, CheckCircle, AlertTriangle,
  Activity, TrendingUp, BarChart3, Package, Minus,
} from "lucide-react";

/* ─── derive table stats from /accuracy response ─── */
function computeStatsFromData(data) {
  if (!data || data.length === 0) {
    return { accuracy: null, mae: null, bias: null, days: 0, chartData: [] };
  }

  const accuracy = data.reduce((s, d) => s + d.accuracy, 0) / data.length;
  const mae      = data.reduce((s, d) => s + Math.abs(d.actual_usage - d.predicted_usage), 0) / data.length;
  const bias     = data.reduce((s, d) => s + (d.predicted_usage - d.actual_usage), 0) / data.length;

  const chartData = data.map((d) => ({
    date:      d.date,
    actual:    d.actual_usage,
    predicted: d.predicted_usage,
    surplus:   parseFloat((d.predicted_usage - d.actual_usage).toFixed(2)),
  }));

  return {
    accuracy:  parseFloat(Math.min(100, accuracy).toFixed(2)),
    mae:       parseFloat(mae.toFixed(2)),
    bias:      parseFloat(bias.toFixed(2)),
    days:      data.length,
    chartData,
  };
}

/* ─── helpers ─── */
function accuracyColor(acc) {
  if (acc === null) return { text: "text-slate-400", badge: "bg-slate-100 text-slate-400 border-slate-200" };
  if (acc >= 85)   return { text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (acc >= 70)   return { text: "text-amber-600",   badge: "bg-amber-50 text-amber-700 border-amber-200" };
  return             { text: "text-red-500",    badge: "bg-red-50 text-red-600 border-red-200" };
}

function AccuracyBadge({ acc }) {
  const c = accuracyColor(acc);
  if (acc === null) return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><Minus size={10} /> No data</span>;
  if (acc >= 85)   return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><CheckCircle size={10} /> {acc.toFixed(1)}%</span>;
  if (acc >= 70)   return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><Activity size={10} /> {acc.toFixed(1)}%</span>;
  return             <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><AlertTriangle size={10} /> {acc.toFixed(1)}%</span>;
}

function fmtDate(v) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

/* ─── per-ingredient chart tooltip ─── */
function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isSafe = d?.surplus != null ? d.surplus >= 0 : null;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgb(0 0 0/0.10)", border: "1px solid #e2e8f0", minWidth: 190 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px 0" }}>{fmtDate(label)}</p>
      {d?.actual != null && (
        <p style={{ fontSize: 13, color: "#10b981", margin: "3px 0 0 0" }}>Actual: <b>{d.actual.toFixed(2)}</b> {unit}</p>
      )}
      {d?.predicted != null && (
        <p style={{ fontSize: 13, color: "#f97316", margin: "3px 0 0 0" }}>Predicted: <b>{d.predicted.toFixed(2)}</b> {unit}</p>
      )}
      {d?.surplus != null && (
        <p style={{
          fontSize: 11, fontWeight: 600,
          color: isSafe ? "#10b981" : "#ef4444",
          margin: "5px 0 0 0", borderTop: "1px solid #f1f5f9", paddingTop: 4,
        }}>
          {isSafe
            ? `Surplus: +${Math.abs(d.surplus).toFixed(2)} ${unit} — safe`
            : `Shortfall: −${Math.abs(d.surplus).toFixed(2)} ${unit} — risk`}
        </p>
      )}
    </div>
  );
}

/* ─── all-ingredient accuracy tooltip ─── */
function AllAccuracyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const acc = payload[0]?.value;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgb(0 0 0/0.10)", border: "1px solid #e2e8f0", minWidth: 160 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px 0" }}>{fmtDate(label)}</p>
      {acc != null && (
        <p style={{ fontSize: 13, color: "#f97316", margin: "3px 0 0 0" }}>
          Avg Accuracy: <b>{acc.toFixed(1)}%</b>
        </p>
      )}
    </div>
  );
}

/* ─── main page ─── */
export default function AccuracyPage() {
  const [ingredients, setIngredients]       = useState([]);
  const [selected, setSelected]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [toast, setToast]                   = useState(null);
  const [searchQuery, setSearchQuery]       = useState("");
  const [accSearchQuery, setAccSearchQuery] = useState("");
  const [accSearchOpen, setAccSearchOpen]   = useState(false);
  const [accAll, setAccAll]                 = useState(false);
  const [allChartData, setAllChartData]     = useState([]);
  const [allChartLoading, setAllChartLoading] = useState(false);

  const showToast = (type, msg) => setToast({ type, message: msg });

  /* ── initial load: ingredient list + progressive accuracy per ingredient ── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const reportRes = await PredictAPI.report();
        const list = Array.isArray(reportRes?.Data) ? reportRes.Data : [];

        const skeleton = list.map((ing) => ({
          ...ing, accuracy: null, mae: null, bias: null, days: 0, chartData: [], _loaded: false,
        }));
        setIngredients(skeleton);
        if (skeleton.length > 0) setSelected(skeleton[0]);
        setLoading(false);

        // Load accuracy per ingredient progressively
        for (const ing of list) {
          try {
            const res   = await PredictAPI.accuracy(ing.ingredient_id);
            const stats = computeStatsFromData(res?.Data);
            setIngredients((prev) =>
              prev.map((i) => i.ingredient_id === ing.ingredient_id ? { ...i, ...stats, _loaded: true } : i)
            );
            setSelected((prev) =>
              prev?.ingredient_id === ing.ingredient_id ? { ...prev, ...stats, _loaded: true } : prev
            );
          } catch { /* skip */ }
        }
      } catch {
        showToast("error", "Failed to load accuracy data.");
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── fetch all-ingredient accuracy when that mode is enabled ── */
  useEffect(() => {
    if (!accAll) return;
    const fetchAll = async () => {
      setAllChartLoading(true);
      try {
        const res = await PredictAPI.accuracy(null);
        setAllChartData(res?.Data || []);
      } catch {
        showToast("error", "Failed to load all-ingredient accuracy.");
      } finally {
        setAllChartLoading(false);
      }
    };
    fetchAll();
  }, [accAll]);

  const summary = useMemo(() => {
    const loaded = ingredients.filter((i) => i._loaded && i.accuracy !== null);
    if (!loaded.length) return null;
    const avgAcc = loaded.reduce((s, i) => s + i.accuracy, 0) / loaded.length;
    const avgMae = loaded.reduce((s, i) => s + i.mae, 0) / loaded.length;
    const totalDays = loaded.reduce((s, i) => s + i.days, 0);
    const best   = [...loaded].sort((a, b) => b.accuracy - a.accuracy)[0];
    return {
      avgAcc,
      avgMae:      parseFloat(avgMae.toFixed(2)),
      totalDays,
      best,
      totalLoaded: loaded.length,
    };
  }, [ingredients]);

  // Sync search box with selected ingredient
  useEffect(() => {
    if (!accAll && selected?.ingredient_name) setAccSearchQuery(selected.ingredient_name);
  }, [selected?.ingredient_id, accAll]);

  const filtered = useMemo(() =>
    ingredients.filter((i) =>
      (i.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    ), [ingredients, searchQuery]);

  const chartData = accAll ? allChartData : (selected?.chartData ?? []);
  const showDots  = chartData.length <= 60;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 flex flex-col gap-6 max-w-screen-2xl w-full mx-auto">

          {/* ── Header ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Target size={20} className="text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Prediction Accuracy</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Compare predicted vs. actual ingredient usage to evaluate forecast performance</p>
                </div>
              </div>

              {/* Stat cards */}
              <div className="flex gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Target size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Overall Accuracy</p>
                    {summary ? (
                      <>
                        <p className={`text-3xl font-bold mt-0.5 ${accuracyColor(summary.avgAcc).text}`}>{summary.avgAcc.toFixed(1)}%</p>
                        <p className="text-xs text-emerald-500 font-medium mt-0.5">avg across {summary.totalLoaded} ingredients</p>
                      </>
                    ) : <Spinner color="emerald" />}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Activity size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Avg Error (MAE)</p>
                    {summary ? (
                      <>
                        <p className="text-3xl font-bold text-blue-900 mt-0.5">{summary.avgMae}</p>
                        <p className="text-xs text-blue-500 font-medium mt-0.5">units/day avg deviation</p>
                      </>
                    ) : <Spinner color="blue" />}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                    <BarChart3 size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Days Analyzed</p>
                    {summary ? (
                      <>
                        <p className="text-3xl font-bold text-slate-700 mt-0.5">{summary.totalDays}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">total data points compared</p>
                      </>
                    ) : <Spinner color="slate" />}
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} className="text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-orange-600 font-bold uppercase tracking-wide">Best Performer</p>
                    {summary?.best ? (
                      <>
                        <p className="text-base font-bold text-orange-900 mt-0.5 truncate">{summary.best.ingredient_name}</p>
                        <p className="text-xs text-emerald-500 font-semibold mt-0.5">{summary.best.accuracy.toFixed(1)}% accuracy</p>
                      </>
                    ) : <Spinner color="orange" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Chart card ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Chart header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold text-slate-700 text-sm">
                    {accAll
                      ? "All Ingredients — Average Daily Accuracy"
                      : (selected ? `${selected.ingredient_name} — Actual vs. Predicted` : "Select an ingredient")}
                  </h3>
                  {!accAll && selected?._loaded && <AccuracyBadge acc={selected.accuracy} />}
                  {!accAll && selected && !selected._loaded && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 size={11} className="animate-spin" /> loading…
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {accAll
                    ? `${allChartData.length} days — avg accuracy across all ingredients (closest-before prediction)`
                    : (chartData.length > 0
                      ? `${chartData.length} data points${selected?._loaded && selected.mae != null ? ` — MAE ${selected.mae} ${selected.unit ?? ""}/day` : ""}`
                      : "Comparing historical predictions vs actual usage")}
                </p>
              </div>

              {/* Search + All checkbox */}
              {ingredients.length > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative w-48">
                    <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition ${accAll ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed" : "bg-slate-50 border-slate-200 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent"}`}>
                      <Search size={13} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search ingredient..."
                        value={accSearchQuery}
                        disabled={accAll}
                        onChange={(e) => { setAccSearchQuery(e.target.value); setAccSearchOpen(true); }}
                        onFocus={() => { if (!accAll) setAccSearchOpen(true); }}
                        onBlur={() => setTimeout(() => setAccSearchOpen(false), 150)}
                        className={`bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400 ${accAll ? "cursor-not-allowed" : ""}`}
                      />
                    </div>
                    {accSearchOpen && (() => {
                      const suggestions = ingredients
                        .filter(i => (i.ingredient_name || "").toLowerCase().includes(accSearchQuery.toLowerCase()))
                        .slice(0, 5);
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute top-full mt-1 right-0 left-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden w-48">
                          {suggestions.map(i => (
                            <button
                              key={i.ingredient_id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelected(i);
                                setAccSearchQuery(i.ingredient_name);
                                setAccSearchOpen(false);
                                setAccAll(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-600 font-medium transition-colors"
                            >
                              {i.ingredient_name}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={accAll}
                      onChange={(e) => setAccAll(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-600">All Ingredient</span>
                  </label>
                </div>
              )}
            </div>

            {/* Chart body */}
            {loading ? (
              <div className="flex items-center justify-center h-72">
                <Loader2 className="animate-spin text-orange-400" size={28} />
              </div>
            ) : accAll ? (
              allChartLoading ? (
                <div className="flex items-center justify-center h-72">
                  <Loader2 className="animate-spin text-orange-400" size={28} />
                </div>
              ) : allChartData.length > 0 ? (
                <>
                  <div className="h-80 px-2 pt-4 pb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={allChartData} margin={{ top: 10, right: 28, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                          interval={Math.max(0, Math.ceil(allChartData.length / 8) - 1)}
                          tickFormatter={fmtDate}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<AllAccuracyTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#f97316"
                          strokeWidth={2.5}
                          dot={allChartData.length <= 60 ? { r: 4, fill: "#f97316", stroke: "#fff", strokeWidth: 2 } : false}
                          activeDot={{ r: 6, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
                          connectNulls={false}
                          name="Avg Accuracy"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-6 px-6 py-3 border-t border-slate-100 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#f97316" strokeWidth="2.5" /></svg>
                      Avg accuracy (all ingredients)
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-72 gap-2">
                  <BarChart3 className="text-slate-200" size={36} />
                  <p className="text-sm font-medium text-slate-500">No data available yet</p>
                  <p className="text-xs text-slate-400 text-center max-w-xs">
                    No historical predictions with matching actual sales found.
                  </p>
                </div>
              )
            ) : chartData.length > 0 ? (
              <>
                <div className="h-80 px-2 pt-4 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 28, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
                        tickFormatter={fmtDate}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip unit={selected?.unit ?? ""} />} />

                      {/* Actual — emerald solid */}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={showDots ? { r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 } : false}
                        activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls={false}
                        name="Actual"
                      />

                      {/* Predicted — orange dashed */}
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={showDots ? { r: 4, fill: "#f97316", stroke: "#fff", strokeWidth: 2 } : false}
                        activeDot={{ r: 6, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls={false}
                        name="Predicted"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 px-6 py-3 border-t border-slate-100 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#10b981" strokeWidth="2.5" /></svg>
                    Actual usage
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>
                    Predicted Demand
                  </div>
                  {selected?.accuracy != null && (
                    <div className="ml-auto"><AccuracyBadge acc={selected.accuracy} /></div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-72 gap-2">
                <BarChart3 className="text-slate-200" size={36} />
                <p className="text-sm font-medium text-slate-500">No overlap data</p>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  Accuracy requires a forecast that was run before the date, with recorded actual sales on the same day.
                </p>
              </div>
            )}
          </div>

          {/* ── Accuracy Table ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-4">
              <div>
                <h2 className="font-bold text-slate-800">Accuracy per Ingredient</h2>
                <p className="text-xs text-slate-400 mt-0.5">Click a row to view the comparison chart</p>
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
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Ingredient</th>
                  <th className="px-6 py-3 font-semibold text-center">Accuracy</th>
                  <th className="px-6 py-3 font-semibold text-right">MAE (avg error/day)</th>
                  <th className="px-6 py-3 font-semibold text-right">Deviation</th>
                  <th className="px-6 py-3 font-semibold text-right">Days compared</th>
                  <th className="px-6 py-3 font-semibold text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-14 text-center"><Loader2 className="animate-spin text-orange-400 mx-auto" size={24} /></td></tr>
                ) : filtered.length > 0 ? (
                  filtered.map((row) => {
                    const isSelected = selected?.ingredient_id === row.ingredient_id;
                    return (
                      <tr
                        key={row.ingredient_id}
                        onClick={() => { setSelected(row); setAccAll(false); }}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-orange-50" : "hover:bg-slate-50/60"}`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            {isSelected && <div className="w-1 h-6 bg-orange-400 rounded-full" />}
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <Package size={13} className="text-slate-400" />
                              </div>
                              <span className={`font-semibold text-sm ${isSelected ? "text-orange-600" : "text-slate-700"}`}>
                                {row.ingredient_name}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-3 text-center">
                          {!row._loaded
                            ? <span className="flex items-center justify-center gap-1 text-xs text-slate-300"><Loader2 size={11} className="animate-spin" /> computing</span>
                            : <AccuracyBadge acc={row.accuracy} />}
                        </td>

                        <td className="px-6 py-3 text-right text-sm font-medium text-slate-700">
                          {!row._loaded ? <span className="text-slate-200">—</span>
                            : row.mae != null ? `${row.mae} ${row.unit}` : <span className="text-slate-300">—</span>}
                        </td>

                        <td className="px-6 py-3 text-right text-sm">
                          {!row._loaded ? <span className="text-slate-200">—</span>
                            : row.bias != null ? (
                              <span className={row.bias > 0.5 ? "text-emerald-600 font-semibold" : row.bias < -0.5 ? "text-red-500 font-semibold" : "text-slate-400"}>
                                {row.bias > 0 ? "+" : ""}{row.bias}
                                {row.bias > 0.5 ? " ↑" : row.bias < -0.5 ? " ↓" : ""}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                        </td>

                        <td className="px-6 py-3 text-right text-sm text-slate-500">
                          {row._loaded ? row.days : <span className="text-slate-200">—</span>}
                        </td>

                        <td className="px-6 py-3 text-center text-sm text-slate-400">{row.unit}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <Target className="mx-auto mb-2 text-slate-200" size={32} />
                      <p className="text-slate-400 text-sm italic">No ingredients found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Deviation guide */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-6 flex-wrap">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deviation guide</p>
              <span className="text-xs text-emerald-600 font-semibold">+Positive ↑ = over-predicted — surplus stock, safe</span>
              <span className="text-xs text-red-500 font-semibold">−Negative ↓ = under-predicted — risk of running out</span>
              <span className="text-xs text-slate-400">≈ 0 = well-calibrated</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

/* ─── tiny helper ─── */
function Spinner({ color }) {
  const cls = { emerald: "text-emerald-300", blue: "text-blue-300", slate: "text-slate-300", orange: "text-orange-300" };
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Loader2 size={14} className={`animate-spin ${cls[color] ?? "text-slate-300"}`} />
      <span className={`text-xs ${cls[color] ?? "text-slate-300"}`}>computing…</span>
    </div>
  );
}
