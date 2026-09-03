"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, XCircle, Loader2, FileText, Tag, ShieldCheck, ChevronRight, FileCheck2, AlertCircle, ScanLine, Sparkles, Terminal, BrainCircuit, Waypoints, ArrowRight, Activity, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]);
        setResults([]);
        setError(null);
      } else {
        setError("Please upload valid PDF documents.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf");
      setFiles(prev => [...prev, ...selectedFiles]);
      setResults([]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      await new Promise(r => setTimeout(r, 1500)); // WOW factor
      
      const newResults = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("http://localhost:8001/verify/async", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        
        if (data.job_id) {
          let isDone = false;
          while (!isDone) {
            await new Promise(r => setTimeout(r, 2000)); 
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

  const scrollToScanner = () => {
    document.getElementById("scanner-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[#fafcff] text-slate-900 font-sans selection:bg-indigo-200 relative overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-screen bg-gradient-to-b from-indigo-50/80 via-white to-transparent pointer-events-none" />
      <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-100/40 blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-100/40 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none mix-blend-multiply" />

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

      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 max-w-7xl mx-auto z-10">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium text-sm shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-400" /> Next-Gen Document Compliance
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Stop Chasing Signatures. <br className="hidden md:block" />
            Let <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">AI do the Auditing.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Upload your BRD or PCR. Our vision engine instantly validates physical ink and digital stamps against your strict Approval Matrix, syncing directly to Jira.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button onClick={scrollToScanner} className="group relative w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_8px_20px_-8px_rgba(79,70,229,0.5)] hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.7)] active:scale-[0.98]">
              Start Scanning Now <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="text-slate-600 font-semibold hover:text-slate-900 px-6 py-4">See how it works</a>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-20 bg-slate-50/50 border-y border-slate-200/50 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6"><BrainCircuit className="w-7 h-7" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Vision AI Recognition</h3>
              <p className="text-slate-500">Advanced OpenCV morphology subtracts table lines and precisely isolates wet ink and digital stamps from printed text.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6"><Waypoints className="w-7 h-7" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Matrix Routing</h3>
              <p className="text-slate-500">Automatically identifies document types (BRD, PCR) and maps them to their specific signature approval hierarchies.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-[#0f172a] p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-2xl rounded-full" />
              <div className="w-14 h-14 bg-slate-800 border border-slate-700 text-blue-400 rounded-2xl flex items-center justify-center mb-6 relative z-10"><Terminal className="w-7 h-7" /></div>
              <h3 className="text-xl font-bold text-white mb-3 relative z-10">Jira Webhook Ready</h3>
              <p className="text-slate-400 relative z-10">Immediately generates REST API payloads to update Jira issues with <code className="text-pink-400 text-sm">waiting-sign-off</code> labels.</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="scanner-section" className="py-32 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Secure Batch Scanner</h2>
            <p className="text-slate-500 mt-3">Upload multiple PDFs below. We process them concurrently.</p>
          </div>

          <div className={`grid gap-8 transition-all duration-700 ease-in-out ${results.length > 0 ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'}`}>
            <motion.div layout className={`${results.length > 0 ? 'lg:col-span-4' : 'col-span-full'}`}>
              <div className="bg-white/80 backdrop-blur-xl p-3 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/60 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center p-8 text-center rounded-[1.5rem] border-2 border-dashed transition-all duration-300 cursor-pointer min-h-[300px]
                    ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[0.98]' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50/80 hover:border-indigo-300'}
                  `}
                  onClick={() => !loading && fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col items-center space-y-6">
                        <div className="relative w-24 h-24">
                          <div className="absolute inset-0 border-4 border-indigo-100 rounded-2xl" />
                          <motion.div animate={{ y: [0, 88, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10" />
                          <div className="absolute inset-0 flex items-center justify-center text-indigo-500"><ScanLine className="w-10 h-10" /></div>
                        </div>
                        <p className="text-lg font-bold text-slate-800">Processing {files.length} Documents...</p>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 ease-out">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-lg">Upload PDFs (Batch)</p>
                          <p className="text-slate-500 mt-1 font-medium text-sm">Drag multiple files here</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* File List before upload */}
              {!loading && files.length > 0 && results.length === 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((f, i) => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileCheck2 className="w-5 h-5 text-indigo-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 truncate">{f.name}</span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={handleUpload} disabled={files.length === 0 || loading} className="group relative w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.5)] active:scale-[0.98] overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? 'Processing...' : `Run Batch Scan (${files.length})`}
                    {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
                {results.length > 0 && (
                  <button onClick={() => { setFiles([]); setResults([]); }} className="w-full mt-3 text-slate-500 font-semibold hover:text-slate-800 text-sm py-2">
                    Clear Results & Scan New
                  </button>
                )}
              </motion.div>
            </motion.div>

            {/* Right Column: BATCH Results */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8 space-y-6">
                  {results.map((res, index) => {
                    if (res.error) {
                      return (
                        <div key={index} className="bg-red-50 border border-red-100 p-6 rounded-[2rem]">
                          <div className="font-bold text-red-900">{res.fileName}</div>
                          <div className="text-red-700 text-sm mt-1">{res.error}</div>
                        </div>
                      );
                    }
                    
                    const tRoles = Object.keys(res.results).length;
                    const sRoles = Object.values(res.results).filter((r: any) => r.signed).length;
                    const isOk = res.status === 'APPROVED';
                    
                    return (
                      <div key={index} className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] border border-slate-200/80 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div className="overflow-hidden pr-4">
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold uppercase mr-2">{res.document_type}</span>
                            <span className="font-bold text-slate-800 truncate" title={res.fileName}>{res.fileName}</span>
                          </div>
                          <div className={`px-4 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shrink-0 ${isOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {isOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {sRoles}/{tRoles} SIGNED
                          </div>
                        </div>
                        <div className="p-6 grid sm:grid-cols-2 gap-3 bg-slate-50/30">
                          {Object.entries(res.results).map(([role, data]: any) => (
                            <div key={role} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${data.signed ? 'bg-white border-emerald-100' : 'bg-white border-amber-200'}`}>
                              <span className="font-medium text-slate-700 truncate pr-2">{role}</span>
                              {data.signed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                            </div>
                          ))}
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
