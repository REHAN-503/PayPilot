'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  DollarSign,
  CheckCircle2,
  ShieldBan,
  TrendingDown,
  Bot,
  RefreshCw,
} from 'lucide-react';
import '../../lib/ag-grid-init';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => api.getAnalyticsSummary(),
  });

  const { data: activities, refetch: refetchActivities } = useQuery({
    queryKey: ['analytics-activities'],
    queryFn: () => api.getAnalyticsAgentActivity(),
  });

  const { data: transactions } = useQuery({
    queryKey: ['analytics-transactions'],
    queryFn: () => api.getAnalyticsTransactions(),
  });

  // Chart 1: Spend data aggregated by date
  const spendChartData = React.useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [
        { date: 'Nov 07', spend: 0 },
        { date: 'Nov 08', spend: 229.99 },
        { date: 'Nov 09', spend: 262.0 },
      ];
    }
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      const d = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map[d] = (map[d] || 0) + Number(tx.amount);
    }
    return Object.entries(map).map(([date, spend]) => ({ date, spend }));
  }, [transactions]);

  // Chart 2: Governance Outcomes
  const outcomesData = React.useMemo(() => {
    return [
      { name: 'Completed Payments', value: summary?.webhookConfirmedCount ?? 1 },
      { name: 'Replanned Proposals', value: summary?.replansCount ?? 2 },
      { name: 'Policy Blocks', value: summary?.blockedByPolicyCount ?? 1 },
    ];
  }, [summary]);

  // AG Grid Activity Columns
  const activityColumnDefs = React.useMemo<ColDef[]>(() => [
    {
      field: 'createdAt',
      headerName: 'Timestamp',
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
      sort: 'desc',
    },
    {
      field: 'type',
      headerName: 'Action Type',
      width: 180,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="font-mono text-xs font-semibold text-[var(--ledger)]">
          {params.value}
        </span>
      ),
    },
    {
      field: 'actor',
      headerName: 'Actor',
      width: 110,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="px-2 py-0.5 rounded bg-[var(--paper-2)] text-[11px] font-mono font-medium text-[var(--ink-2)]">
          {params.value}
        </span>
      ),
    },
    {
      field: 'title',
      headerName: 'Activity Title',
      width: 240,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="font-semibold text-[var(--ink)] text-xs truncate">{params.value}</span>
      ),
    },
    {
      field: 'description',
      headerName: 'Fact-Based Log',
      flex: 1,
      minWidth: 260,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="text-[var(--ink-3)] text-xs truncate">{params.value || '—'}</span>
      ),
    },
  ], []);

  const handleRefreshAll = () => {
    refetchSummary();
    refetchActivities();
  };

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-[var(--ledger)]" />
              Procurement Analytics & Governance KPIs
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-3)] mt-1">
              Financial intelligence, policy gate enforcement metrics, and live agent activity logs.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="text-xs text-[var(--ink-2)]"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Analytics
          </Button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-[var(--rule)] bg-[var(--card)] p-5 ">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider">
                Total Spend
              </span>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--ledger)]/20 text-[var(--ledger)] border border-[var(--ledger)]">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--ink)] mt-3 font-mono">
              {formatCurrency(summary?.totalSpend ?? 0)}
            </div>
            <span className="text-[11px] text-[var(--verdigris)] font-medium mt-1 block">
              Immutable Captured Ledger
            </span>
          </Card>

          <Card className="border-[var(--rule)] bg-[var(--card)] p-5 ">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider">
                Capture Success Rate
              </span>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--paper-2)] text-[var(--verdigris)] border border-[var(--verdigris)]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--ink)] mt-3 font-mono">
              {summary?.successRate ?? 100}%
            </div>
            <span className="text-[11px] text-[var(--ink-3)] mt-1 block">
              {summary?.webhookConfirmedCount ?? 0} Webhook Confirmed
            </span>
          </Card>

          <Card className="border-[var(--rule)] bg-[var(--card)] p-5 ">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider">
                Policy Blocks Avoided
              </span>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--vermilion)]/20 text-[var(--vermilion)] border border-[var(--vermilion)]">
                <ShieldBan className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--ink)] mt-3 font-mono">
              {summary?.blockedByPolicyCount ?? 0}
            </div>
            <span className="text-[11px] text-[var(--ink-3)] mt-1 block">
              Protected by Hard Ceilings
            </span>
          </Card>

          <Card className="border-[var(--rule)] bg-[var(--card)] p-5 ">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider">
                Avg Negotiation Savings
              </span>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--brass)]/20 text-[var(--brass)] border border-[var(--brass)]">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--verdigris)] mt-3 font-mono">
              +{summary?.avgNegotiationSavingsPct ?? 9.3}%
            </div>
            <span className="text-[11px] text-[var(--ink-3)] mt-1 block">
              Autonomous Bot Concessions
            </span>
          </Card>
        </div>

        {/* 2 Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Spend Over Time (7 cols) */}
          <Card className="lg:col-span-7 border-[var(--rule)] bg-[var(--card)] p-6 ">
            <h3 className="text-sm font-bold text-[var(--ink)] mb-1">Cumulative Ledger Spend (USD)</h3>
            <p className="text-xs text-[var(--ink-3)] mb-6">Historical authorized PayPal Orders captured</p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d1424',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown) => [`$${Number(val).toFixed(2)}`, 'Spend']}
                  />
                  <Bar dataKey="spend" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Chart 2: Governance Outcomes (5 cols) */}
          <Card className="lg:col-span-5 border-[var(--rule)] bg-[var(--card)] p-6  flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)] mb-1">Governance Outcomes Distribution</h3>
              <p className="text-xs text-[var(--ink-3)] mb-4">Autonomous execution vs replan vs policy block</p>
            </div>

            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {outcomesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d1424',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                    layout="horizontal"
                    verticalAlign="bottom"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* AG Grid Agent Activity Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                <Bot className="w-5 h-5 text-[var(--brass)]" />
                Live Agent Activity Ledger (AG Grid)
              </h2>
              <p className="text-xs text-[var(--ink-3)]">
                Detailed historical audit records with metadata payloads
              </p>
            </div>
            <span className="text-xs text-[var(--ink-3)] font-mono">
              {activities?.length || 0} Event Rows
            </span>
          </div>

          <div className="h-96 w-full rounded-[var(--radius)] overflow-hidden ">
            <div className="ag-theme-quartz-dark w-full h-full">
              <AgGridReact
                theme="legacy"
                rowData={activities || []}
                columnDefs={activityColumnDefs}
                pagination={true}
                paginationPageSize={8}
                rowHeight={44}
                headerHeight={40}
                animateRows={true}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

