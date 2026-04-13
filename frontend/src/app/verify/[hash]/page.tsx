'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Shield, CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function VerifyCertificate() {
  const params = useParams();
  const hash = params.hash as string;
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hash) verify();
  }, [hash]);

  const verify = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/certificates/verify/${hash}`);
      setResult(data);
    } catch {
      setResult({ verified: false, message: 'Verification failed' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-8" data-testid="verify-page">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="card border-2 border-zinc-300">
          {/* Terminal-style header */}
          <div className="bg-[#0A0A0A] p-4 -m-[1.5rem] mb-6 flex items-center gap-3" style={{ marginTop: '-1.5rem', marginLeft: '-1.5rem', marginRight: '-1.5rem' }}>
            <Shield className="w-5 h-5 text-white" />
            <span className="text-white font-mono text-sm">CERTIFICATE VERIFICATION SYSTEM</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#002FA7]" />
              <span className="ml-3 text-zinc-500">Verifying certificate hash...</span>
            </div>
          ) : result?.verified ? (
            <div className="space-y-4 animate-fade-in" data-testid="verify-success">
              <div className="flex items-center gap-3 p-4 bg-[#E6F4EA] border border-[#0D652D]">
                <CheckCircle className="w-6 h-6 text-[#0D652D]" />
                <div>
                  <p className="font-bold text-[#0D652D]">VERIFIED</p>
                  <p className="text-sm text-[#0D652D]">{result.message}</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">CERTIFICATE</span>
                  <span className="font-medium">{result.certificate?.title}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">STUDENT</span>
                  <span className="font-medium">{result.student_name}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">ISSUER</span>
                  <span className="font-medium">{result.certificate?.issuer_name}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">TYPE</span>
                  <span className="font-medium capitalize">{result.certificate?.certificate_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">ISSUED</span>
                  <span className="font-medium">{result.certificate?.issue_date ? new Date(result.certificate.issue_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-500">STATUS</span>
                  <span className="badge-success px-2 py-0.5 text-xs">{result.certificate?.status}</span>
                </div>
              </div>

              <div className="bg-zinc-100 p-3 mt-4">
                <p className="text-xs text-zinc-500 mb-1">SHA256 HASH</p>
                <p className="font-mono text-xs break-all text-zinc-700">{hash}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in" data-testid="verify-failed">
              <div className="flex items-center gap-3 p-4 bg-[#FFEAEA] border border-[#B31212]">
                <XCircle className="w-6 h-6 text-[#B31212]" />
                <div>
                  <p className="font-bold text-[#B31212]">NOT VERIFIED</p>
                  <p className="text-sm text-[#B31212]">{result?.message || 'Certificate not found in the system'}</p>
                </div>
              </div>
              <div className="bg-zinc-100 p-3">
                <p className="text-xs text-zinc-500 mb-1">QUERIED HASH</p>
                <p className="font-mono text-xs break-all text-zinc-700">{hash}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
