"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, XCircle, Loader2, FileText, Tag, ShieldCheck, ChevronRight, FileCheck2, AlertCircle, ScanLine, Sparkles, Terminal, Edit3, Filter, Check, ListChecks } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await new Promise(r => setTimeout(r, 1000)); // WOW factor
      
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

  // --- MANUAL OVERRIDE LOGIC ---
  const toggleRoleStatus = (docIndex: number, role: string) => {
    const newResults = [...results];
    const doc = newResults[docIndex];
    if (doc.error) return;

    // Flip the status
    doc.results[role].signed = !doc.results[role].signed;
    doc.results[role].manual_override = true; // Flag to show it was edited by human
    
    // Recalculate status and jira labels
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
      <div className="absolute top-0 left-0 w-full h-screen bg-gradient-to-b from-indigo-50/80 via-white to-transparent pointer-events-none" />
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
            <a href="/admin" className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">
              <ShieldCheck className="w-4 h-4" /> Admin Panel
            </a>
          </div>
        </div>
      </nav>

      <section id="scanner-section" className="pt-32 pb-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">AI Compliance Scanner</h2>
            <p className="text-slate-500 mt-3 text-lg">Upload BRD/PCR files. Edit results manually if AI makes a mistake.</p>
          </div>

          <div className={`grid gap-8 transition-all duration-700 ease-in-out ${results.length > 0 ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'}`}>
            {/* LEFT COLUMN: UPLOADER */}
            <motion.div layout className={`${results.length > 0 ? 'lg:col-span-4' : 'col-span-full'}`}>
              <div className="bg-white/80 backdrop-blur-xl p-3 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/60 relative overflow-hidden group">
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
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center space-y-6">
                        <div className="relative w-24 h-24">
                          <div className="absolute inset-0 border-4 border-indigo-100 rounded-2xl" />
                          <motion.div animate={{ y: [0, 88, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10" />
                          <div className="absolute inset-0 flex items-center justify-center text-indigo-500"><ScanLine className="w-10 h-10" /></div>
                        </div>
                        <p className="text-lg font-bold text-slate-800">Processing {files.length} Files...</p>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-lg">Batch Upload PDF</p>
                          <p className="text-slate-500 mt-1 font-medium text-sm">Drag multiple files here</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {!loading && files.length > 0 && results.length === 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                  {files.map((f, i) => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-sm font-medium text-slate-700 truncate">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                    </motion.div>
                  ))}
                </div>
              )}

              <motion.div layout className="mt-6">
                <button onClick={handleUpload} disabled={files.length === 0 || loading} className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_-8px_rgba(79,70,229,0.5)] active:scale-[0.98]">
                  {loading ? 'Processing...' : `Run Scan (${files.length})`}
                </button>
              </motion.div>
            </motion.div>

            {/* RIGHT COLUMN: RESULTS */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8 space-y-6">
                  
                  {/* Summary & Filters */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex gap-4">
                      <div className="text-center px-4 border-r border-slate-100">
                        <div className="text-2xl font-black text-slate-800">{validResults.length}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Scanned</div>
                      </div>
                      <div className="text-center px-4 border-r border-slate-100">
                        <div className="text-2xl font-black text-emerald-600">{approvedCount}</div>
                        <div className="text-[10px] uppercase font-bold text-emerald-600/70 tracking-wider">Ready to Sync</div>
                      </div>
                      <div className="text-center px-4">
                        <div className="text-2xl font-black text-amber-500">{pendingCount}</div>
                        <div className="text-[10px] uppercase font-bold text-amber-500/70 tracking-wider">Action Required</div>
                      </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>All</button>
                      <button onClick={() => setFilter('approved')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === 'approved' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Approved</button>
                      <button onClick={() => setFilter('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>Pending</button>
                    </div>
                  </div>

                  {/* Document Cards */}
                  {filteredResults.map((res, index) => {
                    const originalIndex = results.findIndex(r => r === res);
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
                      <div key={index} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
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
                        
                        <div className="p-6">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                              <ListChecks className="w-4 h-4" /> Signatures Checklist
                            </h3>
                            <span className="text-xs text-slate-400 italic">Click status to manually override AI</span>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            {Object.entries(res.results).map(([role, data]: any) => (
                              <div key={role} className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${data.signed ? 'bg-emerald-50/30 border-emerald-100' : 'bg-amber-50/30 border-amber-200'}`}>
                                <div className="flex flex-col overflow-hidden pr-2">
                                  <span className="font-medium text-slate-700 truncate text-sm">{role}</span>
                                  {data.manual_override && <span className="text-[10px] text-indigo-500 font-semibold flex items-center gap-1"><Edit3 className="w-3 h-3" /> Manually edited</span>}
                                </div>
                                
                                {/* Manual Override Toggle */}
                                <button 
                                  onClick={() => toggleRoleStatus(originalIndex, role)}
                                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                    data.signed 
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                                      : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100 shadow-sm'
                                  }`}
                                >
                                  {data.signed ? <><Check className="w-3.5 h-3.5" /> Yes</> : <><XCircle className="w-3.5 h-3.5 opacity-50" /> No</>}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Final Jira Sync Action */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <div className="text-xs font-mono text-slate-500 flex gap-2 overflow-x-auto max-w-sm custom-scrollbar pb-1">
                            {!isOk && res.jira_labels_to_add.map((l: string) => (
                              <span key={l} className="bg-slate-200 px-1.5 py-0.5 rounded shrink-0">{l}</span>
                            ))}
                            {isOk && <span className="text-emerald-600 font-bold">No labels needed (100% Signed)</span>}
                          </div>
                          
                          <button className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2
                            ${isOk ? 'bg-slate-900 text-white hover:bg-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                          `}>
                            <Terminal className="w-4 h-4" /> Sync to Jira
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredResults.length === 0 && (
                    <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
                      No documents found for this filter.
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </main>
  );
}
