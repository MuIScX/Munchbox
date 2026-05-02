"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCookie } from "cookies-next";
import { StaffAPI } from "../../lib/api";
import { Loader2, User, Lock } from "lucide-react";

export default function StaffLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!getCookie("token")) { router.replace("/login"); }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUsernameError("");
    setPasswordError("");
    setServerError("");

    if (!username.trim()) { setUsernameError("Please enter your username."); return; }
    if (!password) { setPasswordError("Please enter your password."); return; }

    try {
      setLoading(true);
      const res = await StaffAPI.login(username.trim(), password);
      const data = res.Data;
      const isManager = data.role === 1 || data.role === 2;
      router.push(isManager ? "/dashboard" : "/updateinventory");
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Staff not found")) {
        setUsernameError("No staff found with this username.");
      } else if (msg.includes("Wrong password")) {
        setPasswordError("Incorrect password.");
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-8 grid-rows-5 gap-4">
      <div className="col-span-2 row-span-5 flex items-end justify-center">
        <Image src="/logo2.png" alt="logo" width={200} height={200} />
      </div>

      <div className="col-span-4 row-span-5">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-[330px] max-w-sm text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Staff Login</h1>
            <p className="text-sm text-slate-500 mb-8">Enter your credentials to continue</p>

            <form className="space-y-1" onSubmit={handleSubmit}>
              <div className="text-left">
                <label htmlFor="username" className="block text-xs font-semibold text-slate-400 mb-1">
                  USERNAME
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(""); }}
                    placeholder="Enter your username"
                    className={`w-full pl-10 pr-4 rounded-xl border py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      usernameError ? "border-red-500" : "border-slate-300"
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-red-600 text-left min-h-[1rem]">{usernameError}</p>
              </div>

              <div className="text-left">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-400 mb-1">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                    placeholder="Enter your password"
                    className={`w-full pl-10 pr-4 rounded-xl border py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      passwordError ? "border-red-500" : "border-slate-300"
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-red-600 text-left min-h-[1rem]">{passwordError}</p>
              </div>

              {serverError && (
                <p className="text-xs text-red-600 text-center py-1">{serverError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white rounded-xl font-semibold py-3 hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Logging in…</> : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
