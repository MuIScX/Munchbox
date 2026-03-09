"use client";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { ChevronDown, Search, HelpCircle, Package, BarChart2, Users, CookingPot, Bell } from "lucide-react";

const faqs = [
  {
    category: "Inventory",
    icon: Package,
    color: "text-blue-500",
    questions: [
      {
        q: "How do I add new inventory items?",
        a: "Go to Manage Inventory from the sidebar, then click the '+ Add Item' button in the top right. Fill in the ingredient name, unit, current stock, and minimum threshold. Click Save to add it to your inventory.",
      },
      {
        q: "How do I update stock levels?",
        a: "In the Manage Inventory page, find the ingredient you want to update and click the edit icon. You can adjust the current stock quantity directly. Changes are saved immediately.",
      },
      {
        q: "What happens when stock is low?",
        a: "When an ingredient falls below its minimum threshold, it will be flagged with a warning indicator and you will receive a notification. The ingredient will also appear in the low-stock section of your dashboard.",
      },
    ],
  },
  {
    category: "Predictions",
    icon: BarChart2,
    color: "text-emerald-500",
    questions: [
      {
        q: "How does stock prediction work?",
        a: "MunchBox analyzes your historical sales data and usage patterns to forecast how much of each ingredient you will need. The prediction model updates weekly based on recent trends and seasonal factors.",
      },
      {
        q: "How accurate are the predictions?",
        a: "Accuracy improves over time as the system collects more data. Typically, predictions reach 85–90% accuracy after 4 weeks of consistent data. You can view confidence scores on the Predict Ingredients page.",
      },
    ],
  },
  {
    category: "Reports",
    icon: BarChart2,
    color: "text-orange-500",
    questions: [
      {
        q: "Can I export reports to CSV?",
        a: "Yes! On the View Reports page, use the Export button in the top right corner. You can choose to export revenue, orders, or inventory data as a CSV file for use in Excel or other tools.",
      },
      {
        q: "What date ranges can I view in reports?",
        a: "Reports support daily, weekly, monthly, and custom date range views. Use the date picker on the Reports page to select your desired range.",
      },
    ],
  },
  {
    category: "Staff",
    icon: Users,
    color: "text-purple-500",
    questions: [
      {
        q: "How do I add a new staff member?",
        a: "Navigate to Manage Staff in the sidebar and click '+ Add Staff'. Enter their name and assign a role. Staff members will receive an invitation to set up their account.",
      },
      {
        q: "Can I set different permission levels?",
        a: "Yes, there are two permission levels: Admin (full access) and Staff (view and update inventory only). You can change a staff member's role at any time from the Manage Staff page.",
      },
    ],
  },
  {
    category: "Menu",
    icon: CookingPot,
    color: "text-pink-500",
    questions: [
      {
        q: "How do I link ingredients to a menu item?",
        a: "Open a menu item from Manage Menu and click 'Edit Recipe'. From there you can add ingredients and specify the quantity used per serving. This allows MunchBox to automatically track ingredient consumption.",
      },
      {
        q: "Can I temporarily hide a menu item?",
        a: "Yes, you can toggle the visibility of any menu item from the Manage Menu page without deleting it. Hidden items won't appear in reports or affect predictions.",
      },
    ],
  },
  {
    category: "Notifications",
    icon: Bell,
    color: "text-yellow-500",
    questions: [
      {
        q: "How do I manage my notification preferences?",
        a: "Go to Settings then Notifications to customize which alerts you receive. You can toggle low-stock alerts, daily summaries, and prediction updates individually.",
      },
    ],
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${open ? "border-orange-200 bg-orange-50/30" : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className={`text-sm font-medium transition-colors ${open ? "text-slate-800" : "text-slate-700"}`}>
          {q}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-orange-500" : "text-slate-400"}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${open ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="px-5 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-200 pt-3">
          {a}
        </p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", ...faqs.map((f) => f.category)];

  const filtered = faqs
    .filter((s) => activeCategory === "All" || s.category === activeCategory)
    .map((s) => ({
      ...s,
      questions: s.questions.filter(
        ({ q, a }) =>
          search === "" ||
          q.toLowerCase().includes(search.toLowerCase()) ||
          a.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((s) => s.questions.length > 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-8 overflow-y-auto h-full">

          {/* Page Title Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h1 className="text-2xl font-bold italic text-slate-800">FAQ</h1>
          </div>

          {/* Filters Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-600"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      activeCategory === cat
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ Content Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-bold italic text-slate-800 text-lg">Frequently Asked Questions</h2>
            </div>

            <div className="p-6">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm italic">No results found for &quot;{search}&quot;</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {filtered.map((section) => {
                    const Icon = section.icon;
                    return (
                      <div key={section.category}>
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className={`w-4 h-4 ${section.color}`} strokeWidth={2.5} />
                          <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase italic">
                            {section.category}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {section.questions.map((item, i) => (
                            <FAQItem key={i} q={item.q} a={item.a} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}