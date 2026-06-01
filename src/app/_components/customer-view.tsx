"use client";

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";

const ADJECTIVES = ["Swift", "Bold", "Eager", "Quick", "Sharp", "Brave", "Calm", "Wild", "Keen"];
const NOUNS = ["Panda", "Tiger", "Eagle", "Wolf", "Fox", "Bear", "Hawk", "Lynx", "Deer"];

function makeCustomerId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj} ${noun} #${num}`;
}

export function CustomerView() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; reason?: string; mode: string } | null>(null);

  const { data } = api.inventory.getStock.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const buyMut = api.inventory.buy.useMutation({
    onSuccess: (data) => {
      setResult({ success: data.success, reason: data.reason, mode: "?" });
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem("demo_customerId");
    if (stored) {
      setCustomerId(stored);
    } else {
      const id = makeCustomerId();
      localStorage.setItem("demo_customerId", id);
      setCustomerId(id);
    }
  }, []);

  const stock = data?.stock ?? 0;
  const mode = data?.mode ?? "safe";
  const name = data?.name ?? "Concert Ticket";
  const isOversold = stock < 0;
  const isBuying = buyMut.isPending;

  const handleBuy = () => {
    if (!customerId || isBuying) return;
    setResult(null);
    buyMut.mutate({ customerId });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 py-10 text-white">
      {/* Mode badge */}
      <div className="mb-8">
        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
            mode === "fast"
              ? "bg-orange-500/20 text-orange-300 ring-orange-500/40"
              : "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
          }`}
        >
          {mode === "fast" ? "⚡ Fast Mode" : "🔒 Safe Mode"}
        </span>
        <p className="mt-2 text-center text-xs text-gray-600">
          {mode === "fast"
            ? "Race condition active — multiple buyers may succeed"
            : "Atomic guarantee — only one buyer will succeed"}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-5">
        {/* Product card */}
        <div className="rounded-2xl border-2 border-gray-800 bg-gray-900 p-8 text-center">
          <div className="mb-3 text-7xl">🎫</div>
          <h2 className="text-2xl font-bold">{name}</h2>
          <div className="mt-4">
            {isOversold ? (
              <span className="rounded-full bg-red-950 px-4 py-1.5 text-sm font-semibold text-red-400">
                ⚠️ Oversold ({stock})
              </span>
            ) : stock > 0 ? (
              <span className="rounded-full bg-emerald-950 px-4 py-1.5 text-sm font-semibold text-emerald-400">
                ✓ In Stock — {stock} left
              </span>
            ) : (
              <span className="rounded-full bg-gray-800 px-4 py-1.5 text-sm font-semibold text-gray-500">
                Sold Out
              </span>
            )}
          </div>
        </div>

        {/* Result card */}
        {result && (
          <div
            className={`rounded-xl border-2 p-6 text-center transition-all ${
              result.success
                ? "border-emerald-500 bg-emerald-950/60"
                : "border-red-800 bg-red-950/60"
            }`}
          >
            {result.success ? (
              <>
                <div className="text-5xl">🎉</div>
                <div className="mt-2 text-xl font-bold text-emerald-400">You got it!</div>
                {mode === "fast" && (
                  <p className="mt-1 text-xs text-orange-400">
                    Fast mode — others may have also succeeded
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-5xl">😔</div>
                <div className="mt-2 text-xl font-bold text-red-400">
                  {result.reason ?? "Someone else got it"}
                </div>
                {mode === "safe" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Safe mode — exactly one buyer wins. Fair and square.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Buy button */}
        <button
          onClick={handleBuy}
          disabled={isBuying}
          className="w-full rounded-xl bg-indigo-600 py-6 text-2xl font-bold transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBuying ? "⏳ Buying..." : "Buy Now"}
        </button>

        {/* Customer identity */}
        {customerId && (
          <p className="text-center text-xs text-gray-700">
            You are:{" "}
            <span className="font-mono text-gray-500">{customerId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
