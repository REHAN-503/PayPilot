'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Store,
  Search,
  Package,
  Star,
  ShoppingCart,
  ArrowRight,
  Filter,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/progress';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { Product } from '../../lib/schemas';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

const CATEGORIES = ['All', 'Electronics', 'Accessories', 'Work', 'Home', 'Lifestyle'];
const SORT_OPTIONS = [
  { label: 'Featured', value: '' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'In Stock', value: 'stock' },
];

function ProductCard({ product, onPlan }: { product: Product; onPlan: (p: Product) => void }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  const handlePlan = async () => {
    setIsAdding(true);
    setTimeout(() => setIsAdding(false), 1200);
    onPlan(product);
  };

  const stars = 4; // Static display rating

  return (
    <div className="product-card group flex flex-col">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-[var(--paper-2)] overflow-hidden">
        {product.imageUrl && !imgFailed ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="w-12 h-12 text-[var(--ink-3)]" />
          </div>
        )}

        {/* Category pill */}
        {product.category && (
          <div className="absolute top-2.5 left-2.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--card)]/90 backdrop-blur-sm text-[var(--ink-2)] border border-[var(--rule)]/50">
              {product.category}
            </span>
          </div>
        )}

        {/* Stock warning */}
        {product.stock > 0 && product.stock <= 5 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--amber)] text-white shadow-sm">
              Only {product.stock} left!
            </span>
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-[var(--card)]/50 backdrop-blur-sm flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--ink)]/80 text-white">
              Out of Stock
            </span>
          </div>
        )}

        {/* Quick plan overlay */}
        <div className="absolute inset-0 bg-[var(--ledger)]/0 group-hover:bg-[var(--ledger)]/5 transition-colors pointer-events-none" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm text-[var(--ink)] line-clamp-2 group-hover:text-[var(--ledger)] transition-colors leading-snug">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-[11px] text-[var(--ink-3)] mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Stars */}
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cn('w-3 h-3', i < stars ? 'text-[var(--amber-light)] fill-[var(--amber-light)]' : 'text-[var(--rule)]')}
            />
          ))}
          <span className="text-[10px] text-[var(--ink-3)] ml-1">{product.stock} in stock</span>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--rule)]/60 mt-auto">
          <div>
            <div className="text-xl font-black text-[var(--ink)] font-mono leading-none">
              {formatCurrency(product.price)}
            </div>
            {product.minPrice && Number(product.minPrice) < Number(product.price) && (
              <div className="text-[10px] text-[var(--verdigris)] font-semibold mt-0.5">
                Min: {formatCurrency(product.minPrice)}
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono text-[var(--ink-3)] bg-[var(--paper-2)] px-2 py-0.5 rounded-[6px]">
            {product.sku}
          </span>
        </div>

        {/* Action button */}
        <Button
          variant="glow"
          size="sm"
          className="w-full mt-2 gap-2 rounded-[10px] font-semibold"
          onClick={handlePlan}
          disabled={isAdding || product.stock === 0}
          style={{ background: isAdding ? undefined : 'linear-gradient(135deg, var(--ledger) 0%, var(--brass) 100%)' }}
        >
          {isAdding ? (
            <><Zap className="w-3.5 h-3.5 animate-spin" /> Planning...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> Plan Purchase</>
          )}
        </Button>
      </div>
    </div>
  );
}

function StoreSkeleton() {
  return (
    <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="glow-card overflow-hidden">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StorePage() {
  return (
    <React.Suspense fallback={
      <DashboardShell>
        <div className="space-y-6">
          <div className="glow-card p-6 h-20 animate-pulse" />
          <StoreSkeleton />
        </div>
      </DashboardShell>
    }>
      <StoreContent />
    </React.Suspense>
  );
}

function StoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get('search') ?? '');
  const [category, setCategory] = React.useState('All');
  const [sort, setSort] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['store-products', debouncedSearch, category, page],
    queryFn: () =>
      api.getProducts({
        search: debouncedSearch || undefined,
        category: category === 'All' ? undefined : category,
        page,
        limit: 12,
      }),
    staleTime: 30_000,
  });

  const products = React.useMemo(() => {
    let items = data?.data ?? [];
    if (sort === 'price_asc') items = [...items].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price_desc') items = [...items].sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'stock') items = [...items].sort((a, b) => b.stock - a.stock);
    return items;
  }, [data, sort]);

  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;

  const handlePlanProduct = (product: Product) => {
    const goal = `I need ${product.name} — budget up to ${formatCurrency(Number(product.price) * 1.1)}. Category: ${product.category ?? 'General'}.`;
    toast.success('Opening AI planner...', { description: product.name });
    router.push(`/?goal=${encodeURIComponent(goal)}`);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">

        {/* Header */}
        <div className="desk-enter flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--ink)] flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--cyan) 100%)' }}>
                <Store className="w-5 h-5 text-white" />
              </div>
              Product Store
            </h1>
            <p className="text-sm text-[var(--ink-3)] mt-1 flex items-center gap-2">
              Live catalog — browse and plan purchases instantly
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--verdigris)] font-semibold">
                <span className="live-dot" />
                {total} products live
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Link href="/">
              <Button variant="glow" size="sm" className="gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                AI Planner
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters row */}
        <div className="desk-enter desk-enter-delay-1 glow-card p-4 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-3)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search products by name, SKU..."
              className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-[var(--paper-2)] border border-[var(--rule)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ledger)]/30 focus:border-[var(--ledger)]/40 transition-all"
            />
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className={cn(
                  'px-3 py-2 rounded-[8px] text-xs font-semibold whitespace-nowrap transition-all border',
                  category === cat
                    ? 'bg-[var(--ledger)] text-white border-[var(--ledger)]'
                    : 'bg-[var(--paper-2)] text-[var(--ink-2)] border-[var(--rule)] hover:border-[var(--ledger)]/40 hover:text-[var(--ledger)]',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 rounded-[10px] bg-[var(--paper-2)] border border-[var(--rule)] text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--ledger)]/30 cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-3)] pointer-events-none" />
          </div>
        </div>

        {/* Results header */}
        <div className="desk-enter desk-enter-delay-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--ink-3)]">
            <TrendingUp className="w-4 h-4" />
            {isFetching ? (
              <span>Updating...</span>
            ) : (
              <span><strong className="text-[var(--ink)]">{total}</strong> products {debouncedSearch ? `for "${debouncedSearch}"` : ''} {category !== 'All' ? `in ${category}` : ''}</span>
            )}
          </div>
          <span className="text-xs text-[var(--ink-3)]">
            Page {page} of {pagination?.totalPages ?? 1}
          </span>
        </div>

        {/* Products grid */}
        <div className="desk-enter desk-enter-delay-3">
          {isLoading ? (
            <StoreSkeleton />
          ) : products.length === 0 ? (
            <div className="glow-card p-16 text-center">
              <div className="w-16 h-16 rounded-[20px] bg-[var(--paper-2)] flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-[var(--ink-3)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--ink)]">No products found</h3>
              <p className="text-sm text-[var(--ink-3)] mt-2 max-w-xs mx-auto">
                Try adjusting your search or category filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { setSearch(''); setCategory('All'); setPage(1); }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product, i) => (
                <div key={product.id} className="desk-enter" style={{ animationDelay: `${i * 30}ms` }}>
                  <ProductCard product={product} onPlan={handlePlanProduct} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1.5">
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'w-8 h-8 rounded-[8px] text-sm font-semibold transition-all',
                      p === page
                        ? 'bg-[var(--ledger)] text-white'
                        : 'bg-[var(--paper-2)] text-[var(--ink-2)] hover:bg-[var(--rule)]',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
