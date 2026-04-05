"use client";
// Accuracy Report — compares predicted vs actual ingredient usage
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

/* ─── helpers ─── */
function computeAccuracy(actualData, trendData) {
  // Build actual map: date → actual_usage
  const actualMap = {};
  (actualData || []).forEach((d) => { actualMap[d.date] = d.actual_usage; });

  // type-1 rows = daily prediction history (one row per forecasted date)
  const predPoints = (trendData?.data || [])
    .filter((d) => d.prediction_type === 1 && d.expected_usage != null)
    .map((d) => ({
      date:      (d.timestamp || "").split(" ")[0],
      predicted: d.expected_usage,
    }));

  // Join on date — only keep rows where BOTH historical prediction AND actual exist
  const merged = predPoints
    .map((d) => ({ ...d, actual: actualMap[d.date] ?? null }))
    .filter((d) => d.actual !== null && d.actual > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (merged.length === 0) {
    return { accuracy: null, mae: null, bias: null, days: 0, chartData: [], safeCount: 0, riskCount: 0 };
  }

  // Asymmetric accuracy (restaurant logic):
  //   predicted >= actual → 100% (over-prepared is safe — stock left over, no shortfall)
  //   predicted <  actual → predicted/actual × 100 (under-prepared is an error — risk of running out)
  const dailyAcc = merged.map((d) =>
    d.predicted >= d.actual ? 100 : Math.max(0, (d.predicted / d.actual) * 100)
  );

  const absErrors = merged.map((d) => Math.abs(d.actual - d.predicted));
  const biasArr   = merged.map((d) => d.predicted - d.actual);
  const safeCount = merged.filter((d) => d.predicted >= d.actual).length;
  const riskCount = merged.length - safeCount;

  const accuracy = dailyAcc.reduce((a, b) => a + b, 0) / merged.length;
  const mae      = absErrors.reduce((a, b) => a + b, 0) / merged.length;
  const bias     = biasArr.reduce((a, b) => a + b, 0) / merged.length;

  // Attach surplus field (positive = over-predicted/safe, negative = shortfall/risk)
  const chartData = merged.map((d) => ({ ...d, surplus: parseFloat((d.predicted - d.actual).toFixed(2)) }));

  return {
    accuracy:   parseFloat(Math.min(100, accuracy).toFixed(2)),
    mae:        parseFloat(mae.toFixed(2)),
    bias:       parseFloat(bias.toFixed(2)),
    days:       merged.length,
    safeCount,
    riskCount,
    chartData,
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
  const isSafe = d?.surplus != null ? d.surplus >= 0 : null;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgb(0 0 0/0.10)", border: "1px solid #e2e8f0", minWidth: 190 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px 0" }}>{label}</p>
      {d?.actual != null && (
        <p style={{ fontSize: 13, color: "#10b981", margin: "3px 0 0 0" }}>Actual usage: <b>{d.actual.toFixed(1)}</b> {unit}</p>
      )}
      {d?.predicted != null && (
        <p style={{ fontSize: 13, color: "#f97316", margin: "3px 0 0 0" }}>Predicted: <b>{d.predicted.toFixed(1)}</b> {unit}</p>
      )}
      {d?.surplus != null && (
        <p style={{
          fontSize: 11,
          color: isSafe ? "#10b981" : "#ef4444",
          fontWeight: 600,
          margin: "5px 0 0 0",
          borderTop: "1px solid #f1f5f9",
          paddingTop: 4,
        }}>
          {isSafe
            ? `Surplus: +${Math.abs(d.surplus).toFixed(1)} ${unit} — safe`
            : `Shortfall: −${Math.abs(d.surplus).toFixed(1)} ${unit} — risk of running out`}
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
  const [setChartData, setSetChartData]       = useState([]);
  const [setChartLoading, setSetChartLoading] = useState(false);

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

  /* load per-date chart data whenever selected ingredient changes
     Strategy: take the last 14 predict_sets, flatten all daily predictions
     into a date-keyed map (latest set wins per date), then merge with all
     actual sales → produces a time-series of {date, predicted, actual}
     suitable for a two-line crossing chart like the report page. */
  useEffect(() => {
    if (!selected?.ingredient_id) return;
    let cancelled = false;

    const loadSetChart = async () => {
      setSetChartLoading(true);
      setSetChartData([]);
      try {
        const [setsRes, actualRes] = await Promise.all([
          PredictAPI.sets(selected.ingredient_id),
          PredictAPI.actual(selected.ingredient_id),
        ]);

        // API returns descending — take 14 most recent, reverse to chronological
        const sets = (setsRes?.Data || []).slice(0, 14).reverse();
        const actualByDate = {};
        (actualRes?.Data || []).forEach((d) => { actualByDate[d.date] = d.actual_usage; });

        if (!sets.length || cancelled) { setSetChartData([]); return; }

        // Fetch all set forecasts in parallel
        const forecasts = await Promise.all(
          sets.map((s) =>
            PredictAPI.dailyForecast(selected.ingredient_id, s.predict_set_id)
              .catch(() => ({ Data: [] }))
          )
        );
        if (cancelled) return;

        // Flatten: date → predicted (later sets overwrite earlier ones for same date)
        const predictedByDate = {};
        sets.forEach((_, i) => {
          (forecasts[i]?.Data || []).forEach((d) => {
            if (d.date && d.mean_demand != null) {
              predictedByDate[d.date] = d.mean_demand;
            }
          });
        });

        // Union of all dates (predicted ∪ actual), sorted chronologically
        const allDates = [...new Set([
          ...Object.keys(predictedByDate),
          ...Object.keys(actualByDate),
        ])].sort();

        const points = allDates.map((date) => ({
          date,
          predicted: predictedByDate[date] != null ? parseFloat(predictedByDate[date].toFixed(2)) : null,
          actual:    actualByDate[date]    != null ? parseFloat(actualByDate[date].toFixed(2))    : null,
          surplus:   predictedByDate[date] != null && actualByDate[date] != null
            ? parseFloat((predictedByDate[date] - actualByDate[date]).toFixed(2))
            : null,
        }));

        if (!cancelled) setSetChartData(points);
      } catch { /* silent */ } finally {
        if (!cancelled) setSetChartLoading(false);
      }
    };

    loadSetChart();
    return () => { cancelled = true; };
  }, [selected?.ingredient_id]);

  /* summary stats computed from loaded ingredients */
  const summary = useMemo(() => {
    const loaded = ingredients.filter((i) => i._loaded && i.accuracy !== null);
    if (loaded.length === 0) return null;
    const avgAcc    = loaded.reduce((s, i) => s + i.accuracy, 0) / loaded.length;
    const avgMae    = loaded.reduce((s, i) => s + i.mae, 0) / loaded.length;
    const totalDays = loaded.reduce((s, i) => s + i.days, 0);
    const best      = [...loaded].sort((a, b) => b.accuracy - a.accuracy)[0];
    // count ingredients that are mostly safe (bias >= 0) vs at risk (bias < 0)
    const safeIngredients = loaded.filter((i) => i.bias >= 0).length;
    const riskIngredients = loaded.filter((i) => i.bias <  0).length;
    return { avgAcc, avgMae: parseFloat(avgMae.toFixed(2)), totalDays, best, safeIngredients, riskIngredients, totalLoaded: loaded.length };
  }, [ingredients]);

  const filtered = useMemo(() =>
    ingredients.filter((i) =>
      (i.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    ), [ingredients, searchQuery]);

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
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Target size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Accuracy Report</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Compare predicted vs. actual ingredient usage — over-prediction is safe, under-prediction is a risk</p>
                  </div>
                </div>
              </div>

              {/* Context banner */}
              <div className="flex items-center gap-4 mb-5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <CheckCircle size={11} /> Predicted ≥ Actual = 100% — over-prepared is safe
                </span>
                <div className="h-4 w-px bg-slate-200" />
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                  <AlertTriangle size={11} /> Predicted &lt; Actual = Error — risk of running short
                </span>
                <span className="text-xs text-slate-400 ml-auto">Surplus stock is acceptable. Stockout is not.</span>
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
                        <p className="text-xs text-emerald-500 font-medium mt-0.5">avg across {summary.totalLoaded} ingredients</p>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-emerald-300" />
                        <span className="text-xs text-emerald-300">computing…</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Safe vs At-risk */}
                <div className="border border-slate-100 rounded-xl p-4 flex items-center gap-4 flex-1 bg-white">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Activity size={18} className="text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Ingredient Status</p>
                    {summary ? (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm font-bold text-emerald-600">{summary.safeIngredients} safe</span>
                        <span className="text-slate-300">/</span>
                        <span className={`text-sm font-bold ${summary.riskIngredients > 0 ? "text-red-500" : "text-slate-400"}`}>{summary.riskIngredients} at risk</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-slate-300" />
                        <span className="text-xs text-slate-300">computing…</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 font-medium mt-0.5">by avg prediction direction</p>
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
                    {selected ? `${selected.ingredient_name} — Forecast History` : "Select an ingredient"}
                  </h3>
                  {selected?._loaded && <AccuracyBadge acc={selected.accuracy} />}
                  {setChartLoading && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 size={11} className="animate-spin" /> loading runs…
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {setChartData.length > 0
                    ? `${setChartData.length} days · last 14 forecast runs merged — actual vs predicted over time`
                    : "Actual vs predicted daily usage across the last 14 forecast runs"}
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
            ) : setChartLoading ? (
              <div className="flex items-center justify-center h-72 gap-2 text-slate-400">
                <Loader2 className="animate-spin text-orange-300" size={22} />
                <span className="text-sm">Loading forecast history…</span>
              </div>
            ) : setChartData.length > 0 ? (
              <>
                <div className="h-80 px-2 pt-4 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={setChartData} margin={{ top: 10, right: 28, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.max(0, Math.ceil(setChartData.length / 8) - 1)}
                        tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip unit={selected?.unit ?? ""} />} />

                      {/* Actual usage — emerald solid line */}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={setChartData.length <= 14
                          ? { r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }
                          : false}
                        activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
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
                        dot={setChartData.length <= 14
                          ? { r: 4, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }
                          : false}
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
                    Predicted
                  </div>
                  <span className="text-xs text-slate-400">
                    · Predicted above actual = safe &nbsp;·&nbsp; Predicted below actual = risk
                  </span>
                  {selected?.accuracy != null && (
                    <div className="ml-auto">
                      <AccuracyBadge acc={selected.accuracy} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-72 text-slate-400 gap-2">
                <BarChart3 className="text-slate-200" size={36} />
                <p className="text-sm font-medium text-slate-500">No forecast runs found</p>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  Generate a prediction first, then come back after recording sales on those dates.
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
                    return (
                      <tr
                        key={row.ingredient_id}
                        onClick={() => setSelected(row)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-orange-50" : "hover:bg-slate-50/60"}`}
                      >
                        {/* Ingredient name */}
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

                        {/* Accuracy badge */}
                        <td className="px-6 py-3 text-center">
                          {!row._loaded ? (
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-300">
                              <Loader2 size={11} className="animate-spin" /> computing
                            </div>
                          ) : (
                            <AccuracyBadge acc={row.accuracy} />
                          )}
                        </td>

                        {/* MAE */}
                        <td className="px-6 py-3 text-right text-sm font-medium text-slate-700">
                          {!row._loaded ? (
                            <span className="text-slate-200">—</span>
                          ) : row.mae !== null ? (
                            <span>{row.mae} {row.unit}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Bias */}
                        <td className="px-6 py-3 text-right text-sm">
                          {!row._loaded ? (
                            <span className="text-slate-200">—</span>
                          ) : row.bias !== null ? (
                            <span className={row.bias > 0.5 ? "text-emerald-600 font-semibold" : row.bias < -0.5 ? "text-red-500 font-semibold" : "text-slate-400"}>
                              {row.bias > 0 ? "+" : ""}{row.bias}
                              {row.bias > 0.5 ? " ↑" : row.bias < -0.5 ? " ↓" : ""}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Days */}
                        <td className="px-6 py-3 text-right text-sm text-slate-500">
                          {row._loaded ? row.days : <span className="text-slate-200">—</span>}
                        </td>

                        {/* Unit */}
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

            {/* Legend for Bias */}
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
