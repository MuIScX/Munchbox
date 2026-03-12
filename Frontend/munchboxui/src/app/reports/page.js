"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { ReportAPI, MenuAPI } from "../../lib/api";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

import KPICards from "../components/reports/KPICards";
import SalesTrendChart from "../components/reports/SalesTrendChart";
import CategoryPieChart from "../components/reports/CategoryPieChart";
import SalesReportTable from "../components/reports/SalesReportTable";

const COLORS = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#f472b6'];
const TYPE_MAP = { 1: "Food", 2: "Drinks", 3: "Desserts" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };
}

export default function ViewReports() {
  const now = new Date();

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

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
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
        if (Array.isArray(res?.Data))
          setSalesTrendData(res.Data.map(item => ({
            name: new Date(item.day).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
            order: item.sale_amount || 0,
          })));
        else setSalesTrendData([]);
      } catch { setSalesTrendData([]); }
      finally { setTrendLoading(false); }
    };
    fetch();
  }, [selectedMenu, selectedYear, selectedMonth, shareAllTime]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

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

          {/* Header + month picker + All Time toggle */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <h1 className="text-2xl font-bold italic text-slate-900">View Reports</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShareAllTime(a => !a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${shareAllTime
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                All Time
              </button>

              <div className={`flex items-center gap-1 transition ${shareAllTime ? "opacity-40 pointer-events-none" : ""}`}>
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-[110px] text-center">
                  <p className="font-semibold text-gray-800">{MONTHS[selectedMonth]} {selectedYear}</p>
                </div>
                <button
                  onClick={nextMonth}
                  disabled={isCurrentMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
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

          {/* Sales report table — date controls live inside the component */}
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
              onToggleAllTime={() => setShareAllTime(a => !a)}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              isCurrentMonth={isCurrentMonth}
            />
          </div>

        </div>
      </main>
    </div>
  );
}