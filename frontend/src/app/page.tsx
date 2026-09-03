"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle, XCircle, Loader2, FileText, Tag } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      // Nembak API FastAPI yang jalan di port 8001
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

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Signature Matrix Checker</h1>
          <p className="text-gray-500">Upload a BRD or PCR document to verify approval signatures</p>
        </div>

        {/* Upload Card */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-12 bg-gray-50 hover:bg-gray-100 transition-colors">
            <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full max-w-xs text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-8 py-3 rounded-full font-medium transition-all"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? "Verifying Document..." : "Verify Signatures"}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-center text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results Card */}
        {result && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-500 w-6 h-6" />
                <div>
                  <h3 className="font-semibold text-lg">Document Type</h3>
                  <p className="text-gray-500 text-sm uppercase">{result.document_type}</p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-bold ${result.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {result.status}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700">Approval Matrix Check:</h3>
              <div className="grid gap-3">
                {Object.entries(result.results).map(([role, data]: any) => (
                  <div key={role} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="font-medium text-gray-700">{role}</span>
                    <div className="flex items-center gap-2">
                      {data.signed ? (
                        <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                          <CheckCircle className="w-5 h-5" /> Signed
                        </span>
                      ) : data.found ? (
                        <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
                          <XCircle className="w-5 h-5" /> Pending
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
                          <XCircle className="w-5 h-5" /> Not Found
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jira Mockup */}
            {result.jira_labels_to_add && result.jira_labels_to_add.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                  <Tag className="w-4 h-4" /> Jira Automation Preview
                </div>
                <p className="text-sm text-blue-700 mb-2">The following labels would be automatically added to the Jira issue:</p>
                <div className="flex flex-wrap gap-2">
                  {result.jira_labels_to_add.map((label: string) => (
                    <span key={label} className="bg-blue-200 text-blue-800 text-xs px-2.5 py-1 rounded-md font-mono">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
