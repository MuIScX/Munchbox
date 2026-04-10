"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { StaffSession, AuthAPI } from "../../lib/api";
import { UserCircle, Shield, Tag, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const ROLE_LABEL = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier",
};

const ROLE_COLOR = {
  1: "bg-slate-100 text-slate-600",
  2: "bg-orange-100 text-orange-600",
  3: "bg-red-100 text-red-600",
  4: "bg-blue-100 text-blue-600",
  5: "bg-emerald-100 text-emerald-600",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const staff = StaffSession.get();
    if (staff) {
      setProfile({
        name: staff.name,
        role: staff.role,
        roleLabel: staff.roleLabel ?? ROLE_LABEL[staff.role] ?? "Staff",
        source: "staff",
      });
      return;
    }
    AuthAPI.me()
      .then((res) => {
        const data = res.Data ?? res;
        setProfile({
          name: data.username ?? "Unknown",
          role: null,
          roleLabel: data.permission === 1 ? "User" : "Admin",
          email: data.email ?? "",
          source: "account",
        });
      })
      .catch(() => setProfile(null));
  }, []);

  const initials = profile?.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleSignOut = () => {
    StaffSession.clear();
    router.push("/staff-login");
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 max-w-xl">

          {/* Header */}
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

          {/* Details */}
          {profile && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Account Details</h2>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    <UserCircle className="w-4 h-4 text-orange-400" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Name</p>
                    <p className="text-sm text-slate-700 font-medium">{profile.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-blue-400" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Role</p>
                    <p className="text-sm text-slate-700 font-medium">{profile.roleLabel}</p>
                  </div>
                </div>

                {profile.email && (
                  <div className="flex items-center gap-4 px-6 py-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4 text-slate-400" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Email</p>
                      <p className="text-sm text-slate-700 font-medium">{profile.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sign out */}
          {profile?.source === "staff" && (
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
