'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';
import SiteThemeCorner from '@/components/SiteThemeCorner';

function ProposalAccessContent() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setAccessCode(value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim() || accessCode.length !== 6) {
      setError('Please enter a valid 6-character access code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/proposals/access/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: accessCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid access code');
      }

      router.push(`/proposal/${accessCode.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid access code');
      setIsLoading(false);
    }
  };

  return (
    <>
      <SiteThemeCorner />
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-xl">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-900/50 rounded-xl">
              <KeyRound className="w-10 h-10 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Access Your Proposal
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Enter the 6-character access code shared with you
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={accessCode}
                onChange={handleInputChange}
                placeholder="e.g. ABC123"
                maxLength={6}
                autoComplete="off"
                autoFocus
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-center text-xl font-mono tracking-[0.3em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || accessCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-xl text-lg font-semibold transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Validating...
                </>
              ) : (
                'View Proposal'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}

export default function ProposalAccessPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteThemeCorner />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
        </>
      }
    >
      <ProposalAccessContent />
    </Suspense>
  );
}
