"use client";

import { useState } from "react";
import { ShieldCheck, Database, PlusCircle, ArrowLeft } from "lucide-react";

export default function AdminPanel() {
  const [docTypes, setDocTypes] = useState(["BRD", "PCR"]);
  
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-indigo-600" />
              Template Registry
            </h1>
            <p className="text-slate-500 mt-2">Manage Approval Matrices for different document types.</p>
          </div>
          <a href="/" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Scanner
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Active Templates (templates.json)</h2>
            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <PlusCircle className="w-4 h-4" /> Add Document Type
            </button>
          </div>

          <div className="grid gap-4">
            {docTypes.map(type => (
              <div key={type} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex justify-between items-center hover:border-indigo-200 transition-colors cursor-pointer">
                <div>
                  <h3 className="font-bold text-slate-800">{type} Matrix</h3>
                  <p className="text-xs text-slate-500 mt-1">Configured roles & keywords</p>
                </div>
                <div className="text-indigo-600 font-medium text-sm">Edit Configuration</div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <h3 className="text-amber-800 font-bold mb-2">🚧 Roadmap: Phase 2 Feature</h3>
            <p className="text-amber-700/80 text-sm">
              This admin panel will soon allow visual drag-and-drop mapping of signatures and updating the backend JSON configurations directly without redeploying.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
