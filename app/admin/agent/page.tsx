"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AgentSummary {
  agent: {
    status: string;
    autoAllocateEnabled: boolean;
    autoAllocateInterval: number;
    autoAllocateMinConfidence: number;
    llmFallbackEnabled: boolean;
    autoAllocateLastRun: string | null;
    autoAllocateNextRun: string | null;
    totalAllocations: number;
    totalLLMCalls: number;
  };
  transactions: {
    pending: number;
    processed: number;
    needsReview: number;
  };
  llmCacheCount: number;
  recentJobs: Array<{
    id: string;
    status: string;
    startedAt: string;
    processed: number;
    autoAllocated: number;
    llmAllocated: number;
    needsReview: number;
  }>;
}

export default function AgentControlPage() {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [runningJob, setRunningJob] = useState(false);
  const [jobResult, setJobResult] = useState<string | null>(null);

  // Form state
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "PAUSED">("INACTIVE");
  const [autoAllocateEnabled, setAutoAllocateEnabled] = useState(false);
  const [autoAllocateInterval, setAutoAllocateInterval] = useState(60);
  const [autoAllocateMinConfidence, setAutoAllocateMinConfidence] = useState(0.8);
  const [llmFallbackEnabled, setLlmFallbackEnabled] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/allocations/agent");
      if (res.ok) {
        const data = await res.json();
        setSummary(data);

        // Update form state
        setStatus(data.agent.status);
        setAutoAllocateEnabled(data.agent.autoAllocateEnabled);
        setAutoAllocateInterval(data.agent.autoAllocateInterval);
        setAutoAllocateMinConfidence(data.agent.autoAllocateMinConfidence);
        setLlmFallbackEnabled(data.agent.llmFallbackEnabled);
      }
    } catch (error) {
      console.error("Failed to load agent summary:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const updateAgent = async () => {
    setUpdating(true);
    try {
      const res = await fetch("/api/allocations/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          autoAllocateEnabled,
          autoAllocateInterval,
          autoAllocateMinConfidence,
          llmFallbackEnabled,
          authorizedActions: ["ALLOCATE", "RESPOND", "LEARN"],
        }),
      });

      if (res.ok) {
        await loadSummary();
        alert("Agent settings updated!");
      } else {
        const error = await res.json();
        alert(`Failed to update: ${error.error}`);
      }
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update agent settings");
    } finally {
      setUpdating(false);
    }
  };

  const runAllocationJob = async () => {
    setRunningJob(true);
    setJobResult(null);
    try {
      const res = await fetch("/api/allocations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 100,
          autoConfirmAbove: autoAllocateMinConfidence,
          useLLMFallback: llmFallbackEnabled,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setJobResult(result.message);
        await loadSummary();
      } else {
        setJobResult(`Error: ${result.error} - ${result.message}`);
      }
    } catch (error) {
      console.error("Job run failed:", error);
      setJobResult("Failed to run allocation job");
    } finally {
      setRunningJob(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading agent status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sean Agent Control</h1>
            <p className="text-slate-400 text-sm">Autonomous allocation engine</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/allocations"
              className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition"
            >
              Bank Allocations
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Agent Status</div>
            <div className={`text-2xl font-bold ${
              summary?.agent.status === "ACTIVE" ? "text-green-600" :
              summary?.agent.status === "PAUSED" ? "text-yellow-600" :
              "text-slate-400"
            }`}>
              {summary?.agent.status || "UNKNOWN"}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Pending Transactions</div>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.transactions.pending || 0}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">Total Auto-Allocated</div>
            <div className="text-2xl font-bold text-green-600">
              {summary?.agent.totalAllocations || 0}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-slate-500">LLM Calls (Cached)</div>
            <div className="text-2xl font-bold text-purple-600">
              {summary?.agent.totalLLMCalls || 0} / {summary?.llmCacheCount || 0}
            </div>
          </div>
        </div>

        {/* Transaction Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Transaction Status</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {summary?.transactions.pending || 0}
              </div>
              <div className="text-sm text-slate-600">Unprocessed</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">
                {summary?.transactions.needsReview || 0}
              </div>
              <div className="text-sm text-slate-600">Needs Review</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {summary?.transactions.processed || 0}
              </div>
              <div className="text-sm text-slate-600">Processed</div>
            </div>
          </div>
        </div>

        {/* Agent Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Agent Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Agent Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="INACTIVE">Inactive - Manual only</option>
                <option value="ACTIVE">Active - Auto-allocations enabled</option>
                <option value="PAUSED">Paused - Temporarily stopped</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                When ACTIVE, Sean can auto-allocate transactions
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Auto-Allocation Interval (minutes)
              </label>
              <input
                type="number"
                value={autoAllocateInterval}
                onChange={(e) => setAutoAllocateInterval(Number(e.target.value))}
                min={5}
                max={1440}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                How often to run auto-allocation (5-1440 min)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Confidence for Auto-Confirm
              </label>
              <input
                type="range"
                value={autoAllocateMinConfidence}
                onChange={(e) => setAutoAllocateMinConfidence(Number(e.target.value))}
                min={0.5}
                max={0.99}
                step={0.01}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-slate-500">
                <span>50%</span>
                <span className="font-medium text-blue-600">
                  {(autoAllocateMinConfidence * 100).toFixed(0)}%
                </span>
                <span>99%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Only auto-confirm allocations above this confidence level
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoAllocateEnabled"
                  checked={autoAllocateEnabled}
                  onChange={(e) => setAutoAllocateEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autoAllocateEnabled" className="text-sm font-medium text-slate-700">
                  Enable Auto-Allocation
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="llmFallbackEnabled"
                  checked={llmFallbackEnabled}
                  onChange={(e) => setLlmFallbackEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="llmFallbackEnabled" className="text-sm font-medium text-slate-700">
                  Enable LLM Fallback (for unknown transactions)
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={updateAgent}
              disabled={updating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {updating ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {/* Run Job Manually */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Manual Allocation Run</h2>

          <div className="flex items-center gap-4">
            <button
              onClick={runAllocationJob}
              disabled={runningJob || status !== "ACTIVE"}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                status === "ACTIVE"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              } disabled:opacity-50`}
            >
              {runningJob ? "Running..." : "Run Allocation Now"}
            </button>

            {status !== "ACTIVE" && (
              <span className="text-sm text-slate-500">
                Activate Sean to run allocations
              </span>
            )}
          </div>

          {jobResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              jobResult.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}>
              {jobResult}
            </div>
          )}

          {summary?.agent.autoAllocateLastRun && (
            <div className="mt-4 text-sm text-slate-500">
              Last run: {new Date(summary.agent.autoAllocateLastRun).toLocaleString()}
              {summary.agent.autoAllocateNextRun && (
                <span> | Next scheduled: {new Date(summary.agent.autoAllocateNextRun).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        {summary?.recentJobs && summary.recentJobs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Allocation Jobs</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-4">Time</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-right py-2 px-4">Processed</th>
                    <th className="text-right py-2 px-4">Auto</th>
                    <th className="text-right py-2 px-4">LLM</th>
                    <th className="text-right py-2 px-4">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentJobs.map((job) => (
                    <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-4">
                        {new Date(job.startedAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          job.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          job.status === "RUNNING" ? "bg-blue-100 text-blue-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right">{job.processed}</td>
                      <td className="py-2 px-4 text-right text-green-600">{job.autoAllocated}</td>
                      <td className="py-2 px-4 text-right text-purple-600">{job.llmAllocated}</td>
                      <td className="py-2 px-4 text-right text-orange-600">{job.needsReview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* API Integration Info */}
        <div className="bg-slate-800 text-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">External System Integration</h2>

          <p className="text-slate-300 mb-4">
            To trigger allocations from your other accounting system:
          </p>

          <div className="bg-slate-900 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <div className="text-green-400"># Check if allocation should run</div>
            <div className="text-slate-300">
              GET /api/allocations/run<br/>
              Headers: x-api-key: YOUR_SEAN_API_KEY
            </div>
            <br/>
            <div className="text-green-400"># Trigger allocation job</div>
            <div className="text-slate-300">
              POST /api/allocations/run<br/>
              Headers: x-api-key: YOUR_SEAN_API_KEY, x-system-id: YOUR_SYSTEM_NAME<br/>
              Body: {`{ "limit": 100, "useLLMFallback": true }`}
            </div>
          </div>

          <p className="text-slate-400 mt-4 text-sm">
            Set <code className="bg-slate-700 px-2 py-1 rounded">SEAN_API_KEY</code> in your .env file
          </p>
        </div>
      </main>
    </div>
  );
}
