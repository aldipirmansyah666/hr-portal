import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <FileQuestion className="h-7 w-7" />
        </div>
        <p className="mt-4 text-sm font-medium uppercase tracking-wider text-slate-500">
          404
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Halaman Tidak Ditemukan
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Halaman yang kamu tuju tidak ada atau sudah dipindahkan.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Home className="h-4 w-4" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
