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

/* ─── accuracy computation ─── */
function computeAccuracy(actualData, trendData) {
  const actualMap = {};
  (actualData || []).forEach((d) => { actualMap[d.date] = d.actual_usage; });

  // type-1 rows = daily forecast rows (one per predicted date)
  const predPoints = (trendData?.data || [])
    .filter((d) => d.prediction_type === 1 && d.expected_usage != null)
    .map((d) => ({
      date:      (d.timestamp || "").split(" ")[0],
      predicted: d.expected_usage,
    }));

  const merged = predPoints
    .map((d) => ({ ...d, actual: actualMap[d.date] ?? null }))
    .filter((d) => d.actual !== null && d.actual > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (merged.length === 0) {
    return { accuracy: null, mae: null, bias: null, days: 0, chartData: [] };
  }

  // Asymmetric (restaurant logic):
  //   predicted >= actual → 100% (over-prepared is safe)
  //   predicted <  actual → predicted/actual × 100 (risk of running out)
  const dailyAcc = merged.map((d) =>
    d.predicted >= d.actual ? 100 : Math.max(0, (d.predicted / d.actual) * 100)
  );

  const absErrors = merged.map((d) => Math.abs(d.actual - d.predicted));
  const biasArr   = merged.map((d) => d.predicted - d.actual);

  const accuracy = dailyAcc.reduce((a, b) => a + b, 0) / merged.length;
  const mae      = absErrors.reduce((a, b) => a + b, 0) / merged.length;
  const bias     = biasArr.reduce((a, b) => a + b, 0) / merged.length;

  const chartData = merged.map((d) => ({
    ...d,
    surplus: parseFloat((d.predicted - d.actual).toFixed(2)),
  }));

  return {
    accuracy:  parseFloat(Math.min(100, accuracy).toFixed(2)),
    mae:       parseFloat(mae.toFixed(2)),
    bias:      parseFloat(bias.toFixed(2)),
    days:      merged.length,
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
  const d = new Date(v);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ─── chart tooltip ─── */
function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isSafe = d?.surplus != null ? d.surplus >= 0 : null;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgb(0 0 0/0.10)", border: "1px solid #e2e8f0", minWidth: 190 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px 0" }}>{label}</p>
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

/* ─── fuzzy chart data builder (runs per selected ingredient) ───
   Strategy: collect ALL daily predictions across ALL predict_sets,
   then greedily match each predicted date to the nearest actual date
   within ±MAX_DAYS_DIFF. Each actual date is used at most once.
   This gives a chart even when predicted dates don't exactly align
   with recorded sales dates.                                        ─── */
const MAX_DAYS_DIFF = 7;

async function buildFuzzyChartData(ingredientId) {
  const [setsRes, actualRes] = await Promise.all([
    PredictAPI.sets(ingredientId),
    PredictAPI.actual(ingredientId),
  ]);

  const sets      = setsRes?.Data || [];
  const actualArr = (actualRes?.Data || []).sort((a, b) => a.date.localeCompare(b.date));

  if (!sets.length || !actualArr.length) return [];

  // Fetch all set daily forecasts in parallel
  const forecasts = await Promise.all(
    sets.map((s) =>
      PredictAPI.dailyForecast(ingredientId, s.predict_set_id).catch(() => ({ Data: [] }))
    )
  );

  // Collect all predicted dates across all sets; later sets overwrite earlier for same date
  const predByDate = {};
  sets.forEach((_, i) => {
    (forecasts[i]?.Data || []).forEach((d) => {
      if (d.date && d.mean_demand != null) predByDate[d.date] = d.mean_demand;
    });
  });

  const predictions = Object.entries(predByDate)
    .map(([date, predicted]) => ({ date, predicted }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!predictions.length) return [];

  // Greedy nearest-date matching — each actual used at most once
  const usedActual = new Set();

  const matched = predictions.map((pred) => {
    const pTime = new Date(pred.date).getTime();
    let bestDate = null;
    let bestDiff = Infinity;

    for (const act of actualArr) {
      if (usedActual.has(act.date)) continue;
      const diff = Math.abs(new Date(act.date).getTime() - pTime) / 86400000;
      if (diff <= MAX_DAYS_DIFF && diff < bestDiff) {
        bestDiff = diff;
        bestDate = act.date;
      }
    }

    if (!bestDate) return null;
    usedActual.add(bestDate);

    const actual  = actualArr.find((a) => a.date === bestDate).actual_usage;
    const surplus = parseFloat((pred.predicted - actual).toFixed(2));
    return {
      date:      pred.date,
      predicted: parseFloat(pred.predicted.toFixed(2)),
      actual:    parseFloat(actual.toFixed(2)),
      surplus,
      approx:    bestDiff > 0, // true = nearest-date approximation was used
    };
  }).filter(Boolean);

  return matched;
}

/* ─── main page ─── */
export default function AccuracyPage() {
  const [ingredients, setIngredients] = useState([]);
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fuzzyChart, setFuzzyChart]         = useState([]);
  const [fuzzyLoading, setFuzzyLoading]     = useState(false);

  const showToast = (type, msg) => setToast({ type, message: msg });

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
            const [actualRes, trendRes] = await Promise.all([
              PredictAPI.actual(ing.ingredient_id),
              PredictAPI.trend(ing.ingredient_id),
            ]);
            const stats = computeAccuracy(actualRes?.Data, trendRes?.Data);
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

  const summary = useMemo(() => {
    const loaded = ingredients.filter((i) => i._loaded && i.accuracy !== null);
    if (!loaded.length) return null;
    const avgAcc  = loaded.reduce((s, i) => s + i.accuracy, 0) / loaded.length;
    const avgMae  = loaded.reduce((s, i) => s + i.mae, 0) / loaded.length;
    const totalDays = loaded.reduce((s, i) => s + i.days, 0);
    const best    = [...loaded].sort((a, b) => b.accuracy - a.accuracy)[0];
    return {
      avgAcc,
      avgMae:     parseFloat(avgMae.toFixed(2)),
      totalDays,
      best,
      totalLoaded: loaded.length,
    };
  }, [ingredients]);

  // Load fuzzy chart data when selected ingredient changes
  useEffect(() => {
    if (!selected?.ingredient_id) return;
    let cancelled = false;
    setFuzzyLoading(true);
    setFuzzyChart([]);
    buildFuzzyChartData(selected.ingredient_id)
      .then((pts) => { if (!cancelled) setFuzzyChart(pts); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFuzzyLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.ingredient_id]);

  const filtered = useMemo(() =>
    ingredients.filter((i) =>
      (i.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    ), [ingredients, searchQuery]);

  // Use fuzzy chart when it has data, fall back to exact-match chart
  const chartData = fuzzyChart.length > 0 ? fuzzyChart : (selected?.chartData ?? []);
  const isFuzzy   = fuzzyChart.length > 0 && (selected?.chartData ?? []).length < fuzzyChart.length;
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
              {/* Title */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Target size={20} className="text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Accuracy Report</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Compare predicted vs. actual ingredient usage to evaluate forecast performance</p>
                </div>
              </div>

              {/* Context rule banner */}
              <div className="flex items-center gap-4 mb-5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <CheckCircle size={11} /> Predicted ≥ Actual = 100% — over-prepared is safe
                </span>
                <div className="h-4 w-px bg-slate-200" />
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                  <AlertTriangle size={11} /> Predicted &lt; Actual = Error — risk of running short
                </span>
                <span className="text-xs text-slate-400 ml-auto">Surplus stock is acceptable. Stockout is not.</span>
              </div>

              {/* Stat cards */}
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
                        <p className={`text-3xl font-bold mt-0.5 ${accuracyColor(summary.avgAcc).text}`}>{summary.avgAcc.toFixed(1)}%</p>
                        <p className="text-xs text-emerald-500 font-medium mt-0.5">avg across {summary.totalLoaded} ingredients</p>
                      </>
                    ) : <Spinner color="emerald" />}
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
                    ) : <Spinner color="blue" />}
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
                    ) : <Spinner color="slate" />}
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
                    {selected ? `${selected.ingredient_name} — Actual vs. Predicted` : "Select an ingredient"}
                  </h3>
                  {selected?._loaded && <AccuracyBadge acc={selected.accuracy} />}
                  {(selected && !selected._loaded) || fuzzyLoading ? (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 size={11} className="animate-spin" /> loading…
                    </span>
                  ) : null}
                  {isFuzzy && !fuzzyLoading && (
                    <span className="text-[10px] text-amber-500 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                      ±{MAX_DAYS_DIFF}d approx
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chartData.length > 0
                    ? `${chartData.length} data points${isFuzzy ? ` (nearest actual within ±${MAX_DAYS_DIFF} days)` : " (exact date match)"}${selected?._loaded && selected.mae != null ? ` — MAE ${selected.mae} ${selected.unit ?? ""}/day` : ""}`
                    : "Comparing historical predictions vs actual usage"}
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
                    className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer max-w-[160px]"
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
            ) : fuzzyLoading ? (
              <div className="flex items-center justify-center h-72 gap-2 text-slate-400">
                <Loader2 className="animate-spin text-orange-300" size={22} />
                <span className="text-sm">Finding nearest matches…</span>
              </div>
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
                    Predicted (daily avg)
                  </div>
                  {isFuzzy && (
                    <span className="text-xs text-slate-400">· Actual matched to nearest date within ±{MAX_DAYS_DIFF} days</span>
                  )}
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
                  Accuracy requires a forecast date that also has recorded actual sales on the same day.
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
                  <th className="px-6 py-3 font-semibold text-right">Bias</th>
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
                        onClick={() => setSelected(row)}
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

            {/* Bias guide */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-6 flex-wrap">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bias guide</p>
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
