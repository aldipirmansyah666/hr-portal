"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          Terjadi Kesalahan
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Maaf, terjadi kesalahan tak terduga saat memuat halaman. Silakan coba
          lagi atau kembali ke beranda.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-slate-500">
            Kode error: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <RotateCcw className="h-4 w-4" />
            Coba Lagi
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
