'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiPost } from '@/lib/api';
import { MessageSquare, X, Send, Loader2, Sparkles } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; text: string; }

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user || user === false) return null;

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const data = await apiPost('/api/chatbot', { message: msg });
      setMessages(m => [...m, { role: 'assistant', text: data.response }]);
    } catch { setMessages(m => [...m, { role: 'assistant', text: 'Connection error. Try again.' }]); }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 magnetic-btn"
        style={{
          background: open ? 'var(--bg-elevated)' : 'var(--gradient-primary)',
          boxShadow: open ? 'none' : '0 0 30px rgba(0,229,255,0.3), 0 4px 20px rgba(0,229,255,0.2)',
          border: open ? '1px solid var(--border-subtle)' : 'none',
          color: open ? 'var(--text-secondary)' : '#000',
        }}
        data-testid="chatbot-toggle">
        {open ? <X className="w-4 h-4" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 h-[420px] glass-strong rounded-xl flex flex-col shadow-2xl overflow-hidden" style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 15px rgba(0,229,255,0.05)' }} data-testid="chatbot-panel">
          <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <Sparkles className="w-4 h-4 text-[var(--cyan)]" />
            <span className="text-xs font-bold">UNIFY AI</span>
            <span className="text-[8px] font-mono text-[var(--text-muted)] ml-auto tracking-wider">GPT-5.2</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono text-center mt-12 tracking-wider">ASK ANYTHING ABOUT YOUR CAREER</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-xs p-3 rounded-lg transition-all ${m.role === 'user'
                ? 'ml-6 text-[var(--cyan)]' : 'mr-4 text-[var(--text-secondary)]'}`}
                style={{
                  background: m.role === 'user' ? 'rgba(0,229,255,0.06)' : 'var(--bg-elevated)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(0,229,255,0.1)' : 'var(--border-subtle)'}`,
                }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 p-3 text-[var(--text-muted)]">
                <Loader2 className="w-3 h-3 animate-spin text-[var(--cyan)]" />
                <span className="font-mono text-[9px] tracking-wider">THINKING...</span>
              </div>
            )}
          </div>
          <div className="p-2.5 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              className="input-field flex-1 text-xs py-2.5 rounded-lg" placeholder="Type a message..." data-testid="chatbot-input" />
            <button onClick={send} disabled={loading || !input.trim()}
              className="btn-primary px-3 py-2 rounded-lg disabled:opacity-30" data-testid="chatbot-send">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
