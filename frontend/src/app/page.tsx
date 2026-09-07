"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, CheckCircle2, XCircle, Loader2, FileText, Tag, ShieldCheck, ChevronRight, FileCheck2, AlertCircle, ScanLine, Sparkles, Terminal, Edit3, Filter, Check, ListChecks, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animated background elements logic
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]); setResults([]); setError(null);
      } else setError("Please upload valid PDF documents.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf");
      setFiles(prev => [...prev, ...selectedFiles]); setResults([]); setError(null);
    }
  };

  const removeFile = (index: number) => { setFiles(prev => prev.filter((_, i) => i !== index)); setResults([]); };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true); setError(null); setResults([]);

    try {
      await new Promise(r => setTimeout(r, 1200)); 
      
      const newResults = [];
      for (const file of files) {
        const formData = new FormData(); formData.append("file", file);
        const res = await fetch("http://localhost:8001/verify/async", { method: "POST", body: formData });
        const data = await res.json();
        
        if (data.job_id) {
          let isDone = false;
          while (!isDone) {
            await new Promise(r => setTimeout(r, 1500)); 
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

  return (
    <main className="min-h-screen bg-[#fafcff] text-slate-900 font-sans selection:bg-indigo-200 relative overflow-x-hidden">
      {/* Interactive Background Elements */}
      <div className="fixed top-0 left-0 w-full h-screen bg-gradient-to-b from-indigo-50/80 via-white to-transparent pointer-events-none z-0" />
      
      <motion.div 
        animate={{ 
          x: mousePos.x * -0.02,
          y: mousePos.y * -0.02,
        }}
        transition={{ type: "spring", damping: 50, stiffness: 200 }}
        className="fixed -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-200/30 blur-[100px] pointer-events-none z-0" 
      />
      <motion.div 
        animate={{ 
          x: mousePos.x * 0.02,
          y: mousePos.y * 0.02,
        }}
        transition={{ type: "spring", damping: 50, stiffness: 200 }}
        className="fixed top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-200/30 blur-[100px] pointer-events-none z-0" 
      />
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none mix-blend-multiply z-0" />

      {/* Navbar */}
      <nav className="fixed w-full top-0 z-50 backdrop-blur-xl bg-white/60 border-b border-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-gradient-to-tr from-indigo-600 to-blue-500 p-2 rounded-xl shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              SignMatrix
            </span>
          </div>
          <div className="flex items-center gap-4">
            <motion.a 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="/admin" 
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" /> Admin Panel
            </motion.a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-48 md:pb-32 px-6 max-w-7xl mx-auto z-10 flex flex-col items-center justify-center min-h-[85vh]">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium text-sm shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400" /> Next-Gen Document Compliance
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.6, type: "spring", bounce: 0.4, delay: 0.1 }} 
            className="text-6xl md:text-7xl lg:text-[5rem] font-extrabold tracking-tight text-slate-900 leading-[1.05]"
          >
            Stop Chasing Signatures. <br className="hidden md:block" />
            Let <span className="relative inline-block">
              <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">AI do the Auditing.</span>
              <motion.span 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                className="absolute bottom-1 left-0 h-3 bg-cyan-200/50 -z-10 -rotate-1 rounded-sm"
              />
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }} 
            className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto"
          >
            Upload your BRD or PCR. Our vision engine instantly validates physical ink and digital stamps against your strict Approval Matrix, syncing directly to Jira.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }} 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <button onClick={scrollToScanner} className="group relative w-full sm:w-auto flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[1.25rem] font-bold text-lg transition-all shadow-[0_8px_20px_-8px_rgba(79,70,229,0.5)] hover:shadow-[0_8px_30px_-8px_rgba(79,70,229,0.7)] active:scale-[0.98] overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <ScanLine className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Start Batch Scan</span>
            </button>
          </motion.div>
        </div>

        {/* Floating elements animation */}
        <motion.div 
          animate={{ y: [0, -15, 0] }} 
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[10%] top-[30%] hidden lg:flex bg-white p-4 rounded-2xl shadow-xl border border-slate-100 items-center gap-3 z-0"
        >
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Jira Webhook</p>
            <p className="text-sm font-bold text-slate-800">Status: APPROVED</p>
          </div>
        </motion.div>

        <motion.div 
          animate={{ y: [0, 20, 0] }} 
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute left-[10%] bottom-[20%] hidden lg:flex bg-white p-4 rounded-2xl shadow-xl border border-slate-100 items-center gap-3 z-0"
        >
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center"><BrainCircuit className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">YOLOv8 Engine</p>
            <p className="text-sm font-bold text-slate-800">Signature Detected</p>
          </div>
        </motion.div>
      </section>

      {/* Scanner Section */}
      <section id="scanner-section" className="py-24 bg-white/50 border-t border-slate-200/50 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Secure AI Scanner Workspace</h2>
            <p className="text-slate-500 mt-3 text-lg">Process multiple documents concurrently. Zero data retention.</p>
          </div>

          <div className={`grid gap-8 transition-all duration-700 ease-in-out ${results.length > 0 ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'}`}>
            {/* UPLOADER */}
            <motion.div layout className={`${results.length > 0 ? 'lg:col-span-4' : 'col-span-full'}`}>
              <div className="bg-white/80 backdrop-blur-xl p-3 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-slate-200/60 relative overflow-hidden group">
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center p-8 text-center rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[300px]
                    ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[0.98]' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50/80 hover:border-indigo-400'}
                  `}
                  onClick={() => !loading && fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6">
                        <div className="relative w-28 h-28">
                          <div className="absolute inset-0 border-4 border-indigo-100 rounded-3xl" />
                          <motion.div animate={{ y: [0, 104, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.9)] z-10" />
                          <div className="absolute inset-0 flex items-center justify-center text-indigo-500"><ScanLine className="w-12 h-12" /></div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xl font-bold text-slate-800">Processing {files.length} Files...</p>
                          <p className="text-sm text-indigo-500 font-medium animate-pulse">Running Neural Networks</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-white shadow-md border border-slate-100 text-indigo-500 rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out">
                          <UploadCloud className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xl">Batch Upload PDFs</p>
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
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></div>
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

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm text-red-700 rounded-2xl text-sm flex items-start gap-3 border border-red-100 shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layout className="mt-6">
                <button onClick={handleUpload} disabled={files.length === 0 || loading} className="group relative w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-5 rounded-[1.25rem] font-bold text-lg transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.5)] active:scale-[0.98] overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? 'Processing...' : `Run Security Scan (${files.length})`}
                    {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
              </motion.div>
            </motion.div>

            {/* RESULTS */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8 space-y-6">
                  
                  {/* Summary Dashboard */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex gap-6 pl-2">
                      <div className="text-center px-4 border-r border-slate-100">
                        <div className="text-3xl font-black text-slate-800">{validResults.length}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Scanned</div>
                      </div>
                      <div className="text-center px-4 border-r border-slate-100">
                        <div className="text-3xl font-black text-emerald-600">{approvedCount}</div>
                        <div className="text-[10px] uppercase font-bold text-emerald-600/70 tracking-wider">Ready to Sync</div>
                      </div>
                      <div className="text-center px-4">
                        <div className="text-3xl font-black text-amber-500">{pendingCount}</div>
                        <div className="text-[10px] uppercase font-bold text-amber-500/70 tracking-wider">Action Required</div>
                      </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
                      <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>All</button>
                      <button onClick={() => setFilter('approved')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'approved' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Approved</button>
                      <button onClick={() => setFilter('pending')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>Pending</button>
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
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-50/50 to-white">
                          <div className="overflow-hidden flex items-center gap-3">
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold uppercase shrink-0 shadow-sm">{res.document_type}</span>
                            <span className="font-bold text-slate-800 text-lg truncate" title={res.fileName}>{res.fileName}</span>
                          </div>
                          <div className={`px-5 py-2 rounded-xl flex items-center gap-2 font-bold text-sm shrink-0 border shadow-sm ${isOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {isOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {sRoles}/{tRoles} SIGNED
                          </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50/30">
                          <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                              <ListChecks className="w-4 h-4" /> Verification Matrix
                            </h3>
                            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-md">Click buttons to override AI</span>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            {Object.entries(res.results).map(([role, data]: any) => (
                              <div key={role} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${data.signed ? 'bg-white shadow-sm border-emerald-100' : 'bg-amber-50/30 border-amber-200/70'}`}>
                                <div className="flex flex-col overflow-hidden pr-2">
                                  <span className="font-bold text-slate-700 text-sm truncate">{role}</span>
                                  {data.manual_override && <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1"><Edit3 className="w-3 h-3" /> Manually overridden</span>}
                                </div>
                                
                                <button 
                                  onClick={() => toggleRoleStatus(originalIndex, role)}
                                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${
                                    data.signed 
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300' 
                                      : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-700'
                                  }`}
                                >
                                  {data.signed ? <><Check className="w-3.5 h-3.5" /> YES</> : <><XCircle className="w-3.5 h-3.5 opacity-50" /> NO</>}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-5 bg-[#0f172a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="text-xs font-mono text-slate-500 flex gap-2 overflow-x-auto max-w-sm custom-scrollbar pb-1">
                            {!isOk && res.jira_labels_to_add.map((l: string) => (
                              <span key={l} className="bg-slate-800 text-blue-400 border border-slate-700 px-2 py-1 rounded shrink-0">{l}</span>
                            ))}
                            {isOk && <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Ready (No labels needed)</span>}
                          </div>
                          
                          <button className={`w-full sm:w-auto shrink-0 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2
                            ${isOk ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'}
                          `}>
                            <Terminal className="w-4 h-4" /> Push to Jira
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </main>
  );
}
