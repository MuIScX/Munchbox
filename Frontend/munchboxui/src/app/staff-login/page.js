"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCookie } from "cookies-next";
import { StaffAPI, StaffSession } from "../../lib/api";

const ROLE_MAP = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier",
};

export default function StaffLogin() {
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!getCookie("token")) {
      router.replace("/login");
      return;
    }
    StaffAPI.list()
      .then((res) => setStaffList(Array.isArray(res?.Data) ? res.Data : []))
      .catch(() => setStaffList([]));
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNameError("");

    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameError("Please enter your name.");
      return;
    }

    setLoading(true);
    const match = staffList.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (!match) {
      setNameError("Staff member not found. Please check your name.");
      setLoading(false);
      return;
    }

    StaffSession.set({
      id: match.staff_id,
      name: match.name,
      role: match.role,
      roleLabel: ROLE_MAP[match.role] ?? "Staff",
    });
    router.push("/dashboard");
  };

  return (
    <div className="grid grid-cols-8 grid-rows-5 gap-4">
      <div className="col-span-2 row-span-5 flex items-end justify-center">
        <Image src="/logo2.png" alt="logo" width={200} height={200} />
      </div>

      <div className="col-span-4 row-span-5">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-[330px] max-w-sm text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Staff Login
            </h1>
            <p className="text-sm text-slate-500 mb-8">
              Enter your name to continue
            </p>

            <form className="space-y-1" onSubmit={handleSubmit}>
              <div className="text-left">
                <label
                  htmlFor="name"
                  className="block text-xs font-semibold text-slate-400 mb-1"
                >
                  YOUR NAME
                </label>
                <input
                  id="name"
                  type="text"
                  value={nameValue}
                  onChange={(e) => {
                    setNameValue(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  placeholder="Enter your name"
                  className={`w-full rounded-xl border px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    nameError ? "border-red-500" : "border-slate-300"
                  }`}
                />
                <p className="mt-1 text-xs text-red-600 text-left min-h-[1rem]">
                  {nameError}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white rounded-xl font-semibold py-3 hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Entering..." : "Enter"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
