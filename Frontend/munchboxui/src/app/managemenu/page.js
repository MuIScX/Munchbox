"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { MenuAPI } from "@/lib/api";

import { Search, Trash2 } from "lucide-react";

/* Map type จากตัวเลข → ชื่อ */
const TYPE_MAP = {
  1: "Main",
  2: "Appetizer",
  3: "Dessert",
};

export default function ManageMenuPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await MenuAPI.list();
      console.log("MENU DATA:", res.Data);
      setMenus(Array.isArray(res?.Data) ? res.Data : []);
    } catch (err) {
      console.error(err.message);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  // --- UNCOMMENTED AND UPDATED DELETE HANDLER ---
  const handleDelete = async (menuId) => {
    // Add a confirmation popup so users don't delete by accident
    const isConfirmed = window.confirm("Are you sure you want to delete this menu?");
    if (!isConfirmed) return;

    try {
      await MenuAPI.delete(menuId);

      // อัปเดต state แบบไม่ต้อง fetch ใหม่
      setMenus((prev) => prev.filter((m) =>
        (m.menu_id || m.id) !== menuId
      ));

    } catch (err) {
      alert(err.message || "Delete failed");
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  /* Filter logic */  
  const filteredMenus = menus.filter((m) => {
    const name = (m.menu_name || m.name || "").toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase());

    const typeValue = m.menu_type || m.type;
    const matchesCategory =
      selectedCategory === "All" ||
      String(typeValue) === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 overflow-y-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold italic text-slate-800">
              Manage Menu
            </h1>

            <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition active:scale-95 shadow-md">
              + Add Menu
            </button>
          </div>

          {/* Summary */}
          <div className="bg-[#cfe3f1] w-72 rounded-2xl p-4 mb-6">
            <p className="text-[#2c6b8a] text-sm">Total Recipes</p>
            <h2 className="text-3xl font-bold text-black">
              {filteredMenus.length}
            </h2>
          </div>

          {/* Search + Category */}
          <div className="flex gap-4 mb-6 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search Menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 text-slate-600 shadow-sm"
            >
              <option value="All">Category: All</option>
              {Object.entries(TYPE_MAP).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold italic text-slate-800">
                All Menu
              </h2>
            </div>

            <div className="max-h-[450px] overflow-y-auto staff-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-500 text-sm italic">
                    <th className="px-6 py-4 font-semibold">Menu</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold text-center">
                      Ingredient Count
                    </th>
                    <th className="px-6 py-4 font-semibold text-center">
                      Food Price
                    </th>
                    <th className="px-6 py-4 font-semibold text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {!loading && filteredMenus.length > 0 ? (
                    filteredMenus.map((menu) => {
                      const id = menu.menu_id || menu.id;
                      const name =
                        menu.menu_name || menu.name || "Unknown";
                      const typeValue =
                        menu.menu_type || menu.type;
                      const price =
                        menu.menu_price || menu.price || 0;
                      const count =
                        menu.ingredient_count ||
                        menu.count ||
                        0;

                      return (
                        <tr
                          key={id}
                          className="group hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 text-slate-700 font-medium">
                            {name}
                          </td>

                          <td className="px-6 py-4 text-slate-500">
                            {TYPE_MAP[typeValue] || typeValue}
                          </td>

                          <td className="px-6 py-4 text-center text-slate-600">
                            {count}
                          </td>

                          <td className="px-6 py-4 text-center text-slate-800 font-medium">
                            {price} Baht
                          </td>

                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-4">
                              <button className="text-blue-500 hover:underline">
                                View Recipe
                              </button>
                              {/* --- WIRED UP ONCLICK HERE --- */}
                              <button
                                onClick={() => handleDelete(id)}
                                className="
                                  opacity-0 
                                  group-hover:opacity-100 
                                  transition-opacity 
                                  duration-200
                                  text-red-500
                                  hover:scale-110
                                  transform
                                "
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    !loading && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center py-10 text-slate-400 italic"
                        >
                          No menu found
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}