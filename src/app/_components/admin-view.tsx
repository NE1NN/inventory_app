"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/trpc/react";

type Mode = "fast" | "safe" | "lock";

export function AdminView() {
  const [resetStock, setResetStock] = useState(1);
  const [customerUrl, setCustomerUrl] = useState("");

  useEffect(() => {
    setCustomerUrl(window.location.origin);
  }, []);

  const { data: stockData, refetch: refetchStock } = api.inventory.getStock.useQuery(undefined, {
    refetchInterval: 1500,
  });

  const { data: purchases, refetch: refetchPurchases } = api.inventory.getPurchases.useQuery(
    undefined,
    { refetchInterval: 1500 },
  );

  const setModeMut = api.inventory.setMode.useMutation({
    onSuccess: () => void refetchStock(),
  });

  const resetMut = api.inventory.reset.useMutation({
    onSuccess: () => {
      void refetchStock();
      void refetchPurchases();
    },
  });

  const stock = stockData?.stock ?? 0;
  const mode: Mode = stockData?.mode ?? "safe";
  const isOversold = stock < 0;

  const successCount = purchases?.filter((p) => p.success).length ?? 0;
  const oversoldCount = Math.max(0, successCount - resetStock);

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Race Condition Demo — Control Panel</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            Customer view →
          </Link>
        </div>

        {/* Share URL */}
        <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/30 p-4">
          <div className="mb-1 text-xs uppercase tracking-widest text-indigo-500">
            Share with audience
          </div>
          <div className="font-mono text-lg font-bold text-indigo-300">{customerUrl}/</div>
          <div className="mt-1 text-xs text-gray-600">Have them open this on their phones and click Buy Now</div>
        </div>

        {/* Mode + Stock */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Mode toggle */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Active Mode
            </div>
            <div className="flex rounded-xl bg-gray-800 p-1">
              <ModeButton
                label="⚡ Fast"
                sub="May oversell"
                active={mode === "fast"}
                activeClass="bg-orange-500"
                onClick={() => setModeMut.mutate({ mode: "fast" })}
                disabled={setModeMut.isPending}
              />
              <ModeButton
                label="🔒 Safe"
                sub="Atomic UPDATE"
                active={mode === "safe"}
                activeClass="bg-emerald-500"
                onClick={() => setModeMut.mutate({ mode: "safe" })}
                disabled={setModeMut.isPending}
              />
              <ModeButton
                label="🔐 Lock"
                sub="SELECT FOR UPDATE"
                active={mode === "lock"}
                activeClass="bg-violet-500"
                onClick={() => setModeMut.mutate({ mode: "lock" })}
                disabled={setModeMut.isPending}
              />
            </div>
          </div>

          {/* Stock counter */}
          <div
            className={`rounded-2xl border p-5 transition-all ${
              isOversold ? "border-red-500 bg-red-950/30" : "border-gray-800 bg-gray-900"
            }`}
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Current Stock
            </div>
            <div
              className={`text-8xl font-black leading-none ${
                isOversold ? "text-red-400" : stock === 0 ? "text-gray-600" : "text-white"
              }`}
            >
              {stock}
            </div>
            {isOversold && (
              <div className="mt-2 text-sm font-bold text-red-400">
                ⚠️ OVERSOLD — {Math.abs(stock)} extra sold
              </div>
            )}
            {oversoldCount > 0 && !isOversold && (
              <div className="mt-2 text-xs text-orange-400">{oversoldCount} oversell(s) this round</div>
            )}
          </div>
        </div>

        {/* Reset controls */}
        <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <span className="text-sm text-gray-400">Reset stock to:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setResetStock((n) => Math.max(1, n - 1))}
              className="rounded-lg bg-gray-700 px-3 py-1 font-mono text-lg hover:bg-gray-600"
            >
              −
            </button>
            <span className="w-8 text-center text-xl font-bold">{resetStock}</span>
            <button
              onClick={() => setResetStock((n) => Math.min(10, n + 1))}
              className="rounded-lg bg-gray-700 px-3 py-1 font-mono text-lg hover:bg-gray-600"
            >
              +
            </button>
          </div>
          <button
            onClick={() => resetMut.mutate({ stock: resetStock })}
            disabled={resetMut.isPending}
            className="ml-auto rounded-lg bg-gray-700 px-5 py-2 text-sm font-semibold hover:bg-gray-600 disabled:opacity-50"
          >
            ↺ Reset &amp; clear log
          </button>
        </div>

        {/* Trade-off section */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Consistency vs Availability — what each mode trades
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <TradeoffCard
              title="⚡ Fast Mode"
              titleColor="text-orange-400"
              borderColor={mode === "fast" ? "border-orange-500" : "border-gray-800"}
              bgColor={mode === "fast" ? "bg-orange-950/20" : "bg-gray-900"}
              metrics={[
                { label: "Response Speed", value: 5, color: "orange" },
                { label: "Data Integrity", value: 1, color: "orange" },
              ]}
              tag="No locking"
              tagColor="bg-orange-900/50 text-orange-400"
              code={`read  stock = 1  ← A
  ···delay···  ← B reads 1
write stock-1  ← both → -1`}
              explanation="No coordination. Both requests read before either writes. Both pass the check and decrement — stock goes negative."
            />
            <TradeoffCard
              title="🔒 Safe Mode"
              titleColor="text-emerald-400"
              borderColor={mode === "safe" ? "border-emerald-500" : "border-gray-800"}
              bgColor={mode === "safe" ? "bg-emerald-950/20" : "bg-gray-900"}
              metrics={[
                { label: "Response Speed", value: 4, color: "emerald" },
                { label: "Data Integrity", value: 5, color: "emerald" },
              ]}
              tag="Implicit lock"
              tagColor="bg-emerald-900/50 text-emerald-400"
              code={`UPDATE item
  SET stock = stock-1
  WHERE stock > 0
-- DB row lock, 1 stmt`}
              explanation="Single atomic SQL statement. The DB acquires a row lock for just the UPDATE. Second request finds stock = 0 — rejected."
            />
            <TradeoffCard
              title="🔐 Lock Mode"
              titleColor="text-violet-400"
              borderColor={mode === "lock" ? "border-violet-500" : "border-gray-800"}
              bgColor={mode === "lock" ? "bg-violet-950/20" : "bg-gray-900"}
              metrics={[
                { label: "Response Speed", value: 3, color: "violet" },
                { label: "Data Integrity", value: 5, color: "violet" },
              ]}
              tag="Explicit lock"
              tagColor="bg-violet-900/50 text-violet-400"
              code={`SELECT * FROM item
  FOR UPDATE  ← lock
  ...delay...
UPDATE stock-1
COMMIT        ← unlock`}
              explanation="Exclusive row lock held for the entire transaction. Concurrent requests block at SELECT FOR UPDATE and queue — they run serially."
            />
          </div>
        </div>

        {/* Activity log */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Activity Log
            {purchases && purchases.length > 0 && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-gray-400">
                {purchases.length}
              </span>
            )}
          </h2>
          {!purchases || purchases.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-sm text-gray-600">
              No purchases yet — share the customer URL and have the audience click Buy Now!
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 border-b border-gray-800/50 px-4 py-3 text-sm last:border-0"
                >
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                      p.success
                        ? "bg-emerald-900 text-emerald-400"
                        : "bg-red-900/60 text-red-400"
                    }`}
                  >
                    {p.success ? "✓ Booked" : "✗ Rejected"}
                  </span>
                  <span className="min-w-0 truncate text-gray-300">{p.customerId}</span>
                  <span
                    className={`shrink-0 text-xs ${
                      p.mode === "fast"
                        ? "text-orange-400"
                        : p.mode === "lock"
                          ? "text-violet-400"
                          : "text-emerald-400"
                    }`}
                  >
                    {p.mode === "fast" ? "⚡ fast" : p.mode === "lock" ? "🔐 lock" : "🔒 safe"}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-gray-600">
                    {new Date(p.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  label,
  sub,
  active,
  activeClass,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all ${
        active ? `${activeClass} text-white shadow-lg` : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
      <div className="mt-0.5 text-xs font-normal opacity-75">{sub}</div>
    </button>
  );
}

function TradeoffCard({
  title,
  titleColor,
  borderColor,
  bgColor,
  metrics,
  tag,
  tagColor,
  code,
  explanation,
}: {
  title: string;
  titleColor: string;
  borderColor: string;
  bgColor: string;
  metrics: { label: string; value: number; color: "orange" | "emerald" | "violet" }[];
  tag: string;
  tagColor: string;
  code: string;
  explanation: string;
}) {
  return (
    <div className={`rounded-xl border p-5 transition-all ${borderColor} ${bgColor}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`font-bold ${titleColor}`}>{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tagColor}`}>{tag}</span>
      </div>
      <div className="mb-4 space-y-2">
        {metrics.map((m) => (
          <MetricBar key={m.label} label={m.label} value={m.value} max={5} color={m.color} />
        ))}
      </div>
      <pre className="mb-3 overflow-x-auto rounded-lg bg-gray-900/80 p-3 text-xs text-gray-400">
        {code}
      </pre>
      <p className="text-xs text-gray-500">{explanation}</p>
    </div>
  );
}

function MetricBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: "orange" | "emerald" | "violet";
}) {
  const colorClass =
    color === "orange" ? "bg-orange-500" : color === "violet" ? "bg-violet-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${i < value ? colorClass : "bg-gray-700"}`}
          />
        ))}
      </div>
    </div>
  );
}
