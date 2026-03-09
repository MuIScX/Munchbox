"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar"; 
import { ReportAPI, MenuAPI } from "@/lib/api"; 
import { Loader2 } from "lucide-react";

// Import your newly extracted components
import KPICards from "../components/reports/KPICards";
import SalesTrendChart from "../components/reports/SalesTrendChart";
import CategoryPieChart from "../components/reports/CategoryPieChart";
import SalesReportTable from "../components/reports/SalesReportTable";

const COLORS = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa', '#f472b6'];
const TYPE_MAP = { 1: "Food", 2: "Drinks", 3: "Desserts" };

export default function ViewReports() {
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [menuList, setMenuList] = useState([]); 
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [tableData, setTableData] = useState([]);
  
  const [selectedMenu, setSelectedMenu] = useState("All");

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      
      const results = await Promise.allSettled([
        ReportAPI.orders(null),
        ReportAPI.revenue(null),
        ReportAPI.shareCategory(),
        ReportAPI.shareMenu(),
        MenuAPI.list() 
      ]);

      const [ordersRes, revenueRes, categoryShareRes, menuShareRes, menuListRes] = results;

      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value?.Data)) {
        setTotalOrders(ordersRes.value.Data.reduce((acc, curr) => acc + (curr.total_orders || 0), 0));
      }

      if (revenueRes.status === "fulfilled" && Array.isArray(revenueRes.value?.Data)) {
        setTotalRevenue(revenueRes.value.Data.reduce((acc, curr) => acc + (curr.revenue || 0), 0));
      }

      if (categoryShareRes.status === "fulfilled" && Array.isArray(categoryShareRes.value?.Data)) {
        setCategoryData(categoryShareRes.value.Data.map((item, index) => ({
          name: TYPE_MAP[item.type] || `Type ${item.type}`,
          value: item.total_order || 0,
          color: COLORS[index % COLORS.length] 
        })));
      }

      if (menuShareRes.status === "fulfilled" && Array.isArray(menuShareRes.value?.Data)) {
        setTableData(menuShareRes.value.Data.map(item => ({
          id: item.menu_id,
          item: item.menu_name,
          orders: item.total_orders || 0,
          revenue: item.revenue || 0, 
          share: item.share_percent || 0,
        })));
      }

      if (menuListRes.status === "fulfilled" && Array.isArray(menuListRes.value?.Data)) {
        setMenuList(menuListRes.value.Data);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchTrendData = async () => {
      setTrendLoading(true);
      try {
        const menuId = selectedMenu === "All" ? null : Number(selectedMenu);
        const trendRes = await ReportAPI.trendMenu(menuId);

        if (Array.isArray(trendRes?.Data)) {
          setSalesTrendData(trendRes.Data.map(item => {
            const dateObj = new Date(item.day);
            return {
              name: dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), 
              order: item.sale_amount || 0
            };
          }));
        } else {
          setSalesTrendData([]);
        }
      } catch (error) {
        console.error("Trend API Error:", error);
        setSalesTrendData([]);
      } finally {
        setTrendLoading(false);
      }
    };

    fetchTrendData();
  }, [selectedMenu]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

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

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h1 className="text-2xl font-bold italic text-slate-900">View Reports</h1>
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

            <CategoryPieChart data={categoryData} />
          </div>

          <SalesReportTable 
            tableData={tableData} 
            formatCurrency={formatCurrency} 
          />

        </div>
      </main>
    </div>
  );
}