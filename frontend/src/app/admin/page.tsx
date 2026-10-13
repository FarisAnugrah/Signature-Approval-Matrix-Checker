"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Database, PlusCircle, ArrowLeft, Save, Trash2, Edit2, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminPanel() {
  const [templates, setTemplates] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8001/api/templates")
      .then(res => res.json())
      .then(data => {
        setTemplates(data);
        setActiveTab(Object.keys(data)[0]);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("http://localhost:8001/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templates),
      });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = (docType: string) => {
    const newTemplates = { ...templates };
    newTemplates[docType].roles.push("New Role");
    setTemplates(newTemplates);
  };

  const handleUpdateRole = (docType: string, index: number, value: string) => {
    const newTemplates = { ...templates };
    newTemplates[docType].roles[index] = value;
    setTemplates(newTemplates);
  };

  const handleDeleteRole = (docType: string, index: number) => {
    const newTemplates = { ...templates };
    newTemplates[docType].roles.splice(index, 1);
    setTemplates(newTemplates);
  };

  const handleAddDoc = () => {
    const name = prompt("Enter new Document Type (e.g., FSD):");
    if (!name) return;
    const newTemplates = { ...templates };
    newTemplates[name.toUpperCase()] = {
      identifiers: [name.toLowerCase()],
      approval_pages_from_end: 2,
      roles: ["Author", "Reviewer"]
    };
    setTemplates(newTemplates);
    setActiveTab(name.toUpperCase());
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]"><Loader2 className="w-8 h-8 animate-spin text-[#006747]" /></div>;

  return (
    <main className="min-h-screen bg-[#F8FAF9] text-[#232323] font-sans">
      <nav className="bg-white border-b border-[#006747]/15 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#EAF7EE] p-2 rounded-xl border border-[#006747]/20">
            <Database className="w-5 h-5 text-[#006747]" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-[#161620]">Template Registry</span>
            <span className="text-[10px] text-[#006747] font-bold block uppercase tracking-wider">BSN Compliance Configuration</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {successMsg && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[#006747] text-sm font-bold bg-[#EAF7EE] px-3.5 py-1.5 rounded-full border border-[#006747]/20">
                <CheckCircle2 className="w-4 h-4" /> Config Saved
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#006747] hover:bg-[#005439] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-[#006747]/20 disabled:opacity-70">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
          <a href="/" className="text-slate-500 hover:text-[#006747] font-bold text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Exit</a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 flex gap-8 items-start">
        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-2 sticky top-24">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Document Types</h3>
          {templates && Object.keys(templates).map((docType) => (
            <button
              key={docType}
              onClick={() => setActiveTab(docType)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-between border ${
                activeTab === docType 
                  ? "bg-[#006747] text-white border-[#006747] shadow-md shadow-[#006747]/20" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#006747]/40"
              }`}
            >
              <span>{docType}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === docType ? "bg-white/20 text-white" : "bg-[#EAF7EE] text-[#006747]"
              }`}>
                {templates[docType].roles.length}
              </span>
            </button>
          ))}
          <button
            onClick={handleAddDoc}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-[#006747] border-2 border-dashed border-[#006747]/30 hover:border-[#006747] hover:bg-[#EAF7EE] transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Add Document Type
          </button>
        </div>

        {/* Content */}
        {activeTab && templates && templates[activeTab] && (
          <div className="flex-1 bg-white border border-[#006747]/15 rounded-3xl p-8 shadow-sm space-y-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-2xl font-black text-[#161620]">{activeTab} Template</h2>
                <p className="text-slate-500 text-sm mt-1">Configure signature verification matrix for this document.</p>
              </div>
            </div>

            {/* Approval Matrix Roles */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-[#161620] uppercase tracking-wider">Required Roles ({templates[activeTab].roles.length})</h3>
                <button
                  onClick={() => handleAddRole(activeTab)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#006747] bg-[#EAF7EE] hover:bg-[#006747]/15 px-3 py-1.5 rounded-lg border border-[#006747]/20 transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Role
                </button>
              </div>

              <div className="grid gap-3">
                {templates[activeTab].roles.map((role: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 bg-[#FAFDFB] p-3 rounded-2xl border border-slate-200 focus-within:border-[#006747] transition-all">
                    <span className="w-6 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => handleUpdateRole(activeTab, idx, e.target.value)}
                      className="flex-1 bg-transparent border-none text-sm font-semibold text-slate-800 focus:outline-none p-0"
                    />
                    <button
                      onClick={() => handleDeleteRole(activeTab, idx)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Identifiers */}
            <div className="space-y-3 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-[#161620] uppercase tracking-wider">OCR Keyword Identifiers</h3>
              <p className="text-xs text-slate-500">Document Classification checks Page 1 for these exact keywords.</p>
              <div className="flex flex-wrap gap-2">
                {templates[activeTab].identifiers.map((ident: string, idx: number) => (
                  <span key={idx} className="bg-[#EAF7EE] border border-[#006747]/20 text-[#006747] px-3 py-1 rounded-xl text-xs font-bold">
                    {ident}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
