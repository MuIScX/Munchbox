"use client";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { RestaurantAPI } from "../../lib/api";
import {
  Store,
  Edit3,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  Package,
  Lock,
  PlusCircle,
  KeyRound,
} from "lucide-react";

const PACKAGE_LABELS = { 1: "Basic", 2: "Pro", 3: "Enterprise" };
const PACKAGE_OPTIONS = [
  { value: 1, label: "Basic" },
  { value: 2, label: "Pro" },
  { value: 3, label: "Enterprise" },
];

const EMPTY_FORM = { name: "", start_date: "", end_date: "", package: 1, manager_pin: "" };

function InfoRow({ icon: Icon, label, value, color = "text-slate-400" }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className={`w-4 h-4 ${color}`} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-slate-700 font-medium">
          {value ?? <span className="text-slate-300 italic">Not set</span>}
        </p>
      </div>
    </div>
  );
}

function InputField({ icon: Icon, label, name, value, onChange, placeholder, type = "text", color = "text-slate-400", required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${color}`} strokeWidth={2} />
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 outline-none transition-all placeholder-slate-300"
        />
      </div>
    </div>
  );
}

function SelectField({ icon: Icon, label, name, value, onChange, options, color = "text-slate-400", required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${color}`} strokeWidth={2} />
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 outline-none transition-all appearance-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Edit form — only name and manager_pin are editable; package/dates are view-only
function RestaurantEditForm({ form, onChange, restaurant }) {
  return (
    <div className="space-y-5">
      <InputField
        icon={Store} label="Restaurant Name" name="name"
        value={form.name} onChange={onChange}
        placeholder="e.g. MunchBox HQ" color="text-orange-400" required
      />
      {/* Package — view only */}
      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Package</label>
        <div className="flex items-center gap-3 pl-10 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 relative cursor-not-allowed">
          <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
          {PACKAGE_LABELS[restaurant?.package] ?? "Unknown"}
          <span className="ml-auto text-xs italic text-slate-400">View only</span>
        </div>
      </div>
      {/* Start Date — view only */}
      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
        <div className="flex items-center gap-3 pl-10 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 relative cursor-not-allowed">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
          {restaurant?.start_date || <span className="italic text-slate-400">Not set</span>}
          <span className="ml-auto text-xs italic text-slate-400">View only</span>
        </div>
      </div>
      {/* End Date — view only */}
      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
        <div className="flex items-center gap-3 pl-10 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 relative cursor-not-allowed">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-300" />
          {restaurant?.end_date || <span className="italic text-slate-400">Not set</span>}
          <span className="ml-auto text-xs italic text-slate-400">View only</span>
        </div>
      </div>
      <div>
        <InputField
          icon={Lock} label="Manager PIN" name="manager_pin"
          value={form.manager_pin} onChange={onChange}
          placeholder="Optional PIN (numbers only)" type="number"
          color="text-slate-400"
        />
        <p className="text-xs text-slate-400 italic mt-1.5">
          Used to authorize sensitive actions within the app.
        </p>
      </div>
    </div>
  );
}

function RestaurantCreateForm({ form, onChange }) {
  return (
    <div className="space-y-5">
      <InputField
        icon={Store} label="Restaurant Name" name="name"
        value={form.name} onChange={onChange}
        placeholder="e.g. MunchBox HQ" color="text-orange-400" required
      />
      <SelectField
        icon={Package} label="Package" name="package"
        value={form.package} onChange={onChange}
        options={PACKAGE_OPTIONS} color="text-purple-400" required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <InputField
          icon={Calendar} label="Start Date" name="start_date"
          value={form.start_date} onChange={onChange}
          type="date" color="text-emerald-400" required
        />
        <InputField
          icon={Calendar} label="End Date" name="end_date"
          value={form.end_date} onChange={onChange}
          type="date" color="text-red-400" required
        />
      </div>
      <div>
        <InputField
          icon={Lock} label="Manager PIN" name="manager_pin"
          value={form.manager_pin} onChange={onChange}
          placeholder="Optional PIN (numbers only)" type="number"
          color="text-slate-400"
        />
        <p className="text-xs text-slate-400 italic mt-1.5">
          Used to authorize sensitive actions within the app.
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("view"); // "view" | "edit" | "create"
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // PIN popup state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const fetchRestaurant = async () => {
    try {
      setLoading(true);
      const res = await RestaurantAPI.get();
      const data = res.Data ?? res;
      if (data && data.name) {
        setRestaurant(data);
        setForm({
          name: data.name ?? "",
          start_date: data.start_date ?? "",
          end_date: data.end_date ?? "",
          package: data.package ?? 1,
          manager_pin: data.manager_pin ?? "",
        });
        setMode("view");
      } else {
        setRestaurant(null);
        setMode("create");
      }
    } catch {
      setRestaurant(null);
      setMode("create");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurant(); }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditClick = () => {
    if (restaurant?.manager_pin) {
      setIsPinModalOpen(true);
      setPinInput("");
      setPinError("");
    } else {
      setMode("edit");
    }
  };

  const handlePinConfirm = () => {
    if (String(pinInput) === String(restaurant.manager_pin)) {
      setIsPinModalOpen(false);
      setMode("edit");
    } else {
      setPinError("Incorrect PIN. Please try again.");
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      showToast("error", "Please fill in all required fields.");
      return;
    }
    try {
      setSaving(true);
      const res = await RestaurantAPI.create({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        package: Number(form.package),
        manager_pin: form.manager_pin ? Number(form.manager_pin) : undefined,
      });
      const data = res.Data ?? res;
      setRestaurant(data?.name ? data : { ...form });
      setMode("view");
      showToast("success", "Restaurant created successfully!");
    } catch {
      showToast("error", "Failed to create restaurant. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      await RestaurantAPI.update({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        package: Number(form.package),
        manager_pin: form.manager_pin ? Number(form.manager_pin) : undefined,
      });
      setRestaurant({ ...restaurant, ...form });
      setMode("view");
      showToast("success", "Restaurant details updated successfully.");
    } catch {
      showToast("error", "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm({
      name: restaurant.name ?? "",
      start_date: restaurant.start_date ?? "",
      end_date: restaurant.end_date ?? "",
      package: restaurant.package ?? 1,
      manager_pin: restaurant.manager_pin ?? "",
    });
    setMode("view");
  };

  const daysUntilExpiry = restaurant?.end_date
    ? Math.ceil((new Date(restaurant.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8">

          {/* Toast */}
          {toast && (
            <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {toast.type === "success"
                ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                : <AlertCircle className="w-4 h-4 text-red-500" />}
              {toast.message}
            </div>
          )}

          {/* PIN Modal */}
          {isPinModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="font-bold italic text-slate-800">Manager PIN Required</h2>
                    <p className="text-xs text-slate-400">Enter your PIN to edit settings.</p>
                  </div>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePinConfirm()}
                  placeholder="Enter PIN"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 mb-2"
                  autoFocus
                />
                {pinError && <p className="text-xs text-red-500 mb-3">{pinError}</p>}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setIsPinModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePinConfirm}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Page Title */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h1 className="text-2xl font-bold italic text-slate-800">Settings</h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="animate-spin text-orange-500" size={36} />
            </div>

          ) : mode === "create" ? (
            /* ── CREATE MODE ── */
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                      <PlusCircle className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="font-bold italic text-slate-800 text-lg">Create Restaurant</h2>
                      <p className="text-xs text-slate-400">Set up your restaurant profile to get started.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <RestaurantCreateForm form={form} onChange={handleChange} />
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleCreate}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                      {saving ? "Creating..." : "Create Restaurant"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* ── VIEW / EDIT MODE ── */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: Summary */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="h-12 bg-gradient-to-br relative">
                    <div className="absolute inset-0 opacity-10"
                      style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                    />
                  </div>
                  <div className="px-5 pb-5 pt-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm -mt-7 mb-3 flex items-center justify-center">
                      <Store className="w-5 h-5 text-orange-500" strokeWidth={2} />
                    </div>
                    <h2 className="text-base font-bold text-slate-800">{restaurant?.name}</h2>
                    <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-600">
                      {PACKAGE_LABELS[restaurant?.package] ?? "Unknown"} Plan
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider italic mb-3">Subscription</h3>
                  <InfoRow icon={Calendar} label="Start Date" value={restaurant?.start_date} color="text-emerald-400" />
                  <InfoRow icon={Calendar} label="End Date" value={restaurant?.end_date} color="text-red-400" />
                  <InfoRow icon={Clock} label="Last Updated" value={restaurant?.updated_time} color="text-blue-400" />

                  {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                    <div className={`mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium ${
                      daysUntilExpiry <= 7
                        ? "bg-red-50 border border-red-200 text-red-600"
                        : "bg-yellow-50 border border-yellow-200 text-yellow-700"
                    }`}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {daysUntilExpiry <= 0
                        ? "Subscription has expired!"
                        : `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Detail / Edit */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold italic text-slate-800 text-lg">Restaurant Details</h2>
                    {mode === "view" ? (
                      <button
                        onClick={handleEditClick}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleUpdate}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    {mode === "view" ? (
                      <div>
                        <InfoRow icon={Store} label="Restaurant Name" value={restaurant?.name} color="text-orange-400" />
                        <InfoRow icon={Package} label="Package" value={PACKAGE_LABELS[restaurant?.package] ?? restaurant?.package} color="text-purple-400" />
                        <InfoRow icon={Calendar} label="Start Date" value={restaurant?.start_date} color="text-emerald-400" />
                        <InfoRow icon={Calendar} label="End Date" value={restaurant?.end_date} color="text-red-400" />
                        <InfoRow icon={Lock} label="Manager PIN" value={restaurant?.manager_pin ? "••••••" : null} color="text-slate-400" />
                      </div>
                    ) : (
                      <RestaurantEditForm form={form} onChange={handleChange} restaurant={restaurant} />
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
