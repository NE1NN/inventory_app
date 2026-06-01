"use client";

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";

// Client-side delay in fast mode — widens the race window so concurrent
// audience members are more likely to have their requests overlap on the server.
const PRE_FLIGHT_DELAY_MS = 600;

const ADJECTIVES = ["Swift", "Bold", "Eager", "Quick", "Sharp", "Brave", "Calm", "Wild", "Keen"];
const NOUNS = ["Panda", "Tiger", "Eagle", "Wolf", "Fox", "Bear", "Hawk", "Lynx", "Deer"];

function makeCustomerId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj} ${noun} #${num}`;
}

type BuyPhase = "idle" | "checking" | "processing";

export function CustomerView() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; reason?: string } | null>(null);
  const [buyPhase, setBuyPhase] = useState<BuyPhase>("idle");

  const { data } = api.inventory.getStock.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const buyMut = api.inventory.buy.useMutation({
    onSuccess: (res) => {
      setBuyPhase("idle");
      setResult({ success: res.success, reason: res.reason });
    },
    onError: () => setBuyPhase("idle"),
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
  const isBusy = buyPhase !== "idle";

  const handleBuy = async () => {
    if (!customerId || isBusy) return;
    setResult(null);

    // Pre-flight delay: hold here so concurrent audience members can also click
    // before any request hits the server, maximising overlap on both modes.
    setBuyPhase("checking");
    await new Promise((r) => setTimeout(r, PRE_FLIGHT_DELAY_MS));

    setBuyPhase("processing");
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
          disabled={isBusy}
          className="w-full rounded-xl bg-indigo-600 py-6 text-2xl font-bold transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buyPhase === "checking"
            ? "🔍 Checking stock..."
            : buyPhase === "processing"
              ? "⏳ Processing..."
              : "Buy Now"}
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
