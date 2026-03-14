"use client";
import { useState, useEffect, useRef } from "react";
import { X, Loader2, Search, Trash2, Save } from "lucide-react";
import { MenuAPI, IngredientAPI, RecipeAPI } from "../../lib/api";

export default function EditMenuModal({ isOpen, onClose, onSuccess, initialMenu, initialIngredients }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);

  // Form States
  const [formData, setFormData] = useState({ name: "", type: "1", price: "" });
  
  // Ingredients States
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  // Sync initial data when modal opens
  useEffect(() => {
    if (isOpen && initialMenu) {
      setFormData({
        name: initialMenu.menu_name || initialMenu.name || "",
        type: String(initialMenu.menu_type || initialMenu.type || "1"),
        price: initialMenu.menu_price || initialMenu.price || ""
      });

      // Format ingredients to match the state structure
      const formattedIngs = initialIngredients.map(ing => ({
        id: ing.ingredient_id || ing.id,
        name: ing.ingredient_name || ing.name,
        unit: ing.unit,
        amount: ing.amount
      }));
      setSelectedIngredients(formattedIngs);

      // Load master list of ingredients for the dropdown
      IngredientAPI.list({}).then(res => {
        if (res?.Data) setAvailableIngredients(res.Data);
      }).catch(err => console.error(err));
    }
  }, [isOpen, initialMenu, initialIngredients]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const filteredIngredients = availableIngredients.filter(ing => 
    (ing.ingredient_name || ing.name).toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedIngredients.find(selected => selected.id === (ing.ingredient_id || ing.id))
  );

  const handleAddIngredient = (ing) => {
    setSelectedIngredients([...selectedIngredients, { 
      id: ing.ingredient_id || ing.id, 
      name: ing.ingredient_name || ing.name, 
      unit: ing.unit,
      amount: "" 
    }]);
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const handleUpdateAmount = (id, amount) => {
    setSelectedIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, amount } : ing));
  };

  const handleRemoveIngredient = (id) => {
    setSelectedIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
        const menuId = Number(initialMenu.menu_id || initialMenu.id);

        // 1. Update the Basic Menu Info (Name, Type, Price)
        await MenuAPI.update({
        menu_id: menuId,
        menu_name: formData.name,
        menu_type: Number(formData.type),
        menu_price: Number(formData.price)
        });

        // 2. Diffing Logic for Ingredients
        const initialMap = new Map(initialIngredients.map(ing => [ing.ingredient_id || ing.id, ing]));
        const selectedMap = new Map(selectedIngredients.map(ing => [ing.id, ing]));

        // --- A. Identify ingredients to DELETE ---
        const toDelete = initialIngredients.filter(
        ing => !selectedMap.has(ing.ingredient_id || ing.id)
        );

        // --- B. Identify ingredients to ADD or UPDATE ---
        const toAdd = [];
        const toUpdate = [];

        selectedIngredients.forEach(selected => {
        const initial = initialMap.get(selected.id);
        if (!initial) {
            // Not in the original list? It's a new addition.
            toAdd.push(selected);
        } else if (Number(initial.amount) !== Number(selected.amount)) {
            // Existed but the amount changed? Update it.
            toUpdate.push(selected);
        }
        });

        // 3. Execute all API calls in parallel
        const promises = [
        // DELETE calls
        ...toDelete.map(ing => 
            RecipeAPI.delete(menuId, ing.ingredient_id || ing.id)
        ),
        // ADD calls (Uses your existing MenuAPI method)
        ...toAdd.map(ing => 
            MenuAPI.addIngredientToRecipe({ 
            menu_id: menuId, 
            ingredient_id: ing.id, 
            amount: Number(ing.amount) 
            })
        ),
        // UPDATE calls (Uses the new RecipeAPI.edit)
        ...toUpdate.map(ing => 
            RecipeAPI.edit({ 
            menu_id: menuId, 
            ingredient_id: ing.id, 
            amount: Number(ing.amount) 
            })
        )
        ];

        await Promise.all(promises);
        
        onSuccess(); // Refresh the parent page
        onClose();   // Close modal
    } catch (err) {
        console.error("Save Error:", err);
        setError(err.message || "Failed to update recipe");
    } finally {
        setLoading(false);
    }
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 py-10">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-full">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold italic text-slate-800">Edit Recipe: {formData.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-600 mb-1">Menu Name</label>
              <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Type</label>
              <select required value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border  text-slate-600  border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                <option value="1">Main Course</option>
                <option value="2">Appetizer</option>
                <option value="3">Dessert</option>
                <option value="4">Drink</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Price (Baht)</label>
              <input required type="number" min="0" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border text-slate-600  border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Ingredients</label>
            <div className="relative mb-4" ref={dropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search and add ingredients..." 
                  value={searchTerm}
                  onChange={(e) => { 
                    setSearchTerm(e.target.value); 
                    setIsDropdownOpen(true); 
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200  text-slate-600  rounded-lg focus:ring-2 focus:ring-orange-500 outline-none shadow-sm text-sm"
                />
                {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200   text-slate-600  rounded-lg shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
                  {filteredIngredients.length > 0 ? (
                    filteredIngredients.map(ing => (
                      <div 
                        key={ing.ingredient_id || ing.id} 
                        onClick={() => handleAddIngredient(ing)}
                        className="px-4 py-2 cursor-pointer hover:bg-orange-50 flex justify-between items-center text-sm text-slate-700 transition-colors"
                      >
                        <span>{ing.ingredient_name || ing.name}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1  rounded">Stock: {ing.stock || 0} {ing.unit}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center italic">No ingredients found</div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {selectedIngredients.map(ing => (
                <div key={ing.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="flex-1 font-medium text-slate-700 text-sm pl-2">{ing.name}</span>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    required 
                    placeholder="Amount" 
                    value={ing.amount} 
                    onChange={(e) => handleUpdateAmount(ing.id, e.target.value)}
                    className="w-24 px-3 py-1 text-sm bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-right  text-slate-600 "
                  />
                  <span className="text-sm text-slate-500 w-8">{ing.unit}</span>
                  <button type="button" onClick={() => handleRemoveIngredient(ing.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="pt-4 flex gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg py-2">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18}/> Update Recipe</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}