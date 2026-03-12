"use client";
import { useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { ImportAPI } from "../../lib/api";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setErrorMsg("Only .xlsx or .xls files are supported.");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus(null);
    setErrorMsg("");
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const data = await ImportAPI.sales(file);
      setResult(data.Data);
      setStatus("success");
      setFile(null);
    } catch (err) {
      setErrorMsg(err.message || "Import failed.");
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Import Sales Data</h1>
          <p className="text-gray-500 mb-8">
            Upload a monthly Excel file to automatically import sales records and menu items.
          </p>

          {/* Drop Zone */}
          <div
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
              ${dragging
                ? "border-orange-400 bg-orange-50"
                : "border-gray-300 bg-white hover:border-orange-300 hover:bg-orange-50"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <FileSpreadsheet className="mx-auto mb-4 text-orange-400" size={48} />
            {file ? (
              <div>
                <p className="font-semibold text-gray-700">{file.name}</p>
                <p className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-600">Drop your Excel file here</p>
                <p className="text-sm text-gray-400 mt-1">or click to browse — .xlsx, .xls supported</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || status === "loading"}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all
              ${!file || status === "loading"
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600"}`}
          >
            {status === "loading" ? (
              <><Loader2 size={18} className="animate-spin" /> Importing...</>
            ) : (
              <><Upload size={18} /> Import Sales Data</>
            )}
          </button>

          {/* Success */}
          {status === "success" && result && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-6 flex gap-4 items-start">
              <CheckCircle className="text-green-500 mt-0.5 shrink-0" size={24} />
              <div>
                <p className="font-semibold text-green-700">Import Successful!</p>
                <p className="text-sm text-green-600 mt-1">
                  Processed <strong>{result.sheets_processed}</strong> days —{" "}
                  <strong>{result.records_imported}</strong> sale records imported.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-6 flex gap-4 items-start">
              <XCircle className="text-red-500 mt-0.5 shrink-0" size={24} />
              <div>
                <p className="font-semibold text-red-700">Import Failed</p>
                <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
            <p className="font-semibold mb-2">What this import does:</p>
            <ul className="space-y-1 list-disc list-inside text-blue-600">
              <li>Each sheet = one day of sales</li>
              <li>Auto-creates menu items that don't exist yet</li>
              <li>Calculates price from revenue ÷ quantity</li>
              <li>Skips duplicate records (same menu, same day)</li>
              <li>Groups items by category into correct menu types</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}