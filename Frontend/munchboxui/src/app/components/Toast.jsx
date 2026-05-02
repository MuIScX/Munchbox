"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

const DURATION = 6000;

export default function Toast({ toast, onClose }) {
  const [progress, setProgress] = useState(100);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    setProgress(100);
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    timerRef.current = setTimeout(onClose, DURATION);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [toast]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";
  const colors = isSuccess
    ? { border: "border-emerald-200", bg: "bg-emerald-50", bar: "bg-emerald-200", fill: "bg-emerald-500", icon: "text-emerald-500", text: "text-emerald-700", dismiss: "text-emerald-400 hover:text-emerald-600" }
    : { border: "border-red-200",     bg: "bg-red-50",     bar: "bg-red-200",     fill: "bg-red-500",     icon: "text-red-500",     text: "text-red-700",     dismiss: "text-red-400 hover:text-red-600" };

  return (
    <div className={`fixed bottom-16 right-6 z-50 w-80 rounded-xl shadow-lg border ${colors.border} ${colors.bg} overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200`}>
      <div className={`h-1 ${colors.bar}`}>
        <div className={`h-full ${colors.fill} transition-none`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        {isSuccess
          ? <CheckCircle size={16} className={`${colors.icon} shrink-0`} />
          : <AlertCircle size={16} className={`${colors.icon} shrink-0`} />}
        <span className={`text-sm font-medium ${colors.text} flex-1`}>{toast.message}</span>
        <button onClick={onClose} className={`${colors.dismiss} transition-colors text-lg leading-none shrink-0`}>×</button>
      </div>
    </div>
  );
}
