"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Database, PlusCircle, ArrowLeft, Save, Trash2, Edit2, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminPanel() {
  const [templates, setTemplates] = useState<any>(null);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-lg tracking-tight">Template Registry</span>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {successMsg && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4" /> Config Saved
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full text-sm font-bold transition-all disabled:opacity-70">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
          <a href="/" className="text-slate-500 hover:text-slate-900 font-medium text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Exit</a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 flex gap-8 items-start">
        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-2 sticky top-24">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Document Types</h3>
          {Object.keys(templates).map(type => (
            <button key={type} onClick={() => setActiveTab(type)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors font-medium ${activeTab === type ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'hover:bg-slate-100 text-slate-600'}`}>
              {type} Matrix
              <ChevronRight className={`w-4 h-4 ${activeTab === type ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
          <button onClick={handleAddDoc} className="w-full mt-4 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 px-4 py-3 rounded-xl transition-colors font-medium text-sm">
            <PlusCircle className="w-4 h-4" /> Add New Document
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 p-8 min-h-[500px]">
          {activeTab && (
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{activeTab} Configuration</h2>
                <p className="text-slate-500 mt-1">Define keywords and approval hierarchy for {activeTab}s.</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700">Classification Keywords (Identifiers)</label>
                <div className="flex flex-wrap gap-2">
                  {templates[activeTab].identifiers.map((id: string, i: number) => (
                    <div key={i} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-mono border border-slate-200">
                      {id}
                    </div>
                  ))}
                  <button className="text-indigo-600 text-sm font-medium hover:underline px-2">+ Add keyword</button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">Approval Matrix Roles</label>
                  <button onClick={() => handleAddRole(activeTab)} className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors">
                    <PlusCircle className="w-4 h-4" /> Add Role
                  </button>
                </div>
                
                <div className="space-y-2">
                  {templates[activeTab].roles.map((role: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 group">
                      <div className="bg-slate-100 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-200">
                        {idx + 1}
                      </div>
                      <input 
                        type="text" 
                        value={role} 
                        onChange={(e) => handleUpdateRole(activeTab, idx, e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                      <button onClick={() => handleDeleteRole(activeTab, idx)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}

// Icon helper since lucide-react doesn't export ChevronRight directly in our scope above
const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);
