'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
  Receipt,
  Download,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import '../../lib/ag-grid-init';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/progress';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { AnalyticsTransactionRow } from '../../lib/schemas';

export default function TransactionsPage() {
  const gridRef = React.useRef<AgGridReact<AnalyticsTransactionRow>>(null);
  const [quickFilterText, setQuickFilterText] = React.useState('');

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ['analytics-transactions'],
    queryFn: () => api.getAnalyticsTransactions(),
  });

  const columnDefs = React.useMemo<ColDef<AnalyticsTransactionRow>[]>(() => [
    {
      field: 'createdAt',
      headerName: 'Timestamp',
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
      sort: 'desc',
      filter: 'agDateColumnFilter',
    },
    {
      field: 'productName',
      headerName: 'Product & SKU',
      flex: 1.5,
      minWidth: 220,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => {
        const data = params.data as AnalyticsTransactionRow;
        return (
          <div className="flex flex-col justify-center h-full">
            <span className="font-semibold text-[var(--ink)] truncate">{data?.productName}</span>
            <span className="text-[10px] text-[var(--ink-3)] font-mono">
              SKU: {data?.productSku || 'CATALOG-SKU'} • {data?.category || 'General'}
            </span>
          </div>
        );
      },
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => (
        <span className="font-mono font-bold text-[var(--ink)]">
          {formatCurrency(params.value)}
        </span>
      ),
    },
    {
      field: 'paymentStatus',
      headerName: 'PayPal Status',
      width: 150,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => {
        const status = params.value;
        const isCaptured = status === 'CAPTURED';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              isCaptured
                ? 'bg-[var(--verdigris)]/20 text-[var(--verdigris)] border border-[var(--verdigris)]'
                : 'bg-[var(--amber)]/20 text-[var(--amber)] border border-[var(--amber)]'
            }`}
          >
            {status}
          </span>
        );
      },
    },
    {
      field: 'webhookConfirmed',
      headerName: 'Webhook Stamp',
      width: 150,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => {
        const confirmed = params.value;
        return confirmed ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--ledger)] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ledger)]" />
            Confirmed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--amber)] font-medium">
            <Clock className="w-3.5 h-3.5 text-[var(--amber)]" />
            Pending Delivery
          </span>
        );
      },
    },
    {
      field: 'riskLevel',
      headerName: 'Risk Gate',
      width: 120,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => {
        const level = params.value;
        const score = params.data?.riskScore;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
              level === 'LOW'
                ? 'bg-[var(--verdigris)]/10 text-[var(--verdigris)]'
                : level === 'MEDIUM'
                ? 'bg-[var(--amber)]/10 text-[var(--amber)]'
                : 'bg-[var(--vermilion)]/10 text-[var(--vermilion)]'
            }`}
          >
            {level} ({score})
          </span>
        );
      },
    },
    {
      field: 'negotiatedSavings',
      headerName: 'Discount Saved',
      width: 140,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => {
        const savings = Number(params.value);
        return savings > 0 ? (
          <span className="text-[var(--verdigris)] font-mono font-semibold">
            +{formatCurrency(savings)}
          </span>
        ) : (
          <span className="text-[var(--ink-3)] font-mono">—</span>
        );
      },
    },
    {
      headerName: 'Inspect',
      width: 100,
      sortable: false,
      filter: false,
      cellRenderer: (params: CustomCellRendererProps<AnalyticsTransactionRow>) => {
        const paymentId = params.data?.paymentId;
        return (
          <Link
            href={`/payments/${paymentId}`}
            className="text-xs text-[var(--ledger)] hover:text-[var(--ink)] font-medium inline-flex items-center gap-1"
          >
            Details <ArrowRight className="w-3 h-3" />
          </Link>
        );
      },
    },
  ], []);

  const handleExportCsv = () => {
    gridRef.current?.api?.exportDataAsCsv({
      fileName: `paypilot-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-[var(--ledger)]" />
              Transactions & Immutable Ledger
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-3)] mt-1">
              High-performance AG Grid ledger with cryptographic webhook confirmations and policy audit metadata.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="text-xs text-[var(--ink-2)] hover:text-[var(--ink)]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs text-[var(--ink-2)]"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search Bar & Quick Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[var(--ink-3)] absolute left-3 top-3" />
            <Input
              value={quickFilterText}
              onChange={(e) => setQuickFilterText(e.target.value)}
              placeholder="Quick search across products, status, or transaction keys..."
              className="pl-9 h-10 rounded-[var(--radius)] bg-[var(--card)] border-[var(--rule)] text-xs text-[var(--ink)]"
            />
          </div>
          <span className="text-xs text-[var(--ink-3)] font-mono">
            {rows?.length || 0} Ledger Records
          </span>
        </div>

        {/* AG Grid Table Container */}
        {isLoading ? (
          <Skeleton className="h-[520px] w-full rounded-[var(--radius)]" />
        ) : (
          <div className="h-[560px] w-full rounded-[var(--radius)] overflow-hidden ">
            <div className="ag-theme-quartz-dark w-full h-full">
              <AgGridReact
                ref={gridRef}
                rowData={rows || []}
                columnDefs={columnDefs}
                quickFilterText={quickFilterText}
                pagination={true}
                paginationPageSize={12}
                rowHeight={48}
                headerHeight={44}
                animateRows={true}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

