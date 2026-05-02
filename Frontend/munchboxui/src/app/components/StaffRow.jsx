"use client";
import { Trash2, Pencil } from "lucide-react";

const ROLE_MAP = {
  1: "Admin",
  2: "Manager",
  3: "Staff",
  4: "Chef",
  5: "Cashier",
};

const ROLE_STYLE = {
  1: "bg-red-100 text-red-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-slate-100 text-slate-700",
  4: "bg-orange-100 text-orange-700",
  5: "bg-emerald-100 text-emerald-700",
};


export default function StaffRow({ member, callerRole, onEditClick, showDelete, onDeleteClick }) {
  const name = member.name || "Unknown";
  const roleText = ROLE_MAP[member.role] || "Unknown";
  const badgeStyle = ROLE_STYLE[member.role] || "bg-slate-100 text-slate-700";

  return (
    <tr className="hover:bg-orange-50/40 transition-colors group">
      <td className="px-6 py-4 break-words">
        <span className="text-slate-800 font-semibold">{name}</span>
      </td>
      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeStyle}`}>
          {roleText}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          {callerRole !== null && (
            <button
              onClick={() => onEditClick(member)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-orange-500 transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {showDelete && (
            <button
              onClick={() => onDeleteClick(member)}
              className="text-slate-300 hover:text-red-500 transition-colors"
              title="Delete Staff"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
