"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { PredictAPI, IngredientAPI } from "../../lib/api";
import { Search, Loader2, TrendingUp, SlidersHorizontal, X, Plus } from "lucide-react";

export default function PredictPage() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [actualData, setActualData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ingredientList, setIngredientList] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ ingredient_id: "", days: 7, strategy: "2" });
  const [graphFilters, setGraphFilters] = useState({
    confidenceBand: true,
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
      const [trendRes, actualRes] = await Promise.all([
        PredictAPI.trend(ingredient_id),
        PredictAPI.actual(ingredient_id),
      ]);

      const trendRaw = trendRes?.Data?.data || [];
      const actualRaw = actualRes?.Data || [];

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
      const res = await PredictAPI.generate({
        ingredient_id: requestForm.ingredient_id ? parseInt(requestForm.ingredient_id) : null,
        days: requestForm.days,
        strategy: requestForm.strategy,
      });
      const total = res?.Data?.total_processed ?? 0;
      const errors = res?.Data?.errors ?? [];
      if (total > 0) {
        showToast("success", `Generated ${total} prediction(s) successfully.`);
      } else if (errors.length > 0) {
        showToast("error", `Model failed: ${errors[0]?.error || "unknown error"}`);
      } else {
        showToast("error", "No predictions generated. Check server logs.");
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

  const chartData = useMemo(() => {
    return trendData.map((d) => ({
      ...d,
      band_low: d.lower_bound ?? null,
      band_range: d.upper_bound != null && d.lower_bound != null
        ? Math.max(0, d.upper_bound - d.lower_bound) : null,
    }));
  }, [trendData]);

  const hasBands = graphFilters.confidenceBand && chartData.some((d) => d.band_range != null);
  const hasActual = chartData.some((d) => d.actual_usage != null);
  const hasPredicted = chartData.some((d) => d.predicted_usage != null);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">

          {/* Header */}
          <div className="flex justify-between items-center shrink-0">
            <h1 className="text-2xl font-bold italic text-slate-800">Predict Ingredients Demand</h1>
            <button
              onClick={() => setModalOpen(true)}
              disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-md disabled:opacity-60"
            >
              {generating ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
              {generating ? "Generating..." : " Request"}
            </button>
          </div>

          {/* Filter bar */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
            {/* Ingredient pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
              <span className="text-slate-400 font-medium">Ingredient:</span>
              <select
                value={selectedIngredient?.ingredient_id || ""}
                onChange={(e) => {
                  const ing = report.find((r) => String(r.ingredient_id) === e.target.value);
                  if (ing) handleSelectIngredient(ing);
                }}
                className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer max-w-[120px]"
              >
                {report.map((r) => (
                  <option key={r.ingredient_id} value={r.ingredient_id}>{r.ingredient_name}</option>
                ))}
              </select>
            </div>

            {/* Range pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
              <span className="text-slate-400 font-medium">Range:</span>
              <select
                value={requestForm.days}
                onChange={(e) => setRequestForm((f) => ({ ...f, days: parseInt(e.target.value) }))}
                className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer"
              >
                <option value={7}>Next 7 days</option>
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
              </select>
            </div>

            {/* Model pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
              <span className="text-slate-400 font-medium">Model:</span>
              <select
                value={requestForm.strategy}
                onChange={(e) => setRequestForm((f) => ({ ...f, strategy: e.target.value }))}
                className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer"
              >
                <option value="1">Conservative</option>
                <option value="2">Balanced</option>
                <option value="3">Aggressive</option>
              </select>
            </div>

            <div className="flex-1" />

            {/* Graph filter button */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen((o) => !o)}
                className={`p-2 rounded-lg border transition-colors ${
                  filterOpen
                    ? "bg-orange-50 border-orange-300 text-orange-500"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <SlidersHorizontal size={17} />
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-20 w-52">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Graph Component Filters</p>
                  {[
                    { key: "confidenceBand", label: "Confidence Range" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={graphFilters[key]}
                        onChange={() => setGraphFilters((f) => ({ ...f, [key]: !f[key] }))}
                        className="accent-orange-500 w-4 h-4"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-800">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

            {/* Chart section */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-0 overflow-hidden">
              {selectedIngredient ? (
                <>
                  {/* Stats header */}
                  <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-lg font-bold italic text-slate-800">Inventory Forecast</h2>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                      <span className="text-base font-semibold text-slate-600">
                        {selectedIngredient.ingredient_name} ({selectedIngredient.unit})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                      <div>
                        <span className="text-slate-400">Current: </span>
                        <span className="font-bold text-slate-700">{selectedIngredient.current_stock}{selectedIngredient.unit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Minimum Target: </span>
                        <span className="font-bold text-slate-700">{selectedIngredient.expected_usage}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Status: </span>
                        <span className={`font-bold ${selectedIngredient.status === 1 ? "text-emerald-500" : "text-red-500"}`}>
                          {selectedIngredient.status === 1 ? "OK" : "Reorder"}
                        </span>
                      </div>
                      {selectedIngredient.daily_target_average != null && (
                        <div>
                          <span className="text-slate-400">Daily Target Avg: </span>
                          <span className="font-bold text-slate-700">
                            {selectedIngredient.daily_target_average}{selectedIngredient.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="flex-1 min-h-0 px-4 pt-4">
                    {trendLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-orange-500" size={32} />
                      </div>
                    ) : chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload;
                              return (
                                <div style={{ background: "white", borderRadius: 10, padding: "10px 16px", boxShadow: "0 4px 12px rgb(0 0 0/0.12)", border: "1px solid #f1f5f9" }}>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>{label}</p>
                                  {d?.actual_usage != null && (
                                    <p style={{ fontSize: 12, color: "#10b981", margin: "2px 0 0 0" }}>
                                      Actual: <b>{d.actual_usage}</b> {selectedIngredient.unit}
                                    </p>
                                  )}
                                  {d?.predicted_usage != null && (
                                    <p style={{ fontSize: 12, color: "#3b82f6", margin: "2px 0 0 0" }}>
                                      Predicted: <b>{d.predicted_usage}</b> {selectedIngredient.unit}
                                    </p>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <ReferenceLine
                            y={selectedIngredient.current_stock}
                            stroke="#f97316"
                            strokeDasharray="5 4"
                            label={{ value: "Current Stock", fill: "#f97316", fontSize: 10, position: "insideTopLeft" }}
                          />
                          {hasBands && <Area type="monotone" dataKey="band_low" stackId="band" stroke="none" fill="transparent" legendType="none" />}
                          {hasBands && <Area type="monotone" dataKey="band_range" stackId="band" stroke="none" fill="#3b82f6" fillOpacity={0.12} legendType="none" />}
                          {hasActual && (
                            <Line type="monotone" dataKey="actual_usage" stroke="#10b981" strokeWidth={2.5}
                              dot={{ r: 3, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} name="Actual Usage" connectNulls={false} />
                          )}
                          {hasPredicted && (
                            <Line type="monotone" dataKey="predicted_usage" stroke="#3b82f6" strokeWidth={2}
                              strokeDasharray="5 3" dot={{ r: 2, fill: "#3b82f6" }} activeDot={{ r: 4 }} name="Predicted" connectNulls={false} />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 italic gap-2">
                        <TrendingUp className="text-slate-300" size={36} />
                        No trend data available
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="px-6 py-3 border-t border-slate-100 shrink-0 flex flex-wrap gap-x-6 gap-y-1.5">
                    {hasActual && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="w-5 h-0.5 bg-emerald-500 rounded" />
                        Actual Usage
                      </div>
                    )}
                    {hasPredicted && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="w-5 border-t-2 border-blue-400 border-dashed" />
                        Predicted
                      </div>
                    )}
                    {hasBands && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="w-5 h-3 bg-blue-100 rounded border border-blue-200" />
                        Confidence Range
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-5 border-t-2 border-orange-400 border-dashed" />
                      Current Stock
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 italic">
                  Select an ingredient to view the forecast
                </div>
              )}
            </div>

            {/* Table */}
            <div className="w-[380px] bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 shrink-0">
              <div className="p-4 border-b border-slate-100 shrink-0">
                <h2 className="font-bold italic text-slate-800 mb-3">Prediction Result</h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search Ingredient..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="All">Status: All</option>
                    <option value="OK">OK</option>
                    <option value="Reorder">Reorder</option>
                  </select>
                </div>
              </div>

              <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 text-slate-500 text-xs italic border-b border-slate-200">
                      <th className="px-4 py-3 font-semibold">Ingredient</th>
                      <th className="px-4 py-3 font-semibold text-center">Current</th>
                      <th className="px-4 py-3 font-semibold text-center">Minimum</th>
                      <th className="px-4 py-3 font-semibold text-center">Unit</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center">
                          <Loader2 className="animate-spin text-orange-500 mx-auto" size={24} />
                        </td>
                      </tr>
                    ) : filteredReport.length > 0 ? (
                      filteredReport.map((row) => (
                        <tr
                          key={row.ingredient_id}
                          onClick={() => handleSelectIngredient(row)}
                          className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${
                            selectedIngredient?.ingredient_id === row.ingredient_id
                              ? "bg-orange-50 border-l-2 border-l-orange-400"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-700 font-medium text-sm">{row.ingredient_name}</td>
                          <td className="px-4 py-3 text-center text-slate-600 text-sm">{row.current_stock}</td>
                          <td className="px-4 py-3 text-center text-slate-600 text-sm">{row.expected_usage}</td>
                          <td className="px-4 py-3 text-center text-slate-500 text-sm">{row.unit}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              row.status === 1 ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50"
                            }`}>
                              {row.status === 1 ? "OK" : "Reorder"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <TrendingUp className="mx-auto mb-2 text-slate-300" size={32} />
                          <p className="text-slate-400 italic text-sm">No prediction data</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Request Prediction Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold italic text-slate-800">Request Prediction</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Ingredient</label>
                <select
                  value={requestForm.ingredient_id}
                  onChange={(e) => setRequestForm((f) => ({ ...f, ingredient_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">All Ingredients</option>
                  {ingredientList.map((r) => (
                    <option key={r.id} value={r.id}>{r.ingredient_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Range (Day Ahead)</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Day</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={requestForm.days}
                      onChange={(e) => setRequestForm((f) => ({ ...f, days: parseInt(e.target.value) || 7 }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="e.g., 1, 2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Unit</label>
                    <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 font-medium">
                      day
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Model</label>
                <select
                  value={requestForm.strategy}
                  onChange={(e) => setRequestForm((f) => ({ ...f, strategy: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="1">Conservative</option>
                  <option value="2">Balanced</option>
                  <option value="3">Aggressive</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleRequest}
              className="mt-8 w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-bold text-sm transition-colors active:scale-95"
            >
              request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
