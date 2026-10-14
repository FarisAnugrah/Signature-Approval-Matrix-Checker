"use client";

import { useState } from "react";

export default function EmailDraft({ projectName, missingItems, missingSignatures }: {
  projectName: string;
  missingItems: string[];
  missingSignatures: { path: string; missing_roles: string[] }[];
}) {
  const [email, setEmail] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const hasFindings = missingItems.length > 0 || missingSignatures.length > 0;

  return (
    <form className="p-6 bg-white rounded-3xl border border-[#006747]/20 space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (preparing || !hasFindings) return;
      setPreparing(true);
      setPreview("");
      setError("");
      try {
        const response = await fetch("http://localhost:8001/api/alert/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: email.trim(),
            project_name: projectName,
            missing_items: missingItems,
            missing_signatures: missingSignatures
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Gagal menyiapkan draf.");
        if (typeof data.preview !== "string" || !data.preview.trim()) throw new Error("Server tidak mengembalikan preview draf.");
        setPreview(data.preview);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Gagal menyiapkan draf.");
      } finally {
        setPreparing(false);
      }
    }}>
      <h3 className="text-lg font-bold text-[#006747]">Draf reminder email</h3>
      <p className="text-sm text-slate-600">Simulasi saja — email tidak dikirim. SEARCH kontak belum tersedia karena belum ada data direktori. Masukkan email manual; impor/integrasi direktori direncanakan nanti.</p>
      <label className="block text-sm font-semibold">
        Email PIC / Penandatangan
        <input type="email" required autoComplete="email" value={email} disabled={preparing} onChange={event => { setEmail(event.target.value); setPreview(""); setError(""); }} className="block mt-2 w-full px-4 py-3 rounded-xl border border-slate-300 disabled:opacity-60" />
      </label>
      {!hasFindings && <p className="text-sm text-slate-600">Tidak ada temuan dokumen hilang atau peran pending untuk draf reminder. Hasil gagal diproses perlu diperiksa ulang.</p>}
      <button disabled={preparing || !hasFindings} className="px-5 py-3 rounded-xl bg-[#006747] text-white font-bold disabled:bg-slate-200 disabled:text-slate-500">
        {preparing ? "Menyiapkan draf..." : "Siapkan draf (tidak dikirim)"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {preview && <div role="status" className="space-y-3">
        <p className="font-semibold text-[#006747]">Preview draf dari server — email tidak dikirim.</p>
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm">{preview}</pre>
      </div>}
    </form>
  );
}
