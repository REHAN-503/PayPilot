'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Send,
  User,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  ArrowRight,
  Package,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { api, ApiError } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { Product, PurchasePlan } from '../../lib/schemas';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { authClient } from '../../lib/auth-client';
import { useQueryClient } from '@tanstack/react-query';

/* ============================================================
   TYPES
   ============================================================ */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  plan?: PurchasePlan | null;
  products?: Product[];
  actions?: ChatAction[];
  isLoading?: boolean;
}

interface ChatAction {
  label: string;
  type: 'plan' | 'navigate' | 'prompt';
  payload: string;
}

/* ============================================================
   SUGGESTION CHIPS
   ============================================================ */
const SUGGESTIONS = [
  { label: 'Find me a laptop under $800', icon: '💻' },
  { label: 'What\'s the best monitor for coding?', icon: '🖥️' },
  { label: 'I need office supplies under $100', icon: '📦' },
  { label: 'Buy mechanical keyboard, budget $150', icon: '⌨️' },
  { label: 'Show me my pending approvals', icon: '✅' },
  { label: 'What\'s my daily spending limit?', icon: '💰' },
];

/* ============================================================
   MESSAGE BUBBLE COMPONENT
   ============================================================ */
function MessageBubble({ msg, onAction }: { msg: ChatMessage; onAction: (action: ChatAction) => void }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
        }
        // Bold inline text
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className={line.startsWith('•') ? 'flex gap-2' : ''}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.slice(2, -2)}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      });
  };

  return (
    <div className={cn('flex gap-3 group', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1',
        msg.role === 'user'
          ? 'bg-[var(--ledger)] text-white'
          : 'bg-[var(--paper-2)] border border-[var(--rule)] text-[var(--ledger)]',
      )}>
        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn('max-w-[80%] flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
        {msg.isLoading ? (
          <div className="chat-bubble-ai px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-[var(--ledger)] animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span className="text-xs text-[var(--ink-3)]">{msg.content || 'AI is thinking...'}</span>
            </div>
          </div>
        ) : (
          <>
            <div className={cn('px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai')}>
              <div className="space-y-1">{formatContent(msg.content)}</div>
            </div>

            {/* Product mini-cards */}
            {msg.products && msg.products.length > 0 && (
              <div className="flex flex-col gap-2 w-full">
                {msg.products.slice(0, 2).map((p) => (
                  <Link key={p.id} href={`/store`}
                    className="flex items-center gap-3 p-3 rounded-[12px] bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--ledger)]/40 hover:bg-[var(--paper-2)] transition-all group/p"
                  >
                    <div className="w-12 h-12 rounded-[8px] bg-[var(--paper-2)] overflow-hidden shrink-0 relative">
                      {p.imageUrl ? (
                        <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="w-5 h-5 text-[var(--ink-3)]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[var(--ink)] truncate group-hover/p:text-[var(--ledger)] transition-colors">{p.name}</div>
                      <div className="text-[11px] text-[var(--ink-3)]">{p.category} · {p.stock} in stock</div>
                    </div>
                    <div className="text-sm font-bold text-[var(--ink)] font-mono shrink-0">{formatCurrency(p.price)}</div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--ink-3)] opacity-0 group-hover/p:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            )}

            {/* Action buttons */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {msg.actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => onAction(action)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ledger)]/40 bg-[var(--ledger)]/8 text-[var(--ledger)] hover:bg-[var(--ledger)] hover:text-white hover:border-[var(--ledger)] transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp + copy */}
            <div className={cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <span className="text-[10px] text-[var(--ink-3)]">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.role === 'assistant' && (
                <button onClick={handleCopy} className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors">
                  {copied ? <Check className="w-3 h-3 text-[var(--verdigris)]" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MAIN CHAT PAGE
   ============================================================ */
export default function ChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const storageKey = session?.user?.email ? `paypilot-chat:${session.user.email.toLowerCase()}` : null;
  const [restoredForKey, setRestoredForKey] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hello! I'm **PayPilot AI** — your autonomous procurement assistant.\n\nI can help you find products, create purchase plans, negotiate prices, and manage your spending policies. Just tell me what you need in plain language!\n\nWhat would you like to do today?`,
      timestamp: new Date(),
      actions: [
        { label: 'Browse Products', type: 'navigate', payload: '/store' },
        { label: 'Create a Plan', type: 'navigate', payload: '/' },
        { label: 'View Pending', type: 'navigate', payload: '/plans' },
      ],
    },
  ]);
  const [input, setInput] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-100).map((message) => ({
            ...message,
            timestamp: new Date(message.timestamp),
            content: message.isLoading ? 'This request was interrupted when you left the chat. Check Plans before retrying it.' : message.content,
            isLoading: false,
          })));
        }
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    setRestoredForKey(storageKey);
  }, [storageKey]);

  React.useEffect(() => {
    if (!storageKey || restoredForKey !== storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-100)));
    } catch {
      // Chat remains usable when browser storage is unavailable.
    }
  }, [messages, restoredForKey, storageKey]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const loadingId = (Date.now() + 1).toString();
    const loadingMsg: ChatMessage = {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await api.chat(text);
      const actions: ChatAction[] = response.actions.map((action) => {
        if (action === 'create_plan' && response.planPrompt) {
          return { label: 'Create purchase plan', type: 'plan', payload: response.planPrompt };
        }
        const destinations = {
          browse_store: { label: 'Browse Store', payload: '/store' },
          view_plans: { label: 'View Plans', payload: '/plans' },
          create_plan: { label: 'Create a Plan', payload: '/' },
          view_policy: { label: 'View Policy', payload: '/policy' },
        } as const;
        return { ...destinations[action], type: 'navigate' as const };
      });
      const assistantMsg: ChatMessage = {
        id: loadingId,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        products: response.products,
        actions,
        isLoading: false,
      };

      setMessages((prev) => prev.map((m) => m.id === loadingId ? assistantMsg : m));
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'The request could not reach the API service. Check your connection and try again.';
      setMessages((prev) => prev.map((m) =>
        m.id === loadingId
          ? { ...m, content: message, isLoading: false }
          : m,
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = (action: ChatAction) => {
    if (action.type === 'navigate') {
      router.push(action.payload);
    } else if (action.type === 'prompt') {
      void sendMessage(action.payload);
    } else if (action.type === 'plan') {
      void createPlan(action.payload);
    }
  };

  const createPlan = async (prompt: string) => {
    if (isTyping) return;
    const loadingId = `${Date.now()}-plan`;
    setMessages((prev) => [...prev,
      { id: `${loadingId}-user`, role: 'user', content: prompt, timestamp: new Date() },
      { id: loadingId, role: 'assistant', content: 'Creating your plan and checking your spending rules…', timestamp: new Date(), isLoading: true },
    ]);
    setIsTyping(true);
    try {
      const result = await api.createIntent(prompt);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plans'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline-recent'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-summary'] }),
      ]);
      const plan = result.plan;
      const blocked = result.policyEvaluation?.decision === 'BLOCK' && (!plan || plan.status === 'REJECTED');
      const content = blocked
        ? result.message || result.policyEvaluation?.violations?.join(' ') || 'This request was blocked by your spending policy.'
        : plan
          ? `Plan created for **${plan.items?.[0]?.productName || 'your requested purchase'}** — **${formatCurrency(plan.total)}**. Opening the plan so you can review it.`
          : result.message || 'The planner finished without creating a purchase plan.';
      setMessages((prev) => prev.map((message) => message.id === loadingId
        ? { ...message, content, isLoading: false, timestamp: new Date(), actions: plan && !blocked ? [{ label: 'Open plan', type: 'navigate', payload: `/plans/${plan.id}` }] : undefined }
        : message));
      if (plan && !blocked) router.push(`/plans/${plan.id}`);
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error
        ? error.message
        : 'The purchase planner could not complete this request. Please try again.';
      setMessages((prev) => prev.map((item) => item.id === loadingId
        ? { ...item, content: `Plan creation failed: ${message}`, isLoading: false, timestamp: new Date() }
        : item));
      toast.error('Could not create the plan', { description: message });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: '0',
      role: 'assistant',
      content: 'Chat cleared. How can I help you?',
      timestamp: new Date(),
    }]);
  };

  return (
    <DashboardShell>
      <div className="mx-auto flex h-[calc(100dvh-7rem)] min-h-0 w-full min-w-0 max-w-3xl flex-col lg:h-[calc(100dvh-8rem)]">

        {/* Header */}
        <div className="desk-enter flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--purple) 100%)' }}>
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--ink)] tracking-tight flex items-center gap-2">
                AI Procurement Assistant
                <Badge variant="default" className="text-[10px] py-0.5">Beta</Badge>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="live-dot" />
                <span className="text-[11px] text-[var(--verdigris)] font-semibold">Connected to live catalog & your policies</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="gap-2 text-[var(--ink-3)] hover:text-[var(--vermilion)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
        </div>

        {/* Chat area */}
        <div className="flex-1 glow-card overflow-hidden flex flex-col">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 chat-scroll">
            {messages.map((msg) => (
              <div key={msg.id} className="fade-in">
                <MessageBubble msg={msg} onAction={handleAction} />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips — shown when no input */}
          {input === '' && messages.length <= 1 && (
            <div className="px-4 pb-3 border-t border-[var(--rule)] bg-[var(--paper-2)]/40">
              <p className="text-[11px] text-[var(--ink-3)] font-semibold uppercase tracking-wide mb-2 pt-3">
                Quick suggestions:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => void sendMessage(s.label)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--rule)] bg-[var(--paper-2)] hover:bg-[var(--ledger)]/10 hover:border-[var(--ledger)]/40 hover:text-[var(--ledger)] text-[var(--ink-2)] transition-all"
                  >
                    <span>{s.icon}</span> {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-3 border-t border-[var(--rule)] bg-[var(--paper-2)]/30">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your procurement... (Enter to send)"
                  rows={1}
                  className="w-full px-4 py-3 rounded-[12px] bg-[var(--card)] border border-[var(--rule)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ledger)]/30 focus:border-[var(--ledger)]/40 resize-none transition-all"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>
              <Button
                variant="glow"
                size="icon"
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="w-12 h-12 rounded-[12px] shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--purple) 100%)' }}
              >
                {isTyping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-[var(--ink-3)] mt-1.5 text-center">
              AI assistant · Shift+Enter for new line · Connected to PayPilot catalog & policies
            </p>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
