"use client";

import { useState, useRef } from "react";
import { 
  UploadCloud, CheckCircle2, XCircle, Loader2, FileText, Tag, ShieldCheck, 
  ChevronRight, FileCheck2, AlertCircle, ScanLine, Sparkles, Terminal, 
  BrainCircuit, Waypoints, ArrowRight, Activity 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setResult(null);
        setError(null);
      } else {
        setError("Please upload a valid PDF document.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await new Promise(r => setTimeout(r, 1500)); // Fake delay for WOW factor
      const res = await fetch("http://localhost:8001/verify", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Verification failed");
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scrollToScanner = () => {
    document.getElementById("scanner-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const totalRoles = result ? Object.keys(result.results).length : 0;
  const signedRoles = result ? Object.values(result.results).filter((r: any) => r.signed).length : 0;
  const progress = totalRoles === 0 ? 0 : Math.round((signedRoles / totalRoles) * 100);
  const isAllSigned = result?.status === 'APPROVED';

  return (
    <main className="min-h-screen bg-[#fafcff] text-slate-900 font-sans selection:bg-indigo-200 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-screen bg-gradient-to-b from-indigo-50/80 via-white to-transparent pointer-events-none" />
      <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-100/40 blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-100/40 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none mix-blend-multiply" />

      {/* Navbar */}
      <nav className="fixed w-full top-0 z-50 backdrop-blur-xl bg-white/60 border-b border-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-blue-500 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              SignMatrix
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-emerald-500" /> Systems Operational
            </div>
            <button onClick={scrollToScanner} className="bg-slate-900 hover:bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-md active:scale-95">
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* --- HERO LANDING PAGE --- */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 max-w-7xl mx-auto z-10">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium text-sm shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Next-Gen Document Compliance
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]"
          >
            Stop Chasing Signatures. <br className="hidden md:block" />
            Let <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">AI do the Auditing.</span>
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
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button onClick={scrollToScanner} className="group relative w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_8px_20px_-8px_rgba(79,70,229,0.5)] hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.7)] active:scale-[0.98]">
              Start Scanning Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="text-slate-600 font-semibold hover:text-slate-900 px-6 py-4">
              See how it works
            </a>
          </motion.div>
        </div>
      </section>

      {/* --- FEATURES BENTO BOX --- */}
      <section id="features" className="py-20 bg-slate-50/50 border-y border-slate-200/50 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Vision AI Recognition</h3>
              <p className="text-slate-500">Advanced OpenCV morphology subtracts table lines and precisely isolates wet ink and digital stamps from printed text.</p>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Waypoints className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Matrix Routing</h3>
              <p className="text-slate-500">Automatically identifies document types (BRD, PCR) and maps them to their specific signature approval hierarchies.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-[#0f172a] p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-2xl rounded-full" />
              <div className="w-14 h-14 bg-slate-800 border border-slate-700 text-blue-400 rounded-2xl flex items-center justify-center mb-6 relative z-10">
                <Terminal className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 relative z-10">Jira Webhook Ready</h3>
              <p className="text-slate-400 relative z-10">Immediately generates REST API payloads to update Jira issues with <code className="text-pink-400 text-sm">waiting-sign-off</code> labels.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- APP UI (THE SCANNER) --- */}
      <section id="scanner-section" className="py-32 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Secure Document Scanner</h2>
            <p className="text-slate-500 mt-3">Upload your file below. Processing is done instantly.</p>
          </div>

          <div className={`grid gap-8 transition-all duration-700 ease-in-out ${result ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'}`}>
            
            {/* Left Column: Upload */}
            <motion.div layout className={`${result ? 'lg:col-span-5' : 'col-span-full'}`}>
              <div className="bg-white/80 backdrop-blur-xl p-3 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/60 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center p-12 text-center rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[360px]
                    ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[0.98]' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50/80 hover:border-indigo-300'}
                    ${file && !isDragging ? 'border-indigo-200 bg-indigo-50/30' : ''}
                  `}
                  onClick={() => !loading && fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} className="hidden" />
                  
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col items-center space-y-6">
                        <div className="relative w-24 h-24">
                          <div className="absolute inset-0 border-4 border-indigo-100 rounded-2xl" />
                          <motion.div animate={{ y: [0, 88, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10" />
                          <div className="absolute inset-0 flex items-center justify-center text-indigo-500">
                            <ScanLine className="w-10 h-10" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-slate-800">Analyzing Document</p>
                          <p className="text-sm text-slate-500 animate-pulse">Running vision models...</p>
                        </div>
                      </motion.div>
                    ) : file ? (
                      <motion.div key="file" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-white">
                          <FileCheck2 className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-lg truncate max-w-[250px]">{file.name}</p>
                          <p className="text-sm text-slate-500 font-medium mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB PDF</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }} className="mt-2 text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors px-4 py-1.5 rounded-full hover:bg-red-50">
                          Remove Document
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-5">
                        <div className="w-20 h-20 bg-white shadow-sm border border-slate-100 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 ease-out">
                          <UploadCloud className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xl">Upload PDF Document</p>
                          <p className="text-slate-500 mt-2 font-medium">Drag & drop or click to browse</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm text-red-700 rounded-2xl text-sm flex items-start gap-3 border border-red-100 shadow-sm overflow-hidden">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layout className="mt-6">
                <button onClick={handleUpload} disabled={!file || loading} className="group relative w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.5)] active:scale-[0.98] overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? 'Processing...' : 'Run Verification'} 
                    {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
              </motion.div>
            </motion.div>

            {/* Right Column: Results */}
            <AnimatePresence>
              {result && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, scale: 0.95 }} 
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="lg:col-span-7 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/60 overflow-hidden flex flex-col"
                >
                  <div className="p-8 border-b border-slate-100 bg-gradient-to-br from-slate-50/50 to-white">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-extrabold text-slate-900">Verification Report</h2>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                            {result.document_type}
                          </span>
                          <span className="text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs" title={file?.name}>{file?.name}</span>
                        </div>
                      </div>
                      
                      <div className={`px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-sm shadow-sm border
                        ${isAllSigned 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100/50' 
                          : 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100/50'}`}>
                        {isAllSigned ? (
                          <><ShieldCheck className="w-5 h-5" /> FULLY COMPLIANT</>
                        ) : (
                          <><AlertCircle className="w-5 h-5" /> ACTION REQUIRED</>
                        )}
                      </div>
                    </div>

                    <div className="mt-10">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <span className="block text-3xl font-extrabold text-slate-900">{progress}%</span>
                          <span className="text-sm font-medium text-slate-500">Signatures collected</span>
                        </div>
                        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${isAllSigned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {signedRoles} of {totalRoles} Required
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 border border-slate-200/60 shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${progress}%` }} 
                          transition={{ duration: 1.2, type: "spring", bounce: 0.2 }}
                          className={`h-full rounded-full relative overflow-hidden ${isAllSigned ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]" />
                        </motion.div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 flex-1 bg-slate-50/30">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Checklist Details
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(result.results).map(([role, data]: any, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + (idx * 0.08) }}
                          key={role} 
                          className={`flex items-center justify-between p-5 rounded-2xl border shadow-sm transition-colors ${
                            data.signed 
                              ? 'bg-white border-slate-200 hover:border-emerald-200' 
                              : 'bg-white border-amber-200/60 hover:border-amber-300'
                          }`}
                        >
                          <span className="font-semibold text-slate-800">{role}</span>
                          <div className="flex items-center">
                            {data.signed ? (
                              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100/50">
                                <CheckCircle2 className="w-4 h-4" /> Verified
                              </span>
                            ) : data.found ? (
                              <span className="flex items-center gap-1.5 text-amber-600 text-sm font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100/50">
                                <Loader2 className="w-4 h-4 animate-spin" /> Pending
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-slate-500 text-sm font-bold bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                <XCircle className="w-4 h-4" /> Not Found
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {result.jira_labels_to_add && result.jira_labels_to_add.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="m-6 mt-0 p-5 bg-[#0f172a] rounded-2xl shadow-xl overflow-hidden relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-300 font-mono text-sm font-medium">
                          <Terminal className="w-4 h-4 text-blue-400" /> Jira Webhook Trigger
                        </div>
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                        </div>
                      </div>
                      <div className="font-mono text-xs md:text-sm text-slate-400 space-y-2">
                        <p><span className="text-pink-400">POST</span> <span className="text-slate-300">/rest/api/3/issue/UPDATE</span></p>
                        <p className="text-slate-500">{"{"}</p>
                        <div className="pl-4">
                          <p>"update": {"{"}</p>
                          <div className="pl-4">
                            <p>"labels": [</p>
                            <div className="pl-4 flex flex-wrap gap-2 py-1">
                              {result.jira_labels_to_add.map((label: string, i: number) => (
                                <span key={label} className="text-green-400 bg-green-400/10 px-1.5 rounded">
                                  "{label}"{i < result.jira_labels_to_add.length - 1 ? "," : ""}
                                </span>
                              ))}
                            </div>
                            <p>]</p>
                          </div>
                          <p>{"}"}</p>
                        </div>
                        <p className="text-slate-500">{"}"}</p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-slate-200/50 bg-white py-8 text-center text-slate-500 text-sm relative z-10">
        <p>© 2026 Internal Tools. For demo purposes only.</p>
      </footer>
    </main>
  );
}
