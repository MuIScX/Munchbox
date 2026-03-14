"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { ReportAPI, MenuAPI } from "../../lib/api";
import { Loader2 } from "lucide-react";

import KPICards from "../components/reports/KPICards";
import SalesTrendChart from "../components/reports/SalesTrendChart";
import CategoryPieChart from "../components/reports/CategoryPieChart";
import SalesReportTable from "../components/reports/SalesReportTable";

const COLORS = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#f472b6'];
const TYPE_MAP = { 1: "Main Dish", 2: "Side", 3: "Dessert", 4: "Drink" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };
}

const now = new Date();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

export default function ViewReports() {
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
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

  const dateRange = getMonthRange(selectedYear, selectedMonth);
  const shareDateRange = shareAllTime ? { start_date: null, end_date: null } : dateRange;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const handleMonthChange = (val) => {
    if (val === "all") {
      setShareAllTime(true);
    } else {
      setShareAllTime(false);
      setSelectedMonth(Number(val));
    }
  };

  const handleYearChange = (val) => {
    if (val === "all") {
      setShareAllTime(true);
    } else {
      setShareAllTime(false);
      setSelectedYear(Number(val));
    }
  };

  // KPI + menu list
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const kpiRange = shareAllTime ? { start_date: null, end_date: null } : dateRange;
      const results = await Promise.allSettled([
        ReportAPI.orders(null, kpiRange),
        ReportAPI.revenue(null, kpiRange),
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
  }, [selectedYear, selectedMonth, shareAllTime]);

  // Share pie + table
  useEffect(() => {
    const fetch = async () => {
      setShareLoading(true);
      const results = await Promise.allSettled([
        ReportAPI.shareCategory(shareDateRange.start_date, shareDateRange.end_date),
        ReportAPI.shareMenu(shareDateRange.start_date, shareDateRange.end_date),
      ]);
      const [categoryRes, menuRes] = results;
      if (categoryRes.status === "fulfilled" && Array.isArray(categoryRes.value?.Data))
        setCategoryData(categoryRes.value.Data.map((item, i) => ({
          name: TYPE_MAP[item.type] || `Type ${item.type}`,
          value: item.total_order || 0,
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
  }, [selectedYear, selectedMonth, shareAllTime]);

  // Trend line
  useEffect(() => {
    const fetch = async () => {
      setTrendLoading(true);
      try {
        const menuId = selectedMenu === "All" ? null : Number(selectedMenu);
        const trendRange = shareAllTime ? { start_date: null, end_date: null } : dateRange;
        const res = await ReportAPI.trendMenu(menuId, trendRange);
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
            setSalesTrendData(res.Data.map(item => ({
              name: new Date(item.day).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
              order: item.sale_amount || 0,
            })));
          }
        } else setSalesTrendData([]);
      } catch { setSalesTrendData([]); }
      finally { setTrendLoading(false); }
    };
    fetch();
  }, [selectedMenu, selectedYear, selectedMonth, shareAllTime]);

const formatCurrency = (val) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  return (
    <div className="flex h-screen bg-[#f8f9fa] font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6 relative">

          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            </div>
          )}

          {/* Header + dropdowns */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-2xl font-bold italic text-slate-900">View Reports</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Month dropdown */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Month</label>
                <select
                  value={shareAllTime ? "all" : selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Time</option>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Year dropdown */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Year</label>
                <select
                  value={shareAllTime ? "all" : selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Time</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <KPICards
            totalOrders={totalOrders}
            totalRevenue={totalRevenue}
            formatCurrency={formatCurrency}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SalesTrendChart
              data={salesTrendData}
              menuList={menuList}
              selectedMenu={selectedMenu}
              setSelectedMenu={setSelectedMenu}
              trendLoading={trendLoading}
              globalLoading={loading}
              shareAllTime={shareAllTime}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
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
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
