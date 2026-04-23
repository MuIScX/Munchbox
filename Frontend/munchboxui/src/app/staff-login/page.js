"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCookie } from "cookies-next";
import { StaffAPI, StaffSession } from "../../lib/api";
import { Loader2 } from "lucide-react";

const ROLE_MAP = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier",
};

const ROLE_COLOR = {
  1: "bg-slate-100 text-slate-600",
  2: "bg-orange-100 text-orange-700",
  3: "bg-orange-100 text-orange-700",
  4: "bg-blue-100 text-blue-700",
  5: "bg-emerald-100 text-emerald-700",
};

export default function StaffLogin() {
  const [staffList, setStaffList]   = useState([]);
  const [selected, setSelected]     = useState(null);
  const [pinValue, setPinValue]     = useState("");
  const [pinError, setPinError]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [fetching, setFetching]     = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!getCookie("token")) { router.replace("/login"); return; }
    StaffAPI.list()
      .then((res) => setStaffList(Array.isArray(res?.Data) ? res.Data : []))
      .catch(() => setStaffList([]))
      .finally(() => setFetching(false));
  }, [router]);

  const isManager = selected && (selected.role === 2 || selected.role === 3);

  const handleSelect = (staff) => {
    setSelected(staff);
    setPinValue("");
    setPinError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setPinError("");

    if (isManager) {
      if (!pinValue) { setPinError("Please enter the manager PIN."); return; }
      try {
        setLoading(true);
        await StaffAPI.verifyManagerPin(pinValue);
      } catch (err) {
        setPinError(err.message || "Incorrect PIN.");
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    StaffSession.set({
      id:        selected.staff_id,
      name:      selected.name,
      role:      selected.role,
      roleLabel: ROLE_MAP[selected.role] ?? "Staff",
    });
    const isManagerRole = selected.role === 2 || selected.role === 3;
    router.push(isManagerRole ? "/dashboard" : "/updateinventory");
  };

  return (
    <div className="min-h-screen bg-[#fafaf8] flex">
      {/* Left logo */}
      <div className="hidden md:flex w-56 shrink-0 items-end justify-center pb-16">
        <Image src="/logo2.png" alt="logo" width={160} height={160} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Who are you?</h1>
          <p className="text-sm text-slate-500 mb-6">Select your profile to continue</p>

          {fetching ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-orange-400" size={24} />
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-10">
              No staff found. Ask your manager to add staff members first.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {staffList.map((s) => {
                const isSelected = selected?.staff_id === s.staff_id;
                return (
                  <button
                    key={s.staff_id}
                    onClick={() => handleSelect(s)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-orange-400 bg-orange-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                      isSelected ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {(s.name || "?")[0].toUpperCase()}
                    </div>
                    <p className={`text-sm font-semibold truncate w-full text-center ${isSelected ? "text-orange-700" : "text-slate-700"}`}>
                      {s.name}
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[s.role] ?? "bg-slate-100 text-slate-500"}`}>
                      {ROLE_MAP[s.role] ?? "Staff"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* PIN input — only visible for managers */}
          <form onSubmit={handleSubmit}>
            <div className={`overflow-hidden transition-all duration-300 ${isManager ? "max-h-28 opacity-100 mb-4" : "max-h-0 opacity-0"}`}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Manager PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pinValue}
                onChange={(e) => { setPinValue(e.target.value); if (pinError) setPinError(""); }}
                placeholder="Enter manager PIN"
                className={`w-full rounded-xl border px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  pinError ? "border-red-400" : "border-slate-300"
                }`}
              />
              {pinError && <p className="mt-1 text-xs text-red-500">{pinError}</p>}
            </div>

            <button
              type="submit"
              disabled={!selected || loading}
              className="w-full bg-orange-500 text-white rounded-xl font-semibold py-3 hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Entering…</> : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
