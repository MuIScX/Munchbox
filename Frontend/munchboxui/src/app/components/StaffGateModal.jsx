"use client";

export default function StaffGateModal({ isOpen, staffList, selectedStaff, onSelect, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10 backdrop-blur-md">
      <div className="bg-white w-[500px] h-[400px] rounded-[32px] shadow-2xl border border-black flex flex-col items-center justify-center p-12 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-full max-w-xs space-y-8">
          <div className="relative">
            <select 
              value={selectedStaff}
              onChange={(e) => onSelect(e.target.value)}
              className="w-full px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium appearance-none focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
            >
              <option value="" disabled>Select Staff Name</option>
              {staffList.map((staff) => {
                const id = staff.staff_id || staff.id;
                const name = staff.name || staff.username || `Staff #${id}`;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          <button 
            onClick={onConfirm}
            disabled={!selectedStaff}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xl font-bold italic rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}