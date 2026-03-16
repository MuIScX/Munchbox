"use client";

import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import StaffRow from "../components/StaffRow";
import AddStaffModal from "../components/AddStaffModal";
import EditStaffModal from "../components/EditStaffModal";
import DeleteStaffModal from "../components/DeleteStaffModal";
import Toast from "../components/Toast";
import { StaffAPI } from "../../lib/api";
import { Search, Plus, Loader2, Trash2, Users, UserCheck } from "lucide-react";

export default function ManageStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState(null);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => setToast({ type, message });

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

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    const staffId = staffToDelete.staff_id || staffToDelete.id;
    try {
      await StaffAPI.delete(staffId);
      setStaff((prev) => prev.filter((s) => (s.staff_id || s.id) !== staffId));
      setStaffToDelete(null);
      showToast("success", "Staff member deleted successfully.");
    } catch (err) {
      showToast("error", err.message || "Failed to delete staff member.");
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((s) =>
      (s.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staff, searchQuery]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      <Toast toast={toast} onClose={() => setToast(null)} />

      <AddStaffModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchStaff}
      />

      <EditStaffModal
        isOpen={!!staffToEdit}
        onClose={() => setStaffToEdit(null)}
        onSuccess={fetchStaff}
        staffMember={staffToEdit}
      />

      <DeleteStaffModal
        isOpen={!!staffToDelete}
        onClose={() => setStaffToDelete(null)}
        onConfirm={confirmDelete}
        staffName={staffToDelete?.name || "Unknown Staff"}
      />

      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 flex flex-col gap-6 overflow-hidden h-full">

          {/* Header + Summary Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            {/* Orange accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />

            <div className="p-6">
              {/* Title row */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Users size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manage Staff</h1>
                    <p className="text-sm text-slate-400 mt-0.5">View and manage your team members</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition shadow-sm"
                >
                  <Plus size={18} /> Add New Staff
                </button>
              </div>

              {/* Stat cards row */}
              <div className="flex gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Total Staff</p>
                    <p className="text-3xl font-bold text-blue-900 mt-0.5">{staff.length}</p>
                    <p className="text-xs text-blue-500 font-medium mt-0.5">members</p>
                  </div>
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                    <UserCheck size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-violet-600 font-bold uppercase tracking-wide">Roles</p>
                    <p className="text-3xl font-bold text-violet-900 mt-0.5">{new Set(staff.map(s => s.role)).size}</p>
                    <p className="text-xs text-violet-500 font-medium mt-0.5">distinct roles</p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                    <Search size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Showing</p>
                    <p className="text-3xl font-bold text-slate-700 mt-0.5">{filteredStaff.length}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">in view</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-700">Staff Directory</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filteredStaff.length} member{filteredStaff.length !== 1 ? "s" : ""} found</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search staff name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 text-sm text-slate-700 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none w-64"
                />
              </div>
            </div>

            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr className="text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3.5 font-semibold">Staff Name</th>
                    <th className="px-6 py-3.5 font-semibold">Role</th>
                    <th className="px-6 py-3.5 font-semibold text-center">
                      <div className="flex items-center justify-center gap-2">
                        Actions
                        <button
                          onClick={() => setShowDelete(v => !v)}
                          title={showDelete ? "Hide delete buttons" : "Show delete buttons"}
                          className={`p-1 rounded transition-colors ${showDelete ? "text-red-500 bg-red-50" : "text-slate-400 hover:text-red-400"}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <Loader2 className="animate-spin text-orange-500 mx-auto" size={28} />
                      </td>
                    </tr>
                  ) : filteredStaff.length > 0 ? (
                    filteredStaff.map((member) => (
                      <StaffRow
                        key={member.staff_id || member.id}
                        member={member}
                        onEditClick={setStaffToEdit}
                        showDelete={showDelete}
                        onDeleteClick={setStaffToDelete}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <Users className="mx-auto mb-3 text-slate-300" size={36} />
                        <p className="text-slate-400 italic">
                          {searchQuery ? "No staff found matching your search." : "No staff members available."}
                        </p>
                      </td>
                    </tr>
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
