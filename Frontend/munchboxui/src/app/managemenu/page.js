"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AddMenuModal from "../components/AddMenuModal";
import DeleteMenuModal from "../components/DeleteMenuModal";
import MenuRow from "../components/MenuRow";
import { MenuAPI } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

const TYPE_MAP = {
  1: "Main",
  2: "Appetizer",
  3: "Dessert",
};

export default function ManageMenuPage() {
  const router = useRouter();

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState(null);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await MenuAPI.list({ restaurant_id: 1 });
      setMenus(Array.isArray(res?.Data) ? res.Data : []);
    } catch (err) {
      console.error(err.message);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const confirmDelete = async () => {
    if (!menuToDelete) return;
    const menuId = menuToDelete.menu_id || menuToDelete.id;

    try {
      await MenuAPI.delete(menuId);
      setMenus((prev) => prev.filter((m) => (m.menu_id || m.id) !== menuId));
      setMenuToDelete(null);
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  };

  const filteredMenus = menus.filter((m) => {
    const name = (m.menu_name || m.name || "").toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase());
    const typeValue = m.menu_type || m.type;
    const matchesCategory = selectedCategory === "All" || String(typeValue) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      {/* Modals */}
      <AddMenuModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMenus}
      />

      <DeleteMenuModal
        isOpen={!!menuToDelete}
        onClose={() => setMenuToDelete(null)}
        onConfirm={confirmDelete}
        menuName={menuToDelete?.menu_name || menuToDelete?.name || "Unknown"}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 overflow-y-auto">

          {/* Header Section */}
          <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold italic text-slate-800">Manage Menu</h1>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-bold transition active:scale-95 shadow-md"
            >
              + Add Menu
            </button>
          </div>

          {/* Summary Box */}
          <div className="bg-[#cfe3f1] w-72 rounded-2xl p-4 mb-6">
            <p className="text-[#2c6b8a] text-sm">Total Recipes</p>
            <h2 className="text-3xl font-bold text-black">{filteredMenus.length}</h2>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search Menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 text-slate-600 shadow-sm"
            >
              <option value="All">Category: All</option>
              {Object.entries(TYPE_MAP).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Menu Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold italic text-slate-800">All Menu</h2>
            </div>

            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-500 text-sm italic">
                    <th className="px-6 py-4 font-semibold">Menu</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold text-center">Ingredient Count</th>
                    <th className="px-6 py-4 font-semibold text-center">Food Price</th>
                    <th className="px-6 py-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center">
                        <Loader2 className="animate-spin mx-auto text-orange-500" size={28} />
                      </td>
                    </tr>
                  ) : filteredMenus.length > 0 ? (
                    filteredMenus.map((menu) => (
                      <MenuRow 
                        key={menu.menu_id || menu.id} 
                        menu={menu} 
                        onViewRecipe={(id) => router.push(`/managemenu/${id}`)}
                        onDeleteClick={setMenuToDelete}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 italic">
                        No menu found
                      </td>
                    </tr>
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