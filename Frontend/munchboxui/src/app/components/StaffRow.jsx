"use client";
import { Trash2, Edit2 } from "lucide-react"; // Optional: grab an edit icon if you want!

const ROLE_MAP = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier"
};

// Add onEditClick to the props
export default function StaffRow({ member, onDeleteClick, onEditClick }) {
  const name = member.name || "Unknown";
  const roleText = ROLE_MAP[member.role] || "Unknown"; 

  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 text-slate-700 font-medium">{name}</td>
      <td className="px-6 py-4 text-slate-500">
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
          {roleText}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          
          {/* Wire up the Edit button to pass the whole member object */}
          <button 
            onClick={() => onEditClick(member)}
            className="text-blue-500 hover:text-blue-700 font-medium text-sm transition-colors flex items-center gap-1 underline"
          >
            Edit profile
          </button>
          
          <button 
            onClick={() => onDeleteClick(member)} 
            className="text-slate-400 hover:text-red-500 transition-colors"
            title="Delete Staff"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}