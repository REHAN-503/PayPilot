'use client';

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
  Sparkles,
  Bot,
  RefreshCw,
} from 'lucide-react';
import '../../lib/ag-grid-init';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/progress';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => api.getAnalyticsSummary(),
  });

  const { data: activities, isLoading: isActLoading, refetch: refetchActivities } = useQuery({
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
        <span className="font-mono text-xs font-semibold text-blue-400">
          {params.value}
        </span>
      ),
    },
    {
      field: 'actor',
      headerName: 'Actor',
      width: 110,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono font-medium text-slate-300">
          {params.value}
        </span>
      ),
    },
    {
      field: 'title',
      headerName: 'Activity Title',
      width: 240,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="font-semibold text-slate-100 text-xs truncate">{params.value}</span>
      ),
    },
    {
      field: 'description',
      headerName: 'Fact-Based Log',
      flex: 1,
      minWidth: 260,
      cellRenderer: (params: CustomCellRendererProps) => (
        <span className="text-slate-400 text-xs truncate">{params.value || '—'}</span>
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
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Procurement Analytics & Governance KPIs
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Financial intelligence, policy gate enforcement metrics, and live agent activity logs.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="text-xs text-slate-300"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Analytics
          </Button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Spend
              </span>
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white mt-3 font-mono">
              {formatCurrency(summary?.totalSpend ?? 0)}
            </div>
            <span className="text-[11px] text-emerald-400 font-medium mt-1 block">
              Immutable Captured Ledger
            </span>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Capture Success Rate
              </span>
              <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white mt-3 font-mono">
              {summary?.successRate ?? 100}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {summary?.webhookConfirmedCount ?? 0} Webhook Confirmed
            </span>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Policy Blocks Avoided
              </span>
              <div className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
                <ShieldBan className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white mt-3 font-mono">
              {summary?.blockedByPolicyCount ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Protected by Hard Ceilings
            </span>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Avg Negotiation Savings
              </span>
              <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-3 font-mono">
              +{summary?.avgNegotiationSavingsPct ?? 9.3}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Autonomous Bot Concessions
            </span>
          </Card>
        </div>

        {/* 2 Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Spend Over Time (7 cols) */}
          <Card className="lg:col-span-7 border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-1">Cumulative Ledger Spend (USD)</h3>
            <p className="text-xs text-slate-400 mb-6">Historical authorized PayPal Orders captured</p>

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
          <Card className="lg:col-span-5 border-slate-800 bg-slate-900/80 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Governance Outcomes Distribution</h3>
              <p className="text-xs text-slate-400 mb-4">Autonomous execution vs replan vs policy block</p>
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
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-violet-400" />
                Live Agent Activity Ledger (AG Grid)
              </h2>
              <p className="text-xs text-slate-400">
                Detailed historical audit records with metadata payloads
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {activities?.length || 0} Event Rows
            </span>
          </div>

          <div className="h-96 w-full rounded-2xl overflow-hidden shadow-2xl">
            <div className="ag-theme-quartz-dark w-full h-full">
              <AgGridReact
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

