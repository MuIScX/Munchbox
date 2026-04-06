"use client";
import { useState, useEffect, useMemo, useCallback, useRef, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { PredictAPI, IngredientAPI } from "../../lib/api";
import { CATEGORY_MAP } from "../../lib/schema";
import {
  Search, Loader2, TrendingUp, X, Plus,
  Package, BarChart2, Clock, AlertTriangle, CheckCircle, RefreshCw, ClipboardList, ArrowUpDown, Calendar,
} from "lucide-react";
import CategorySortPopover from "../components/CategorySortPopover";

const DateInput = forwardRef(({ value, onClick }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
  >
    {value}
    <Calendar size={11} className="text-slate-400 shrink-0" />
  </button>
));
DateInput.displayName = "DateInput";

export default function PredictPage() {
  const [report, setReport]                       = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [generating, setGenerating]               = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [trendData, setTrendData]                 = useState([]);
  const [dailyForecast, setDailyForecast]         = useState([]);
  const [trendLoading, setTrendLoading]           = useState(false);
  const [predictSets, setPredictSets]             = useState([]);
  const [selectedSetId, setSelectedSetId]         = useState(null);
  const [sliceStart, setSliceStart]               = useState(null);
  const [sliceEnd, setSliceEnd]                   = useState(null);

  // The selected set's full date range
  const selectedSet = useMemo(() => predictSets.find((s) => s.predict_set_id === selectedSetId) ?? null, [predictSets, selectedSetId]);

  // Effective display window: use slice if set, else full set range
  const displayStart = sliceStart ?? selectedSet?.start_date ?? null;
  const displayEnd   = sliceEnd   ?? selectedSet?.end_date   ?? null;

  // forecastDays = number of days in the display window
  const forecastDays = useMemo(() => {
    if (displayStart && displayEnd) {
      const days = Math.round((new Date(displayEnd) - new Date(displayStart)) / 86400000) + 1;
      return days > 0 ? days : 1;
    }
    return dailyForecast.length || 7;
  }, [displayStart, displayEnd, dailyForecast.length]);
  const [searchQuery, setSearchQuery]             = useState("");
  const [showSuggestions, setShowSuggestions]     = useState(false);
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
  const [sortBy, setSortBy]             = useState("urgency");
  const [showSortPopover, setShowSortPopover] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("inventory_category_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        const allKeys = Object.keys(CATEGORY_MAP);
        return [...parsed.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !parsed.includes(k))];
      }
    } catch {}
    return Object.keys(CATEGORY_MAP);
  });
  const [prepSummaryOpen, setPrepSummaryOpen]     = useState(false);
  const [prepSortBy, setPrepSortBy]               = useState("urgency");
  const [showPrepSortPopover, setShowPrepSortPopover] = useState(false);
  const [prepSummaryData, setPrepSummaryData]     = useState([]);
  const [prepSummaryLoading, setPrepSummaryLoading] = useState(false);
  const [prepSummaryError, setPrepSummaryError]   = useState(null);
  const [prepSearch, setPrepSearch]               = useState("");
  const [prepStart, setPrepStart]                 = useState(() => new Date(Date.now() + 1 * 86400000));
  const [prepEnd, setPrepEnd]                     = useState(() => new Date(Date.now() + 7 * 86400000));

  const toDateStr = (d) => d
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
    : null;

  const fetchPrepSummary = useCallback(async (start, end) => {
    try {
      setPrepSummaryLoading(true);
      setPrepSummaryError(null);
      const res = await PredictAPI.prepSummary(toDateStr(start), toDateStr(end));
      setPrepSummaryData(Array.isArray(res?.Data) ? res.Data : []);
    } catch (err) {
      setPrepSummaryError(err.message || "Failed to load prep summary");
      setPrepSummaryData([]);
    } finally {
      setPrepSummaryLoading(false);
    }
  }, []);
  const [graphFilters, setGraphFilters] = useState({
    zoneColors:      true,
    reorderLine:     true,
    futureForecast:  true,
    suggestionRange: true,
    dailyTargetAvg:  true,
  });
  const showToast = (type, message) => setToast({ type, message });

  // ── Fetch forecast for a specific predict_set ──
  const fetchForecastForSet = useCallback(async (ingredient_id, set_id) => {
    const res = await PredictAPI.dailyForecast(ingredient_id, set_id);
    setDailyForecast(res?.Data || []);
  }, []);

  // ── Fetch trend — loads sets list and latest forecast ──
  const fetchTrend = useCallback(async (ingredient_id) => {
    try {
      setTrendLoading(true);
      setTrendData([]);
      setDailyForecast([]);
      setPredictSets([]);
      setSelectedSetId(null);

      const [trendRes, actualRes, forecastRes, setsRes] = await Promise.all([
        PredictAPI.trend(ingredient_id),
        PredictAPI.actual(ingredient_id),
        PredictAPI.dailyForecast(ingredient_id, null),
        PredictAPI.sets(ingredient_id),
      ]);

      const trendRaw  = trendRes?.Data?.data || [];
      const actualRaw = actualRes?.Data      || [];
      setDailyForecast(forecastRes?.Data     || []);

      const sets = setsRes?.Data || [];
      setPredictSets(sets);
      if (sets.length > 0) setSelectedSetId(sets[0].predict_set_id);

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
      setPredictSets([]);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  // ── Fetch report — preserves selected ingredient ──
  const fetchReport = useCallback(async (days) => {
    try {
      setLoading(true);
      const res  = await PredictAPI.report(days);
      const data = Array.isArray(res?.Data) ? res.Data.map(r => ({ ...r, hasPrediction: true })) : [];
      setReport(data);

      if (data.length > 0) {
        setSelectedIngredient((prev) => {
          const keep = prev?.hasPrediction ? data.find((r) => r.ingredient_id === prev.ingredient_id) : null;
          const next = keep ?? data[0];
          fetchTrend(next.ingredient_id);
          return next;
        });
      }
    } catch {
      showToast("error", "Failed to load prediction data.");
    } finally {
      setLoading(false);
    }
  }, [fetchTrend]);

  const fetchReportRef = useRef(fetchReport);
  useEffect(() => { fetchReportRef.current = fetchReport; }, [fetchReport]);

  useEffect(() => {
    fetchReportRef.current(null);
    IngredientAPI.list({}).then((res) => {
      const list = Array.isArray(res?.Data) ? res.Data : [];
      setIngredientList(list);
      if (list.length > 0) setRequestForm((f) => ({ ...f, ingredient_id: String(list[0].id) }));
    }).catch(() => {});

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchReportRef.current(null);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleSelectIngredient = (ing) => {
    setSelectedIngredient(ing);
    if (ing.hasPrediction) {
      fetchTrend(ing.ingredient_id);
    } else {
      setTrendData([]);
      setDailyForecast([]);
      setPredictSets([]);
      setSelectedSetId(null);
    }
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
      if (total > 0) {
        showToast("success", `Generated forecasts for ${total} ingredient(s).`);
        setSliceStart(requestForm.start_date);
        setSliceEnd(requestForm.end_date);
      } else if (errors.length) showToast("error", `Model failed: ${errors[0]?.error || "unknown error"}`);
      else                   showToast("error", "No forecasts generated.");
      await fetchReport(null);
    } catch (err) {
      showToast("error", err.message || "Failed to generate prediction.");
    } finally {
      setGenerating(false);
    }
  };

const mergedList = useMemo(() => {
  const reportMap = new Map(report.map(r => [r.ingredient_id, r]));
  return ingredientList.map(ing => {
    const predicted = reportMap.get(ing.id);
    if (predicted) return { ...predicted, hasPrediction: true };
    return {
      ingredient_id: ing.id,
      ingredient_name: ing.ingredient_name,
      unit: ing.unit || "",
      category: ing.category ?? "",
      hasPrediction: false,
    };
  });
}, [ingredientList, report]);

const filteredReport = useMemo(() => {
  return mergedList
    .filter((r) => {
      const nameMatch   = (r.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      // Status filter only applies to items with prediction data; no-prediction items only show under "All"
      if (!r.hasPrediction) return nameMatch && statusFilter === "All";
      const statusMatch = statusFilter === "All" || (statusFilter === "OK" ? r.status === 1 : r.status === 0);
      return nameMatch && statusMatch;
    })
    .sort((a, b) => {
      // Items without prediction always go to the bottom
      if (a.hasPrediction !== b.hasPrediction) return a.hasPrediction ? -1 : 1;
      if (sortBy === "urgency") {
        // Use urgency_score if available (higher = more urgent), else fall back to deficit
        const uA = a.urgency_score ?? null;
        const uB = b.urgency_score ?? null;
        if (uA !== null && uB !== null) return uB - uA;
        if (a.status !== b.status) return a.status - b.status;
        return (a.current_stock - a.expected_usage) - (b.current_stock - b.expected_usage);
      }
      if (sortBy === "category") {
        const ai = categoryOrder.indexOf(String(a.category));
        const bi = categoryOrder.indexOf(String(b.category));
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }
      return 0;
    });
}, [mergedList, searchQuery, statusFilter, sortBy, categoryOrder]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Reorder point = 3 days of daily avg usage (safety buffer)
  const reorderPoint = useMemo(() => {
    if (!selectedIngredient?.daily_target_average) return 0;
    return Math.ceil(selectedIngredient.daily_target_average * 3);
  }, [selectedIngredient]);

  // Stock depletion chart data
  const stockDepletionData = useMemo(() => {
    if (!selectedIngredient || !dailyForecast.length) return [];
    const current  = selectedIngredient.current_stock;
    const dailyAvg = selectedIngredient.daily_target_average ?? 0;

    // Filter to display window by date range
    const windowStart = displayStart ?? dailyForecast[0]?.date;
    const windowEnd   = displayEnd   ?? dailyForecast[dailyForecast.length - 1]?.date;

    // Pre-period: days before display window — subtract to estimate stock at windowStart
    let stock = current;
    dailyForecast
      .filter((d) => d.date > todayStr && d.date < windowStart)
      .forEach((d) => { stock = Math.max(0, stock - (d.mean_demand ?? dailyAvg)); });

    // Display window
    const windowDays = dailyForecast.filter((d) => d.date >= windowStart && d.date <= windowEnd);
    const anchorDate = windowDays[0]?.date ?? windowStart;
    const points = [{ date: anchorDate, stock_left: parseFloat(stock.toFixed(2)) }];

    windowDays.forEach((day) => {
      stock = Math.max(0, stock - (day.mean_demand ?? dailyAvg));
      points.push({ date: day.date, stock_left: parseFloat(stock.toFixed(2)) });
    });

    return points;
  }, [dailyForecast, selectedIngredient, displayStart, displayEnd, todayStr]);

  const yMaxDepletion = useMemo(() => {
    if (!stockDepletionData.length) return 100;
    return Math.ceil(Math.max(...stockDepletionData.map((d) => d.stock_left)) * 1.15) || 100;
  }, [stockDepletionData]);

  // Point where stock first crosses the reorder line — use the last point still above it
  // Skip index 0 (anchor point) so we don't mark the start as reorder
  const reorderCrossPoint = useMemo(() => {
    if (!reorderPoint) return null;
    const idx = stockDepletionData.findIndex((d, i) => i > 0 && d.stock_left <= reorderPoint);
    if (idx <= 0) return null;
    return stockDepletionData[idx - 1];
  }, [stockDepletionData, reorderPoint]);

  // Date when stock hits zero (skip anchor at index 0)
  const stockoutDate = useMemo(() => {
    return stockDepletionData.find((d, i) => i > 0 && d.stock_left <= 0)?.date ?? null;
  }, [stockDepletionData]);

  const surplus = selectedIngredient
    ? (selectedIngredient.current_stock - Math.ceil(selectedIngredient.expected_usage)).toFixed(1)
    : 0;

  // ── Forecast chart data (top chart — forecast only, no actual) ──
  const forecastChartData = useMemo(() => {
    const dailyAvg    = selectedIngredient?.daily_target_average ?? null;
    const windowStart = displayStart ?? dailyForecast[0]?.date;
    const windowEnd   = displayEnd   ?? dailyForecast[dailyForecast.length - 1]?.date;
    return dailyForecast
      .filter((d) => d.date >= windowStart && d.date <= windowEnd)
      .map((d) => ({
        date:       d.date,
        forecast:   d.mean_demand != null ? d.mean_demand : null,
        band_low:   d.low_bound  ?? null,
        band_range: (d.high_bound != null && d.low_bound != null)
                      ? Math.max(0, d.high_bound - d.low_bound) : null,
        daily_avg:  dailyAvg,
      }));
  }, [dailyForecast, displayStart, displayEnd, selectedIngredient]);

  const hasForecastLine    = graphFilters.futureForecast  && forecastChartData.some((d) => d.forecast != null);
  const hasForecastBand    = graphFilters.suggestionRange && forecastChartData.some((d) => d.band_range != null);

  const yForecastMax = useMemo(() => {
    const maxBand = Math.max(0, ...forecastChartData.map((d) => (d.band_low ?? 0) + (d.band_range ?? 0)));
    const maxLine = Math.max(0, ...forecastChartData.map((d) => d.forecast ?? 0));
    return Math.ceil(Math.max(maxBand, maxLine) * 1.2) || 10;
  }, [forecastChartData]);

  const fmtDate = (str) => {
    if (!str) return "";
    const d = new Date(str);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const depletionDateRange = useMemo(() => {
    if (!stockDepletionData.length) return null;
    return { start: stockDepletionData[0].date, end: stockDepletionData[stockDepletionData.length - 1].date };
  }, [stockDepletionData]);

  const forecastDateRange = useMemo(() => {
    if (!forecastChartData.length) return null;
    return { start: forecastChartData[0].date, end: forecastChartData[forecastChartData.length - 1].date };
  }, [forecastChartData]);

  // ── Tooltips ──
  const ForecastTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const [y,m,day] = (label || "").split("-");
    const dateStr = label ? `${day.padStart(2,"0")}/${m.padStart(2,"0")}/${y}` : label;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 min-w-[180px]">
        <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
          {dateStr}
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-500">Forecast</span>
        </p>
        {d?.forecast != null && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-slate-500">Est. demand</span>
            <span className="ml-auto font-bold text-slate-700">{d.forecast.toFixed(1)} {selectedIngredient?.unit}</span>
          </div>
        )}
        {d?.daily_avg != null && (
          <div className="flex items-center gap-2 text-sm mt-1">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-slate-500">Daily avg</span>
            <span className="ml-auto font-bold text-slate-700">{d.daily_avg} {selectedIngredient?.unit}</span>
          </div>
        )}
      </div>
    );
  };

  const DepletionTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const isLow = d?.stock_left != null && d.stock_left <= reorderPoint;
    const isToday = label === todayStr;
    const [y,m,day] = (label || "").split("-");
    const dateStr = label ? `${day.padStart(2,"0")}/${m.padStart(2,"0")}/${y}` : label;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 min-w-[190px]">
        <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
          {dateStr}
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-500">
            {isToday ? "Today" : "Projected"}
          </span>
        </p>
        {d?.stock_left != null && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-500">Stock left</span>
            <span className={`ml-auto font-bold ${isLow ? "text-red-500" : "text-slate-700"}`}>
              {d.stock_left} {selectedIngredient?.unit}
            </span>
          </div>
        )}
        {isLow && (
          <div className="mt-2 pt-2 border-t border-red-100 text-[11px] text-red-500 font-semibold flex items-center gap-1">
            ⚠ Below reorder point ({reorderPoint} {selectedIngredient?.unit})
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
                onClick={() => { setPrepSummaryOpen(true); fetchPrepSummary(prepStart, prepEnd); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
              >
                <ClipboardList size={13} />
                Prep Summary
              </button>
              <button
                onClick={() => fetchReport(null)}
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
              {/* Search with dropdown */}
              <div className="relative">
                <div className="flex items-center gap-2 border-2 border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:border-orange-400 transition">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search ingredient…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                    className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setShowSuggestions(false); }} className="text-slate-300 hover:text-slate-500 shrink-0">
                      <X size={11} />
                    </button>
                  )}
                </div>
                {showSuggestions && searchQuery && (() => {
                  const suggestions = mergedList
                    .filter(ing => (ing.ingredient_name || "").toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice(0, 6);
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      {suggestions.map(ing => (
                        <button
                          key={ing.ingredient_id}
                          onMouseDown={(e) => { e.preventDefault(); handleSelectIngredient(ing); setSearchQuery(ing.ingredient_name); setShowSuggestions(false); }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-600 font-medium transition-colors flex items-center gap-2"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ing.hasPrediction ? (ing.status === 0 ? "bg-red-400" : "bg-emerald-400") : "bg-slate-300"}`} />
                          {ing.ingredient_name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
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

              {/* Sort */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm flex-1">
                  <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="urgency">Top Urgency</option>
                    <option value="category">Category</option>
                  </select>
                </div>
                {sortBy === "category" && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowSortPopover(v => !v)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                        showSortPopover ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <ArrowUpDown size={11} /> Order
                    </button>
                    <CategorySortPopover
                      isOpen={showSortPopover}
                      onClose={() => setShowSortPopover(false)}
                      categoryOrder={categoryOrder}
                      onChange={(newOrder) => {
                        setCategoryOrder(newOrder);
                        localStorage.setItem("inventory_category_order", JSON.stringify(newOrder));
                      }}
                      categoryMap={CATEGORY_MAP}
                    />
                  </div>
                )}
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
                ) : (() => {
                  const renderCard = (ing) => {
                    const isSelected = selectedIngredient?.ingredient_id === ing.ingredient_id;

                    if (!ing.hasPrediction) {
                      return (
                        <button
                          key={ing.ingredient_id}
                          onClick={() => handleSelectIngredient(ing)}
                          className={`w-full text-left rounded-xl border p-3 transition-all opacity-50 ${
                            isSelected
                              ? "bg-slate-100 border-slate-300 shadow-sm"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300" />
                            <span className="font-semibold text-sm truncate flex-1 text-slate-400">
                              {ing.ingredient_name}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-300 pl-3.5">Last updated: —</p>
                        </button>
                      );
                    }

                    const isLow = ing.status === 0;
                    const setDays = (ing.forecast_start && ing.forecast_end)
                      ? Math.round((new Date(ing.forecast_end) - new Date(ing.forecast_start)) / 86400000) + 1
                      : null;
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
                        <div className="flex items-center gap-2 mb-0.5">
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
                        <p className="text-[9px] text-slate-400 mb-2">
                          Last updated: {ing.forecast_start && ing.forecast_end
                            ? `${new Date(ing.forecast_start).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} - ${new Date(ing.forecast_end).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}`
                            : "—"}
                        </p>
                        <div className="grid grid-cols-2 gap-x-2">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">Current Stock</p>
                            <p className="text-xs font-bold text-slate-600">{ing.current_stock} <span className="font-normal text-slate-400 text-[10px]">{ing.unit}</span></p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide font-medium">Est. {setDays ?? "?"}d</p>
                            <p className="text-xs font-bold text-slate-600">{Math.ceil(ing.expected_usage)} <span className="font-normal text-slate-400 text-[10px]">{ing.unit}</span></p>
                          </div>
                        </div>
                      </button>
                    );
                  };

                  if (sortBy === "category") {
                    const noPredictionItems = filteredReport.filter(ing => !ing.hasPrediction);
                    return [
                      ...categoryOrder.map((catId) => {
                        const items = filteredReport
                          .filter(ing => ing.hasPrediction && String(ing.category) === catId)
                          .sort((a, b) => {
                            const uA = a.urgency_score ?? null;
                            const uB = b.urgency_score ?? null;
                            if (uA !== null && uB !== null) return uB - uA;
                            if (a.status !== b.status) return a.status - b.status;
                            return (a.current_stock - a.expected_usage) - (b.current_stock - b.expected_usage);
                          });
                        if (items.length === 0) return null;
                        return (
                          <div key={catId} className="flex flex-col gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 pb-1 border-b border-orange-100">
                              {CATEGORY_MAP[catId] || catId}
                            </p>
                            {items.map(renderCard)}
                          </div>
                        );
                      }),
                      noPredictionItems.length > 0 && (
                        <div key="__no_prediction__" className="flex flex-col gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pb-1 border-b border-slate-100">
                            No Prediction Data
                          </p>
                          {noPredictionItems.map(renderCard)}
                        </div>
                      ),
                    ];
                  }

                  const predictedItems    = filteredReport.filter(ing => ing.hasPrediction);
                  const noPredictionItems = filteredReport.filter(ing => !ing.hasPrediction);
                  return [
                    predictedItems.length > 0 && (
                      <div key="__predicted__" className="flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 pb-1 border-b border-orange-100">
                          Predicted
                        </p>
                        {predictedItems.map(renderCard)}
                      </div>
                    ),
                    noPredictionItems.length > 0 && (
                      <div key="__no_prediction__" className="flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pb-1 border-b border-slate-100">
                          No Prediction Data
                        </p>
                        {noPredictionItems.map(renderCard)}
                      </div>
                    ),
                  ];
                })()}
              </div>
            </div>

            {/* ── Right panel: stats + chart ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">

              {/* No prediction placeholder */}
              {selectedIngredient && !selectedIngredient.hasPrediction && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
                  <BarChart2 size={36} className="text-slate-300" />
                  <p className="text-base font-semibold text-slate-500">{selectedIngredient.ingredient_name}</p>
                  <p className="text-sm text-slate-400">No prediction data available.</p>
                  <p className="text-xs text-slate-300">Generate a forecast to see predictions for this ingredient.</p>
                </div>
              )}

              {/* Stat cards */}
              {selectedIngredient && selectedIngredient.hasPrediction && (
                <div className="grid grid-cols-4 gap-3 shrink-0">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Current Stock</p>
                      <p className="text-xl font-bold text-slate-700 leading-tight">{selectedIngredient.current_stock}</p>
                      <p className="text-[10px] text-slate-400">{selectedIngredient.unit}</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <BarChart2 size={14} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-orange-500 font-bold uppercase tracking-wide">Estimate {forecastDays} day</p>
                      <p className="text-xl font-bold text-orange-900 leading-tight">{Math.ceil(selectedIngredient.expected_usage)}</p>
                      <p className="text-[10px] text-orange-400">{selectedIngredient.unit}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wide">Average / Day</p>
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

              {/* ── Charts: only shown when ingredient has prediction data ── */}
              {(!selectedIngredient || selectedIngredient.hasPrediction) && <>

              {/* ── TOP CHART: Demand Forecast ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-700 text-sm truncate">
                      {selectedIngredient ? `${selectedIngredient.ingredient_name} — Demand Forecast` : "Select an ingredient"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {forecastDateRange
                        ? <><span className="font-medium text-slate-500">{fmtDate(forecastDateRange.start)} – {fmtDate(forecastDateRange.end)}</span> · {forecastChartData.length} day forecast</>
                        : "Predicted demand per day for the selected window"}
                    </p>
                  </div>
                  {/* Prediction set selector */}
                  {predictSets.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0 h-[30px]">
                      <span className="text-[10px] text-slate-400 font-medium">Forecast set</span>
                      <span className="text-slate-200 text-xs">|</span>
                      <select
                        value={selectedSetId ?? ""}
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          setSelectedSetId(id);
                          setSliceStart(null);
                          setSliceEnd(null);
                          if (selectedIngredient) fetchForecastForSet(selectedIngredient.ingredient_id, id);
                        }}
                        className="text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
                      >
                        {predictSets.map((s) => {
                          const fmt = (d) => { if (!d) return "?"; const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
                          return (
                            <option key={s.predict_set_id} value={s.predict_set_id}>
                              {fmt(s.start_date)} – {fmt(s.end_date)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  {selectedSet && (() => {
                    const toDate = (s) => s ? new Date(s) : null;
                    const toStr  = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : null;
                    const minDate = toDate(selectedSet.start_date);
                    const maxDate = toDate(selectedSet.end_date);
                    return (
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0 h-[30px]">
                        <span className="text-[10px] text-slate-400 font-medium">Range</span>
                        <span className="text-slate-200 text-xs">|</span>
                        <DatePicker
                          selected={toDate(sliceStart ?? selectedSet.start_date)}
                          onChange={(d) => setSliceStart(toStr(d))}
                          minDate={minDate}
                          maxDate={toDate(sliceEnd ?? selectedSet.end_date)}
                          dateFormat="dd/MM/yyyy"
                          customInput={<DateInput />}
                        />
                        <span className="text-slate-300 text-xs">–</span>
                        <DatePicker
                          selected={toDate(sliceEnd ?? selectedSet.end_date)}
                          onChange={(d) => setSliceEnd(toStr(d))}
                          minDate={toDate(sliceStart ?? selectedSet.start_date)}
                          maxDate={maxDate}
                          dateFormat="dd/MM/yyyy"
                          customInput={<DateInput />}
                        />
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">Model</span>
                    <span className="text-slate-200 text-xs">|</span>
                    <select value={requestForm.strategy} onChange={(e) => setRequestForm((f) => ({ ...f, strategy: e.target.value }))} className="text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer">
                      <option value="1">Conservative</option>
                      <option value="2">Balanced</option>
                      <option value="3">Aggressive</option>
                    </select>
                  </div>
                  {selectedIngredient && (
                    selectedIngredient.status === 1
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0"><CheckCircle size={11} /> Stock OK</span>
                      : <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg shrink-0"><AlertTriangle size={11} /> Reorder</span>
                  )}
                </div>

                {/* Toggles */}
                <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
                  {[
                    { key: "futureForecast",  label: "Forecast",   color: "#6366f1" },
                    { key: "suggestionRange", label: "Range band", color: "#6366f1", opacity: 0.25 },
                    { key: "dailyTargetAvg",  label: "Daily avg",  color: "#f97316", dashed: true },
                  ].map(({ key, label, color, opacity, dashed }) => (
                    <button key={key} onClick={() => setGraphFilters((f) => ({ ...f, [key]: !f[key] }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${graphFilters[key] ? "bg-white border-slate-300 text-slate-700 shadow-sm" : "border-transparent text-slate-400 hover:text-slate-500"}`}>
                      {dashed
                        ? <svg width="14" height="8" className={!graphFilters[key] ? "opacity-40" : ""}><line x1="0" y1="4" x2="14" y2="4" stroke={color} strokeWidth="2" strokeDasharray="3 2" /></svg>
                        : <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, opacity: graphFilters[key] ? (opacity ?? 1) : 0.3 }} />
                      }
                      {label}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                {trendLoading ? (
                  <div className="flex items-center justify-center h-56 gap-3">
                    <Loader2 className="animate-spin text-orange-400" size={22} />
                    <p className="text-sm text-slate-400">Loading…</p>
                  </div>
                ) : forecastChartData.length > 0 ? (
                  <>
                    <div className="h-56 px-2 pt-3 pb-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChartData} margin={{ top: 8, right: 24, left: -16, bottom: 16 }}>
                          <defs>
                            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.14} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} padding={{ left: 10, right: 10 }} interval={forecastChartData.length <= 14 ? 0 : Math.ceil(forecastChartData.length / 8)} tickFormatter={(v) => { const [y,m,d] = v.split("-"); return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`; }} label={{ value: "Date →", position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, yForecastMax]} allowDataOverflow label={{ value: selectedIngredient?.unit ?? "Qty", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} />
                          <Tooltip content={<ForecastTooltip />} />
                          {hasForecastBand && <Area type="monotone" dataKey="band_low"   stackId="fb" stroke="none" fill="transparent" legendType="none" />}
                          {hasForecastBand && <Area type="monotone" dataKey="band_range" stackId="fb" stroke="none" fill="#6366f1" fillOpacity={0.10} legendType="none" />}
                          {hasForecastLine && (
                            <Area type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2.5} fill="url(#forecastGrad)" dot={{ r: 3, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }} connectNulls legendType="none" />
                          )}
                          {selectedIngredient?.daily_target_average != null && graphFilters.dailyTargetAvg && (
                            <Line type="monotone" dataKey="daily_avg" stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={false} connectNulls legendType="none" />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/30 flex items-center gap-5 text-xs text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#6366f1" strokeWidth="2.5" /></svg>Forecast demand</div>
                      <div className="flex items-center gap-1.5"><div className="w-8 h-3 rounded-sm bg-indigo-100 border border-indigo-200" />Range band</div>
                      <div className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>Daily avg</div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2">
                    <BarChart2 className="text-slate-200" size={28} />
                    <p className="text-sm">{selectedIngredient ? 'No data — click "New Prediction" to generate a forecast' : "Select an ingredient from the list"}</p>
                  </div>
                )}
              </div>

              {/* ── BOTTOM CHART: Stock Depletion ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-700 text-sm truncate">
                      {selectedIngredient ? `${selectedIngredient.ingredient_name} — Stock Depletion` : "Select an ingredient"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {depletionDateRange
                        ? <><span className="font-medium text-slate-500">{fmtDate(depletionDateRange.start)} – {fmtDate(depletionDateRange.end)}</span>{selectedIngredient?.daily_target_average != null ? ` · Avg: ${selectedIngredient.daily_target_average} ${selectedIngredient.unit}/day · Reorder: ${reorderPoint} ${selectedIngredient.unit}${stockoutDate ? ` · ⚠ Stockout ${fmtDate(stockoutDate)}` : ""}` : ""}</>
                        : "Stock level projection based on forecast usage"}
                    </p>
                  </div>
                </div>

                {/* Toggles */}
                <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
                  {[
                    { key: "zoneColors",  label: "Safe/Reorder zones", isZone: true, color: "#10b981" },
                    { key: "reorderLine", label: "Reorder line",        dashed: true, color: "#94a3b8" },
                  ].map(({ key, label, color, dashed, isZone }) => (
                    <button key={key} onClick={() => setGraphFilters((f) => ({ ...f, [key]: !f[key] }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${graphFilters[key] ? "bg-white border-slate-300 text-slate-700 shadow-sm" : "border-transparent text-slate-400 hover:text-slate-500"}`}>
                      {isZone
                        ? <div className={`w-3 h-3 rounded-sm shrink-0 border ${graphFilters[key] ? "bg-emerald-100 border-emerald-300" : "bg-slate-100 border-slate-200"}`} />
                        : <svg width="14" height="8" className={!graphFilters[key] ? "opacity-40" : ""}><line x1="0" y1="4" x2="14" y2="4" stroke={color} strokeWidth="2" strokeDasharray="3 2" /></svg>
                      }
                      {label}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                {trendLoading ? (
                  <div className="flex items-center justify-center h-56 gap-3">
                    <Loader2 className="animate-spin text-orange-400" size={22} />
                    <p className="text-sm text-slate-400">Loading…</p>
                  </div>
                ) : stockDepletionData.length > 0 ? (
                  <>
                    <div className="h-56 px-2 pt-3 pb-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={stockDepletionData} margin={{ top: 8, right: 24, left: -16, bottom: 16 }}>
                          <defs>
                            <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          {graphFilters.zoneColors && reorderPoint > 0 && (
                            <>
                              <ReferenceArea y1={reorderPoint} y2={yMaxDepletion} fill="#f0fdf4" fillOpacity={0.7} ifOverflow="visible" />
                              <ReferenceArea y1={0} y2={reorderPoint} fill="#fff1f2" fillOpacity={0.85} ifOverflow="visible" />
                            </>
                          )}
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} padding={{ left: 10, right: 10 }} interval={stockDepletionData.length <= 21 ? 1 : Math.ceil(stockDepletionData.length / 8)} tickFormatter={(v) => { const [y,m,d] = v.split("-"); return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`; }} label={{ value: "Date →", position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, yMaxDepletion]} allowDataOverflow label={{ value: selectedIngredient?.unit ?? "Qty", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} />
                          <Tooltip content={<DepletionTooltip />} />
                          {graphFilters.reorderLine && reorderPoint > 0 && (
                            <ReferenceLine y={reorderPoint} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 4"
                              label={{ value: `Reorder: ${reorderPoint} ${selectedIngredient?.unit ?? ""}`, fill: "#94a3b8", fontSize: 10, fontWeight: 600, position: "insideTopLeft" }} />
                          )}
                          {reorderCrossPoint && (
                            <ReferenceLine x={reorderCrossPoint.date} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 3"
                              label={{ value: "Reorder", fill: "#f97316", fontSize: 10, fontWeight: 700, position: "insideTopRight" }} />
                          )}
                          {stockoutDate && (
                            <ReferenceLine x={stockoutDate} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3"
                              label={{ value: "Stockout", fill: "#ef4444", fontSize: 10, fontWeight: 700, position: "insideTopRight" }} />
                          )}
                          <Area type="monotone" dataKey="stock_left" stroke="#3b82f6" strokeWidth={2.5} fill="url(#stockGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} connectNulls legendType="none" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/30 flex items-center gap-5 text-xs text-slate-500 flex-wrap">
                      <div className="flex items-center gap-1.5"><svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#3b82f6" strokeWidth="2.5" /></svg>Stock left</div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />Safe to use</div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" />Reorder soon</div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2">
                    <TrendingUp className="text-slate-200" size={28} />
                    <p className="text-sm">{selectedIngredient ? 'No data — click "New Prediction" to generate a forecast' : "Select an ingredient from the list"}</p>
                  </div>
                )}
              </div>

              </>}
            </div>
          </div>

        </div>
      </main>

      {/* ── Prep Summary Modal ── */}
      {prepSummaryOpen && (() => {
        const prepDays    = (prepStart && prepEnd)
          ? Math.round((prepEnd - prepStart) / 86400000) + 1
          : null;
        // An ingredient "has data" only if it covers every day in the requested range
        const withData    = prepSummaryData.filter((r) => r.has_data && (r.ingredient_name || "").toLowerCase().includes(prepSearch.toLowerCase())).sort((a, b) => {
          if (prepSortBy === "category") {
            const ai = categoryOrder.indexOf(String(a.category));
            const bi = categoryOrder.indexOf(String(b.category));
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          }
          // urgency: match main page — urgency_score desc, then status, then deficit
          const uA = a.urgency_score ?? null;
          const uB = b.urgency_score ?? null;
          if (uA !== null && uB !== null) return uB - uA;
          if (a.status !== b.status) return a.status - b.status;
          return (a.current_stock - a.expected_usage) - (b.current_stock - b.expected_usage);
        });
        const withoutData = prepSummaryData
          .filter((r) => !r.has_data)
          .filter((r) => (r.ingredient_name || "").toLowerCase().includes(prepSearch.toLowerCase()));

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[560px] h-[850px] max-h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <ClipboardList size={15} className="text-orange-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-slate-800">Preparation Summary</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {prepStart && prepEnd
                      ? `Ingredients needed for ${prepStart.getDate().toString().padStart(2,"0")}/${(prepStart.getMonth()+1).toString().padStart(2,"0")}/${prepStart.getFullYear()} – ${prepEnd.getDate().toString().padStart(2,"0")}/${(prepEnd.getMonth()+1).toString().padStart(2,"0")}/${prepEnd.getFullYear()}`
                      : "All available prediction data"}
                  </p>
                </div>
                <button onClick={() => setPrepSummaryOpen(false)} className="text-slate-400 hover:text-slate-600 transition p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Search + Date range + sort */}
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent transition">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search ingredient…"
                    value={prepSearch}
                    onChange={(e) => setPrepSearch(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 h-[30px]">
                  <span className="text-[10px] text-slate-400 font-medium">Range</span>
                  <span className="text-slate-200 text-xs">|</span>
                  <DatePicker
                    selected={prepStart}
                    onChange={(d) => { setPrepStart(d); fetchPrepSummary(d, prepEnd); }}
                    maxDate={prepEnd ?? undefined}
                    dateFormat="dd/MM/yyyy"
                    customInput={<DateInput />}
                  />
                  <span className="text-slate-300 text-xs">–</span>
                  <DatePicker
                    selected={prepEnd}
                    onChange={(d) => { setPrepEnd(d); fetchPrepSummary(prepStart, d); }}
                    minDate={prepStart ?? undefined}
                    dateFormat="dd/MM/yyyy"
                    customInput={<DateInput />}
                  />
                </div>
                <div className="flex items-center gap-1.5 w-[210px]">
                  <div className="flex-1 flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 h-[30px]">
                    <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                    <select
                      value={prepSortBy}
                      onChange={(e) => { setPrepSortBy(e.target.value); setShowPrepSortPopover(false); }}
                      className="w-full text-xs font-semibold text-slate-600 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="urgency">Top Urgency</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                  {prepSortBy === "category" && (
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setShowPrepSortPopover(v => !v)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors h-[30px] ${showPrepSortPopover ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                      >
                        <ArrowUpDown size={11} /> Order
                      </button>
                      <CategorySortPopover
                        isOpen={showPrepSortPopover}
                        onClose={() => setShowPrepSortPopover(false)}
                        categoryOrder={categoryOrder}
                        onChange={(newOrder) => {
                          setCategoryOrder(newOrder);
                          localStorage.setItem("inventory_category_order", JSON.stringify(newOrder));
                        }}
                        categoryMap={CATEGORY_MAP}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    const s = new Date(Date.now() + 1 * 86400000);
                    const e = new Date(Date.now() + 7 * 86400000);
                    setPrepStart(s); setPrepEnd(e); fetchPrepSummary(s, e);
                  }}
                  className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 font-medium underline"
                >
                  Reset
                </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-2">
                {prepSummaryLoading ? (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <Loader2 className="animate-spin text-orange-400" size={20} />
                    <p className="text-sm text-slate-400">Loading…</p>
                  </div>
                ) : prepSummaryError ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <AlertTriangle size={20} className="text-red-400" />
                    <p className="text-sm text-red-500 font-medium">{prepSummaryError}</p>
                  </div>
                ) : prepSummaryData.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No prediction data available.</p>
                ) : (
                  <>
                    {/* Ingredients with data */}
                    {withData.length > 0 && (
                      <div className="mb-2">
                        {prepSortBy === "category"
                          ? categoryOrder.map((catId) => {
                              const items = withData.filter((r) => String(r.category) === catId);
                              if (items.length === 0) return null;
                              return (
                                <div key={catId} className="mb-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 pb-1 border-b border-orange-100 mb-1.5">
                                    {CATEGORY_MAP[catId] || catId}
                                  </p>
                                  {items.map((r) => (
                                    <div key={r.ingredient_id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-2.5 mb-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                      <p className="text-sm font-semibold text-slate-700 truncate flex-1">{r.ingredient_name}</p>
                                      <p className="text-sm font-bold text-slate-700 shrink-0">{Math.ceil(r.expected_usage)} <span className="text-[10px] font-normal text-slate-400">{r.unit}</span></p>
                                    </div>
                                  ))}
                                </div>
                              );
                            })
                          : withData.map((r) => (
                              <div key={r.ingredient_id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-2.5 mb-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-700 truncate">{r.ingredient_name}</p>
                                  <p className="text-[10px] text-slate-400">{CATEGORY_MAP[r.category] || "Other"}</p>
                                </div>
                                <p className="text-sm font-bold text-slate-700 shrink-0">{Math.ceil(r.expected_usage)} <span className="text-[10px] font-normal text-slate-400">{r.unit}</span></p>
                              </div>
                            ))
                        }
                      </div>
                    )}

                    {/* No prediction data */}
                    {withoutData.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">No Prediction Data</p>
                        {withoutData.map((r) => (
                          <div key={r.ingredient_id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-1.5 opacity-60">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-500 truncate">{r.ingredient_name}</p>
                              <p className="text-[10px] text-slate-400">{CATEGORY_MAP[r.category] || "Other"}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">No data</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
                <span>{withData.length} ingredient{withData.length !== 1 ? "s" : ""} · {withoutData.length} no data</span>
                {prepDays && <span>{prepDays} days</span>}
              </div>
            </div>
          </div>
        );
      })()}

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
                {!requestForm.ingredient_id && (
                  <p className="text-xs text-red-500 font-medium mb-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} /> This procedure will take a long time to complete
                  </p>
                )}
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