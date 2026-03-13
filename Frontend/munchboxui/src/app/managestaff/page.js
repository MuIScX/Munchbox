"use client";

import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import StaffRow from "../components/StaffRow";
import AddStaffModal from "../components/AddStaffModal";
import EditStaffModal from "../components/EditStaffModal";
import DeleteStaffModal from "../components/DeleteStaffModal";
import { StaffAPI } from "../../lib/api";
import { Search, Plus, Loader2, Trash2 } from "lucide-react";

export default function ManageStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState(null);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [showDelete, setShowDelete] = useState(false);

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
    } catch (err) {
      alert(err.message || "Failed to delete staff member.");
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((s) =>
      (s.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staff, searchQuery]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

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
        <div className="p-8 overflow-y-auto custom-scrollbar">

          {/* Header */}
          <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold italic text-slate-800">Manage Staff</h1>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-md"
            >
              <Plus size={20} /> Add New Staff
            </button>
          </div>

          {/* Summary Card */}
          <div className="bg-[#cfe3f1] flex-1 max-w-[220px] rounded-2xl p-5 mb-8 shadow-sm">
            <p className="text-[#2c6b8a] text-sm font-semibold mb-1">Total Staff</p>
            <h2 className="text-4xl font-bold text-slate-800">{staff.length}</h2>
          </div>

          {/* Search Bar */}
          <div className="flex flex-wrap gap-4 mb-8">
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

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold italic text-slate-800">Staff Directory</h2>
            </div>

            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                  <tr className="text-slate-500 text-sm italic">
                    <th className="px-6 py-4 font-semibold">Staff Name</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold text-center">
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
                      <td colSpan={3} className="py-12 text-center">
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
                      <td colSpan={3} className="text-center py-12 text-slate-400 italic">
                        {searchQuery ? "No staff found matching your search." : "No staff members available."}
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
