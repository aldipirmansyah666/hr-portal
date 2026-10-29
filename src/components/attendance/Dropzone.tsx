"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";

type DropzoneProps = {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
};

const ACCEPTED = [".csv", ".xlsx"];

export default function Dropzone({ file, onFile, disabled, onError }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validate = (candidate: File) => {
    const ext = candidate.name.slice(candidate.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      onError?.("Format file tidak didukung. Gunakan file .csv atau .xlsx.");
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      onError?.("Ukuran file maksimal 10 MB.");
      return;
    }
    onFile(candidate);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validate(dropped);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300 ${
          dragging
            ? "border-indigo-500 bg-indigo-50 scale-[1.01]"
            : file
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) validate(picked);
            e.target.value = "";
          }}
        />

        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
            dragging
              ? "bg-indigo-600 text-white shadow-sm"
              : file
                ? "bg-emerald-100 text-emerald-600"
                : "bg-white text-slate-400 group-hover:text-indigo-600 shadow-sm"
          }`}
        >
          {file ? (
            <FileSpreadsheet className="h-8 w-8" />
          ) : (
            <UploadCloud className="h-8 w-8" />
          )}
        </div>

        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB — siap diproses
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">
              {dragging ? "Lepaskan file untuk mulai" : "Tarik file ke sini atau klik untuk memilih"}
            </p>
            <p className="text-xs text-slate-500">
              Mendukung file <span className="text-slate-700">.csv</span> dan{" "}
              <span className="text-slate-700">.xlsx</span> — maksimal 10 MB
            </p>
          </div>
        )}
      </div>

      {file && !disabled && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onFile(null)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <X className="h-3.5 w-3.5" />
            Hapus file
          </button>
        </div>
      )}
    </div>
  );
}

export function ProcessingOverlay({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-10 shadow-sm">
      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}
