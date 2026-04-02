"use client";
import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { CATEGORY_MAP } from "../../lib/schema";

export default function EditIngredientModal({ isOpen, onClose, ingredient, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ name: "", category: "1", unit: "" });

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.ingredient_name || ingredient.name || "",
        category: String(ingredient.category || "1"),
        unit: ingredient.unit || "",
      });
      setError("");
    }
  }, [ingredient]);

  if (!isOpen || !ingredient) return null;

  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

  const handleNameChange = (e) => {
    setFormData({ ...formData, name: capitalize(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSave({
        ingredient_id: ingredient.ingredient_id || ingredient.id,
        name: formData.name.trim(),
        category: Number(formData.category),
        unit: formData.unit,
      });
    } catch (err) {
      setError(err.message || "Failed to update ingredient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Edit Ingredient</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Ingredient Name</label>
            <input required type="text" placeholder="e.g., Tomato" value={formData.name} onChange={handleNameChange} className="w-full px-4 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Category</label>
            <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-slate-700">
              {Object.entries(CATEGORY_MAP).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Unit</label>
            <select required value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-700">
              <option value="" disabled>Select Unit</option>
              <option value="kg">kg (Kilogram)</option>
              <option value="g">g (Gram)</option>
              <option value="liter">liter</option>
              <option value="ml">ml (Milliliter)</option>
              <option value="piece">piece</option>
              <option value="bag">bag</option>
              <option value="pack">pack</option>
              <option value="box">box</option>
              <option value="bottle">bottle</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Update Ingredient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
