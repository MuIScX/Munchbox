"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { StaffSession, StaffAPI, AuthAPI } from "../../lib/api";
import { UserCircle, Shield, AtSign, Edit3, Save, X, Lock, Eye, EyeOff, LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const ROLE_LABEL = { 1: "Admin", 2: "Manager", 3: "Staff", 4: "Chef", 5: "Cashier" };
const ROLE_COLOR = {
  1: "bg-red-100 text-red-600",
  2: "bg-orange-100 text-orange-600",
  3: "bg-slate-100 text-slate-600",
  4: "bg-blue-100 text-blue-600",
  5: "bg-emerald-100 text-emerald-600",
};

function InfoRow({ icon: Icon, iconColor, label, value }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2} />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-slate-700 font-medium">{value || <span className="text-slate-300 italic">Not set</span>}</p>
      </div>
    </div>
  );
}

function PasswordInput({ label, value, onChange, placeholder, error }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full pl-4 pr-10 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 outline-none transition-all ${
            error ? "border-red-400 ring-2 ring-red-200" : "border-slate-200"
          }`}
        />
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/* ─── Change Username Modal ─────────────────────────────────────── */
function ChangeUsernameModal({ staffId, currentUsername, onClose, onSuccess }) {
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!newUsername.trim()) errs.username = "Username is required.";
    if (newUsername.trim() === currentUsername) errs.username = "New username cannot be the same as current username.";
    if (!currentPassword) errs.password = "Current password is required.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError("");
    try {
      await StaffAPI.selfUpdate({ staff_id: staffId, username: newUsername.trim(), current_password: currentPassword });
      onSuccess(newUsername.trim());
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Incorrect current password")) setErrors({ password: "Incorrect password." });
      else if (msg.includes("already taken")) setErrors({ username: "Username already taken." });
      else setServerError(msg || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold italic text-slate-800">Change Username</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">New Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setErrors(v => ({ ...v, username: "" })); }}
              placeholder="Enter new username"
              className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all ${errors.username ? "border-red-400 ring-2 ring-red-200" : "border-slate-200"}`}
            />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
          </div>
          <PasswordInput
            label="Password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setErrors(v => ({ ...v, password: "" })); }}
            placeholder="Enter your password"
            error={errors.password}
          />
          {serverError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{serverError}</p>}
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Change Password Modal ─────────────────────────────────────── */
function ChangePasswordModal({ staffId, onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!currentPassword) errs.current = "Current password is required.";
    if (!newPassword) errs.new = "New password is required.";
    if (newPassword && newPassword.length < 4) errs.new = "Password must be at least 4 characters.";
    if (newPassword && newPassword === currentPassword) errs.new = "New password cannot be the same as current password.";
    if (!confirmPassword) errs.confirm = "Please confirm your new password.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) errs.confirm = "Passwords do not match.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError("");
    try {
      await StaffAPI.selfUpdate({ staff_id: staffId, new_password: newPassword, current_password: currentPassword });
      onSuccess();
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Incorrect current password")) setErrors({ current: "Incorrect password." });
      else setServerError(msg || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold italic text-slate-800">Change Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setErrors(v => ({ ...v, current: "" })); }}
            placeholder="Enter current password"
            error={errors.current}
          />
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setErrors(v => ({ ...v, new: "" })); }}
            placeholder="Enter new password"
            error={errors.new}
          />
          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setErrors(v => ({ ...v, confirm: "" })); }}
            placeholder="Type new password again"
            error={errors.confirm}
          />
          {serverError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{serverError}</p>}
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modal, setModal] = useState(null); // "username" | "password"
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const staff = StaffSession.get();
    if (staff) {
      setProfile({ id: staff.id, name: staff.name, username: staff.username, role: staff.role, roleLabel: staff.roleLabel ?? ROLE_LABEL[staff.role] ?? "Staff", source: "staff" });
      return;
    }
    AuthAPI.me()
      .then((res) => {
        const data = res.Data ?? res;
        setProfile({ name: data.username ?? "Unknown", role: null, roleLabel: data.permission === 1 ? "User" : "Admin", email: data.email ?? "", source: "account" });
      })
      .catch(() => setProfile(null));
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const startEdit = () => {
    setEditName(profile.name);
    setNameError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNameError("");
  };

  const saveName = async () => {
    if (!editName.trim()) { setNameError("Name cannot be empty."); return; }
    if (editName.trim() === profile.name) { setEditing(false); return; }
    setNameLoading(true);
    setNameError("");
    try {
      await StaffAPI.selfUpdate({ staff_id: profile.id, name: editName.trim() });
      setProfile(p => ({ ...p, name: editName.trim() }));
      setEditing(false);
      showToast("Name updated successfully.");
    } catch (err) {
      setNameError(err.message || "Failed to update name.");
    } finally {
      setNameLoading(false);
    }
  };

  const handleUsernameSuccess = (newUsername) => {
    setProfile(p => ({ ...p, username: newUsername }));
    setModal(null);
    showToast("Username updated successfully.");
  };

  const handlePasswordSuccess = () => {
    setModal(null);
    showToast("Password updated successfully.");
  };

  const handleSignOut = () => {
    StaffSession.clear();
    router.push("/staff-login");
  };

  const initials = profile?.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const isStaff = profile?.source === "staff";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          toast.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {modal === "username" && isStaff && (
        <ChangeUsernameModal staffId={profile.id} currentUsername={profile.username} onClose={() => setModal(null)} onSuccess={handleUsernameSuccess} />
      )}
      {modal === "password" && isStaff && (
        <ChangePasswordModal staffId={profile.id} onClose={() => setModal(null)} onSuccess={handlePasswordSuccess} />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 max-w-xl">

          {/* Header card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shrink-0">
                <span className="text-white text-2xl font-bold tracking-wide">{initials}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  {profile?.name ?? "Loading…"}
                </h1>
                {profile && (
                  <span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLOR[profile.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {profile.roleLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account Details card */}
          {profile && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              {/* Card header with Edit button */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Account Details</h2>
                {isStaff && !editing && (
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    <Edit3 size={13} strokeWidth={2.5} />
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                /* ── Edit mode ── */
                <div className="p-6 space-y-5">
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                      Name
                    </label>
                    <div className="relative">
                      <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" strokeWidth={2} />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setNameError(""); }}
                        className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 outline-none transition-all ${
                          nameError ? "border-red-400 ring-2 ring-red-200" : "border-slate-200"
                        }`}
                      />
                    </div>
                    {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                  </div>

                  {/* Save / Cancel */}
                  <div className="flex gap-3">
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors text-sm"
                    >
                      <X size={14} /> Cancel
                    </button>
                    <button
                      onClick={saveName}
                      disabled={nameLoading || editName.trim() === profile.name}
                      className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      {nameLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Credentials</p>
                    <button
                      onClick={() => setModal("username")}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-600 font-medium rounded-lg transition-colors text-sm"
                    >
                      <AtSign size={15} strokeWidth={2} />
                      Change Username
                    </button>
                    <button
                      onClick={() => setModal("password")}
                      className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-600 font-medium rounded-lg transition-colors text-sm"
                    >
                      <Lock size={15} strokeWidth={2} />
                      Change Password
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="divide-y divide-slate-100">
                  <InfoRow icon={UserCircle} iconColor="text-orange-400" label="Name" value={profile.name} />
                  {profile.username && (
                    <InfoRow icon={AtSign} iconColor="text-blue-400" label="Username" value={profile.username} />
                  )}
                  <InfoRow icon={Shield} iconColor="text-blue-400" label="Role" value={profile.roleLabel} />
                  {profile.email && (
                    <InfoRow icon={AtSign} iconColor="text-slate-400" label="Email" value={profile.email} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sign out */}
          {isStaff && (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-semibold rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={2} />
              Sign Out of Staff Session
            </button>
          )}

        </div>
      </main>
    </div>
  );
}
