"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const DOMAINS = [
  "VAT",
  "INCOME_TAX",
  "COMPANY_TAX",
  "PAYROLL",
  "CAPITAL_GAINS_TAX",
  "WITHHOLDING_TAX",
  "ACCOUNTING_GENERAL",
  "OTHER",
];

interface KnowledgeItem {
  id: string;
  citationId: string;
  title: string;
  layer: string;
  status: string;
  kbVersion: number;
  createdAt: string;
  approvedAt?: string;
  primaryDomain: string;
  secondaryDomains: string;
  submittedBy: { email: string };
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [tab, setTab] = useState<"items" | "ingest" | "pdf">("items");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending"
  );
  const [layer, setLayer] = useState<string>("all");
  const [primaryDomain, setPrimaryDomain] = useState<string>("all");
  const [secondaryDomain, setSecondaryDomain] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/knowledge/list?status=${status}`;
      if (layer !== "all") {
        url += `&layer=${layer}`;
      }
      if (primaryDomain !== "all") {
        url += `&primaryDomain=${primaryDomain}`;
      }
      if (secondaryDomain !== "all") {
        url += `&secondaryDomain=${secondaryDomain}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoading(false);
    }
  }, [status, layer, primaryDomain, secondaryDomain]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleApprove = async (itemId: string) => {
    try {
      const res = await fetch("/api/knowledge/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeItemId: itemId }),
      });

      if (res.ok) {
        loadItems();
      }
    } catch (error) {
      console.error("Approve failed:", error);
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      const res = await fetch("/api/knowledge/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeItemId: itemId }),
      });

      if (res.ok) {
        loadItems();
      }
    } catch (error) {
      console.error("Reject failed:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "APPROVED":
        return "bg-green-50 border-green-200 text-green-800";
      case "REJECTED":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-slate-50 border-slate-200 text-slate-800";
    }
  };

  const getLayerBadge = (layer: string) => {
    const colors = {
      LEGAL: "bg-purple-100 text-purple-800",
      FIRM: "bg-blue-100 text-blue-800",
      CLIENT: "bg-green-100 text-green-800",
    };
    return colors[layer as keyof typeof colors] || "bg-slate-100 text-slate-800";
  };

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      VAT: "bg-indigo-100 text-indigo-800",
      INCOME_TAX: "bg-cyan-100 text-cyan-800",
      COMPANY_TAX: "bg-sky-100 text-sky-800",
      PAYROLL: "bg-violet-100 text-violet-800",
      CAPITAL_GAINS_TAX: "bg-fuchsia-100 text-fuchsia-800",
      WITHHOLDING_TAX: "bg-pink-100 text-pink-800",
      ACCOUNTING_GENERAL: "bg-orange-100 text-orange-800",
      OTHER: "bg-slate-100 text-slate-800",
    };
    return colors[domain] || "bg-slate-100 text-slate-800";
  };

  const parseSecondaryDomains = (secondaryDomainsJson: string): string[] => {
    try {
      return JSON.parse(secondaryDomainsJson);
    } catch {
      return [];
    }
  };

  const handleIngestWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) return;

    setIngestLoading(true);
    setIngestMessage("");

    try {
      const res = await fetch("/api/knowledge/ingest-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: websiteUrl,
          domain: "OTHER",
          layer: "LEGAL",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIngestMessage(`✓ Created ${data.items.length} suggested knowledge items`);
        setWebsiteUrl("");
        // Refresh items
        setTimeout(() => {
          setStatus("pending");
          loadItems();
        }, 1000);
      } else {
        setIngestMessage(`✗ ${data.error}`);
      }
    } catch (error) {
      setIngestMessage(`✗ Error: ${error}`);
    } finally {
      setIngestLoading(false);
    }
  };

  const handleIngestPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;

    setPdfLoading(true);
    setPdfMessage("");

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);

      const res = await fetch("/api/knowledge/ingest-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setPdfMessage(
          `✓ ${data.message} Domain breakdown: ${Object.entries(data.domainCounts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}`
        );
        setPdfFile(null);
        // Refresh items
        setTimeout(() => {
          setStatus("pending");
          loadItems();
        }, 1000);
      } else {
        setPdfMessage(`✗ ${data.error}`);
      }
    } catch (error) {
      setPdfMessage(`✗ Error: ${error}`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Knowledge Base</h1>
            <Link
              href="/chat"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Chat
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-slate-300 mb-4">
            <button
              onClick={() => setTab("items")}
              className={`px-4 py-2 font-medium text-sm ${
                tab === "items"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Knowledge Items
            </button>
            <button
              onClick={() => setTab("ingest")}
              className={`px-4 py-2 font-medium text-sm ${
                tab === "ingest"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ingest Website
            </button>
            <button
              onClick={() => setTab("pdf")}
              className={`px-4 py-2 font-medium text-sm ${
                tab === "pdf"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upload PDF
            </button>
          </div>

          {tab === "ingest" && (
            <form onSubmit={handleIngestWebsite} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.sars.gov.za/..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={ingestLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {ingestLoading ? "Ingesting..." : "Ingest"}
                </button>
              </div>
              {ingestMessage && (
                <p className={`mt-2 text-sm ${ingestMessage.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                  {ingestMessage}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Allowed: sars.gov.za only. Content will be suggested as PENDING knowledge.
              </p>
            </form>
          )}

          {tab === "pdf" && (
            <form onSubmit={handleIngestPdf} className="mb-6">
              <div className="flex gap-2">
                <label title="Select PDF file" className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="text-slate-600">
                    {pdfFile ? pdfFile.name : "Click to select PDF file..."}
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={pdfLoading || !pdfFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? "Processing..." : "Upload"}
                </button>
              </div>
              {pdfMessage && (
                <p className={`mt-2 text-sm ${pdfMessage.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                  {pdfMessage}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Max 15MB. PDFs are split into chunks. All items created as PENDING and require approval.
              </p>
            </form>
          )}

          {tab === "items" && (
          <>
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                title="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "approved" | "rejected" | "all")}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Layer
              </label>
              <select
                title="Filter by layer"
                value={layer}
                onChange={(e) => setLayer(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Layers</option>
                <option value="LEGAL">Legal/Regulatory</option>
                <option value="FIRM">Firm-specific</option>
                <option value="CLIENT">Client-specific</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Primary Domain
              </label>
              <select
                title="Filter by primary domain"
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Domains</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Secondary Domain
              </label>
              <select
                title="Filter by secondary domain"
                value={secondaryDomain}
                onChange={(e) => setSecondaryDomain(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Domains</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {tab === "items" && (
        <>
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No knowledge items found for the selected filters.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 ${getStatusColor(item.status)}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getLayerBadge(item.layer)}`}>
                        {item.layer}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDomainColor(item.primaryDomain)}`}>
                        {item.primaryDomain.replace(/_/g, " ")}
                      </span>
                      <code className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                        {item.citationId}
                      </code>
                    </div>
                    
                    {/* Secondary domains if any */}
                    {parseSecondaryDomains(item.secondaryDomains).length > 0 && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {parseSecondaryDomains(item.secondaryDomains).map((domain) => (
                          <span
                            key={domain}
                            className={`px-2 py-0.5 rounded text-xs font-medium opacity-75 ${getDomainColor(domain)}`}
                          >
                            {domain.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm opacity-75 mb-2">
                      Submitted by {item.submittedBy.email}
                      {" on "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {item.status === "PENDING" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Version info */}
                <div className="text-xs opacity-75 mt-2">
                  Version {item.kbVersion}
                  {item.approvedAt && (
                    <span>
                      {" · "}
                      Approved {new Date(item.approvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
