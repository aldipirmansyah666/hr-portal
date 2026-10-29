"use client";

import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { useModalDismiss } from "@/lib/useModalDismiss";

type ConfirmDialogProps = {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "success";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dismiss = () => {
    if (!busy) onCancel();
  };

  useModalDismiss(true, dismiss);

  const iconTone =
    tone === "success"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-rose-50 text-rose-600";
  const confirmTone =
    tone === "success"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-rose-600 hover:bg-rose-700";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={dismiss}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconTone}`}
          >
            {tone === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <div className="mt-1 text-sm text-slate-500">{message}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${confirmTone}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          aria-label="Tutup dialog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
