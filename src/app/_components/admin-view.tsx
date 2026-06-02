"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/trpc/react";

type Mode = "latency" | "consistency";

export function AdminView() {
  const [customerUrl, setCustomerUrl] = useState("");

  useEffect(() => {
    setCustomerUrl(window.location.origin);
  }, []);

  const { data: seatData, refetch: refetchSeat } = api.inventory.getSeat.useQuery(undefined, {
    refetchInterval: 1500,
  });

  const { data: purchases, refetch: refetchPurchases } = api.inventory.getPurchases.useQuery(
    undefined,
    { refetchInterval: 1500 },
  );

  const setModeMut = api.inventory.setMode.useMutation({
    onSuccess: () => void refetchSeat(),
  });

  const resetMut = api.inventory.reset.useMutation({
    onSuccess: () => {
      void refetchSeat();
      void refetchPurchases();
    },
  });

  const isAvailable = seatData?.isAvailable ?? true;
  const seatLabel = seatData?.label ?? "E5";
  const mode: Mode = (seatData?.mode ?? "latency") as Mode;

  const successCount = purchases?.filter((p) => p.success).length ?? 0;
  const isOversold = successCount > 1;

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
            Audience view →
          </Link>
        </div>

        {/* Share URL */}
        <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/30 p-4">
          <div className="mb-1 text-xs uppercase tracking-widest text-indigo-500">
            Share with audience
          </div>
          <div className="font-mono text-lg font-bold text-indigo-300">{customerUrl}/</div>
          <div className="mt-1 text-xs text-gray-600">
            Have them open this on their phones and tap Book Seat
          </div>
        </div>

        {/* Mode + Seat status */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Mode toggle */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Active Mode
            </div>
            <div className="flex rounded-xl bg-gray-800 p-1">
              <ModeButton
                label="⚡ Latency"
                sub="May oversell"
                active={mode === "latency"}
                activeClass="bg-orange-500"
                onClick={() => setModeMut.mutate({ mode: "latency" })}
                disabled={setModeMut.isPending}
              />
              <ModeButton
                label="🔐 Consistency"
                sub="SELECT FOR UPDATE"
                active={mode === "consistency"}
                activeClass="bg-violet-500"
                onClick={() => setModeMut.mutate({ mode: "consistency" })}
                disabled={setModeMut.isPending}
              />
            </div>
          </div>

          {/* Seat status */}
          <div
            className={`rounded-2xl border p-5 transition-all ${
              isOversold ? "border-red-500 bg-red-950/30" : "border-gray-800 bg-gray-900"
            }`}
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Seat {seatLabel}
            </div>
            <div
              className={`text-5xl font-black leading-none ${
                isOversold
                  ? "text-red-400"
                  : isAvailable
                    ? "text-emerald-400"
                    : "text-gray-500"
              }`}
            >
              {isOversold ? "OVERSOLD" : isAvailable ? "Available" : "Booked"}
            </div>
            {isOversold && (
              <div className="mt-2 text-sm font-bold text-red-400">
                ⚠️ {successCount} bookings for 1 seat
              </div>
            )}
            {!isOversold && !isAvailable && successCount === 1 && (
              <div className="mt-2 text-xs text-gray-500">1 booking — correct</div>
            )}
          </div>
        </div>

        {/* Reset */}
        <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <span className="text-sm text-gray-400">Ready for next round?</span>
          <button
            onClick={() => resetMut.mutate()}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TradeoffCard
              title="⚡ Prioritize Latency"
              titleColor="text-orange-400"
              borderColor={mode === "latency" ? "border-orange-500" : "border-gray-800"}
              bgColor={mode === "latency" ? "bg-orange-950/20" : "bg-gray-900"}
              metrics={[
                { label: "Response Speed", value: 5, color: "orange" },
                { label: "Data Integrity", value: 1, color: "orange" },
              ]}
              tag="No locking"
              tagColor="bg-orange-900/50 text-orange-400"
              code={`read  available=true  ← A
  ···delay···  ← B reads true
write false    ← both → oversold`}
              explanation="No coordination. Both requests read before either writes. Both pass the check and book — seat double-sold."
            />
            <TradeoffCard
              title="🔐 Prioritize Consistency"
              titleColor="text-violet-400"
              borderColor={mode === "consistency" ? "border-violet-500" : "border-gray-800"}
              bgColor={mode === "consistency" ? "bg-violet-950/20" : "bg-gray-900"}
              metrics={[
                { label: "Response Speed", value: 3, color: "violet" },
                { label: "Data Integrity", value: 5, color: "violet" },
              ]}
              tag="Explicit lock"
              tagColor="bg-violet-900/50 text-violet-400"
              code={`SELECT * FROM "Seat"
  FOR UPDATE  ← lock
  ...delay...
UPDATE false
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
              No bookings yet — share the audience URL and have them tap Book Seat!
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
                      p.success ? "bg-emerald-900 text-emerald-400" : "bg-red-900/60 text-red-400"
                    }`}
                  >
                    {p.success ? "✓ Booked" : "✗ Rejected"}
                  </span>
                  <span className="min-w-0 truncate text-gray-300">{p.customerId}</span>
                  <span
                    className={`shrink-0 text-xs ${
                      p.mode === "latency" ? "text-orange-400" : "text-violet-400"
                    }`}
                  >
                    {p.mode === "latency" ? "⚡ latency" : "🔐 consistency"}
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
        <span>
          {value}/{max}
        </span>
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
