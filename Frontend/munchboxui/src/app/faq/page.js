"use client";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { ChevronDown, Search, HelpCircle, Package, BarChart2, Users, CookingPot, Target, LayoutDashboard, Settings } from "lucide-react";

const faqs = [
  {
    category: "Dashboard",
    icon: LayoutDashboard,
    color: "text-orange-500",
    questions: [
      {
        q: "What does the dashboard show?",
        a: "The dashboard gives you a quick overview of your restaurant's status. It shows today's orders and revenue, forecast accuracy, ingredients predicted to run low, and menu items that may be unable to serve due to low stock.",
      },
      {
        q: "Can I navigate to other pages from the dashboard?",
        a: "Yes. Clicking the icon or title of any dashboard card — Sales Trend, Forecast Accuracy, Low Stock Items, or Unable to Serve — will take you directly to the relevant page.",
      },
      {
        q: "What does 'Low Stock Items' mean on the dashboard?",
        a: "It shows ingredients predicted to run out within the selected number of days (3 or 7), based on the latest forecast. You can toggle between 3-day and 7-day views. If an ingredient appears at 3 days but not 7, it means the prediction for 7 days ahead has not been run yet.",
      },
    ],
  },
  {
    category: "Update Inventory",
    icon: Package,
    color: "text-blue-500",
    questions: [
      {
        q: "How do I update stock levels?",
        a: "Go to Update Inventory from the sidebar. Select your staff name, choose the action type — RESTOCK (adding new stock) or RECHECK (correcting the current count) — then enter the new quantities for each ingredient and press Save.",
      },
      {
        q: "What is the difference between RESTOCK and RECHECK?",
        a: "RESTOCK means you are adding new stock (e.g. a delivery arrived). RECHECK means you are correcting the stock level to match what is physically on hand. Both are logged separately so you can track the reason for each change.",
      },
      {
        q: "Where can I see the history of stock changes?",
        a: "Open the Inventory Log page from the sidebar. Each entry shows the staff member, date, action type (RESTOCK or RECHECK), and the before/after quantities for every ingredient updated in that batch.",
      },
      {
        q: "Can I export inventory log data?",
        a: "Yes. On the Inventory Log page, use the checkboxes to select one or more log batches, then click Export CSV. Each selected batch is exported as its own CSV file.",
      },
    ],
  },
  {
    category: "Predict Ingredient",
    icon: BarChart2,
    color: "text-emerald-500",
    questions: [
      {
        q: "How does stock prediction work?",
        a: "MunchBox uses a Bayesian time-series model that analyzes your historical sales data to forecast how much of each ingredient you will need over a chosen period. You run predictions manually from the Predict Ingredient page. A setting to schedule automatic prediction runs at a chosen frequency is planned for a future update.",
      },
      {
        q: "What strategy options are available?",
        a: "Currently only the Balanced strategy is supported. Conservative and Aggressive strategies are shown but disabled — they are planned for a future update.",
      },
      {
        q: "How accurate are the predictions?",
        a: "Accuracy improves as the system collects more historical sales data. You can review how well past predictions matched actual usage on the Prediction Accuracy page, which shows accuracy percentage, MAE (mean absolute error), and deviation per ingredient.",
      },
      {
        q: "What is the minimum data required to run a prediction?",
        a: "At least 3 days of historical sales data are required for any ingredient. If there is insufficient data, the model will return an error for that ingredient.",
      },
      {
        q: "Can I predict a past date range?",
        a: "No. The model only forecasts future dates. If the end date of your chosen range falls before today (or before the last available data point), you will see a 'Can't predict in the past' error.",
      },
    ],
  },
  {
    category: "Prediction Accuracy",
    icon: Target,
    color: "text-purple-500",
    questions: [
      {
        q: "What does the Prediction Accuracy page show?",
        a: "It compares past predictions against actual ingredient usage recorded through sales. For each ingredient it shows accuracy %, MAE (average error per day), deviation (whether the model tends to over- or under-predict), and the number of days compared.",
      },
      {
        q: "What is MAE?",
        a: "MAE stands for Mean Absolute Error — the average difference between predicted and actual usage per day, in the ingredient's unit. A lower MAE means the model is closer to reality.",
      },
      {
        q: "What does Deviation mean?",
        a: "Deviation (bias) shows the direction of error. A positive deviation means the model tends to over-predict (surplus stock, safe). A negative deviation means it tends to under-predict (risk of running out). Values near 0 mean the model is well-calibrated.",
      },
      {
        q: "Why does an ingredient show no accuracy data?",
        a: "Accuracy requires a prediction that was run before the date being evaluated, with actual sales recorded on the same day. If no such overlap exists yet, the ingredient will show no data.",
      },
    ],
  },
  {
    category: "Sales Report",
    icon: BarChart2,
    color: "text-orange-500",
    questions: [
      {
        q: "What can I see on the Sales Report page?",
        a: "The Sales Report page shows total orders and revenue for a selected date range, a sales trend chart (daily or monthly), a revenue breakdown by category (pie chart), and a per-menu-item table with orders, revenue, and revenue share.",
      },
      {
        q: "Can I export sales reports?",
        a: "Not yet. Export functionality for sales reports (CSV, Excel, Word, PDF) is planned for a future update.",
      },
      {
        q: "How do I switch to a monthly view in the sales trend chart?",
        a: "Check the Monthly checkbox next to the menu selector in the Sales Trend chart. The date pickers will switch to month-selection mode, and the chart will aggregate data by month.",
      },
      {
        q: "What does the Clear button do on the Reports page?",
        a: "Clear resets the date range to the full available period — from the date of your very first recorded sale up to today.",
      },
    ],
  },
  {
    category: "Manage Recipe",
    icon: CookingPot,
    color: "text-pink-500",
    questions: [
      {
        q: "How do I link ingredients to a menu item?",
        a: "Open a menu item from the Manage Recipe page and click Edit. From there you can add ingredients and specify the quantity used per serving. MunchBox uses this to calculate ingredient consumption from sales automatically.",
      },
      {
        q: "Why does a menu item appear in 'Unable to Serve'?",
        a: "A menu item appears as unable to serve when one or more of its recipe ingredients are predicted to run out before the forecast end date. Check the Predict Ingredient page to see which ingredient is the bottleneck.",
      },
    ],
  },
  {
    category: "Manage Staff",
    icon: Users,
    color: "text-indigo-500",
    questions: [
      {
        q: "How does staff login work?",
        a: "On the login screen ('Who Are You'), staff members select their name from the list. No password is required for regular staff. A Manager PIN can be set in Settings to protect sensitive actions like editing restaurant details.",
      },
      {
        q: "How do I add a new staff member?",
        a: "Navigate to Manage Staff in the sidebar and add a new staff entry. The staff member will appear on the login screen immediately.",
      },
    ],
  },
  {
    category: "Settings",
    icon: Settings,
    color: "text-slate-500",
    questions: [
      {
        q: "What can I change in Settings?",
        a: "You can update your restaurant name and Manager PIN. Package, start date, and end date are view-only and managed by your subscription.",
      },
      {
        q: "What does the Manager PIN protect?",
        a: "The Manager PIN is required before editing restaurant settings. It is also used to authorize other sensitive actions within the app. If no PIN is set, those actions are accessible without a prompt.",
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <HelpCircle size={20} className="text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">FAQ</h1>
                <p className="text-sm text-slate-400 mt-0.5">Frequently asked questions about MunchBox</p>
              </div>
            </div>
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
