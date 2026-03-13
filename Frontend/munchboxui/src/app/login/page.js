"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCookie } from 'cookies-next';
import { AuthAPI } from "../../lib/api"

export default function Home() {
  const [emailValue, setemailValue] = useState('');
  const [emailerrorMessage, setemailerrorMessage] = useState(''); 
  const [passwordValue, setpasswordValue] = useState('');
  const [passworderrorMessage, setpassworderrorMessage] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const router = useRouter();

  const handleEmailChange = (event) => {
    setemailValue(event.target.value);
    if (emailerrorMessage) setemailerrorMessage(''); 
  };

  const handlePasswordChange = (event) => {
    setpasswordValue(event.target.value);
    if (passworderrorMessage) setpassworderrorMessage(''); 
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError("");
    setemailerrorMessage("");
    setpassworderrorMessage("");

    if (!emailValue) {
      setemailerrorMessage("Please enter an email address.");
      return;
    }
    if (!passwordValue) {
      setpassworderrorMessage("Please enter password.");
      return;
    }

    try {
      setLoading(true);
      const response = await AuthAPI.login(emailValue, passwordValue);
      console.log("Login success:", response);
      router.push("/dashboard"); 
    } catch (error) {
      const msg = error.message || "";
      if (msg.includes("User not found")) {
        setemailerrorMessage("No account found with this email.");
      } else if (msg.includes("Wrong password")) {
        setpassworderrorMessage("Incorrect password.");
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
        <Image src="/logo2.png" alt="log" width={200} height={200} />
      </div>

      <div className="col-span-4 row-span-5">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-[330px] max-w-sm text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">
              Welcome to MunchBox
            </h1>

            <form className="space-y-1" onSubmit={handleSubmit}>
              <div className="text-left">
                <label htmlFor="email" className="block text-xs font-semibold text-gray-400 mb-1">
                  EMAIL
                </label>
                <input
                  id="email"
                  type="email"
                  value={emailValue}
                  onChange={handleEmailChange}
                  placeholder="Enter your Email"
                  className={`w-full rounded-xl border px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    emailerrorMessage ? "border-red-500" : "border-gray-300"
                  }`}
                />
                <p className="mt-1 text-xs text-red-600 text-left min-h-[1rem]">
                  {emailerrorMessage}
                </p>
              </div>

              <div className="text-left">
                <label htmlFor="password" className="block text-xs font-semibold text-gray-400 mb-1">
                  PASSWORD
                </label>
                <input
                  id="password"
                  type="password"
                  value={passwordValue}
                  onChange={handlePasswordChange}
                  placeholder="Enter your Password"
                  className={`w-full rounded-xl border px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    passworderrorMessage ? "border-red-500" : "border-gray-300"
                  }`}
                />
                <p className="mt-1 text-xs text-red-600 text-left min-h-[1rem]">
                  {passworderrorMessage}
                </p>
              </div>

              {serverError && (
                <p className="text-xs text-red-600 text-center py-1">{serverError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e08906] text-white rounded-[2vw] font-semibold py-3 hover:bg-orange-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}