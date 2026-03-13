"use client";
import { useState, useEffect, useRef } from "react";
import { X, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { MenuAPI, IngredientAPI } from "../../lib/api"; 

export default function AddMenuModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Form States
  const [formData, setFormData] = useState({ name: "", type: "1", price: "" });
  
  // Ingredients States
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]); // [{ id, name, unit, amount }]

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: "", type: "1", price: "" });
      setSelectedIngredients([]);
      setSearchTerm("");
      setIsDropdownOpen(false);
      IngredientAPI.list({}).then(res => {
        if (res?.Data) setAvailableIngredients(res.Data);
      }).catch(err => console.error(err));
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filter ingredients based on search
  const filteredIngredients = availableIngredients.filter(ing => 
    (ing.ingredient_name || ing.name).toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedIngredients.find(selected => selected.id === (ing.ingredient_id || ing.id)) // Hide already selected
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

  const handleRemoveIngredient = (id) => {
    setSelectedIngredients(selectedIngredients.filter(ing => ing.id !== id));
  };

  const updateIngredientAmount = (id, amount) => {
    setSelectedIngredients(selectedIngredients.map(ing => 
      ing.id === id ? { ...ing, amount } : ing
    ));
  };

 const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. สร้าง Menu ก่อน
  const menuRes = await MenuAPI.create({
        name: formData.name,
        type: Number(formData.type),
        price: Number(formData.price)
      });
      
      console.log("🔥 ตอบกลับจาก Backend:", menuRes);
      
      // ดึง menu_id ที่เพิ่งสร้างเสร็จจาก Response 
      // (ตรงนี้ขึ้นอยู่กับว่า Service.add_menu ใน Flask return อะไรกลับมา สมมติว่าเป็น menu_id หรือ id)
      const newMenuId = menuRes?.Data?.menu_id || menuRes?.Data?.id;

      if (!newMenuId) {
         throw new Error("สร้างเมนูสำเร็จ แต่ไม่พบ ID สำหรับบันทึกสูตรอาหาร");
      }

      // 2. ถ้ามีส่วนผสม (selectedIngredients) ให้บันทึกลง Recipe ด้วย
      if (selectedIngredients.length > 0) {
        // สร้าง Array ของ Promise เพื่อยิง API พร้อมๆ กัน
        const recipePromises = selectedIngredients.map((ing) => {
          return MenuAPI.addIngredientToRecipe({
            menu_id: newMenuId,
            ingredient_id: ing.id,
            amount: Number(ing.amount) // แปลงเป็นตัวเลขก่อนส่ง
          });
        });

        // รอให้บันทึกส่วนผสมทุกตัวเสร็จสมบูรณ์
        await Promise.all(recipePromises);
      }
      
      // รีเซ็ตฟอร์ม (เผื่อกดเปิดใหม่จะได้เป็นค่าว่าง)
      setFormData({ name: "", type: "1", price: "" });
      setSelectedIngredients([]);

      onSuccess(); // รีเฟรชตารางหน้าหลัก
      onClose();   // ปิด Modal
    } catch (error) {
      alert(error.message || "Failed to add menu and recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm py-10">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold italic text-slate-800">Add New Menu & Recipe</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Menu Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-600 mb-1">Menu Name</label>
              <input required type="text" placeholder="e.g., Spicy Basil Pork" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2  text-slate-600  bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Type</label>
              <select required value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border  text-slate-600  border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                <option value="1">Main Course</option>
                <option value="2">Appetizer</option>
                <option value="3">Dessert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Price (Baht)</label>
              <input required type="number" min="0" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border text-slate-600  border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Searchable Ingredients Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Ingredients</label>
            
            {/* Custom Searchable Dropdown */}
            <div className="relative mb-4" ref={dropdownRef}>
              <div className="relative">
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
              </div>

              {/* Dropdown List */}
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

            {/* Selected Ingredients List */}
            <div className="space-y-2">
              {selectedIngredients.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">No ingredients added yet.</p>
              ) : (
                selectedIngredients.map(ing => (
                  <div key={ing.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="flex-1 font-medium text-slate-700 text-sm pl-2">{ing.name}</span>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      required
                      placeholder="Amount" 
                      value={ing.amount}
                      onChange={(e) => updateIngredientAmount(ing.id, e.target.value)}
                      className="w-24 px-3 py-1 text-sm bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-orange-500 outline-none text-right  text-slate-600 "
                    />
                    <span className="text-sm text-slate-500 w-8">{ing.unit}</span>
                    <button type="button" onClick={() => handleRemoveIngredient(ing.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex gap-3 border-t border-slate-100 mt-6">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Save Menu & Recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}