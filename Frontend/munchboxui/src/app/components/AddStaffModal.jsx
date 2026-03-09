"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { StaffAPI } from "@/lib/api"; 

// If you have this in @/lib/schema, import it instead!
const ROLE_MAP = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier"
};

export default function AddStaffModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  
  // Set default role to the numeric ID "1" instead of text
  const [formData, setFormData] = useState({ 
    name: "", 
    role: "1" 
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // FIX: Pass them as two separate arguments, not an object!
      await StaffAPI.create(
        formData.name, 
        Number(formData.role)
      );
      
      onSuccess(); 
      onClose();   
      setFormData({ name: "", role: "1" }); 
    } catch (error) {
      alert(error.message || "Failed to add staff member");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold italic text-slate-800">Add New Staff</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Staff Name</label>
            <input 
              required 
              type="text" 
              placeholder="e.g., John Doe" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              className="w-full px-4 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Role</label>
            <select 
              required 
              value={formData.role} 
              onChange={(e) => setFormData({...formData, role: e.target.value})} 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700"
            >
              {/* Loop through the ROLE_MAP to generate options dynamically */}
              {Object.entries(ROLE_MAP).map(([id, roleName]) => (
                <option key={id} value={id}>
                  {roleName}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Save Staff"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}