"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export default function IngredientFilterPopover({ isOpen, onClose, ingredients, selected, onToggle, onClear }) {
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!isOpen) return null;

  const selectedItems = ingredients.filter(ing => selected.includes(ing.ingredient_id || ing.id));

  const filteredSuggestions = ingredients
    .filter(ing => {
      const name = (ing.ingredient_name || ing.name || "").toLowerCase();
      const id = ing.ingredient_id || ing.id;
      return name.includes(searchTerm.toLowerCase()) && !selected.includes(id);
    })
    .slice(0, searchTerm === "" ? 5 : 50);

  const handleAdd = (ing) => {
    onToggle(ing.ingredient_id || ing.id);
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  return (
    <div
      ref={ref}
      className="absolute -top-3 left-full ml-3 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl w-80 overflow-hidden"
    >
      <div className="p-4 space-y-3 min-h-[230px]">

        {/* 1. Search input always on top */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent transition">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Search and add ingredients..."
              className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
            />
          </div>

          {isDropdownOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((ing) => (
                  <button
                    key={ing.ingredient_id || ing.id}
                    onMouseDown={(e) => { e.preventDefault(); handleAdd(ing); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-600 font-medium transition-colors"
                  >
                    {ing.ingredient_name || ing.name}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2.5 text-xs text-slate-400 italic">
                  {searchTerm ? "No matching ingredients" : "All ingredients selected"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2. Selected pills below search */}
        {selectedItems.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => { onClear(); setSearchTerm(""); }}
              className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors"
            >
              Clear all
            </button>

            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map((ing) => {
                const id = ing.ingredient_id || ing.id;
                const name = ing.ingredient_name || ing.name;
                return (
                  <span
                    key={id}
                    className="group flex items-center gap-1 pl-3 pr-2 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold rounded-full transition-colors hover:border-red-300 hover:bg-red-50 cursor-pointer"
                    onClick={() => onToggle(id)}
                  >
                    {name}
                    <X size={11} className="text-orange-400 group-hover:text-red-500 transition-colors shrink-0" strokeWidth={2.5} />
                  </span>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
