"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  actionType: string;
  entityType?: string;
  user?: { email: string };
  createdAt: string;
  detailsJson?: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionType, setActionType] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [actionType]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let url = "/api/audit/logs?limit=100";
      if (actionType !== "all") {
        url += `&actionType=${actionType}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = [
    "LOGIN",
    "LOGOUT",
    "MESSAGE_SEND",
    "KB_SUBMIT",
    "KB_APPROVE",
    "KB_REJECT",
    "KB_INGEST_WEBSITE",
    "REASON_QUERY",
  ];

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      LOGIN: "bg-blue-50 text-blue-800 border-blue-200",
      LOGOUT: "bg-slate-50 text-slate-800 border-slate-200",
      MESSAGE_SEND: "bg-cyan-50 text-cyan-800 border-cyan-200",
      KB_SUBMIT: "bg-yellow-50 text-yellow-800 border-yellow-200",
      KB_APPROVE: "bg-green-50 text-green-800 border-green-200",
      KB_REJECT: "bg-red-50 text-red-800 border-red-200",
      KB_INGEST_WEBSITE: "bg-indigo-50 text-indigo-800 border-indigo-200",
      REASON_QUERY: "bg-purple-50 text-purple-800 border-purple-200",
    };
    return colors[action] || "bg-slate-50 text-slate-800 border-slate-200";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Audit Log</h1>
            <Link
              href="/knowledge"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Knowledge
            </Link>
          </div>

          {/* Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Action
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Actions</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No audit logs found.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className={`border rounded-lg p-4 ${getActionColor(log.actionType)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold mb-1">{log.actionType}</div>
                    <div className="text-sm opacity-75">
                      {log.user?.email || "System"} at{" "}
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                    {log.detailsJson && (
                      <div className="text-xs font-mono opacity-60 mt-2 bg-white bg-opacity-40 p-2 rounded">
                        {log.detailsJson}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
