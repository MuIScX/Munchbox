"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Trash2,
  ChevronDown,
  Search,
  Link2,
} from "lucide-react";

/**
 * ImportCSVModal
 *
 * Parses a CSV with columns: ingredient_name (or name), new_stock
 * Matches rows against the existing ingredient list by name (case-insensitive).
 * Unmatched rows show a dropdown so the user can remap to an existing ingredient.
 * On confirm, calls onImport({ [ingredient_id]: new_stock, ... }).
 */
export default function ImportCSVModal({
  isOpen,
  onClose,
  onImport,
  ingredients = [],
}) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [remaps, setRemaps] = useState({}); // { rowIndex: ingredient_id }
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const fileRef = useRef(null);

  // ── Build lookup maps ──
  const { nameToIngredient, allIngredients } = useMemo(() => {
    const map = {};
    const list = [];
    for (const ing of ingredients) {
      const id = String(ing.ingredient_id ?? ing.id);
      const name = (ing.ingredient_name || ing.name || "").trim();
      const entry = {
        id,
        name,
        unit: ing.unit || "—",
        currentStock: ing.stock_left ?? ing.stock ?? "—",
      };
      if (name) map[name.toLowerCase()] = entry;
      list.push(entry);
    }
    return { nameToIngredient: map, allIngredients: list };
  }, [ingredients]);

  const reset = () => {
    setFile(null);
    setRows([]);
    setParseError(null);
    setParsing(false);
    setRemaps({});
    setOpenDropdown(null);
    setDropdownSearch("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── CSV parsing ──
  const parseCSV = useCallback(
    (text) => {
      setParsing(true);
      setParseError(null);
      setRows([]);
      setRemaps({});

      try {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          setParseError("CSV must have a header row and at least one data row.");
          setParsing(false);
          return;
        }

        const header = lines[0]
          .split(",")
          .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

        const nameIdx = header.findIndex(
          (h) => h === "ingredient_name" || h === "name" || h === "ingredient"
        );
        const stockIdx = header.findIndex(
          (h) => h === "new_stock" || h === "stock" || h === "quantity"
        );

        if (nameIdx === -1 || stockIdx === -1) {
          setParseError(
            'Missing required columns. The CSV must contain "ingredient_name" (or "name") and "new_stock" (or "stock" / "quantity") columns.'
          );
          setParsing(false);
          return;
        }

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          // Handle commas within quotes
          const cols = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
          if (!cols) continue;
          const cleaned = cols.map((c) =>
            c.trim().replace(/^["']|["']$/g, "")
          );

          const rawName = cleaned[nameIdx]?.trim();
          const rawStock = cleaned[stockIdx]?.trim();

          if (!rawName) continue;

          const stockNum = parseFloat(rawStock);
          const match = nameToIngredient[rawName.toLowerCase()];

          let error = null;
          if (isNaN(stockNum) || stockNum < 0) error = "Invalid stock value";

          parsed.push({
            csvName: rawName,
            new_stock: isNaN(stockNum) ? rawStock : stockNum,
            matched: !!match && !error,
            ingredientId: match?.id || null,
            ingredientName: match?.name || null,
            unit: match?.unit || "—",
            currentStock: match?.currentStock ?? "—",
            error: !match ? "not_found" : error,
          });
        }

        if (parsed.length === 0) {
          setParseError("No valid data rows found in the CSV.");
          setParsing(false);
          return;
        }

        setRows(parsed);
      } catch {
        setParseError("Failed to parse CSV. Please check the file format.");
      } finally {
        setParsing(false);
      }
    },
    [nameToIngredient]
  );

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith(".csv") && f.type !== "text/csv") {
      setParseError("Please upload a .csv file.");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target.result);
    reader.onerror = () => setParseError("Failed to read file.");
    reader.readAsText(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  // ── Remap logic ──
  const handleRemap = (rowIndex, ingredientId) => {
    const ing = allIngredients.find((i) => i.id === ingredientId);
    if (!ing) return;
    setRemaps((prev) => ({ ...prev, [rowIndex]: ingredientId }));
    setOpenDropdown(null);
    setDropdownSearch("");
  };

  const clearRemap = (rowIndex) => {
    setRemaps((prev) => {
      const copy = { ...prev };
      delete copy[rowIndex];
      return copy;
    });
  };

  // ── Resolved rows (apply remaps) ──
  const resolvedRows = useMemo(() => {
    return rows.map((r, i) => {
      if (r.matched) return { ...r, resolved: true };

      const remappedId = remaps[i];
      if (remappedId) {
        const ing = allIngredients.find((x) => x.id === remappedId);
        if (ing) {
          return {
            ...r,
            resolved: true,
            ingredientId: ing.id,
            ingredientName: ing.name,
            unit: ing.unit,
            currentStock: ing.currentStock,
            error: r.error === "not_found" ? null : r.error,
          };
        }
      }

      return { ...r, resolved: false };
    });
  }, [rows, remaps, allIngredients]);

  const importableRows = resolvedRows.filter(
    (r) => r.resolved && r.ingredientId && r.error !== "Invalid stock value"
  );
  const unmatchedRows = resolvedRows.filter((r) => !r.resolved);
  const invalidStockRows = resolvedRows.filter(
    (r) => r.error === "Invalid stock value"
  );

  // ── Confirm ──
  const handleConfirm = () => {
    const values = {};
    for (const r of importableRows) {
      values[r.ingredientId] = String(r.new_stock);
    }
    onImport(values);
    handleClose();
  };

  // ── Template download ──
  const downloadTemplate = () => {
    const header = "ingredient_name,new_stock";
    const sampleRows = ingredients.slice(0, 5).map((ing) => {
      const name = (ing.ingredient_name || ing.name || "").replace(/,/g, " ");
      return `${name},0`;
    });
    const csv = [header, ...sampleRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_update_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Remap dropdown component ──
  const RemapDropdown = ({ rowIndex }) => {
    const isOpen = openDropdown === rowIndex;
    const remappedId = remaps[rowIndex];
    const remappedIng = remappedId
      ? allIngredients.find((x) => x.id === remappedId)
      : null;

    const filtered = allIngredients.filter((ing) =>
      ing.name.toLowerCase().includes(dropdownSearch.toLowerCase())
    );

    const openMenu = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownW = 260;
      const dropdownH = 260;
      let top = rect.bottom + 4;
      let left = rect.left;
      if (left + dropdownW > window.innerWidth - 8) {
        left = window.innerWidth - dropdownW - 8;
      }
      if (top + dropdownH > window.innerHeight - 8) {
        top = rect.top - dropdownH - 4;
      }
      setDropdownPos({ top, left });
      setOpenDropdown(isOpen ? null : rowIndex);
      setDropdownSearch("");
    };

    return (
      <div>
        {remappedIng ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-1 rounded-lg">
              <Link2 size={10} />
              {remappedIng.name}
            </span>
            <button
              onClick={() => clearRemap(rowIndex)}
              className="p-0.5 text-slate-300 hover:text-red-400 transition"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={openMenu}
            className="flex items-center gap-1 text-[11px] font-semibold text-orange-500 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg transition"
          >
            Map to ingredient <ChevronDown size={11} />
          </button>
        )}

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => {
                setOpenDropdown(null);
                setDropdownSearch("");
              }}
            />
            <div
              className="fixed w-[260px] bg-white border border-slate-200 rounded-xl shadow-2xl z-[70] overflow-hidden"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                  <Search size={12} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search ingredients..."
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 italic">
                    No match
                  </p>
                ) : (
                  filtered.map((ing) => (
                    <button
                      key={ing.id}
                      onClick={() => handleRemap(rowIndex, ing.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 hover:text-orange-600 transition-colors flex items-center justify-between group"
                    >
                      <span className="font-medium text-slate-700 group-hover:text-orange-600 truncate">
                        {ing.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {ing.unit}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-300 shrink-0" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Import CSV</h2>
              <p className="text-[11px] text-slate-400">
                Upload a CSV with{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">
                  ingredient_name
                </code>{" "}
                and{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">
                  new_stock
                </code>{" "}
                columns
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {/* Drop zone */}
          {(!file || (parseError && rows.length === 0)) && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  dragOver
                    ? "border-orange-400 bg-orange-50"
                    : "border-slate-200 bg-slate-50/50 hover:border-orange-300 hover:bg-orange-50/30"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                    dragOver ? "bg-orange-200" : "bg-slate-100"
                  }`}
                >
                  <Upload
                    size={22}
                    className={dragOver ? "text-orange-600" : "text-slate-400"}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    {dragOver
                      ? "Drop your CSV here"
                      : "Click or drag & drop your CSV"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Columns: ingredient_name, new_stock
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-xs text-orange-500 hover:text-orange-600 font-semibold transition mx-auto"
              >
                <Download size={13} /> Download template CSV
              </button>
            </>
          )}

          {parseError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertTriangle
                size={16}
                className="text-red-400 mt-0.5 shrink-0"
              />
              <p className="text-sm text-red-600">{parseError}</p>
            </div>
          )}

          {parsing && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-orange-400" size={24} />
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <>
              {/* Summary */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">
                  {file?.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                    <CheckCircle2 size={12} /> {importableRows.length} ready
                  </span>
                  {unmatchedRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                      <AlertTriangle size={12} /> {unmatchedRows.length}{" "}
                      unmatched
                    </span>
                  )}
                  {invalidStockRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-500 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                      <AlertTriangle size={12} /> {invalidStockRows.length}{" "}
                      invalid
                    </span>
                  )}
                </div>
                <button
                  onClick={reset}
                  className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 font-medium transition"
                >
                  <Trash2 size={12} /> Clear
                </button>
              </div>

              {/* Mismatch warning */}
              {unmatchedRows.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <AlertTriangle
                    size={15}
                    className="text-amber-500 mt-0.5 shrink-0"
                  />
                  <p className="text-xs text-amber-700">
                    <span className="font-bold">
                      {unmatchedRows.length} ingredient
                      {unmatchedRows.length > 1 ? "s" : ""} not recognized.
                    </span>{" "}
                    Use the{" "}
                    <span className="font-semibold text-orange-600">
                      "Map to ingredient"
                    </span>{" "}
                    button to link each one to an existing ingredient, or leave
                    them to skip on import.
                  </p>
                </div>
              )}

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <th className="px-4 py-2.5 w-10"></th>
                      <th className="px-4 py-2.5">CSV Name</th>
                      <th className="px-4 py-2.5">Matched Ingredient</th>
                      <th className="px-4 py-2.5 text-center">Current</th>
                      <th className="px-4 py-2.5 text-center">New Stock</th>
                      <th className="px-4 py-2.5 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resolvedRows.map((r, i) => {
                      const isUnmatched =
                        r.error === "not_found" && !r.resolved;
                      const isInvalid = r.error === "Invalid stock value";

                      return (
                        <tr
                          key={i}
                          className={
                            r.resolved && !isInvalid
                              ? "bg-white"
                              : isUnmatched
                              ? "bg-amber-50/40"
                              : "bg-red-50/40"
                          }
                        >
                          <td className="px-4 py-2.5">
                            {r.resolved && !isInvalid ? (
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500"
                              />
                            ) : (
                              <AlertTriangle
                                size={14}
                                className={
                                  isUnmatched
                                    ? "text-amber-400"
                                    : "text-red-400"
                                }
                              />
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            <span className="text-sm font-medium text-slate-600">
                              {r.csvName}
                            </span>
                          </td>

                          <td className="px-4 py-2.5">
                            {r.resolved && !isInvalid ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-slate-800">
                                  {r.ingredientName}
                                </span>
                                {remaps[i] && (
                                  <button
                                    onClick={() => clearRemap(i)}
                                    className="p-0.5 text-slate-300 hover:text-red-400 transition"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            ) : isUnmatched ? (
                              <RemapDropdown rowIndex={i} />
                            ) : (
                              <span className="text-xs italic text-red-400">
                                {r.error}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-sm text-slate-400 text-center">
                            {r.resolved ? r.currentStock : "—"}
                          </td>

                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`text-sm font-semibold ${
                                r.resolved && !isInvalid
                                  ? "text-orange-600"
                                  : "text-slate-300"
                              }`}
                            >
                              {r.new_stock}
                            </span>
                          </td>

                          <td className="px-4 py-2.5 text-xs text-slate-400 text-center">
                            {r.resolved ? r.unit : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-white">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={importableRows.length === 0}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition shadow-sm disabled:opacity-50 active:scale-95 flex items-center gap-2"
          >
            <Upload size={14} />
            Import{" "}
            {importableRows.length > 0 ? `(${importableRows.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}