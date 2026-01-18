"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Category {
  code: string;
  label: string;
  keywords: string[];
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  isDebit: boolean;
  suggestedCategory: string | null;
  suggestedConfidence: number | null;
  confirmedCategory: string | null;
  feedback: string | null;
  processed: boolean;
}

interface AllocationStats {
  rules: {
    totalRules: number;
    rulesByCategory: Array<{ category: string; ruleCount: number; totalLearnings: number }>;
    topRules: Array<{ pattern: string; category: string; confidence: number; learnedFromCount: number }>;
  };
  transactions: {
    total: number;
    processed: number;
    unprocessed: number;
    byCategory: Array<{ category: string; count: number; totalAmount: number }>;
  };
}

export default function AllocationsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<AllocationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unprocessed" | "processed">("unprocessed");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [teachFeedback, setTeachFeedback] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const processedParam = filter === "all" ? "" : `&processed=${filter === "processed"}`;
      const res = await fetch(`/api/allocations/transactions?limit=100${processedParam}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadStats = async () => {
    try {
      const res = await fetch("/api/allocations/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  useEffect(() => {
    loadTransactions();
    loadStats();
  }, [loadTransactions]);

  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx);
    setSelectedCategory(tx.confirmedCategory || tx.suggestedCategory || "");
    setTeachFeedback("");
  };

  const handleConfirmAllocation = async () => {
    if (!selectedTx || !selectedCategory) return;

    setSaving(true);
    try {
      const res = await fetch("/api/allocations/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTx.id,
          description: selectedTx.rawDescription || selectedTx.description,
          correctCategory: selectedCategory,
          feedback: teachFeedback || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({
          type: "success",
          text: data.message,
        });

        // Update local state
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === selectedTx.id
              ? { ...tx, confirmedCategory: selectedCategory, processed: true, feedback: teachFeedback }
              : tx
          )
        );

        // Move to next unprocessed transaction
        const nextUnprocessed = transactions.find(
          tx => tx.id !== selectedTx.id && !tx.processed
        );
        if (nextUnprocessed) {
          handleSelectTransaction(nextUnprocessed);
        } else {
          setSelectedTx(null);
        }

        // Refresh stats
        loadStats();
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save allocation" });
    } finally {
      setSaving(false);
    }
  };

  const handleImportTransactions = async () => {
    if (!importText.trim()) return;

    setImportLoading(true);
    try {
      // Parse CSV-like input: date, description, amount
      const lines = importText.trim().split("\n");
      const txs = lines.map(line => {
        const parts = line.split(/[,\t]/).map(p => p.trim());
        return {
          date: parts[0] || new Date().toISOString().split("T")[0],
          description: parts[1] || line,
          rawDescription: parts[1] || line,
          amount: parseFloat(parts[2]) || 0,
          isDebit: parseFloat(parts[2] || "0") < 0,
        };
      }).filter(tx => tx.description);

      const res = await fetch("/api/allocations/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: txs }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({
          type: "success",
          text: `Imported ${data.created} transactions`,
        });
        setImportText("");
        loadTransactions();
        loadStats();
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to import transactions" });
    } finally {
      setImportLoading(false);
    }
  };

  const getCategoryLabel = (code: string | null) => {
    if (!code) return "—";
    const cat = categories.find(c => c.code === code);
    return cat?.label || code;
  };

  const formatAmount = (amount: number, isDebit: boolean) => {
    const formatted = Math.abs(amount).toLocaleString("en-ZA", {
      style: "currency",
      currency: "ZAR",
    });
    return isDebit ? `-${formatted}` : formatted;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Bank Allocations</h1>
              <p className="text-slate-600 mt-1">
                Categorize transactions and teach Sean to learn your patterns
              </p>
            </div>
            <Link
              href="/chat"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Chat
            </Link>
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-700">{stats.transactions.total}</div>
                <div className="text-sm text-blue-600">Total Transactions</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-700">{stats.transactions.unprocessed}</div>
                <div className="text-sm text-yellow-600">Need Allocation</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-700">{stats.transactions.processed}</div>
                <div className="text-sm text-green-600">Processed</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-700">{stats.rules.totalRules}</div>
                <div className="text-sm text-purple-600">Learned Rules</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
          message.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 font-bold">×</button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Left: Transaction List */}
          <div className="col-span-2">
            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
              {(["unprocessed", "processed", "all"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    filter === f
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {f === "unprocessed" ? "Need Allocation" : f === "processed" ? "Processed" : "All"}
                </button>
              ))}
            </div>

            {/* Import Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
              <h3 className="font-semibold text-slate-900 mb-2">Import Transactions</h3>
              <p className="text-xs text-slate-500 mb-2">
                Paste transactions (one per line): date, description, amount (CSV or tab-separated)
              </p>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="2024-01-15, ATM FEE WITHDRAWAL, -15.00&#10;2024-01-16, TELKOM MONTHLY, -599.00"
                className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
              <button
                onClick={handleImportTransactions}
                disabled={importLoading || !importText.trim()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {importLoading ? "Importing..." : "Import"}
              </button>
            </div>

            {/* Transaction List */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : transactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No transactions found. Import some above!
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {transactions.map(tx => (
                        <tr
                          key={tx.id}
                          onClick={() => handleSelectTransaction(tx)}
                          className={`cursor-pointer transition ${
                            selectedTx?.id === tx.id
                              ? "bg-blue-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(tx.date).toLocaleDateString("en-ZA")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900 truncate max-w-xs">
                              {tx.description}
                            </div>
                            {tx.suggestedCategory && !tx.confirmedCategory && (
                              <div className="text-xs text-slate-500">
                                Suggested: {getCategoryLabel(tx.suggestedCategory)}
                                {tx.suggestedConfidence && (
                                  <span className="ml-1 text-slate-400">
                                    ({(tx.suggestedConfidence * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-mono ${
                            tx.isDebit ? "text-red-600" : "text-green-600"
                          }`}>
                            {formatAmount(tx.amount, tx.isDebit)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {tx.confirmedCategory ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                {getCategoryLabel(tx.confirmedCategory)}
                              </span>
                            ) : tx.suggestedCategory ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                {getCategoryLabel(tx.suggestedCategory)}?
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {tx.processed ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-yellow-500">○</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right: Allocation Panel */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-4">
              {selectedTx ? (
                <>
                  <h3 className="font-semibold text-slate-900 mb-4">Allocate Transaction</h3>

                  {/* Transaction Details */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <div className="text-sm text-slate-600 mb-1">
                      {new Date(selectedTx.date).toLocaleDateString("en-ZA")}
                    </div>
                    <div className="font-medium text-slate-900 mb-2">
                      {selectedTx.description}
                    </div>
                    <div className={`text-lg font-bold ${
                      selectedTx.isDebit ? "text-red-600" : "text-green-600"
                    }`}>
                      {formatAmount(selectedTx.amount, selectedTx.isDebit)}
                    </div>
                  </div>

                  {/* Suggestion */}
                  {selectedTx.suggestedCategory && !selectedTx.confirmedCategory && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="text-sm font-medium text-blue-800">
                        Sean suggests: {getCategoryLabel(selectedTx.suggestedCategory)}
                      </div>
                      <div className="text-xs text-blue-600">
                        Confidence: {((selectedTx.suggestedConfidence || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}

                  {/* Category Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat.code} value={cat.code}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Teach Sean (Feedback) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Teach Sean (optional)
                    </label>
                    <textarea
                      value={teachFeedback}
                      onChange={e => setTeachFeedback(e.target.value)}
                      placeholder="Explain why this category is correct..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Your feedback helps Sean learn for similar transactions
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmAllocation}
                      disabled={saving || !selectedCategory}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      {saving ? "Saving..." : "Confirm & Learn"}
                    </button>
                    <button
                      onClick={() => setSelectedTx(null)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Quick Actions */}
                  {selectedTx.suggestedCategory && selectedCategory !== selectedTx.suggestedCategory && (
                    <button
                      onClick={() => setSelectedCategory(selectedTx.suggestedCategory!)}
                      className="w-full mt-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      Use Sean's suggestion
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <div className="text-4xl mb-4">👈</div>
                  <p>Select a transaction to allocate</p>
                </div>
              )}
            </div>

            {/* Learning Stats */}
            {stats && stats.rules.topRules.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6 mt-4">
                <h3 className="font-semibold text-slate-900 mb-4">Top Learned Patterns</h3>
                <div className="space-y-3">
                  {stats.rules.topRules.slice(0, 5).map((rule, i) => (
                    <div key={i} className="text-sm">
                      <div className="font-medium text-slate-900 truncate">
                        {rule.pattern}
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{getCategoryLabel(rule.category)}</span>
                        <span>{rule.learnedFromCount}× learned</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
