'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';

interface ContinuityPlan {
  id: string;
  name: string;
  description: string | null;
  billing_interval: string;
  amount_per_interval: number;
  features: string[] | null;
  is_active: boolean;
  created_at: string;
}

const INTERVALS = ['week', 'month', 'quarter', 'year'];

export default function ContinuityPlansAdminPage() {
  const [plans, setPlans] = useState<ContinuityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    billing_interval: 'month',
    amount_per_interval: 0,
    features: '',
    is_active: true,
  });

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/continuity-plans?active=false');
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      billing_interval: 'month',
      amount_per_interval: 0,
      features: '',
      is_active: true,
    });
    setEditing(null);
    setShowCreate(false);
  };

  const startEdit = (plan: ContinuityPlan) => {
    setForm({
      name: plan.name,
      description: plan.description || '',
      billing_interval: plan.billing_interval,
      amount_per_interval: plan.amount_per_interval,
      features: (plan.features || []).join('\n'),
      is_active: plan.is_active,
    });
    setEditing(plan.id);
    setShowCreate(true);
  };

  const handleSave = async () => {
    const body = {
      name: form.name,
      description: form.description || null,
      billing_interval: form.billing_interval,
      amount_per_interval: Number(form.amount_per_interval),
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
      is_active: form.is_active,
    };

    try {
      const url = editing
        ? `/api/admin/continuity-plans?id=${editing}`
        : '/api/admin/continuity-plans';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        fetchPlans();
      } else {
        const err = await res.json();
        alert(err.error || 'Save failed');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this continuity plan?')) return;
    try {
      const res = await fetch(`/api/admin/continuity-plans?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchPlans();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-6 text-white">
      {/* Header */}
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="rounded-lg p-2 hover:bg-gray-800">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Continuity Plans</h1>
            <p className="text-sm text-gray-400">Manage recurring subscription plans for ongoing client support</p>
          </div>
          <button
            onClick={() => fetchPlans()}
            className="rounded-lg bg-gray-800 p-2 hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New Plan
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreate && (
          <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? 'Edit Plan' : 'Create New Plan'}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  placeholder="e.g. AI Advisory Retainer"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Billing Interval</label>
                <select
                  value={form.billing_interval}
                  onChange={e => setForm({ ...form, billing_interval: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                >
                  {INTERVALS.map(i => (
                    <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Amount per Interval ($)</label>
                <input
                  type="number"
                  value={form.amount_per_interval}
                  onChange={e => setForm({ ...form, amount_per_interval: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  min={0}
                  step={1}
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="rounded border-gray-600"
                  />
                  Active
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-400">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  rows={2}
                  placeholder="Brief description of this plan"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-400">Features (one per line)</label>
                <textarea
                  value={form.features}
                  onChange={e => setForm({ ...form, features: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  rows={5}
                  placeholder="Monthly group coaching call&#10;Resource library access&#10;Basic maintenance"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700"
              >
                <Check size={16} /> {editing ? 'Update' : 'Create'}
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
              >
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Plans List */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
            <p className="text-gray-400">No continuity plans yet.</p>
            <button
              onClick={() => { resetForm(); setShowCreate(true); }}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="flex items-start justify-between rounded-xl border border-gray-800 bg-gray-900 p-5"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      plan.is_active
                        ? 'bg-green-900/40 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="mt-1 text-sm text-gray-400">{plan.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="font-semibold text-green-400">
                      {formatCurrency(plan.amount_per_interval)}/{plan.billing_interval}
                    </span>
                    {plan.features && plan.features.length > 0 && (
                      <span className="text-gray-500">{plan.features.length} features</span>
                    )}
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-300">
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="ml-4 flex items-start gap-2">
                  <button
                    onClick={() => startEdit(plan)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-900/30 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
