"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { StaffAPI } from "@/lib/api";
import { Search } from "lucide-react";

export default function ManageStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await StaffAPI.list();
      setStaff(Array.isArray(res?.Data) ? res.Data : []);
    } catch (err) {
      console.error(err.message);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold italic text-slate-800">
              Manage Staff
            </h1>

            <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition-transform active:scale-95 shadow-md">
              + Add New Staff
            </button>
          </div>

          {/* Summary */}
          <div className="bg-[#cfe3f1] w-72 rounded-2xl p-4 mb-6">
            <p className="text-[#2c6b8a] text-sm">Total Staff</p>
            <h2 className="text-3xl font-bold text-black">
              {staff.length}
            </h2>
          </div>

          {/* Search */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search Staff..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold italic text-slate-800">
                Manage Staff Accounts
              </h2>
              {loading && (
                <span className="text-orange-500 text-sm">Loading...</span>
              )}
            </div>

            {/* Table Scroll Container */}
            <div className="max-h-[450px] overflow-y-auto staff-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-500 text-sm italic">
                    <th className="px-6 py-4 font-semibold">Staff Name</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold text-center">
                      Info
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {!loading &&
                  staff.filter((s) =>
                    (s.name || "")
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  ).length > 0 ? (
                    staff
                      .filter((s) =>
                        (s.name || "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())
                      )
                      .map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 text-slate-700 font-medium">
                            {member.name}
                          </td>

                          <td className="px-6 py-4 text-slate-500">
                            {member.role}
                          </td>

                          <td className="px-6 py-4 text-center">
                            <button className="text-blue-500 hover:underline">
                              Edit profile
                            </button>
                          </td>
                        </tr>
                      ))
                  ) : (
                    !loading && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center py-10 text-slate-400 italic"
                        >
                          No staff found
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}