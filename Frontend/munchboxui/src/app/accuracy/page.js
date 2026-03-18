"use client";
// Accuracy Report — compares predicted vs actual ingredient usage
import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { PredictAPI } from "../../lib/api";
import {
  Target, Loader2, Search, CheckCircle, AlertTriangle,
  Activity, TrendingUp, BarChart3, Package, Minus,
} from "lucide-react";

/* ─── helpers ─── */
function computeAccuracy(actualData, trendData) {
  const actualMap = {};
  (actualData || []).forEach((d) => { actualMap[d.date] = d.actual_usage; });

  const trendPoints = (trendData?.data || []).map((d) => ({
    date: d.timestamp.split(" ")[0],
    predicted: d.daily_target_average,
  }));

  const merged = trendPoints
    .map((d) => ({ ...d, actual: actualMap[d.date] ?? null }))
    .filter((d) => d.actual !== null && d.predicted !== null && d.actual > 0);

  if (merged.length === 0) return { accuracy: null, mae: null, bias: null, days: 0, chartData: [] };

  const absErrors = merged.map((d) => Math.abs(d.actual - d.predicted));
  const pctErrors = merged.map((d) => Math.abs(d.actual - d.predicted) / d.actual);
  const biasArr  = merged.map((d) => d.predicted - d.actual);

  const mape = (pctErrors.reduce((a, b) => a + b, 0) / merged.length) * 100;
  const mae  = absErrors.reduce((a, b) => a + b, 0) / merged.length;
  const bias = biasArr.reduce((a, b) => a + b, 0) / merged.length;

  return {
    accuracy: Math.max(0, 100 - mape),
    mae: parseFloat(mae.toFixed(2)),
    bias: parseFloat(bias.toFixed(2)),
    days: merged.length,
    chartData: merged.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function accuracyColor(acc) {
  if (acc === null) return { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-400", badge: "bg-slate-100 text-slate-400 border-slate-200" };
  if (acc >= 85)   return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (acc >= 70)   return { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-600",   badge: "bg-amber-50 text-amber-700 border-amber-200" };
  return             { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-500",    badge: "bg-red-50 text-red-600 border-red-200" };
}

function AccuracyBadge({ acc }) {
  const c = accuracyColor(acc);
  if (acc === null) return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><Minus size={10} /> No data</span>;
  if (acc >= 85)   return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><CheckCircle size={10} /> {acc.toFixed(1)}%</span>;
  if (acc >= 70)   return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><Activity size={10} /> {acc.toFixed(1)}%</span>;
  return             <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.badge}`}><AlertTriangle size={10} /> {acc.toFixed(1)}%</span>;
}

/* ─── custom tooltip ─── */
function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgb(0 0 0/0.10)", border: "1px solid #e2e8f0", minWidth: 180 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px 0" }}>{label}</p>
      {d?.actual != null && (
        <p style={{ fontSize: 13, color: "#10b981", margin: "3px 0 0 0" }}>Actual: <b>{d.actual.toFixed(1)}</b> {unit}</p>
      )}
      {d?.predicted != null && (
        <p style={{ fontSize: 13, color: "#f97316", margin: "3px 0 0 0" }}>Predicted: <b>{d.predicted.toFixed(1)}</b> {unit}</p>
      )}
      {d?.actual != null && d?.predicted != null && (
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "5px 0 0 0", borderTop: "1px solid #f1f5f9", paddingTop: 4 }}>
          Error: {Math.abs(d.actual - d.predicted).toFixed(1)} {unit} ({(Math.abs(d.actual - d.predicted) / d.actual * 100).toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

/* ─── main component ─── */
export default function AccuracyPage() {
  const [ingredients, setIngredients] = useState([]);
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (type, msg) => setToast({ type, message: msg });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const reportRes = await PredictAPI.report();
        const list = Array.isArray(reportRes?.Data) ? reportRes.Data : [];

        // Set skeleton list immediately
        const skeleton = list.map((ing) => ({ ...ing, accuracy: null, mae: null, bias: null, days: 0, chartData: [], _loaded: false }));
        setIngredients(skeleton);
        if (skeleton.length > 0) setSelected(skeleton[0]);
        setLoading(false);

        // Progressively load accuracy data per ingredient
        for (const ing of list) {
          try {
            const [actualRes, trendRes] = await Promise.all([
              PredictAPI.actual(ing.ingredient_id),
              PredictAPI.trend(ing.ingredient_id),
            ]);
            const stats = computeAccuracy(actualRes?.Data, trendRes?.Data);
            const updated = { ...ing, ...stats, _loaded: true };

            setIngredients((prev) =>
              prev.map((i) => i.ingredient_id === ing.ingredient_id ? updated : i)
            );
            setSelected((prev) =>
              prev?.ingredient_id === ing.ingredient_id ? { ...prev, ...stats, _loaded: true } : prev
            );
          } catch { /* skip failed ingredient */ }
        }
      } catch {
        showToast("error", "Failed to load accuracy data.");
        setLoading(false);
      }
    };
    load();
  }, []);

  /* summary stats computed from loaded ingredients */
  const summary = useMemo(() => {
    const loaded = ingredients.filter((i) => i._loaded && i.accuracy !== null);
    if (loaded.length === 0) return null;
    const avgAcc = loaded.reduce((s, i) => s + i.accuracy, 0) / loaded.length;
    const avgMae = loaded.reduce((s, i) => s + i.mae, 0) / loaded.length;
    const totalDays = loaded.reduce((s, i) => s + i.days, 0);
    const best = [...loaded].sort((a, b) => b.accuracy - a.accuracy)[0];
    return { avgAcc, avgMae: parseFloat(avgMae.toFixed(2)), totalDays, best };
  }, [ingredients]);

  const filtered = useMemo(() =>
    ingredients.filter((i) =>
      (i.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    ), [ingredients, searchQuery]);

  const selColor = selected?.accuracy !== null && selected?.accuracy !== undefined
    ? accuracyColor(selected.accuracy)
    : accuracyColor(null);

  /* format date for X axis */
  const fmtDate = (v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 flex flex-col gap-6 max-w-screen-2xl w-full mx-auto">

          {/* ── Header + Summary stat cards panel ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              {/* Title row */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Target size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Accuracy Report</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Compare predicted vs. actual ingredient usage to evaluate forecast performance</p>
                  </div>
                </div>
              </div>

              {/* Summary stat cards */}
              <div className="flex gap-4">
                {/* Overall accuracy */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Target size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Overall Accuracy</p>
                    {summary ? (
                      <>
                        <p className={`text-3xl font-bold mt-0.5 ${accuracyColor(summary.avgAcc).text}`}>
                          {summary.avgAcc.toFixed(1)}%
                        </p>
                        <p className="text-xs text-emerald-500 font-medium mt-0.5">avg across {ingredients.filter(i => i._loaded && i.accuracy !== null).length} ingredients</p>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-emerald-300" />
                        <span className="text-xs text-emerald-300">computing…</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avg MAE */}
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
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-blue-300" />
                        <span className="text-xs text-blue-300">computing…</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Days analyzed */}
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
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-slate-300" />
                        <span className="text-xs text-slate-300">computing…</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Best performer */}
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
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-orange-300" />
                        <span className="text-xs text-orange-300">computing…</span>
                      </div>
                    )}
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
                    {selected ? `${selected.ingredient_name} — Actual vs. Predicted` : "Select an ingredient"}
                  </h3>
                  {selected?._loaded && <AccuracyBadge acc={selected.accuracy} />}
                  {selected && !selected._loaded && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 size={11} className="animate-spin" /> loading…
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selected?._loaded && selected.days > 0
                    ? `${selected.days} days of overlap data — MAE ${selected.mae} ${selected.unit ?? ""}/day · Bias ${selected.bias > 0 ? "+" : ""}${selected.bias} (${selected.bias > 0 ? "over-predicted" : "under-predicted"})`
                    : "Comparing dates where both actual usage and a prediction exist"}
                </p>
              </div>

              {/* Ingredient selector */}
              {ingredients.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-400 font-medium">Ingredient</span>
                  <span className="text-slate-300">|</span>
                  <select
                    value={selected?.ingredient_id || ""}
                    onChange={(e) => {
                      const ing = ingredients.find((i) => String(i.ingredient_id) === e.target.value);
                      if (ing) setSelected(ing);
                    }}
                    className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer max-w-[140px]"
                  >
                    {ingredients.map((i) => (
                      <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Chart body */}
            {loading ? (
              <div className="flex items-center justify-center h-72">
                <Loader2 className="animate-spin text-orange-400" size={28} />
              </div>
            ) : selected?._loaded && selected.chartData?.length > 0 ? (
              <>
                <div className="h-80 px-2 pt-4 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={selected.chartData} margin={{ top: 10, right: 28, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.max(0, Math.ceil(selected.chartData.length / 8) - 1)}
                        tickFormatter={fmtDate}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip unit={selected.unit ?? ""} />} />

                      {/* Actual usage — emerald solid line */}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls={false}
                        name="Actual"
                      />
                      {/* Predicted — orange dashed line */}
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={false}
                        activeDot={{ r: 5, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
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
                    Predicted (daily avg)
                  </div>
                  {selected?.accuracy !== null && (
                    <div className="ml-auto">
                      <AccuracyBadge acc={selected.accuracy} />
                    </div>
                  )}
                </div>
              </>
            ) : selected && !selected._loaded ? (
              <div className="flex items-center justify-center h-72 gap-2 text-slate-400">
                <Loader2 className="animate-spin text-orange-300" size={22} />
                <span className="text-sm">Loading data…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-72 text-slate-400 gap-2">
                <BarChart3 className="text-slate-200" size={36} />
                <p className="text-sm">No overlap data — need both a prediction and actual sales on the same dates</p>
              </div>
            )}
          </div>

          {/* ── Accuracy Table ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
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
                <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide border-b border-slate-100">
                  <th className="px-6 py-3 font-semibold">Ingredient</th>
                  <th className="px-6 py-3 font-semibold text-center">Accuracy</th>
                  <th className="px-6 py-3 font-semibold text-right">MAE (avg error)</th>
                  <th className="px-6 py-3 font-semibold text-right">Bias</th>
                  <th className="px-6 py-3 font-semibold text-right">Days compared</th>
                  <th className="px-6 py-3 font-semibold text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <Loader2 className="animate-spin text-orange-400 mx-auto" size={24} />
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((row) => {
                    const isSelected = selected?.ingredient_id === row.ingredient_id;
                    const c = accuracyColor(row._loaded ? row.accuracy : null);
                    return (
                      <tr
                        key={row.ingredient_id}
                        onClick={() => setSelected(row)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-orange-50" : "hover:bg-slate-50/60"}`}
                      >
                        {/* Ingredient name */}
                        <td className="px-6 py-4">
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

                        {/* Accuracy badge */}
                        <td className="px-6 py-4 text-center">
                          {!row._loaded ? (
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-300">
                              <Loader2 size={11} className="animate-spin" /> computing
                            </div>
                          ) : (
                            <AccuracyBadge acc={row.accuracy} />
                          )}
                        </td>

                        {/* MAE */}
                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          {!row._loaded ? (
                            <span className="text-slate-200">—</span>
                          ) : row.mae !== null ? (
                            <span>{row.mae} {row.unit}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Bias */}
                        <td className="px-6 py-4 text-right text-sm">
                          {!row._loaded ? (
                            <span className="text-slate-200">—</span>
                          ) : row.bias !== null ? (
                            <span className={row.bias > 0.5 ? "text-blue-500" : row.bias < -0.5 ? "text-red-400" : "text-slate-400"}>
                              {row.bias > 0 ? "+" : ""}{row.bias}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Days */}
                        <td className="px-6 py-4 text-right text-sm text-slate-500">
                          {row._loaded ? row.days : <span className="text-slate-200">—</span>}
                        </td>

                        {/* Unit */}
                        <td className="px-6 py-4 text-center text-sm text-slate-400">{row.unit}</td>
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

            {/* Legend for Bias */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-6 flex-wrap">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bias guide</p>
              <span className="text-xs text-blue-500 font-medium">+Positive = over-predicted</span>
              <span className="text-xs text-red-400 font-medium">−Negative = under-predicted</span>
              <span className="text-xs text-slate-400">≈ 0 = well-calibrated</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
