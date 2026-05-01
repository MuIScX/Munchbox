"use client";
import { useState, useEffect, useRef } from "react";
import { CheckCircle } from "lucide-react";

const DURATION = 6000;

export default function PredictNotification() {
  const [notif, setNotif] = useState(null);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  const dismiss = () => {
    setNotif(null);
    setProgress(100);
    clearTimeout(timerRef.current);
    cancelAnimationFrame(rafRef.current);
  };

  const show = (message) => {
    dismiss();
    setNotif(message);
    setProgress(100);
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(dismiss, DURATION);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "pred_done_notif" && e.newValue) {
        try {
          const { message } = JSON.parse(e.newValue);
          show(message);
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("storage", handler);
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!notif) return null;

  return (
    <div className="fixed bottom-16 right-6 z-50 w-80 rounded-xl shadow-lg border border-emerald-200 bg-emerald-50 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Countdown bar */}
      <div className="h-1 bg-emerald-200">
        <div
          className="h-full bg-emerald-500 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Content */}
      <div className="flex items-center gap-3 px-4 py-3">
        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
        <span className="text-sm font-medium text-emerald-700 flex-1">{notif}</span>
        <button
          onClick={dismiss}
          className="text-emerald-400 hover:text-emerald-600 transition-colors text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
