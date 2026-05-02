"use client";
import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { StaffAPI } from "../../lib/api";

const ROLE_MAP = {
  1: "Admin",
  2: "Manager",
  3: "Staff",
  4: "Chef",
  5: "Cashier",
};

export default function EditStaffModal({ isOpen, onClose, onSuccess, staffMember, callerRole }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("1");

  useEffect(() => {
    if (staffMember) {
      setName(staffMember.name || "");
      setRole(String(staffMember.role || "1"));
      setError("");
    }
  }, [staffMember]);

  if (!isOpen) return null;

  const isRestricted = callerRole === 2 && staffMember?.role === 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (!name.trim()) { setError("Name cannot be empty."); setLoading(false); return; }
    const staffId = staffMember?.staff_id || staffMember?.id;
    try {
      await StaffAPI.update(staffId, name.trim(), Number(role));
      onSuccess({ name: name.trim(), role: Number(role) });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update staff member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold italic text-slate-800">Edit Staff Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name — editable by manager */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Staff Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { if (!isRestricted) { setName(e.target.value); setError(""); } }}
              readOnly={isRestricted}
              className={`w-full px-4 py-2 border rounded-lg outline-none ${isRestricted ? "text-slate-400 bg-slate-100 cursor-not-allowed" : "text-slate-600 bg-slate-50 focus:ring-2 focus:ring-orange-500 border-slate-200"}`}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => { if (!isRestricted) setRole(e.target.value); }}
              disabled={isRestricted}
              className={`w-full px-4 py-2 border rounded-lg outline-none ${isRestricted ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-slate-50 border-slate-200 focus:ring-2 focus:ring-orange-500 text-slate-700"}`}
            >
              {Object.entries(ROLE_MAP)
                .filter(([id]) => !(callerRole === 2 && Number(id) === 1))
                .map(([id, roleName]) => (
                  <option key={id} value={id}>{roleName}</option>
                ))}
            </select>
          </div>

          {isRestricted && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              Managers cannot edit Admin staff.
            </p>
          )}
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || isRestricted} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Save Changes"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
