'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import type { Product } from '../types';

interface CatalogViewProps {
  onSelectPrompt: (promptText: string) => void;
}

export function CatalogView({ onSelectPrompt }: CatalogViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    api
      .getProducts({ search, category: category || undefined, limit: 30 })
      .then((res) => {
        setProducts(res.data || []);
      })
      .catch((err: unknown) => {
        console.error('Failed to load products', err);
      });
  }, [search, category]);

  const categories = ['All', 'Electronics', 'Accessories', 'Home', 'Lifestyle', 'Work'];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Fictional Product Catalog
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                15 catalog items seeded in PostgreSQL. No third-party trademarks; fictional demo brands only.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-lg border border-zinc-200 pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isSelected = (cat === 'All' && !category) || category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat === 'All' ? '' : cat)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((prod) => (
          <div
            key={prod.id}
            className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono text-[10px]">{prod.sku}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {prod.category}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">
                {prod.name}
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                {prod.description}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <span className="text-base font-black text-zinc-900 dark:text-white font-mono">
                ${Number(prod.price).toFixed(2)}{' '}
                <span className="text-[10px] font-normal text-zinc-400">USD</span>
              </span>

              <button
                type="button"
                onClick={() => onSelectPrompt(`Buy ${prod.name} under $${Math.ceil(Number(prod.price) + 20)}`)}
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
              >
                <Sparkles className="h-3 w-3" />
                Prompt Agent
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
