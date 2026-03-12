"use client";

const ROLE_MAP = {
  1: "Staff",
  2: "Manager",
  3: "Admin",
  4: "Chef",
  5: "Cashier"
};

export default function StaffRow({ member, onEditClick }) {
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
          <button
            onClick={() => onEditClick(member)}
            className="text-blue-500 hover:text-blue-700 font-medium text-sm transition-colors flex items-center gap-1 hover:underline"
          >
            Edit profile
          </button>
        </div>
      </td>
    </tr>
  );
}
