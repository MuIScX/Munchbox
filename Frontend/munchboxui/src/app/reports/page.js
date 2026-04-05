"use client";

import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Sidebar from "../components/Sidebar";
import { ReportAPI, MenuAPI } from "../../lib/api";
import { Loader2, BarChart2 } from "lucide-react";

import KPICards from "../components/reports/KPICards";
import SalesTrendChart from "../components/reports/SalesTrendChart";
import CategoryPieChart from "../components/reports/CategoryPieChart";
import SalesReportTable from "../components/reports/SalesReportTable";

const COLORS = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#f472b6'];
const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };

const now = new Date();

export default function ViewReports() {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [shareAllTime, setShareAllTime] = useState(true);

  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);

  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [menuList, setMenuList] = useState([]);
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState("All");

  const toStr = (d) => d ? d.toISOString().split("T")[0] : null;
  const startStr = toStr(startDate);
  const endStr   = toStr(endDate);

  const dateRange = shareAllTime
    ? { start_date: null, end_date: null }
    : { start_date: startStr, end_date: endStr };

  const handleStartDateChange = (date) => {
    setStartDate(date);
    setShareAllTime(!date && !endDate);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
    setShareAllTime(!startDate && !date);
  };

  const handleClearDates = () => {
    setStartDate(null);
    setEndDate(null);
    setShareAllTime(true);
  };

  // KPI + menu list
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        ReportAPI.orders(null, dateRange),
        ReportAPI.revenue(null, dateRange),
        MenuAPI.list(),
      ]);
      const [ordersRes, revenueRes, menuListRes] = results;
      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value?.Data))
        setTotalOrders(ordersRes.value.Data.reduce((a, c) => a + (c.total_orders || 0), 0));
      if (revenueRes.status === "fulfilled" && Array.isArray(revenueRes.value?.Data))
        setTotalRevenue(revenueRes.value.Data.reduce((a, c) => a + (c.revenue || 0), 0));
      if (menuListRes.status === "fulfilled" && Array.isArray(menuListRes.value?.Data))
        setMenuList(menuListRes.value.Data);
      setLoading(false);
    };
    fetch();
  }, [startDate, endDate, shareAllTime]);

  // Share pie + table
  useEffect(() => {
    const fetch = async () => {
      setShareLoading(true);
      const results = await Promise.allSettled([
        ReportAPI.shareCategory(dateRange.start_date, dateRange.end_date),
        ReportAPI.shareMenu(dateRange.start_date, dateRange.end_date),
      ]);
      const [categoryRes, menuRes] = results;
      if (categoryRes.status === "fulfilled" && Array.isArray(categoryRes.value?.Data))
        setCategoryData(categoryRes.value.Data.map((item, i) => ({
          name: TYPE_MAP[item.type] || `Type ${item.type}`,
          value: item.revenue || 0,
          color: COLORS[i % COLORS.length],
        })));
      if (menuRes.status === "fulfilled" && Array.isArray(menuRes.value?.Data))
        setTableData(menuRes.value.Data.map(item => ({
          id: item.menu_id,
          item: item.menu_name,
          orders: item.total_orders || 0,
          revenue: item.revenue || 0,
          share: item.share_percent || 0,
        })));
      setShareLoading(false);
    };
    fetch();
  }, [startDate, endDate, shareAllTime]);

  // Trend line
  useEffect(() => {
    const fetch = async () => {
      setTrendLoading(true);
      try {
        const menuId = selectedMenu === "All" ? null : Number(selectedMenu);
        const res = await ReportAPI.trendMenu(menuId, dateRange);
        if (Array.isArray(res?.Data)) {
          if (shareAllTime) {
            const monthMap = {};
            res.Data.forEach(item => {
              const d = new Date(item.day);
              const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              monthMap[key] = (monthMap[key] || 0) + (item.sale_amount || 0);
            });
            setSalesTrendData(Object.entries(monthMap).map(([name, order]) => ({ name, order })));
          } else {
            // Build a map from API data
            const dataMap = {};
            res.Data.forEach(item => { dataMap[item.day] = item.sale_amount || 0; });
            // Fill every date in range with 0 if missing
            const filled = [];
            if (startDate && endDate) {
              const cur = new Date(startDate);
              const end = new Date(endDate);
              cur.setHours(0,0,0,0); end.setHours(0,0,0,0);
              while (cur <= end) {
                const key = cur.toISOString().split("T")[0];
                filled.push({ name: key.split("-").reverse().join("/"), order: dataMap[key] ?? 0 });
                cur.setDate(cur.getDate() + 1);
              }
            } else {
              res.Data.forEach(item => filled.push({ name: item.day.split("-").reverse().join("/"), order: item.sale_amount || 0 }));
            }
            setSalesTrendData(filled);
          }
        } else setSalesTrendData([]);
      } catch { setSalesTrendData([]); }
      finally { setTrendLoading(false); }
    };
    fetch();
  }, [selectedMenu, startDate, endDate, shareAllTime]);

const formatCurrency = (val) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6 relative">

          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            </div>
          )}

          {/* Header + KPI Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <BarChart2 size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Analyze sales trends and revenue data</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">Start Date</label>
                    <DatePicker
                      selected={startDate}
                      onChange={handleStartDateChange}
                      selectsStart
                      startDate={startDate}
                      endDate={endDate}
                      maxDate={endDate || new Date()}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="dd/mm/yyyy"
                      showYearDropdown
                      showMonthDropdown
                      dropdownMode="select"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 w-32"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-medium mb-1">End Date</label>
                    <DatePicker
                      selected={endDate}
                      onChange={handleEndDateChange}
                      selectsEnd
                      startDate={startDate}
                      endDate={endDate}
                      minDate={startDate}
                      maxDate={new Date()}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="dd/mm/yyyy"
                      showYearDropdown
                      showMonthDropdown
                      dropdownMode="select"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-400 w-32"
                    />
                  </div>
                  {!shareAllTime && (
                    <div className="self-end">
                      <button
                        onClick={handleClearDates}
                        className="px-3 py-2 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-xl bg-slate-50 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <KPICards
                totalOrders={totalOrders}
                totalRevenue={totalRevenue}
                formatCurrency={formatCurrency}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SalesTrendChart
              data={salesTrendData}
              menuList={menuList}
              selectedMenu={selectedMenu}
              setSelectedMenu={setSelectedMenu}
              trendLoading={trendLoading}
              globalLoading={loading}
              shareAllTime={shareAllTime}
              startDate={startStr}
              endDate={endStr}
              tableData={tableData}
              formatCurrency={formatCurrency}
            />
            <div className="relative">
              {shareLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-2xl">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                </div>
              )}
              <CategoryPieChart data={categoryData} />
            </div>
          </div>

          {/* Sales report table */}
          <div className="relative">
            {shareLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-2xl">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            )}
            <SalesReportTable
              tableData={tableData}
              formatCurrency={formatCurrency}
              shareAllTime={shareAllTime}
              startDate={startStr}
              endDate={endStr}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
