"use client";
import { useState } from "react";
import { X, Loader2, Eye, EyeOff } from "lucide-react";
import { StaffAPI } from "../../lib/api";

const ROLE_MAP = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier"
};

export default function AddStaffModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({ name: "", username: "", password: "", confirmPassword: "", role: "1" });

  if (!isOpen) return null;

  const triggerError = (msg) => {
    setError(msg);
    setShakeKey(k => k + 1);
  };

  const set = (field) => (e) => {
    setFormData(f => ({ ...f, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.name.trim()) { triggerError("Staff name is required."); return; }
    if (!formData.username.trim()) { triggerError("Username is required."); return; }
    if (!formData.password) { triggerError("Password is required."); return; }
    if (!formData.confirmPassword) { triggerError("Please confirm the password."); return; }
    if (formData.password !== formData.confirmPassword) { triggerError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await StaffAPI.create(formData.name.trim(), formData.username.trim(), formData.password, Number(formData.role));
      onSuccess();
      onClose();
      setFormData({ name: "", username: "", password: "", confirmPassword: "", role: "1" });
    } catch (err) {
      triggerError(err.message || "Failed to add staff member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .input-shake { animation: shake 0.4s ease; }
      `}</style>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold italic text-slate-800">Add New Staff</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Staff Name</label>
            <input
              key={shakeKey}
              type="text"
              placeholder="e.g., John Doe"
              value={formData.name}
              onChange={set("name")}
              className={`w-full px-4 py-2 text-slate-600 bg-slate-50 border rounded-lg outline-none transition-all ${
                error ? "border-red-400 ring-2 ring-red-200 input-shake" : "border-slate-200 focus:ring-2 focus:ring-orange-500"
              }`}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Username</label>
            <input
              type="text"
              placeholder="e.g., johndoe"
              value={formData.username}
              onChange={set("username")}
              className="w-full px-4 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Set a password"
                value={formData.password}
                onChange={set("password")}
                className="w-full px-4 py-2 pr-10 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={set("confirmPassword")}
                className="w-full px-4 py-2 pr-10 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={set("role")}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700"
            >
              {Object.entries(ROLE_MAP).map(([id, roleName]) => (
                <option key={id} value={id}>{roleName}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Save"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
