"use client";

import { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, CheckCircle2, XCircle, Loader2, FileText, ShieldCheck, 
  ChevronRight, AlertCircle, ScanLine, Sparkles, Terminal, Edit3, 
  Filter, Check, ListChecks, Trash2, FolderTree, Mail, Send, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [activeTab, setActiveTab] = useState<'zip' | 'pdf'>('zip');
  
  // Single PDF states
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // ZIP Inspection states
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipResults, setZipResults] = useState<Record<string, any> | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [alertSending, setAlertSending] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    if (activeTab === 'zip') {
      const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.zip'));
      if (file) {
        setZipFile(file);
        setZipResults(null);
        setZipError(null);
      } else {
        setZipError("Silakan upload file berkas berformat .zip");
      }
    } else {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]); setResults([]); setError(null);
      } else setError("Please upload valid PDF documents.");
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
        setZipResults(null);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleZipUpload = async () => {
    if (!zipFile) return;
    setZipLoading(true); setZipError(null); setZipResults(null); setSelectedProject(null); setAlertFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", zipFile);
      const res = await fetch("http://localhost:8001/verify/zip", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Gagal mengunggah file ZIP");

      if (data.job_id) {
        let isDone = false;
        while (!isDone) {
          await new Promise(r => setTimeout(r, 1500));
          const pollRes = await fetch(`http://localhost:8001/verify/${data.job_id}`);
          const pollData = await pollRes.json();

          if (pollData.status === "completed") {
            setZipResults(pollData.result);
            const firstProj = Object.keys(pollData.result.projects || {})[0];
            if (firstProj) setSelectedProject(firstProj);
            isDone = true;
          } else if (pollData.status === "failed") {
            setZipError(pollData.error || "Gagal menganalisis arsip ZIP");
            isDone = true;
          }
        }
      }
    } catch (err: any) {
      setZipError(err.message);
    } finally {
      setZipLoading(false);
    }
  };

  const handleSendAlert = async (projName: string, missingItems: string[], missingSigs: any[]) => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      alert("Masukkan alamat email PIC yang valid");
      return;
    }
    setAlertSending(true);
    setAlertFeedback(null);
    try {
      const res = await fetch("http://localhost:8001/api/alert/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          project_name: projName,
          missing_items: missingItems,
          missing_signatures: missingSigs
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAlertFeedback(`Notifikasi berhasil dikirim ke ${recipientEmail}!`);
      } else {
        setAlertFeedback(`Gagal mengirim: ${data.detail || "Error"}`);
      }
    } catch (err: any) {
      setAlertFeedback(`Gagal: ${err.message}`);
    } finally {
      setAlertSending(false);
    }
  };

  const toggleRoleStatus = (docIndex: number, role: string) => {
    const newResults = [...results];
    const doc = newResults[docIndex];
    if (doc.error) return;

    doc.results[role].signed = !doc.results[role].signed;
    doc.results[role].manual_override = true; 
    
    const missingRoles = Object.entries(doc.results).filter(([_, data]: any) => !data.signed).map(([r]) => r);
    doc.status = missingRoles.length === 0 ? 'APPROVED' : 'PENDING';
    doc.jira_labels_to_add = missingRoles.map(r => `waiting-sign-off-${r.replace(/ /g, '-').toLowerCase()}`);
    
    setResults(newResults);
  };

  const scrollToScanner = () => document.getElementById("scanner-section")?.scrollIntoView({ behavior: "smooth" });

  const validResults = results.filter(r => !r.error);
  const approvedCount = validResults.filter(r => r.status === 'APPROVED').length;
  const pendingCount = validResults.filter(r => r.status !== 'APPROVED').length;

  const filteredResults = results.filter(res => {
    if (filter === 'all') return true;
    if (res.error) return false;
    return filter === 'approved' ? res.status === 'APPROVED' : res.status !== 'APPROVED';
  });

  const activeProjectData = zipResults && selectedProject ? zipResults.projects[selectedProject] : null;
  const missingFilesForAlert = activeProjectData 
    ? activeProjectData.items.filter((i: any) => i.status === "Belum ditemukan").map((i: any) => i.path)
    : [];
  const missingSigsForAlert = activeProjectData
    ? activeProjectData.items.filter((i: any) => i.signature_analysis && i.signature_analysis.status === "PENDING").map((i: any) => ({
        path: i.path,
        missing_roles: i.signature_analysis.missing_roles
      }))
    : [];

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
      <section className="relative pt-36 pb-16 md:pt-44 md:pb-24 px-6 max-w-7xl mx-auto z-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAF7EE] border border-[#006747]/20 text-[#006747] font-semibold text-xs md:text-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#D39121] animate-pulse"></span>
            Asisten Pemeriksa Kelengkapan Dokumen & Tanda Tangan ITP NMB 2026
          </motion.div>
          
          <motion.h1 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-5xl md:text-6xl lg:text-[4.4rem] font-black tracking-tight text-[#161620] leading-[1.1]">
            Validasi Dokumen <br className="hidden md:block" /> & <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#006747] via-[#0A805B] to-[#D39121]">Matriks Tanda Tangan.</span>
          </motion.h1>
          
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
            Audit folder proyek secara menyeluruh sesuai standar checklist NMB 2026, verifikasi fisik keberadaan berkas, deteksi tanda tangan peran dinamis, dan pengiriman reminder PIC.
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
              <p className="text-slate-500 text-xs leading-relaxed">Unggah folder arsip NMB 2026 atau subfolder proyek tanpa perlu ekstrak manual.</p>
            </div>
            
            <div className="p-5 rounded-2xl bg-white/85 border border-[#006747]/15 shadow-[0_4px_20px_-8px_rgba(0,103,71,0.08)] backdrop-blur-sm relative group hover:border-[#006747]/40 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF8E7] border border-[#D39121]/30 text-[#D39121] font-black flex items-center justify-center text-sm">2</div>
                <ChevronRight className="hidden md:block w-5 h-5 text-slate-300 group-hover:text-[#D39121] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[#161620] text-base mb-1">Checklist Pohon Berkas</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Sistem membandingkan keberadaan file dengan checklist 26 subfolder hierarki ITP.</p>
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
              <p className="text-slate-500 text-xs leading-relaxed">Dapatkan rekapitulasi kelengkapan dan kirimkan draf reminder email ke PIC proyek.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WORKSPACE SECTION */}
      <section id="scanner-section" className="py-16 bg-white/80 border-t border-[#006747]/10 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* TAB SELECTOR BSN STYLE */}
          <div className="flex justify-center mb-10">
            <div className="bg-[#EBF5F0] p-1.5 rounded-2xl flex gap-2 border border-[#006747]/10">
              <button 
                onClick={() => setActiveTab('zip')} 
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'zip' ? 'bg-[#006747] text-white shadow-md shadow-[#006747]/20' : 'text-slate-600 hover:text-[#006747]'}`}
              >
                <FolderTree className="w-4 h-4" /> Pemeriksaan Folder Proyek (ZIP)
              </button>
              <button 
                onClick={() => setActiveTab('pdf')} 
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'pdf' ? 'bg-[#006747] text-white shadow-md shadow-[#006747]/20' : 'text-slate-600 hover:text-[#006747]'}`}
              >
                <ScanLine className="w-4 h-4" /> Single/Batch PDF Matrix
              </button>
            </div>
          </div>

          {activeTab === 'zip' ? (
            /* ZIP WORKSPACE */
            <div className="space-y-8">
              <div className="max-w-3xl mx-auto bg-white p-7 rounded-3xl shadow-sm border border-[#006747]/15 text-center">
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => !zipLoading && zipInputRef.current?.click()}
                  className={`p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${isDragging ? 'border-[#006747] bg-[#EAF7EE]' : 'border-slate-300 hover:border-[#006747] bg-[#FAFDFB]'}`}
                >
                  <input type="file" ref={zipInputRef} accept=".zip" onChange={handleZipChange} className="hidden" />
                  {zipLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-[#006747] animate-spin" />
                      <p className="font-bold text-[#161620]">Mengekstrak dan memeriksa pohon folder proyek...</p>
                      <p className="text-xs text-slate-500">Memeriksa kelengkapan file & kolom persetujuan</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-[#EAF7EE] text-[#006747] rounded-2xl shadow-sm flex items-center justify-center border border-[#006747]/20">
                        <FolderTree className="w-8 h-8" />
                      </div>
                      <p className="font-bold text-[#161620] text-lg">Upload File ZIP NMB 2026</p>
                      <p className="text-slate-500 text-sm">Seret file .zip yang berisi struktur folder NMB 2026 / Project di sini</p>
                      {zipFile && (
                        <div className="mt-2 text-xs font-bold text-[#006747] bg-[#EAF7EE] px-4 py-1.5 rounded-full border border-[#006747]/20">
                          {zipFile.name} ({(zipFile.size / (1024*1024)).toFixed(2)} MB)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {zipError && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-200">
                    {zipError}
                  </div>
                )}

                <button 
                  onClick={handleZipUpload} 
                  disabled={!zipFile || zipLoading}
                  className="mt-6 w-full py-4 bg-[#006747] hover:bg-[#005439] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-all shadow-md shadow-[#006747]/20"
                >
                  {zipLoading ? "Sedang Memeriksa..." : "Jalankan Audit Kelengkapan Dokumen"}
                </button>
              </div>

              {/* ZIP RESULTS */}
              {zipResults && (
                <div className="space-y-6">
                  {/* PROJECT SELECTOR TABS */}
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {Object.keys(zipResults.projects || {}).map((pName) => {
                      const pData = zipResults.projects[pName];
                      return (
                        <button
                          key={pName}
                          onClick={() => { setSelectedProject(pName); setAlertFeedback(null); }}
                          className={`px-5 py-3 rounded-2xl font-bold text-sm shrink-0 flex items-center gap-3 border transition-all ${selectedProject === pName ? 'bg-[#006747] text-white border-[#006747] shadow-md shadow-[#006747]/20' : 'bg-white text-slate-700 border-slate-200 hover:border-[#006747]/50'}`}
                        >
                          <span>{pName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${selectedProject === pName ? 'bg-white/20 text-white font-extrabold' : 'bg-[#EAF7EE] text-[#006747] font-semibold'}`}>
                            {pData.completeness_score}
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
                              {activeProjectData.percent}% Lengkap
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm mt-1">
                            {activeProjectData.completeness_score} Dokumen Wajib Ditemukan • {activeProjectData.missing_signatures_count} Dokumen Menunggu Tanda Tangan
                          </p>
                        </div>

                        {/* ALERT EMAIL BUTTON / FORM */}
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                          <input 
                            type="email" 
                            placeholder="Email PIC / Penandatangan"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#006747]"
                          />
                          <button
                            onClick={() => handleSendAlert(activeProjectData.project_name, missingFilesForAlert, missingSigsForAlert)}
                            disabled={alertSending}
                            className="w-full sm:w-auto px-5 py-2.5 bg-[#D39121] hover:bg-[#B57814] disabled:bg-slate-200 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            <Mail className="w-4 h-4" /> {alertSending ? "Mengirim..." : "Kirim Alert PIC"}
                          </button>
                        </div>
                      </div>

                      {alertFeedback && (
                        <div className="p-3 bg-[#EAF7EE] border-b border-[#006747]/20 text-[#006747] text-sm font-semibold text-center">
                          {alertFeedback}
                        </div>
                      )}

                      {/* CHECKLIST ITEMS TABLE */}
                      <div className="divide-y divide-slate-100">
                        {activeProjectData.items.map((item: any, idx: number) => {
                          const isFound = item.status === "Ditemukan";
                          const hasSig = item.signature_analysis;
                          const sigPending = hasSig && hasSig.status === "PENDING";
                          const sigApproved = hasSig && hasSig.status === "APPROVED";

                          return (
                            <div key={idx} className="p-5 hover:bg-[#FAFDFB] transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-1 overflow-hidden">
                                <div className="flex items-center gap-3">
                                  <span className={`w-3 h-3 rounded-full shrink-0 ${isFound ? 'bg-[#006747] ring-4 ring-[#EAF7EE]' : 'bg-red-400 ring-4 ring-red-50'}`} />
                                  <span className="font-bold text-[#161620] text-base">{item.path}</span>
                                </div>
                                <div className="pl-6 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                                  {isFound ? (
                                    <span>File: <strong className="text-slate-800">{item.files.join(", ")}</strong></span>
                                  ) : (
                                    <span className="text-red-500 font-semibold">Folder kosong atau berkas belum ditemukan</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${isFound ? 'bg-[#EAF7EE] text-[#006747] border-[#006747]/20' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {item.status}
                                </span>

                                {item.requires_signature && (
                                  <div className="text-xs">
                                    {!isFound ? (
                                      <span className="text-slate-400 italic">Menunggu file</span>
                                    ) : sigApproved ? (
                                      <span className="px-3 py-1 rounded-xl font-bold bg-[#EAF7EE] text-[#006747] border border-[#006747]/20 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> TTD Lengkap
                                      </span>
                                    ) : sigPending ? (
                                      <div className="flex flex-col items-end">
                                        <span className="px-3 py-1 rounded-xl font-bold bg-[#FFF8E7] text-[#D39121] border border-[#D39121]/30 flex items-center gap-1">
                                          <AlertCircle className="w-3.5 h-3.5" /> TTD Kurang ({hasSig.missing_roles.length})
                                        </span>
                                        <span className="text-[10px] text-amber-700 mt-0.5 truncate max-w-xs font-semibold">
                                          {hasSig.missing_roles.join(", ")}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="px-3 py-1 rounded-xl font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        Tipe Non-Standar
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* SINGLE / BATCH PDF WORKSPACE */
            <div className={`grid gap-8 transition-all duration-700 ease-in-out ${results.length > 0 ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'}`}>
              <motion.div layout className={`${results.length > 0 ? 'lg:col-span-4' : 'col-span-full'}`}>
                <div className="bg-white p-3 rounded-[2rem] shadow-sm border border-[#006747]/15 relative overflow-hidden group">
                  <div 
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center p-8 text-center rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[300px] ${isDragging ? 'border-[#006747] bg-[#EAF7EE] scale-[0.98]' : 'border-slate-300 bg-[#FAFDFB] hover:border-[#006747]'}`}
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
                </div>

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

                <motion.div layout className="mt-6">
                  <button onClick={handleUpload} disabled={files.length === 0 || loading} className="group relative w-full flex items-center justify-center gap-2 bg-[#006747] hover:bg-[#005439] disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-5 rounded-[1.25rem] font-bold text-lg transition-all duration-300 shadow-lg shadow-[#006747]/20 active:scale-[0.98] overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? 'Processing...' : `Run Security Scan (${files.length})`}
                      {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </span>
                  </button>
                </motion.div>
              </motion.div>

              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8 space-y-6">
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
                      if (res.error) {
                        return (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} key={index} className="bg-red-50 border border-red-100 p-6 rounded-[2rem] shadow-sm">
                            <div className="font-bold text-red-900 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {res.fileName}</div>
                            <div className="text-red-700 text-sm mt-2">{res.error}</div>
                          </motion.div>
                        );
                      }
                      
                      const tRoles = Object.keys(res.results).length;
                      const sRoles = Object.values(res.results).filter((r: any) => r.signed).length;
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
                              {Object.entries(res.results).map(([role, data]: any) => (
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
