"use client";
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function DeleteStaffModal({ isOpen, onClose, onConfirm, staffName }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(); // Waits for the API call to finish before closing
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 text-center">
        
        {/* Warning Icon */}
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-4">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        
        <h3 className="text-xl font-bold italic text-slate-800 mb-2">Delete Staff Member</h3>
        <p className="text-sm text-slate-500 mb-6">
          Are you sure you want to remove <span className="font-bold text-slate-700">"{staffName}"</span>? This action cannot be undone.
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={loading}
            className="flex-1 flex justify-center items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Delete"}
          </button>
        </div>

      </div>
    </div>
  );
}