import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Check,
  Edit2,
  X,
  BookOpen,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/client';
import { TransactionItem } from '../../api/types';

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ingestion states
  const [activeTab, setActiveTab] = useState<'upload' | 'sms' | 'rules'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [smsText, setSmsText] = useState('');
  const [parsingSms, setParsingSms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category Correction Modal State
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [learnRule, setLearnRule] = useState(true);
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [learnedRules, setLearnedRules] = useState<Record<string, string>>({});

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTransactions({
        page,
        page_size: pageSize,
        category: selectedCategory,
        tx_type: selectedType,
        search: searchQuery,
      });
      setTransactions(res.transactions);
      setTotal(res.total);
      setCategories(res.categories);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const data = await api.getCategories();
      setLearnedRules(data.learned_rules || {});
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchRules();
  }, [page, selectedCategory, selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadSuccess(null);
      const res = await api.uploadStatement(file);
      setUploadSuccess(`Successfully imported ${res.imported_count} transactions!`);
      setPage(1);
      fetchTransactions();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;

    try {
      setParsingSms(true);
      const res = await api.parseSMS(smsText);
      setUploadSuccess(`Successfully parsed and added ${res.imported_count} transaction(s) from SMS!`);
      setSmsText('');
      setPage(1);
      fetchTransactions();
    } catch (err: any) {
      alert(`SMS Parsing error: ${err.message}`);
    } finally {
      setParsingSms(false);
    }
  };

  const openCorrectionModal = (tx: TransactionItem) => {
    setEditingTx(tx);
    setNewCategory(tx.Category);
    setRuleKeyword(tx.Description);
    setLearnRule(true);
  };

  const handleSaveCorrection = async () => {
    if (!editingTx || !newCategory) return;
    try {
      setCorrecting(true);
      const res = await api.correctCategory(
        editingTx.TransactionID,
        newCategory,
        learnRule,
        ruleKeyword
      );
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.TransactionID === editingTx.TransactionID || (learnRule && t.Description.toLowerCase().includes(ruleKeyword.toLowerCase()))
            ? { ...t, Category: newCategory }
            : t
        )
      );
      setEditingTx(null);
      await fetchRules();
      alert(`Category updated to "${newCategory}". ${res.rule_saved ? `Learned rule saved: ${res.matching_updated_count} record(s) reconciled!` : ''}`);
    } catch (err: any) {
      alert(`Error updating category: ${err.message}`);
    } finally {
      setCorrecting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-8">
      {/* Top Banner: Ingestion Control Hub */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
          <div>
            <h2 className="font-archivo font-bold text-lg text-[#0f172a]">Statement Ingestion Hub</h2>
            <p className="font-mono text-xs text-[#64748b]">
              Ingest messy bank statements (CSV, PDF) or paste SMS alerts with automatic classification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold transition-colors ${
                activeTab === 'upload' ? 'bg-[#ff3b12] text-white shadow-sm' : 'bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a] border border-slate-200'
              }`}
            >
              CSV / PDF
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold transition-colors ${
                activeTab === 'sms' ? 'bg-[#ff3b12] text-white shadow-sm' : 'bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a] border border-slate-200'
              }`}
            >
              SMS Alerts
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold transition-colors ${
                activeTab === 'rules' ? 'bg-[#ff3b12] text-white shadow-sm' : 'bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a] border border-slate-200'
              }`}
            >
              Learned Rules ({Object.keys(learnedRules).length})
            </button>
          </div>
        </div>

        {uploadSuccess && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 font-mono text-xs text-[#059669]">
            <Check className="w-4 h-4" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Tab 1: File Drop Zone */}
        {activeTab === 'upload' && (
          <div className="mt-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#ff3b12] rounded-xl p-8 text-center cursor-pointer transition-colors bg-[#f8fafc] group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .pdf, text/csv, application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Upload className="w-10 h-10 text-[#94a3b8] group-hover:text-[#ff3b12] mx-auto mb-3 transition-colors" />
              <div className="font-archivo font-bold text-sm text-[#0f172a] mb-1">
                {uploading ? 'Parsing & Categorizing Statement...' : 'Drop your statement file here, or click to browse'}
              </div>
              <p className="font-mono text-xs text-[#64748b]">
                Supports CSV statements & PDF e-statements. Auto-detects columns, debit/credit flow, and merchant rules.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: SMS Alerts Paste */}
        {activeTab === 'sms' && (
          <form onSubmit={handleSmsSubmit} className="mt-4 space-y-3">
            <textarea
              rows={4}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              placeholder="Paste one or more bank/UPI SMS notifications here, e.g.:&#10;Rs. 450.00 debited from a/c **1234 at Swiggy on 12-Oct-26. Avl bal INR 24,000.&#10;Credited with Rs. 85,000 from Salary Corp on 01-Nov-26."
              className="w-full p-3.5 rounded-lg bg-white border border-slate-300 font-mono text-xs text-[#0f172a] focus:outline-none focus:border-[#ff3b12] focus:ring-1 focus:ring-[#ff3b12]"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={parsingSms || !smsText.trim()}
                className="px-4 py-2 rounded bg-[#ff3b12] hover:bg-[#e0340f] text-white font-mono text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
              >
                {parsingSms ? 'Parsing SMS...' : 'Parse & Ingest SMS'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Learned Rules */}
        {activeTab === 'rules' && (
          <div className="mt-4">
            <p className="font-mono text-xs text-[#64748b] mb-3">
              The correction loop automatically maps merchant descriptions to categories and applies them across future imports.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {Object.entries(learnedRules).map(([kw, cat]) => (
                <div key={kw} className="p-2.5 rounded bg-[#f8fafc] border border-slate-200 font-mono text-xs flex justify-between items-center shadow-sm">
                  <span className="text-[#0f172a] font-semibold truncate mr-2">{kw}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#059669] border border-emerald-200 text-[10px] shrink-0 font-bold">
                    {cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between font-mono text-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#94a3b8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by description, merchant, or notes..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12] shadow-sm"
          />
        </form>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12] shadow-sm"
          >
            <option value="All">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12] shadow-sm"
          >
            <option value="All">All Types</option>
            <option value="Expense">Expense Only</option>
            <option value="Income">Income Only</option>
          </select>

          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedType('All');
              setPage(1);
              fetchTransactions();
            }}
            title="Reset Filters"
            className="p-2.5 rounded-lg bg-white border border-slate-300 text-[#64748b] hover:text-[#0f172a] shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="rounded-xl bg-white border border-[#e2e8f0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-[#64748b] border-b border-[#e2e8f0] bg-slate-50">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Payment Mode</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748b]">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748b]">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.TransactionID} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3.5 px-4 text-[#64748b]">{tx.TransactionDate}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-[#0f172a] font-semibold">{tx.Description}</div>
                      {tx.Notes && <div className="text-[10px] text-[#64748b] truncate max-w-xs">{tx.Notes}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => openCorrectionModal(tx)}
                        className="px-2.5 py-1 rounded bg-slate-100 group-hover:bg-slate-200 border border-slate-200 text-[#0f172a] text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span>{tx.Category}</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-[#ff3b12]" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold ${
                          tx.TransactionType.toLowerCase() === 'income' ? 'text-[#059669]' : 'text-[#64748b]'
                        }`}
                      >
                        {tx.TransactionType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#64748b]">{tx.PaymentMode || 'Card/UPI'}</td>
                    <td
                      className={`py-3.5 px-4 text-right font-bold ${
                        tx.TransactionType.toLowerCase() === 'income' ? 'text-[#059669]' : 'text-[#0f172a]'
                      }`}
                    >
                      {tx.TransactionType.toLowerCase() === 'income' ? '+' : '-'}₹
                      {tx.Amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openCorrectionModal(tx)}
                        title="Reclassify & Teach Rule"
                        className="p-1 rounded text-[#94a3b8] hover:text-[#ff3b12] hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-[#64748b] bg-slate-50/50">
          <div>
            Showing {transactions.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(page * pageSize, total)} of {total} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded bg-white border border-slate-300 text-[#0f172a] disabled:opacity-40 shadow-sm"
            >
              Previous
            </button>
            <span className="text-[#0f172a] font-bold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded bg-white border border-slate-300 text-[#0f172a] disabled:opacity-40 shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Category Correction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-xl rounded-xl max-w-md w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-archivo font-bold text-sm text-[#0f172a]">Correction Loop: Reclassify Transaction</h3>
              <button onClick={() => setEditingTx(null)} className="text-[#64748b] hover:text-[#0f172a]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-[#64748b]">Transaction Description:</div>
              <div className="text-[#0f172a] font-semibold">{editingTx.Description}</div>
              <div className="text-[#64748b]">Amount: ₹{editingTx.Amount.toLocaleString('en-IN')}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[#475569] block font-medium">New Category:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={learnRule}
                  onChange={(e) => setLearnRule(e.target.checked)}
                  className="rounded border-slate-300 text-[#ff3b12] focus:ring-0"
                />
                <span className="text-[#0f172a] font-semibold">Teach INARI this rule for future imports</span>
              </label>

              {learnRule && (
                <div className="space-y-1">
                  <label className="text-[#64748b] block text-[11px]">Match keyword in description:</label>
                  <input
                    type="text"
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    className="w-full p-2 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
                  />
                  <p className="text-[10px] text-[#64748b]">
                    Whenever this keyword appears, INARI will automatically classify it as "{newCategory}".
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setEditingTx(null)}
                className="px-4 py-2 rounded bg-slate-100 border border-slate-200 text-[#64748b] hover:text-[#0f172a]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCorrection}
                disabled={correcting}
                className="px-4 py-2 rounded bg-[#ff3b12] hover:bg-[#e0340f] text-white font-bold disabled:opacity-50 shadow-sm"
              >
                {correcting ? 'Saving Rule...' : 'Save & Propagate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
