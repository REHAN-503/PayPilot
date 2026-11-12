'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Send,
  User,
  Sparkles,
  ShoppingBag,
  Handshake,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Package,
  CheckCircle2,
  Zap,
  MessageSquare,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { Product, PurchasePlan } from '../../lib/schemas';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

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
   AI RESPONSE GENERATOR
   ============================================================ */
async function generateAIResponse(
  message: string,
  products: Product[],
  plans: PurchasePlan[],
  policy: { dailySpendingLimit?: number | string | null; monthlySpendingLimit?: number | string | null; autonomyMode?: string } | null,
): Promise<{ content: string; relatedProducts?: Product[]; plan?: PurchasePlan | null; actions?: ChatAction[] }> {
  const lowerMsg = message.toLowerCase();

  // Check if it's a purchase/product request
  const isBuyRequest = /buy|purchase|need|want|looking for|find me|get me|order/i.test(lowerMsg);
  const isApprovalCheck = /approval|pending|authorize|approve/i.test(lowerMsg);
  const isPolicyCheck = /limit|policy|budget|spend|remaining/i.test(lowerMsg);
  const isNegotiateRequest = /negotiate|discount|price|cheaper|bargain/i.test(lowerMsg);

  // Product-related request
  if (isBuyRequest) {
    // Try to match with available products
    const matched = products.filter(p => {
      const name = p.name.toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const words = lowerMsg.split(/\s+/);
      return words.some(w => w.length > 3 && (name.includes(w) || cat.includes(w)));
    }).slice(0, 3);

    // Extract budget if mentioned
    const budgetMatch = lowerMsg.match(/\$(\d+(?:,\d+)?(?:\.\d{2})?)|(\d+(?:,\d+)?) dollars?/i);
    const budget = budgetMatch ? parseFloat(budgetMatch[1] || budgetMatch[2]) : null;

    const affordable = budget
      ? matched.filter(p => Number(p.price) <= budget)
      : matched;

    if (affordable.length > 0) {
      const top = affordable[0];
      return {
        content: `I found **${affordable.length} matching product${affordable.length > 1 ? 's' : ''}** for you! Here's my top recommendation:\n\n**${top.name}** — ${formatCurrency(top.price)}\n\n${top.description ? `${top.description.slice(0, 150)}...` : ''}\n\nI can create a full purchase plan for this — would you like me to proceed? The plan will check your policy limits and risk score before checkout.`,
        relatedProducts: affordable,
        actions: [
          { label: `Plan: ${top.name}`, type: 'plan', payload: `I need ${top.name} — budget ${budget ? formatCurrency(budget) : formatCurrency(Number(top.price) * 1.1)}` },
          { label: 'View all results', type: 'navigate', payload: `/store?search=${encodeURIComponent(message)}` },
        ],
      };
    } else {
      const content = budget
        ? `I couldn't find products matching your description under ${formatCurrency(budget)}. Would you like me to:\n\n• Browse all products in the store\n• Try a broader search\n• Adjust your budget slightly`
        : `I'll search the catalog for that. Try browsing the store or give me a more specific product name.`;
      return {
        content,
        actions: [
          { label: 'Browse Store', type: 'navigate', payload: '/store' },
          { label: 'Create a Plan', type: 'navigate', payload: '/' },
        ],
      };
    }
  }

  // Policy / budget check
  if (isPolicyCheck) {
    const dailyLimit = policy?.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null;
    const monthlyLimit = policy?.monthlySpendingLimit ? Number(policy.monthlySpendingLimit) : null;
    const mode = policy?.autonomyMode ?? 'ASK_EVERY_TIME';

    return {
      content: `Here's your current spending policy:\n\n• **Autonomy Mode:** ${mode.replace(/_/g, ' ')}\n${dailyLimit ? `• **Daily Limit:** ${formatCurrency(dailyLimit)}\n` : ''}${monthlyLimit ? `• **Monthly Limit:** ${formatCurrency(monthlyLimit)}\n` : ''}• **Auto Execute:** ${mode === 'AUTO_WITHIN_LIMITS' ? 'Enabled within limits' : 'Disabled'}\n\nAll purchases are validated against these rules before PayPal checkout is initiated.`,
      actions: [
        { label: 'Edit Policy', type: 'navigate', payload: '/policy' },
      ],
    };
  }

  // Approval check
  if (isApprovalCheck) {
    const pending = plans.filter(p => p.status === 'AWAITING_APPROVAL');
    if (pending.length > 0) {
      return {
        content: `You have **${pending.length} plan${pending.length > 1 ? 's' : ''} awaiting approval**:\n\n${pending.slice(0, 3).map(p => `• **${p.items?.[0]?.productName || 'Order'}** — ${formatCurrency(p.total)}`).join('\n')}\n\nClick the plan link below to review and authorize payment.`,
        plan: pending[0],
        actions: pending.slice(0, 2).map(p => ({
          label: `Review: ${p.items?.[0]?.productName?.slice(0, 20) || 'Plan'}`,
          type: 'navigate' as const,
          payload: `/plans/${p.id}`,
        })),
      };
    }
    return {
      content: `You have no plans currently awaiting approval. All recent plans have been processed.\n\nWant me to help you create a new purchase plan?`,
      actions: [{ label: 'Create a Plan', type: 'navigate', payload: '/' }],
    };
  }

  // Negotiation request
  if (isNegotiateRequest) {
    const activePlans = plans.filter(p => p.status === 'AWAITING_APPROVAL' || p.status === 'READY');
    return {
      content: `Great idea! The AI negotiation engine can bargain with the merchant to get you a better price. Here's how it works:\n\n1. **Select a plan** you want to negotiate\n2. **Set your target discount** (e.g. 10–20%)\n3. **Watch the AI buyer and merchant agents** exchange offers in real-time\n4. **Review the final agreed price** before approving payment\n\n${activePlans.length > 0 ? `You have ${activePlans.length} plan(s) ready for negotiation.` : 'Create a purchase plan first, then negotiate!'}`,
      actions: [
        activePlans.length > 0
          ? { label: 'Negotiate Now', type: 'navigate', payload: `/negotiation?planId=${activePlans[0].id}` }
          : { label: 'Create a Plan', type: 'navigate', payload: '/' },
        { label: 'Learn About Negotiation', type: 'navigate', payload: '/negotiation' },
      ],
    };
  }

  // General greeting / help
  if (/hello|hi|hey|help|what can you/i.test(lowerMsg)) {
    return {
      content: `Hi! I'm **PayPilot AI** — your autonomous procurement assistant. Here's what I can do:\n\n🛒 **Find products** — Describe what you need and I'll search the live catalog\n📋 **Create plans** — I'll build a purchase plan with AI-powered recommendations\n🤝 **Negotiate prices** — The AI buyer agent can bargain for discounts\n🛡️ **Check policies** — I'll verify your spending limits and rules\n✅ **Review approvals** — See what's pending your authorization\n\nJust tell me what you need in plain language!`,
      actions: [
        { label: 'Browse Store', type: 'navigate', payload: '/store' },
        { label: 'View Pending Plans', type: 'navigate', payload: '/plans' },
      ],
    };
  }

  // Default / catch-all
  return {
    content: `I understand you're asking about "${message}". As your AI procurement assistant, I can help you:\n\n• Search the product catalog for specific items\n• Create purchase plans with AI recommendations\n• Check and negotiate prices\n• Review your spending policies and limits\n\nTry being more specific — e.g. "Find me a webcam under $80" or "What are my pending approvals?"`,
    actions: [
      { label: 'Browse Store', type: 'navigate', payload: '/store' },
      { label: 'Create a Plan', type: 'navigate', payload: '/' },
    ],
  };
}

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
              <span className="text-xs text-[var(--ink-3)]">AI is thinking...</span>
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

  const { data: products } = useQuery({
    queryKey: ['products-chat'],
    queryFn: () => api.getProducts({ limit: 50 }),
    staleTime: 60_000,
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const { data: policyData } = useQuery({
    queryKey: ['policy'],
    queryFn: () => api.getPolicy(),
  });

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // Simulate network delay for realistic feel
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

    try {
      const policyInfo = policyData?.policy
        ? {
            dailySpendingLimit: policyData.policy.dailySpendingLimit,
            monthlySpendingLimit: policyData.policy.monthlySpendingLimit,
            autonomyMode: policyData.policy.autonomyMode,
          }
        : null;

      const response = await generateAIResponse(
        text,
        products?.data ?? [],
        plans ?? [],
        policyInfo,
      );

      const assistantMsg: ChatMessage = {
        id: loadingId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        products: response.relatedProducts,
        plan: response.plan,
        actions: response.actions,
        isLoading: false,
      };

      setMessages((prev) => prev.map((m) => m.id === loadingId ? assistantMsg : m));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === loadingId
          ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isLoading: false }
          : m,
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = (action: ChatAction) => {
    if (action.type === 'navigate') {
      router.push(action.payload);
    } else if (action.type === 'plan' || action.type === 'prompt') {
      void sendMessage(action.payload);
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
      <div className="max-w-3xl mx-auto h-[calc(100vh-130px)] flex flex-col">

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
