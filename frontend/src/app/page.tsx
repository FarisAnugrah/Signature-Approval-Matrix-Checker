"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, XCircle, Loader2, FileText, Tag, ShieldCheck, ChevronRight, FileCheck2, AlertCircle } from "lucide-react";
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
        setError("Please upload a PDF document.");
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
      const res = await fetch("http://localhost:8001/verify", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to verify");
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Compute stats
  const totalRoles = result ? Object.keys(result.results).length : 0;
  const signedRoles = result ? Object.values(result.results).filter((r: any) => r.signed).length : 0;
  const progress = totalRoles === 0 ? 0 : Math.round((signedRoles / totalRoles) * 100);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">SignatureMatrix</span>
        </div>
        <div className="text-sm font-medium text-slate-500">
          Internal Verification Tool
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            Verify Signatures with <span className="text-blue-600">Confidence</span>
          </h1>
          <p className="text-lg text-slate-500">
            Instantly validate physical and digital signatures on your BRD and PCR documents against the official Approval Matrix.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className={`grid gap-8 ${result ? 'md:grid-cols-12' : 'max-w-3xl mx-auto'}`}>
          
          {/* Left Column: Upload */}
          <div className={`${result ? 'md:col-span-5' : 'col-span-full'}`}>
            <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200/60">
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed transition-all duration-200 ease-in-out cursor-pointer min-h-[320px]
                  ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-300'}
                  ${file && !isDragging ? 'border-blue-200 bg-blue-50/30' : ''}
                `}
                onClick={() => !loading && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {file ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                      <FileCheck2 className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                      className="text-sm text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 text-blue-500 rounded-full flex items-center justify-center mx-auto">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Click to upload or drag & drop</p>
                      <p className="text-sm text-slate-500 mt-1">PDF documents only (max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-50 text-red-700 rounded-2xl text-sm flex items-start gap-3 border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <div className="mt-6">
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-4 rounded-2xl font-semibold transition-all shadow-sm active:scale-[0.98]"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Document...</>
                ) : (
                  <>Verify Signatures <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Results */}
          <AnimatePresence>
            {result && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }}
                className="md:col-span-7 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden flex flex-col"
              >
                {/* Result Header */}
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Verification Report</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                          {result.document_type}
                        </span>
                        <span className="text-slate-400 text-sm">{file?.name}</span>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 font-bold text-sm shadow-sm
                      ${result.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {result.status === 'APPROVED' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {result.status}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-8">
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-slate-600">Verification Progress</span>
                      <span className={progress === 100 ? 'text-emerald-600' : 'text-amber-600'}>{signedRoles} / {totalRoles} Signed</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${progress}%` }} 
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-2.5 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      ></motion.div>
                    </div>
                  </div>
                </div>

                {/* Matrix List */}
                <div className="p-8 flex-1 overflow-y-auto">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Approval Matrix Checklist</h3>
                  <div className="space-y-3">
                    {Object.entries(result.results).map(([role, data]: any, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={role} 
                        className={`flex items-center justify-between p-4 rounded-xl border ${
                          data.signed ? 'bg-white border-slate-200' : 'bg-amber-50/30 border-amber-100'
                        }`}
                      >
                        <span className="font-medium text-slate-700">{role}</span>
                        <div className="flex items-center">
                          {data.signed ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                              <CheckCircle2 className="w-4 h-4" /> Verified
                            </span>
                          ) : data.found ? (
                            <span className="flex items-center gap-1.5 text-amber-600 text-sm font-semibold bg-amber-50 px-3 py-1 rounded-full">
                              <Loader2 className="w-4 h-4" /> Pending
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-slate-500 text-sm font-semibold bg-slate-100 px-3 py-1 rounded-full">
                              <XCircle className="w-4 h-4" /> Not Found
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Jira Mockup */}
                {result.jira_labels_to_add && result.jira_labels_to_add.length > 0 && (
                  <div className="p-6 bg-blue-50/50 border-t border-blue-100 m-4 mt-0 rounded-2xl">
                    <div className="flex items-center gap-2 text-blue-900 font-semibold mb-2">
                      <Tag className="w-4 h-4 text-blue-600" /> Automated Jira Action
                    </div>
                    <p className="text-sm text-blue-700/80 mb-3">These labels will be synced to the Jira ticket to notify pending approvals:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.jira_labels_to_add.map((label: string) => (
                        <span key={label} className="bg-white border border-blue-200 text-blue-700 text-xs px-3 py-1.5 rounded-lg font-mono shadow-sm">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
