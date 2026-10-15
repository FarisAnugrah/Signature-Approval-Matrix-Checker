"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import EmailDraft from "./email-draft";
import { zipRequest } from "./zip-request";
import {
  UploadCloud, CheckCircle2, XCircle, Loader2, FileText, ShieldCheck,
  ChevronRight, ChevronDown, AlertCircle, ScanLine, Terminal, Edit3,
  Check, ListChecks, Trash2, FolderTree, Download, ChevronsUpDown, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type RoleResult = {
  found: boolean;
  signed: boolean;
  ink: number;
  manual_override?: boolean;
};

type DocumentResult = { fileName: string } & (
  | { error: string }
  | {
      document_type: string;
      status: 'APPROVED' | 'PENDING';
      results: Record<string, RoleResult>;
      jira_labels_to_add: string[];
    }
);

type SignatureAnalysis =
  | { status: 'APPROVED' | 'PENDING'; missing_roles: string[] }
  | { status: 'ERROR'; error: string }
  | { status: 'UNRECOGNIZED_TEMPLATE' | 'UNSUPPORTED' | 'NO_PDF' | 'MULTIPLE_PDFS' | 'NOT_CHECKED' };

type ZipResult = {
  mode: 'itp' | 'custom' | 'inventory';
  folders: string[];
  tree: { path: string; kind: 'folder' | 'file'; empty?: boolean; size?: number }[];
  total_projects: number;
  projects: Record<string, {
    project_name: string;
    root: string;
    folders: string[];
    unmapped_count: number;
    completeness_score: string | null;
    percent: number | null;
    missing_signatures_count: number;
    items: {
      path: string;
      status: 'Ditemukan' | 'Belum ditemukan' | 'Perlu pemetaan' | 'Folder kosong';
      mapped_path: string | null;
      files: string[];
      requires_signature: boolean;
      signature_analysis: SignatureAnalysis | null;
    }[];
  }>;
};

export default function Home() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isFolder = pathname === "/folder-checker";
  const isZip = pathname === "/zip-checker";
  // Single PDF states
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DocumentResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draggingSection, setDraggingSection] = useState<'zip' | 'pdf' | 'folder' | null>(null);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // Folder Direct Inspection states
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderResults, setFolderResults] = useState<ZipResult | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [expandedFolderItems, setExpandedFolderItems] = useState<Record<number, boolean>>({});

  // ZIP Inspection states
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipResults, setZipResults] = useState<ZipResult | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [expandedZipItems, setExpandedZipItems] = useState<Record<number, boolean>>({});
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [checklistMode, setChecklistMode] = useState<'itp' | 'custom' | 'inventory'>('itp');
  const [customCategories, setCustomCategories] = useState('');
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [folderMapping, setFolderMapping] = useState<Record<string, Record<string, string | null>>>({});
  const [mappingDirty, setMappingDirty] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');

  const [checklistFilter, setChecklistFilter] = useState<'all' | 'missing' | 'empty' | 'pending_sig'>('all');

  const resetZip = () => {
    setZipResults(null); setFolderResults(null); setProjectRoots([]); setFolderMapping({}); setMappingDirty(false);
    setExpandedZipItems({}); setExpandedFolderItems({});
    setChecklistFilter('all');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleDragOver = (e: React.DragEvent, section: 'zip' | 'pdf' | 'folder') => { e.preventDefault(); setDraggingSection(section); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDraggingSection(null); };

  const handleDrop = (e: React.DragEvent, section: 'zip' | 'pdf' | 'folder') => {
    e.preventDefault(); setDraggingSection(null);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    if (section === 'zip' ? zipLoading : section === 'folder' ? folderLoading : loading) return;

    if (section === 'zip') {
      const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.zip'));
      if (file) {
        setZipFile(file);
        resetZip();
        setZipError(null);
      } else {
        setZipError("Silakan upload file berkas berformat .zip");
      }
    } else if (section === 'folder') {
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) {
        setFolderFiles(dropped);
        resetZip();
        setFolderError(null);
      } else {
        setFolderError("Folder kosong atau tidak dapat dibaca");
      }
    } else {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]); setResults([]); setError(null);
      } else setError("Please upload valid PDF documents.");
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFolderFiles(Array.from(e.target.files));
      resetZip();
      setFolderError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      setFiles(prev => [...prev, ...selectedFiles]); setResults([]); setError(null);
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        setZipFile(file);
        resetZip();
        setZipError(null);
      } else {
        setZipError("Silakan upload file berkas berformat .zip");
      }
    }
  };

  const removeFile = (index: number) => { setFiles(prev => prev.filter((_, i) => i !== index)); setResults([]); };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true); setError(null); setResults([]);

    try {
      const newResults = [];
      for (const file of files) {
        const formData = new FormData(); formData.append("file", file);
        const res = await fetch("http://localhost:8001/verify/async", { method: "POST", body: formData });
        const data = await res.json();

        if (data.job_id) {
          let isDone = false;
          while (!isDone) {
            await new Promise(r => setTimeout(r, 1200));
            const pollRes = await fetch(`http://localhost:8001/verify/${data.job_id}`);
            const pollData = await pollRes.json();

            if (pollData.status === "completed") {
              newResults.push({ fileName: file.name, ...pollData.result });
              isDone = true;
            } else if (pollData.status === "failed") {
              newResults.push({ fileName: file.name, error: pollData.error });
              isDone = true;
            }
          }
        }
      }
      setResults(newResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleZipUpload = async () => {
    if (!zipFile) return;
    setZipLoading(true); setZipError(null); setZipResults(null); setSelectedProject(null);

    try {
      const formData = new FormData();
      formData.append("file", zipFile);
      formData.append("options", JSON.stringify({ mode: checklistMode, categories: customCategories.split('\n').map(p => p.trim()).filter(Boolean), roots: projectRoots, mapping: folderMapping }));
      const data = await zipRequest("http://localhost:8001/verify/zip", "Upload ZIP", { method: "POST", body: formData });
      if (typeof data.job_id !== "string" || !data.job_id) throw new Error("Upload ZIP: respons backend tidak berisi ID proses.");

      if (data.job_id) {
        let isDone = false;
        const deadline = Date.now() + 10 * 60 * 1000;
        while (!isDone) {
          if (Date.now() > deadline) throw new Error('Waktu tunggu habis; proses server mungkin masih berjalan.');
          await new Promise(r => setTimeout(r, 1500));
          const pollData = await zipRequest(`http://localhost:8001/verify/${data.job_id}`, "Mengambil hasil ZIP");

          if (pollData.status === "completed") {
            setZipResults(pollData.result);
            setMappingDirty(false);
            const firstProj = Object.keys(pollData.result.projects || {})[0];
            if (firstProj !== undefined) setSelectedProject(firstProj);
            isDone = true;
          } else if (pollData.status === "failed") {
            setZipError(pollData.error || "Gagal menganalisis arsip ZIP");
            isDone = true;
          }
        }
      }
    } catch (err) {
      setZipError(err instanceof Error ? err.message : String(err));
    } finally {
      setZipLoading(false);
    }
  };

  const handleFolderUpload = async () => {
    if (folderFiles.length === 0) return;
    setFolderLoading(true); setFolderError(null); setFolderResults(null); setSelectedProject(null);

    try {
      const formData = new FormData();
      const paths: string[] = [];
      for (const file of folderFiles) {
        formData.append("files", file);
        const rel = (file as { webkitRelativePath?: string }).webkitRelativePath || file.name;
        paths.push(rel);
      }
      formData.append("paths", JSON.stringify(paths));
      formData.append("options", JSON.stringify({ mode: checklistMode, categories: customCategories.split('\n').map(p => p.trim()).filter(Boolean), roots: projectRoots, mapping: folderMapping }));
      const res = await fetch("http://localhost:8001/verify/folder", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Gagal memproses folder");

      if (data.job_id) {
        let isDone = false;
        const deadline = Date.now() + 10 * 60 * 1000;
        while (!isDone) {
          if (Date.now() > deadline) throw new Error('Waktu tunggu habis; proses server mungkin masih berjalan.');
          await new Promise(r => setTimeout(r, 1500));
          const pollRes = await fetch(`http://localhost:8001/verify/${data.job_id}`);
          const pollData = await pollRes.json();
          if (!pollRes.ok) throw new Error(pollData.detail || 'Gagal mengambil hasil folder');

          if (pollData.status === "completed") {
            setFolderResults(pollData.result);
            setMappingDirty(false);
            const firstProj = Object.keys(pollData.result.projects || {})[0];
            if (firstProj !== undefined) setSelectedProject(firstProj);
            isDone = true;
          } else if (pollData.status === "failed") {
            setFolderError(pollData.error || "Gagal menganalisis folder");
            isDone = true;
          }
        }
      }
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : String(err));
    } finally {
      setFolderLoading(false);
    }
  };

  const toggleRoleStatus = (docIndex: number, role: string) => {
    const newResults = [...results];
    const doc = newResults[docIndex];
    if ('error' in doc) return;

    doc.results[role].signed = !doc.results[role].signed;
    doc.results[role].manual_override = true;

    const missingRoles = Object.entries(doc.results).filter(([, data]) => !data.signed).map(([r]) => r);
    doc.status = missingRoles.length === 0 ? 'APPROVED' : 'PENDING';
    doc.jira_labels_to_add = missingRoles.map(r => `waiting-sign-off-${r.replace(/ /g, '-').toLowerCase()}`);

    setResults(newResults);
  };

  const scrollToScanner = () => document.getElementById("scanner-section")?.scrollIntoView({ behavior: "smooth" });

  const validResults = results.filter((r): r is Exclude<DocumentResult, { error: string }> => !('error' in r));
  const approvedCount = validResults.filter(r => r.status === 'APPROVED').length;
  const pendingCount = validResults.filter(r => r.status !== 'APPROVED').length;

  const filteredResults = results.filter(res => {
    if (filter === 'all') return true;
    if ('error' in res) return false;
    return filter === 'approved' ? res.status === 'APPROVED' : res.status !== 'APPROVED';
  });

  const activeProjectData = (isFolder ? folderResults : zipResults) && selectedProject !== null ? (isFolder ? folderResults : zipResults)!.projects[selectedProject] : null;
  const missingFilesForAlert = activeProjectData
    ? activeProjectData.items.filter((i) => i.status === "Belum ditemukan" || i.status === "Folder kosong").map((i) => i.path)
    : [];
  const missingSigsForAlert = activeProjectData
    ? activeProjectData.items.flatMap((i) => i.signature_analysis?.status === "PENDING" ? [{
        path: i.path,
        missing_roles: i.signature_analysis.missing_roles
      }] : [])
    : [];

  const visibleItems = (activeProjectData?.items ?? []).map((item, idx) => ({ item, idx })).filter(({ item }) =>
    checklistFilter === 'all' ||
    (checklistFilter === 'missing' && item.status !== 'Ditemukan') ||
    (checklistFilter === 'empty' && item.status === 'Folder kosong') ||
    (checklistFilter === 'pending_sig' && item.signature_analysis?.status === 'PENDING')
  );
  const exportReport = (format: 'csv' | 'json') => {
    if (!activeProjectData) return;
    const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const rows = [['Kategori', 'Status', 'Berkas', 'Audit TTD'], ...activeProjectData.items.map(item => [item.path, item.status, item.files.join('\n'), item.signature_analysis?.status ?? '-'])];
    const content = format === 'json' ? JSON.stringify(activeProjectData, null, 2) : '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-${activeProjectData.project_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const checklistToolbar = (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5 text-sm">
      <label className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filter
        <select value={checklistFilter} onChange={e => setChecklistFilter(e.target.value as typeof checklistFilter)} className="rounded-lg border p-2">
          <option value="all">Semua</option><option value="missing">Berkas belum lengkap</option><option value="empty">Folder kosong</option><option value="pending_sig">TTD pending</option>
        </select>
      </label>
      <button type="button" className="rounded-lg border p-2" onClick={() => (isFolder ? setExpandedFolderItems : setExpandedZipItems)(Object.fromEntries(visibleItems.map(({ idx }) => [idx, true])))}><ChevronsUpDown className="mr-1 inline h-4 w-4" />Buka semua</button>
      <button type="button" className="rounded-lg border p-2" onClick={() => (isFolder ? setExpandedFolderItems : setExpandedZipItems)({})}>Tutup semua</button>
      <button type="button" className="rounded-lg border p-2" onClick={() => exportReport('csv')}><Download className="mr-1 inline h-4 w-4" />CSV</button>
      <button type="button" className="rounded-lg border p-2" onClick={() => exportReport('json')}>JSON</button>
      <p className="w-full text-xs text-slate-500" role="status">{visibleItems.length} kategori ditampilkan. Ekspor mencakup seluruh hasil proyek, bukan hanya hasil filter.</p>
      {!visibleItems.length && <p className="w-full text-slate-500">Tidak ada kategori yang cocok dengan filter.</p>}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F8FAF9] text-[#232323] font-sans selection:bg-[#006747]/20 relative overflow-x-hidden">
      {/* Background BSN subtle Islamic geometric pattern overlay & ambient glow */}
      <div className="fixed top-0 left-0 w-full h-screen bg-gradient-to-b from-[#EBF5F0]/70 via-white to-transparent pointer-events-none z-0" />

      <motion.div animate={{ x: mousePos.x * -0.015, y: mousePos.y * -0.015 }} transition={{ type: "spring", damping: 50, stiffness: 200 }} className="fixed -top-[20%] -right-[10%] w-[65%] h-[65%] rounded-full bg-[#006747]/8 blur-[110px] pointer-events-none z-0" />
      <motion.div animate={{ x: mousePos.x * 0.015, y: mousePos.y * 0.015 }} transition={{ type: "spring", damping: 50, stiffness: 200 }} className="fixed top-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#D39121]/10 blur-[120px] pointer-events-none z-0" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0067470a_1px,transparent_1px),linear-gradient(to_bottom,#0067470a_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none mix-blend-multiply z-0" />

      {/* NAVBAR BSN */}
      <nav className="fixed w-full top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-[#006747]/10 shadow-[0_4px_30px_rgba(0,103,71,0.04)]">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-gradient-to-tr from-[#006747] to-[#0A805B] p-2.5 rounded-2xl shadow-md shadow-[#006747]/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-[#006747]">BSN</span>
                <span className="text-xs font-bold uppercase tracking-widest text-[#D39121] bg-[#FFF8E7] px-2 py-0.5 rounded-md border border-[#D39121]/30">ITP</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Compliance & Matrix Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#006747]/5 border border-[#006747]/20 text-[#006747] text-sm font-bold hover:bg-[#006747] hover:text-white transition-all shadow-sm">
              <ShieldCheck className="w-4 h-4" /> Admin Templates
            </motion.a>
          </div>
        </div>
      </nav>

      {/* HERO SECTION BSN THEME */}
      {isLanding && <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 px-6 max-w-7xl mx-auto z-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAF7EE] border border-[#006747]/20 text-[#006747] font-semibold text-xs md:text-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#D39121] animate-pulse"></span>
            Asisten Pemeriksa Kelengkapan Dokumen & Tanda Tangan ITP
          </motion.div>

          <motion.h1 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-5xl md:text-6xl lg:text-[4.4rem] font-black tracking-tight text-[#161620] leading-[1.1]">
            Validasi Dokumen <br className="hidden md:block" /> & <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#006747] via-[#0A805B] to-[#D39121]">Matriks Tanda Tangan.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
            Temukan struktur ZIP proyek dengan checklist ITP, checklist custom, atau inventaris saja. Periksa tanda tangan pada dokumen yang didukung dan siapkan draf reminder PIC (simulasi, tidak dikirim).
          </motion.p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <button onClick={scrollToScanner} className="flex items-center justify-center gap-3 bg-[#006747] hover:bg-[#005439] text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-[#006747]/25 hover:shadow-xl hover:shadow-[#006747]/35 active:scale-[0.98]">
              <ScanLine className="w-5 h-5" /> Mulai Pemeriksaan Dokumen
            </button>
          </div>

          {/* 4 PROCESS STEPS - BSN THEME */}
          <div className="pt-16 grid grid-cols-1 md:grid-cols-4 gap-4 text-left max-w-5xl mx-auto relative">
            <div className="p-5 rounded-2xl bg-white/85 border border-[#006747]/15 shadow-[0_4px_20px_-8px_rgba(0,103,71,0.08)] backdrop-blur-sm relative group hover:border-[#006747]/40 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAF7EE] border border-[#006747]/20 text-[#006747] font-black flex items-center justify-center text-sm">1</div>
                <ChevronRight className="hidden md:block w-5 h-5 text-slate-300 group-hover:text-[#006747] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[#161620] text-base mb-1">Upload Berkas ZIP</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Unggah arsip ZIP proyek dengan nama root dan tahun apa pun tanpa ekstrak manual.</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/85 border border-[#006747]/15 shadow-[0_4px_20px_-8px_rgba(0,103,71,0.08)] backdrop-blur-sm relative group hover:border-[#006747]/40 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF8E7] border border-[#D39121]/30 text-[#D39121] font-black flex items-center justify-center text-sm">2</div>
                <ChevronRight className="hidden md:block w-5 h-5 text-slate-300 group-hover:text-[#D39121] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[#161620] text-base mb-1">Checklist Pohon Berkas</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Pilih checklist ITP, custom, atau inventaris; petakan folder yang namanya berbeda.</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/85 border border-[#006747]/15 shadow-[0_4px_20px_-8px_rgba(0,103,71,0.08)] backdrop-blur-sm relative group hover:border-[#006747]/40 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAF7EE] border border-[#006747]/20 text-[#006747] font-black flex items-center justify-center text-sm">3</div>
                <ChevronRight className="hidden md:block w-5 h-5 text-slate-300 group-hover:text-[#006747] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[#161620] text-base mb-1">Audit Tanda Tangan</h3>
              <p className="text-slate-500 text-xs leading-relaxed">OCR & Vision memindai lembar persetujuan secara dinamis untuk peran yang tercetak.</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/85 border border-[#006747]/15 shadow-[0_4px_20px_-8px_rgba(0,103,71,0.08)] backdrop-blur-sm relative group hover:border-[#006747]/40 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#D39121]/15 border border-[#D39121]/30 text-[#B57814] font-black flex items-center justify-center text-sm">4</div>
                <CheckCircle2 className="w-5 h-5 text-[#006747]" />
              </div>
              <h3 className="font-bold text-[#161620] text-base mb-1">Alerting & Reminder</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Tinjau rekapitulasi dan siapkan draf reminder PIC. Simulasi saja, email tidak dikirim.</p>
            </div>
          </div>
        </div>
      </section>}

      {!isLanding && <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-6">
        <Link href="/" className="font-bold text-[#006747] hover:underline">← Kembali ke beranda</Link>
        <h1 className="text-3xl font-black mt-5">{isFolder ? "Folder Checker (Pilih Langsung)" : isZip ? "ZIP Checker" : "PDF Signature Checker"}</h1>
      </div>}

      {/* WORKSPACE SECTION */}
      <section id="scanner-section" className="py-16 bg-white/80 border-t border-[#006747]/10 relative z-10">
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          {isLanding && <div className="grid md:grid-cols-3 gap-6">
            <Link href="/folder-checker" className="block p-8 bg-white rounded-3xl border border-[#006747]/20 shadow-sm hover:border-[#006747] focus-visible:outline-2 focus-visible:outline-[#006747]">
              <FolderTree className="w-10 h-10 text-[#006747] mb-5" />
              <h2 className="text-xl font-bold text-[#006747]">Pemeriksaan Folder Langsung</h2>
              <p className="text-slate-600 my-4 text-sm">Pilih satu folder proyek langsung dari perangkat tanpa perlu kompresi ZIP.</p>
              <span className="font-bold text-sm text-[#006747]">Pilih Folder Proyek →</span>
            </Link>
            <Link href="/zip-checker" className="block p-8 bg-white rounded-3xl border border-[#006747]/20 shadow-sm hover:border-[#006747] focus-visible:outline-2 focus-visible:outline-[#006747]">
              <UploadCloud className="w-10 h-10 text-[#006747] mb-5" />
              <h2 className="text-xl font-bold text-[#006747]">Pemeriksaan Folder ZIP</h2>
              <p className="text-slate-600 my-4 text-sm">Periksa kelengkapan folder proyek dan tanda tangan dalam arsip berkas .zip.</p>
              <span className="font-bold text-sm text-[#006747]">Buka ZIP Checker →</span>
            </Link>
            <Link href="/pdf-checker" className="block p-8 bg-white rounded-3xl border border-[#006747]/20 shadow-sm hover:border-[#006747] focus-visible:outline-2 focus-visible:outline-[#006747]">
              <FileText className="w-10 h-10 text-[#006747] mb-5" />
              <h2 className="text-xl font-bold text-[#006747]">Pemeriksaan Tanda Tangan PDF</h2>
              <p className="text-slate-600 my-4 text-sm">Periksa matriks tanda tangan satu atau batch berkas PDF dokumen persetujuan.</p>
              <span className="font-bold text-sm text-[#006747]">Buka PDF Signature Checker →</span>
            </Link>
          </div>}
          {!isLanding && isFolder && <section id="folder-section" aria-labelledby="folder-heading" className="contents">
            <div className="min-w-0 space-y-8 scroll-mt-24 lg:col-start-1 lg:row-start-1">
              <div className="text-center space-y-3">
                <h2 id="folder-heading" className="text-2xl md:text-3xl font-black text-[#006747]">Pemeriksaan Folder Proyek Langsung (Tanpa ZIP)</h2>
                <p className="text-slate-600 text-sm max-w-3xl mx-auto">Pilih folder proyek langsung dari perangkat Anda. Struktur subfolder dan file akan diperiksa otomatis dengan checklist yang dipilih tanpa harus dikompresi ke ZIP terlebih dahulu.</p>
              </div>
              <div className="max-w-3xl mx-auto bg-white p-7 rounded-3xl shadow-sm border border-[#006747]/15 text-center">
                <fieldset disabled={folderLoading} className="text-left space-y-3 mb-6">
                  <label className="block font-bold text-[#006747]">Mode checklist
                    <select value={checklistMode} onChange={e => { setChecklistMode(e.target.value as typeof checklistMode); resetZip(); }} className="block w-full border rounded-lg p-3 mt-2">
                      <option value="itp">Checklist ITP</option>
                      <option value="custom">Checklist custom</option>
                      <option value="inventory">Inventaris saja</option>
                    </select>
                  </label>
                  <p className="text-sm text-slate-600">Pilih mode checklist yang diinginkan untuk mengevaluasi kelengkapan berkas pada folder ini.</p>
                  {checklistMode === 'custom' && <>
                    <label className="block text-sm font-bold">Kategori folder wajib (path relatif, satu per baris)
                      <textarea value={customCategories} onChange={e => { setCustomCategories(e.target.value); resetZip(); }} rows={5} maxLength={10000} placeholder={'kontrak\nanalisis/kebutuhan'} className="block w-full border rounded-lg p-3 mt-2 font-mono" />
                    </label>
                    <div className="flex gap-4 text-sm text-[#006747]">
                      <button type="button" onClick={() => { try { localStorage.setItem('bsn-zip-checklist', customCategories); setStorageNotice('Checklist disimpan di browser ini.'); } catch { setStorageNotice('Penyimpanan browser tidak tersedia.'); } }} className="underline">Simpan checklist</button>
                      <button type="button" onClick={() => { try { const saved = localStorage.getItem('bsn-zip-checklist'); if (saved !== null) { setCustomCategories(saved); resetZip(); } setStorageNotice(saved === null ? 'Belum ada checklist tersimpan.' : 'Checklist dimuat.'); } catch { setStorageNotice('Penyimpanan browser tidak tersedia.'); } }} className="underline">Muat tersimpan</button>
                    </div>
                    <p role="status" className="text-sm">{storageNotice}</p>
                  </>}
                </fieldset>
                <div
                  onDragOver={(e) => handleDragOver(e, 'folder')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'folder')}
                  role="button" tabIndex={folderLoading ? -1 : 0} aria-label="Pilih folder dari perangkat" aria-disabled={folderLoading}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!folderLoading) folderInputRef.current?.click(); } }}
                  onClick={() => !folderLoading && folderInputRef.current?.click()}
                  className={`h-[300px] overflow-y-auto flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${draggingSection === 'folder' ? 'border-[#006747] bg-[#EAF7EE]' : 'border-slate-300 hover:border-[#006747] bg-[#FAFDFB]'}`}
                >
                  <input
                    type="file"
                    ref={folderInputRef}
                    // @ts-expect-error standard HTML webkitdirectory attribute for folder picking
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderChange}
                    className="hidden"
                  />
                  {folderLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-[#006747] animate-spin" />
                      <p className="font-bold text-[#161620]">Mengunggah dan memeriksa struktur folder proyek...</p>
                      <p className="text-xs text-slate-500">Menganalisis {folderFiles.length} berkas</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-[#EAF7EE] text-[#006747] rounded-2xl shadow-sm flex items-center justify-center border border-[#006747]/20">
                        <FolderTree className="w-8 h-8" />
                      </div>
                      <p className="font-bold text-[#161620] text-lg">Pilih Folder Proyek</p>
                      <p className="text-slate-500 text-sm">Klik di sini untuk memilih folder proyek langsung dari komputer Anda</p>
                      {folderFiles.length > 0 && (
                        <div className="mt-2 text-xs font-bold text-[#006747] bg-[#EAF7EE] px-4 py-2 rounded-xl border border-[#006747]/20">
                          {folderFiles.length} file dipilih dari folder
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFolderUpload}
                  disabled={folderFiles.length === 0 || folderLoading}
                  className="mt-6 min-h-16 w-full px-4 py-4 bg-[#006747] hover:bg-[#005439] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-all shadow-md shadow-[#006747]/20"
                >
                  {folderLoading ? "Sedang Memeriksa..." : `Jalankan Pemeriksaan Folder (${folderFiles.length} Berkas)`}
                </button>
              </div>

              {folderError && <div role="alert" className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">{folderError}</div>}

              {folderResults && (
                <div className="space-y-6">
                  {/* PROJECT SELECTOR TABS */}
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {Object.keys(folderResults.projects || {}).map((pName) => {
                      const pData = folderResults.projects[pName];
                      return (
                        <button
                          key={pName}
                          onClick={() => { setSelectedProject(pName); }}
                          className={`px-5 py-3 rounded-2xl font-bold text-sm shrink-0 flex items-center gap-3 border transition-all ${selectedProject === pName ? 'bg-[#006747] text-white border-[#006747] shadow-md shadow-[#006747]/20' : 'bg-white text-slate-700 border-slate-200 hover:border-[#006747]/50'}`}
                        >
                          <span>{pData.project_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${selectedProject === pName ? 'bg-white/20 text-white font-extrabold' : 'bg-[#EAF7EE] text-[#006747] font-semibold'}`}>
                            {pData.completeness_score ?? 'Inventaris'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeProjectData && (
                    <div className="bg-white rounded-3xl border border-[#006747]/15 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-[#FAFDFB] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black text-[#161620]">{activeProjectData.project_name}</h3>
                            <span className="bg-[#EAF7EE] text-[#006747] text-xs font-bold px-3 py-1 rounded-full border border-[#006747]/20">
                              {folderResults.mode === 'inventory' ? 'Tanpa penilaian kelengkapan' : activeProjectData.percent === null ? 'Perlu pemetaan' : `${activeProjectData.percent}% kategori berisi file`}
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm mt-1">
                            {folderResults.mode === 'inventory' ? 'Semua folder dan berkas ditampilkan.' : `${activeProjectData.completeness_score} kategori wajib berisi file • ${activeProjectData.missing_signatures_count} dokumen menunggu tanda tangan.`}
                          </p>
                        </div>
                      </div>

                      {checklistToolbar}
                      {/* CHECKLIST ITEMS LIST - ACCORDION DETAIL VIEW */}
                      <div>
                        {/* TABLE HEADER BAR */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-[#F4F9F6] border-b border-[#006747]/15 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <div className="col-span-6 flex items-center gap-2">
                            <span>Kategori / Folder</span>
                          </div>
                          <div className="col-span-2 text-center">Status Berkas</div>
                          <div className="col-span-2 text-center">Jumlah Berkas</div>
                          <div className="col-span-2 text-right">Matriks TTD</div>
                        </div>

                        <div className="divide-y divide-slate-100">
                        {visibleItems.map(({ item, idx }) => {
                          const isFound = item.status === "Ditemukan";
                          const hasSig = item.signature_analysis;
                          const sigPending = hasSig && hasSig.status === "PENDING";
                          const sigApproved = hasSig && hasSig.status === "APPROVED";
                          const fileCount = item.files.length;
                          const isExpanded = !!expandedFolderItems[idx];

                          return (
                            <div key={idx} className="transition-colors hover:bg-slate-50/70">
                              {/* ROW HEADER (CLICKABLE LIST ITEM) */}
                              <div
                                onClick={() => setExpandedFolderItems(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                className="p-4 sm:px-5 sm:py-3.5 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center cursor-pointer select-none flex flex-col gap-2"
                              >
                                {/* KATEGORI / FOLDER */}
                                <div className="sm:col-span-6 flex items-start gap-3 min-w-0">
                                  <div className="mt-0.5 text-slate-400 shrink-0 transition-transform duration-200">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#006747]" /> : <ChevronRight className="w-4 h-4" />}
                                  </div>
                                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isFound ? 'bg-[#006747]' : 'bg-red-400'}`} />
                                  <span className="font-semibold text-slate-900 break-words text-sm leading-snug">
                                    {item.path}
                                  </span>
                                </div>

                                {/* STATUS BERKAS */}
                                <div className="sm:col-span-2 sm:flex sm:justify-center">
                                  <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold border w-fit ${
                                    isFound
                                      ? 'bg-[#EAF7EE] text-[#006747] border-[#006747]/20'
                                      : item.status === 'Folder kosong'
                                      ? 'bg-[#FFF8E7] text-[#D39121] border-[#D39121]/30'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>

                                {/* JUMLAH BERKAS */}
                                <div className="sm:col-span-2 sm:flex sm:justify-center">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    {fileCount} Berkas
                                  </span>
                                </div>

                                {/* MATRIKS TTD */}
                                <div className="sm:col-span-2 sm:flex sm:justify-end">
                                  {item.requires_signature ? (
                                    !isFound ? (
                                      <span className="text-slate-400 text-xs italic">Menunggu file</span>
                                    ) : sigApproved ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EAF7EE] text-[#006747] border border-[#006747]/20">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                                      </span>
                                    ) : sigPending ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFF8E7] text-[#D39121] border border-[#D39121]/30" title={`Kurang: ${hasSig.missing_roles.join(", ")}`}>
                                        <AlertCircle className="w-3.5 h-3.5" /> Kurang ({hasSig.missing_roles.length})
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                        {hasSig?.status === 'MULTIPLE_PDFS' ? 'Multi PDF' : 'Manual'}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-400 text-xs px-2">-</span>
                                  )}
                                </div>
                              </div>

                              {/* ACCORDION DETAIL BODY (OPEN ON CLICK) */}
                              {isExpanded && (
                                <div className="px-5 pb-5 pt-3 bg-[#F9FBFA] border-t border-slate-100">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* LIST BERKAS */}
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
                                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                        <span className="font-bold text-xs text-[#006747] flex items-center gap-1.5">
                                          <FolderTree className="w-4 h-4" /> Daftar Berkas Terdeteksi ({fileCount})
                                        </span>
                                      </div>
                                      {fileCount === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-2">Tidak ada file dalam folder/kategori ini</p>
                                      ) : (
                                        <ul className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                                          {item.files.map((fPath, fIdx) => {
                                            const bName = fPath.split('/').pop();
                                            return (
                                              <li key={fIdx} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 break-all" title={fPath}>
                                                <FileText className="w-3.5 h-3.5 text-[#006747] shrink-0" />
                                                <span className="font-mono text-slate-400 text-[10px] shrink-0">{fIdx + 1}.</span>
                                                <span className="font-medium text-slate-700">{bName}</span>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>

                                    {/* AUDIT MATRIKS TTD */}
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1">
                                      <div className="text-xs font-bold text-[#006747] mb-2 flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4" /> Detail Matriks Tanda Tangan
                                      </div>
                                      {item.requires_signature ? (
                                        !isFound ? (
                                          <p className="text-xs text-slate-500">Berkas belum diunggah.</p>
                                        ) : sigApproved ? (
                                          <div className="text-xs text-[#006747] font-semibold flex items-center gap-1.5 bg-[#EAF7EE] p-2.5 rounded-xl border border-[#006747]/20">
                                            <CheckCircle2 className="w-4 h-4 shrink-0" /> Seluruh tanda tangan yang disyaratkan telah lengkap.
                                          </div>
                                        ) : sigPending ? (
                                          <div className="space-y-1.5 text-xs">
                                            <p className="text-amber-800 font-bold flex items-center gap-1">
                                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" /> Tanda tangan belum lengkap:
                                            </p>
                                            <div className="text-slate-700 break-words bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 space-y-1">
                                              <span className="font-bold text-amber-900 block">Peran yang belum menandatangani:</span>
                                              <span className="font-medium">{hasSig.missing_roles.join(", ")}</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                            {hasSig?.status === 'MULTIPLE_PDFS'
                                              ? 'Terdapat beberapa PDF pada folder ini. Tinjau tanda tangan secara manual pada masing-masing dokumen.'
                                              : 'Dokumen ini memerlukan tinjauan tanda tangan manual.'}
                                          </p>
                                        )
                                      ) : (
                                        <p className="text-xs text-slate-500">Kategori ini tidak mewajibkan audit tanda tangan.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                      {folderResults.mode !== 'inventory' && activeProjectData.unmapped_count === 0 && <EmailDraft
                        key={JSON.stringify([selectedProject, folderResults])}
                        projectName={activeProjectData.project_name}
                        missingItems={missingFilesForAlert}
                        missingSignatures={missingSigsForAlert}
                      />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>}
          {!isLanding && isZip && <section id="zip-section" aria-labelledby="zip-heading" className="contents">
            <div className="min-w-0 space-y-8 scroll-mt-24 lg:col-start-1 lg:row-start-1">
              <div className="text-center space-y-3">
                <h2 id="zip-heading" className="text-2xl md:text-3xl font-black text-[#006747]">Pemeriksaan Kelengkapan Folder Proyek (ZIP)</h2>
                <p className="text-slate-600 text-sm max-w-3xl mx-auto">Unggah arsip ZIP folder proyek untuk memeriksa kelengkapan dokumen, tanda tangan, dan menyiapkan draf pengingat PIC tanpa mengirim email. Gunakan halaman PDF untuk pemeriksaan tanda tangan dokumen satuan atau sekaligus.</p>
              </div>
              <div className="max-w-3xl mx-auto bg-white p-7 rounded-3xl shadow-sm border border-[#006747]/15 text-center">
                <fieldset disabled={zipLoading} className="text-left space-y-3 mb-6">
                  <label className="block font-bold text-[#006747]">Mode checklist
                    <select value={checklistMode} onChange={e => { setChecklistMode(e.target.value as typeof checklistMode); resetZip(); }} className="block w-full border rounded-lg p-3 mt-2">
                      <option value="itp">Checklist ITP</option>
                      <option value="custom">Checklist custom</option>
                      <option value="inventory">Inventaris saja</option>
                    </select>
                  </label>
                  <p className="text-sm text-slate-600">Nama root dan tahun bebas. Pilih root proyek dan petakan nama folder berbeda setelah penemuan otomatis. Inventaris tidak menilai kelengkapan.</p>
                  {checklistMode === 'custom' && <>
                    <label className="block text-sm font-bold">Kategori folder wajib (path relatif, satu per baris)
                      <textarea value={customCategories} onChange={e => { setCustomCategories(e.target.value); resetZip(); }} rows={5} maxLength={10000} placeholder={'kontrak\nanalisis/kebutuhan'} className="block w-full border rounded-lg p-3 mt-2 font-mono" />
                    </label>
                    <div className="flex gap-4 text-sm text-[#006747]">
                      <button type="button" onClick={() => { try { localStorage.setItem('bsn-zip-checklist', customCategories); setStorageNotice('Checklist disimpan di browser ini.'); } catch { setStorageNotice('Penyimpanan browser tidak tersedia.'); } }} className="underline">Simpan checklist</button>
                      <button type="button" onClick={() => { try { const saved = localStorage.getItem('bsn-zip-checklist'); if (saved !== null) { setCustomCategories(saved); resetZip(); } setStorageNotice(saved === null ? 'Belum ada checklist tersimpan.' : 'Checklist dimuat.'); } catch { setStorageNotice('Penyimpanan browser tidak tersedia.'); } }} className="underline">Muat tersimpan</button>
                    </div>
                    <p role="status" className="text-sm">{storageNotice}</p>
                  </>}
                  <p className="text-xs text-slate-500">ZIP: ≤10.000 entri; ≤50 MiB/file; total terbuka ≤500 MiB. TTD otomatis hanya BRD/PCR dengan satu PDF per kategori, maksimal 20 pemeriksaan; lainnya perlu tinjauan manual.</p>
                </fieldset>
                <div
                  onDragOver={(e) => handleDragOver(e, 'zip')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'zip')}
                  role="button" tabIndex={zipLoading ? -1 : 0} aria-label="Pilih file ZIP" aria-disabled={zipLoading}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!zipLoading) zipInputRef.current?.click(); } }}
                  onClick={() => !zipLoading && zipInputRef.current?.click()}
                  className={`h-[300px] overflow-y-auto flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${draggingSection === 'zip' ? 'border-[#006747] bg-[#EAF7EE]' : 'border-slate-300 hover:border-[#006747] bg-[#FAFDFB]'}`}
                >
                  <input type="file" ref={zipInputRef} accept=".zip" onChange={handleZipChange} className="hidden" />
                  {zipLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-[#006747] animate-spin" />
                      <p className="font-bold text-[#161620]">Membaca dan memeriksa pohon folder proyek...</p>
                      <p className="text-xs text-slate-500">Memeriksa kelengkapan file & kolom persetujuan</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-[#EAF7EE] text-[#006747] rounded-2xl shadow-sm flex items-center justify-center border border-[#006747]/20">
                        <FolderTree className="w-8 h-8" />
                      </div>
                      <p className="font-bold text-[#161620] text-lg">Upload File ZIP Proyek</p>
                      <p className="text-slate-500 text-sm">Seret file .zip dengan struktur folder proyek apa pun di sini</p>

                    </div>
                  )}
                </div>

                <button
                  onClick={handleZipUpload}
                  disabled={!zipFile || zipLoading}
                  className="mt-6 min-h-16 w-full px-4 py-4 bg-[#006747] hover:bg-[#005439] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-all shadow-md shadow-[#006747]/20"
                >
                  {zipLoading ? "Sedang Memeriksa..." : "Jalankan Pemeriksaan ZIP"}
                </button>
              </div>
              {zipFile && (
                <div className="text-xs font-bold text-[#006747] bg-[#EAF7EE] px-4 py-3 rounded-xl border border-[#006747]/20 break-all">
                  {zipFile.name} ({(zipFile.size / (1024*1024)).toFixed(2)} MB)
                </div>
              )}
              {zipError && (
                <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-200">
                  {zipError}
                </div>
              )}
            </div>
              {/* ZIP RESULTS */}
              {zipResults && (
                <div className="min-w-0 space-y-6 lg:col-span-2">
                  <details open className="p-6 bg-white border border-[#006747]/20 rounded-2xl">
                    <summary className="font-bold text-[#006747] cursor-pointer">Pohon ZIP lengkap ({zipResults.tree.length} entri)</summary>
                    <ul className="mt-4 max-h-96 overflow-auto font-mono text-sm" aria-label="Inventaris ZIP">
                      {zipResults.tree.map(node => <li key={node.path} style={{ paddingLeft: `${(node.path.split('/').length - 1) * 16}px` }} className="py-1 break-all">{node.kind === 'folder' ? '[Folder]' : '[File]'} {node.path}{node.empty ? ' — kosong (tanpa file)' : ''}{node.kind === 'file' ? ` — ${node.size} byte` : ''}</li>)}
                    </ul>
                    {!zipResults.tree.length && <p>Arsip ZIP kosong.</p>}
                  </details>
                  {zipResults.mode !== 'inventory' && <div className="p-6 bg-white border border-[#006747]/20 rounded-2xl space-y-3">
                    <label className="block font-bold text-[#006747]">Root proyek (pilihan eksplisit mengganti deteksi otomatis)
                      <select multiple size={5} value={projectRoots} disabled={zipLoading} onChange={e => { setProjectRoots(Array.from(e.target.selectedOptions, option => option.value)); setFolderMapping({}); setMappingDirty(true); }} className="block border rounded-lg p-2 w-full mt-2">
                        <option value="">ZIP root</option>
                        {zipResults.folders.map(folder => <option key={folder} value={folder}>{folder}</option>)}
                      </select>
                    </label>
                    <p className="text-sm text-slate-600">Kosongkan pilihan untuk deteksi otomatis; gunakan Ctrl/Cmd untuk beberapa root. Folder dengan nama yang tidak cocok perlu dipetakan, bukan otomatis dianggap hilang.</p>
                    <button type="button" onClick={() => { setProjectRoots([]); setFolderMapping({}); setMappingDirty(true); }} className="text-[#006747] underline">Gunakan deteksi otomatis</button>
                    {mappingDirty && <p role="status" className="text-amber-700">Pilihan berubah. Jalankan ulang pemeriksaan ZIP untuk menerapkan; hasil di bawah masih hasil sebelumnya.</p>}
                    <button onClick={handleZipUpload} disabled={zipLoading} className="block bg-[#006747] text-white rounded-lg px-5 py-3">Terapkan root / pemetaan dan periksa ulang</button>
                  </div>}
                  {/* PROJECT SELECTOR TABS */}
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {Object.keys(zipResults.projects || {}).map((pName) => {
                      const pData = zipResults.projects[pName];
                      return (
                        <button
                          key={pName}
                          onClick={() => { setSelectedProject(pName); }}
                          className={`px-5 py-3 rounded-2xl font-bold text-sm shrink-0 flex items-center gap-3 border transition-all ${selectedProject === pName ? 'bg-[#006747] text-white border-[#006747] shadow-md shadow-[#006747]/20' : 'bg-white text-slate-700 border-slate-200 hover:border-[#006747]/50'}`}
                        >
                          <span>{pData.project_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${selectedProject === pName ? 'bg-white/20 text-white font-extrabold' : 'bg-[#EAF7EE] text-[#006747] font-semibold'}`}>
                            {pData.completeness_score ?? 'Inventaris'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeProjectData && (
                    <div className="bg-white rounded-3xl border border-[#006747]/15 shadow-sm overflow-hidden">
                      {/* HEADER SUMMARY */}
                      <div className="p-6 border-b border-slate-100 bg-[#FAFDFB] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black text-[#161620]">{activeProjectData.project_name}</h3>
                            <span className="bg-[#EAF7EE] text-[#006747] text-xs font-bold px-3 py-1 rounded-full border border-[#006747]/20">
                              {zipResults.mode === 'inventory' ? 'Tanpa penilaian kelengkapan' : activeProjectData.percent === null ? 'Perlu pemetaan' : `${activeProjectData.percent}% kategori berisi file`}
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm mt-1">
                            {zipResults.mode === 'inventory' ? 'Semua folder, file, dan folder kosong ditampilkan; tidak ada kesimpulan dokumen wajib.' : `${activeProjectData.completeness_score} kategori wajib berisi file • ${activeProjectData.unmapped_count} perlu pemetaan • ${activeProjectData.missing_signatures_count} dokumen menunggu tanda tangan. Keberadaan file bukan validasi isi.`}
                          </p>
                        </div>

                      </div>

                      {/* CHECKLIST ITEMS TABLE */}
                      {checklistToolbar}
                      {/* CHECKLIST ITEMS LIST - ACCORDION DETAIL VIEW */}
                      <div>
                        {/* TABLE HEADER BAR */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-[#F4F9F6] border-b border-[#006747]/15 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <div className="col-span-6 flex items-center gap-2">
                            <span>Kategori / Folder</span>
                          </div>
                          <div className="col-span-2 text-center">Status Berkas</div>
                          <div className="col-span-2 text-center">Jumlah Berkas</div>
                          <div className="col-span-2 text-right">Matriks TTD</div>
                        </div>

                        <div className="divide-y divide-slate-100">
                        {visibleItems.map(({ item, idx }) => {
                          const isFound = item.status === "Ditemukan";
                          const hasSig = item.signature_analysis;
                          const sigPending = hasSig && hasSig.status === "PENDING";
                          const sigApproved = hasSig && hasSig.status === "APPROVED";
                          const fileCount = item.files.length;
                          const isExpanded = !!expandedZipItems[idx];

                          return (
                            <div key={idx} className="transition-colors hover:bg-slate-50/70">
                              {/* ROW HEADER (CLICKABLE LIST ITEM) */}
                              <div
                                onClick={() => setExpandedZipItems(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                className="p-4 sm:px-5 sm:py-3.5 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center cursor-pointer select-none flex flex-col gap-2"
                              >
                                {/* KATEGORI / FOLDER */}
                                <div className="sm:col-span-6 flex items-start gap-3 min-w-0">
                                  <div className="mt-0.5 text-slate-400 shrink-0 transition-transform duration-200">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#006747]" /> : <ChevronRight className="w-4 h-4" />}
                                  </div>
                                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isFound ? 'bg-[#006747]' : 'bg-red-400'}`} />
                                  <span className="font-semibold text-slate-900 break-words text-sm leading-snug">
                                    {item.path}
                                  </span>
                                </div>

                                {/* STATUS BERKAS */}
                                <div className="sm:col-span-2 sm:flex sm:justify-center">
                                  <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold border w-fit ${
                                    isFound
                                      ? 'bg-[#EAF7EE] text-[#006747] border-[#006747]/20'
                                      : item.status === 'Folder kosong'
                                      ? 'bg-[#FFF8E7] text-[#D39121] border-[#D39121]/30'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>

                                {/* JUMLAH BERKAS */}
                                <div className="sm:col-span-2 sm:flex sm:justify-center">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    {fileCount} Berkas
                                  </span>
                                </div>

                                {/* MATRIKS TTD */}
                                <div className="sm:col-span-2 sm:flex sm:justify-end">
                                  {item.requires_signature ? (
                                    !isFound ? (
                                      <span className="text-slate-400 text-xs italic">Menunggu file</span>
                                    ) : sigApproved ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EAF7EE] text-[#006747] border border-[#006747]/20">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                                      </span>
                                    ) : sigPending ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFF8E7] text-[#D39121] border border-[#D39121]/30" title={`Kurang: ${hasSig.missing_roles.join(", ")}`}>
                                        <AlertCircle className="w-3.5 h-3.5" /> Kurang ({hasSig.missing_roles.length})
                                      </span>
                                    ) : (
                                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                        {hasSig?.status === 'MULTIPLE_PDFS' ? 'Multi PDF' : 'Manual'}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-400 text-xs px-2">-</span>
                                  )}
                                </div>
                              </div>

                              {/* ACCORDION DETAIL BODY (OPEN ON CLICK) */}
                              {isExpanded && (
                                <div className="px-5 pb-5 pt-3 bg-[#F9FBFA] border-t border-slate-100">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* LIST BERKAS */}
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
                                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                        <span className="font-bold text-xs text-[#006747] flex items-center gap-1.5">
                                          <FolderTree className="w-4 h-4" /> Daftar Berkas Terdeteksi ({fileCount})
                                        </span>
                                      </div>
                                      {fileCount === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-2">Tidak ada file dalam folder/kategori ini</p>
                                      ) : (
                                        <ul className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                                          {item.files.map((fPath, fIdx) => {
                                            const bName = fPath.split('/').pop();
                                            return (
                                              <li key={fIdx} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 break-all" title={fPath}>
                                                <FileText className="w-3.5 h-3.5 text-[#006747] shrink-0" />
                                                <span className="font-mono text-slate-400 text-[10px] shrink-0">{fIdx + 1}.</span>
                                                <span className="font-medium text-slate-700">{bName}</span>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>

                                    {/* AUDIT MATRIKS TTD & PEMETAAN */}
                                    <div className="flex flex-col gap-3">
                                      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1">
                                        <div className="text-xs font-bold text-[#006747] mb-2 flex items-center gap-1.5">
                                          <ShieldCheck className="w-4 h-4" /> Detail Matriks Tanda Tangan
                                        </div>
                                        {item.requires_signature ? (
                                          !isFound ? (
                                            <p className="text-xs text-slate-500">Berkas belum diunggah.</p>
                                          ) : sigApproved ? (
                                            <div className="text-xs text-[#006747] font-semibold flex items-center gap-1.5 bg-[#EAF7EE] p-2.5 rounded-xl border border-[#006747]/20">
                                              <CheckCircle2 className="w-4 h-4 shrink-0" /> Seluruh tanda tangan yang disyaratkan telah lengkap.
                                            </div>
                                          ) : sigPending ? (
                                            <div className="space-y-1.5 text-xs">
                                              <p className="text-amber-800 font-bold flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" /> Tanda tangan belum lengkap:
                                              </p>
                                              <div className="text-slate-700 break-words bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 space-y-1">
                                                <span className="font-bold text-amber-900 block">Peran yang belum menandatangani:</span>
                                                <span className="font-medium">{hasSig.missing_roles.join(", ")}</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                              {hasSig?.status === 'MULTIPLE_PDFS'
                                                ? 'Terdapat beberapa PDF pada folder ini. Tinjau tanda tangan secara manual pada masing-masing dokumen.'
                                                : 'Dokumen ini memerlukan tinjauan tanda tangan manual.'}
                                            </p>
                                          )
                                        ) : (
                                          <p className="text-xs text-slate-500">Kategori ini tidak mewajibkan audit tanda tangan.</p>
                                        )}
                                      </div>

                                      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-xs font-bold text-slate-800">Pemetaan Folder</p>
                                          <p className="text-[11px] text-slate-500">Sesuaikan mapping nama folder</p>
                                        </div>
                                        <select
                                          disabled={zipLoading || (projectRoots.length > 0 && !projectRoots.includes(activeProjectData.root))}
                                          value={Object.hasOwn(folderMapping[activeProjectData.root] ?? {}, item.path) ? (folderMapping[activeProjectData.root][item.path] === null ? '__absent' : `p:${folderMapping[activeProjectData.root][item.path]}`) : '__auto'}
                                          onChange={e => {
                                            const value = e.target.value;
                                            setFolderMapping(previous => {
                                              const choices = { ...previous[activeProjectData.root] };
                                              if (value === '__auto') delete choices[item.path]; else choices[item.path] = value === '__absent' ? null : value.slice(2);
                                              return { ...previous, [activeProjectData.root]: choices };
                                            });
                                            setMappingDirty(true);
                                          }}
                                          className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 max-w-[170px] truncate focus:border-[#006747] outline-none"
                                        >
                                          <option value="__auto">Otomatis</option>
                                          <option value="__absent">Konfirmasi Tidak Ada</option>
                                          <option value="p:">Root Proyek</option>
                                          {activeProjectData.folders.map(folder => (
                                            <option key={folder} value={`p:${folder}`}>{folder}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                      {zipResults.mode !== 'inventory' && !mappingDirty && activeProjectData.unmapped_count === 0 && <EmailDraft
                        key={JSON.stringify([selectedProject, zipResults])}
                        projectName={activeProjectData.project_name}
                        missingItems={missingFilesForAlert}
                        missingSignatures={missingSigsForAlert}
                      />}
                    </div>
                  )}
                </div>
              )}
          </section>}
          {!isLanding && !isZip && !isFolder && <section id="pdf-section" aria-labelledby="pdf-heading" className="contents">
            <div className="min-w-0 space-y-8 scroll-mt-24 lg:col-start-2 lg:row-start-1">
              <div className="text-center space-y-3">
                <h2 id="pdf-heading" className="text-2xl md:text-3xl font-black text-[#006747]">Pemeriksaan Tanda Tangan PDF (Satuan / Sekaligus)</h2>
                <p className="text-slate-600 text-sm max-w-3xl mx-auto">Unggah satu atau beberapa PDF untuk memeriksa matriks tanda tangan setiap dokumen, melihat status persetujuan, dan mengoreksi hasil deteksi. Bagian ini tidak memeriksa kelengkapan folder ZIP.</p>
              </div>
              <motion.div layout className="min-w-0">
                <div className="bg-white p-7 rounded-3xl shadow-sm border border-[#006747]/15 relative overflow-hidden group">
                  <div
                    onDragOver={(e) => handleDragOver(e, 'pdf')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'pdf')}
                    className={`relative flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer h-[300px] overflow-y-auto ${draggingSection === 'pdf' ? 'border-[#006747] bg-[#EAF7EE] scale-[0.98]' : 'border-slate-300 bg-[#FAFDFB] hover:border-[#006747]'}`}
                    role="button" tabIndex={loading ? -1 : 0} aria-label="Pilih file PDF" aria-disabled={loading}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!loading) fileInputRef.current?.click(); } }}
                    onClick={() => !loading && fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
                    <AnimatePresence mode="wait">
                      {loading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6">
                          <div className="relative w-28 h-28">
                            <div className="absolute inset-0 border-4 border-[#EAF7EE] rounded-3xl" />
                            <motion.div animate={{ y: [0, 104, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-0 w-full h-1.5 bg-[#006747] shadow-[0_0_20px_rgba(0,103,71,0.8)] z-10" />
                            <div className="absolute inset-0 flex items-center justify-center text-[#006747]"><ScanLine className="w-12 h-12" /></div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xl font-bold text-[#161620]">Processing {files.length} Files...</p>
                            <p className="text-sm text-[#006747] font-semibold animate-pulse">Running Neural Networks</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4">
                          <div className="w-20 h-20 bg-[#EAF7EE] shadow-sm border border-[#006747]/20 text-[#006747] rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300">
                            <UploadCloud className="w-10 h-10" />
                          </div>
                          <div>
                            <p className="font-bold text-[#161620] text-xl">Batch Upload PDFs</p>
                            <p className="text-slate-500 mt-2 font-medium text-sm">Drag multiple documents here</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button onClick={handleUpload} disabled={files.length === 0 || loading} className="mt-6 min-h-16 group relative w-full flex items-center justify-center gap-2 bg-[#006747] hover:bg-[#005439] disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-4 rounded-xl font-bold transition-all duration-300 shadow-md shadow-[#006747]/20 active:scale-[0.98] overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? 'Processing...' : `Run Security Scan (${files.length})`}
                      {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </span>
                  </button>
                </div>

                {error && <div role="alert" className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

                {!loading && files.length > 0 && results.length === 0 && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {files.map((f, i) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-[#006747]/40 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-[#EAF7EE] text-[#006747] flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-bold text-slate-700 truncate">{f.name}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </motion.div>
                    ))}
                  </div>
                )}

              </motion.div>
            </div>

              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex gap-6 pl-2">
                        <div className="text-center px-4 border-r border-slate-100"><div className="text-3xl font-black text-slate-800">{validResults.length}</div><div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Scanned</div></div>
                        <div className="text-center px-4 border-r border-slate-100"><div className="text-3xl font-black text-[#006747]">{approvedCount}</div><div className="text-[10px] uppercase font-bold text-[#006747]/70 tracking-wider">Ready to Sync</div></div>
                        <div className="text-center px-4"><div className="text-3xl font-black text-[#D39121]">{pendingCount}</div><div className="text-[10px] uppercase font-bold text-[#D39121]/70 tracking-wider">Action Required</div></div>
                      </div>
                      <div className="flex bg-[#EBF5F0] p-1.5 rounded-2xl w-full sm:w-auto">
                        <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'all' ? 'bg-[#006747] shadow-sm text-white' : 'text-slate-600 hover:text-[#006747]'}`}>All</button>
                        <button onClick={() => setFilter('approved')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'approved' ? 'bg-[#006747] shadow-sm text-white' : 'text-slate-600 hover:text-[#006747]'}`}>Approved</button>
                        <button onClick={() => setFilter('pending')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'pending' ? 'bg-[#D39121] shadow-sm text-white' : 'text-slate-600 hover:text-[#D39121]'}`}>Pending</button>
                      </div>
                    </div>

                    {filteredResults.map((res, index) => {
                      const originalIndex = results.findIndex(r => r === res);
                      if ('error' in res) {
                        return (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} key={index} className="bg-red-50 border border-red-100 p-6 rounded-[2rem] shadow-sm">
                            <div className="font-bold text-red-900 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {res.fileName}</div>
                            <div className="text-red-700 text-sm mt-2">{res.error}</div>
                          </motion.div>
                        );
                      }

                      const tRoles = Object.keys(res.results).length;
                      const sRoles = Object.values(res.results).filter((r) => r.signed).length;
                      const isOk = res.status === 'APPROVED';

                      return (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} key={index} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow">
                          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-[#FAFDFB] to-white">
                            <div className="overflow-hidden flex items-center gap-3">
                              <span className="bg-[#EAF7EE] border border-[#006747]/20 text-[#006747] px-3 py-1 rounded-lg text-xs font-bold uppercase shrink-0 shadow-sm">{res.document_type}</span>
                              <span className="font-bold text-slate-800 text-lg truncate" title={res.fileName}>{res.fileName}</span>
                            </div>
                            <div className={`px-5 py-2 rounded-xl flex items-center gap-2 font-bold text-sm shrink-0 border shadow-sm ${isOk ? 'bg-[#EAF7EE] text-[#006747] border-[#006747]/30' : 'bg-[#FFF8E7] text-[#D39121] border-[#D39121]/40'}`}>
                              {isOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                              {sRoles}/{tRoles} SIGNED
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50/40">
                            <div className="flex justify-between items-center mb-5">
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                                <ListChecks className="w-4 h-4" /> Verification Matrix
                              </h3>
                              <span className="text-xs font-medium bg-white text-slate-500 px-2.5 py-1 rounded-md border border-slate-200">Click YES/NO to override AI</span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                              {Object.entries(res.results).map(([role, data]) => (
                                <div key={role} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${data.signed ? 'bg-white shadow-sm border-[#006747]/20' : 'bg-[#FFF8E7]/40 border-[#D39121]/30'}`}>
                                  <div className="flex flex-col overflow-hidden pr-2">
                                    <span className="font-bold text-slate-700 text-sm truncate">{role}</span>
                                    {data.manual_override && <span className="text-[10px] text-[#006747] font-bold uppercase tracking-wider flex items-center gap-1 mt-1"><Edit3 className="w-3 h-3" /> Manually overridden</span>}
                                  </div>
                                  <button onClick={() => toggleRoleStatus(originalIndex, role)} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${data.signed ? 'bg-[#EAF7EE] text-[#006747] border-[#006747]/30 hover:bg-[#006747]/10' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
                                    {data.signed ? <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> YES</span> : <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 opacity-50" /> NO</span>}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-5 bg-[#161620] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="text-xs font-mono text-slate-400 flex gap-2 overflow-x-auto max-w-sm custom-scrollbar pb-1">
                              {!isOk && res.jira_labels_to_add.map((l: string) => (
                                <span key={l} className="bg-slate-800 text-[#D39121] border border-slate-700 px-2 py-1 rounded shrink-0">{l}</span>
                              ))}
                              {isOk && <span className="text-[#2EBB79] font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Ready (No labels needed)</span>}
                            </div>
                            <button className={`w-full sm:w-auto shrink-0 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${isOk ? 'bg-[#006747] text-white hover:bg-[#005439]' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'}`}>
                              <Terminal className="w-4 h-4" /> Push to Jira
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                    <EmailDraft
                      key={JSON.stringify(results)}
                      projectName="Pemeriksaan PDF"
                      missingItems={[]}
                      missingSignatures={validResults.flatMap(doc => {
                        const missingRoles = Object.entries(doc.results).filter(([, role]) => !role.signed).map(([role]) => role);
                        return missingRoles.length ? [{ path: doc.fileName, missing_roles: missingRoles }] : [];
                      })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
          </section>}
        </div>
      </section>
    </main>
  );
}
