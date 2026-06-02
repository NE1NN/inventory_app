"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/trpc/react";

const PRE_FLIGHT_DELAY_MS = 600;

const ADJECTIVES = ["Swift", "Bold", "Eager", "Quick", "Sharp", "Brave", "Calm", "Wild", "Keen"];
const NOUNS = ["Panda", "Tiger", "Eagle", "Wolf", "Fox", "Bear", "Hawk", "Lynx", "Deer"];

function makeCustomerId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj} ${noun} #${num}`;
}

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type BookPhase = "idle" | "checking" | "processing";

export function CustomerView() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; reason?: string; latencyMs: number } | null>(null);
  const [bookPhase, setBookPhase] = useState<BookPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data } = api.inventory.getSeat.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const bookMut = api.inventory.book.useMutation({
    onSuccess: (res) => {
      const latencyMs = startRef.current !== null ? Date.now() - startRef.current : 0;
      if (timerRef.current) clearInterval(timerRef.current);
      setBookPhase("idle");
      setResult({ success: res.success, reason: res.reason, latencyMs });
    },
    onError: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setBookPhase("idle");
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

  const seatLabel = data?.label ?? "E5";
  const seatRow = data?.row ?? "E";
  const seatCol = data?.col ?? 5;
  const isAvailable = data?.isAvailable ?? true;
  const mode = data?.mode ?? "safe";
  const isBusy = bookPhase !== "idle";

  const handleBook = async () => {
    if (!customerId || isBusy || !isAvailable) return;
    setResult(null);

    setBookPhase("checking");
    await new Promise((r) => setTimeout(r, PRE_FLIGHT_DELAY_MS));

    setBookPhase("processing");
    const now = Date.now();
    startRef.current = now;
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(Date.now() - now), 50);
    timerRef.current = id;
    bookMut.mutate({ customerId });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-8 text-white">
      {/* Mode badge */}
      <div className="mb-6 text-center">
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${
            mode === "fast"
              ? "bg-orange-500/20 text-orange-300 ring-orange-500/40"
              : mode === "lock"
                ? "bg-violet-500/20 text-violet-300 ring-violet-500/40"
                : "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
          }`}
        >
          {mode === "fast" ? "⚡ Fast Mode" : mode === "lock" ? "🔐 Lock Mode" : "🔒 Safe Mode"}
        </span>
        <p className="mt-1.5 text-xs text-gray-600">
          {mode === "fast"
            ? "Race condition active — multiple buyers may succeed"
            : mode === "lock"
              ? "Exclusive lock — requests queue, only one wins"
              : "Atomic guarantee — only one buyer will succeed"}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-5">
        {/* Cinema */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          {/* Screen */}
          <div className="mb-5">
            <div className="h-1.5 rounded-full bg-linear-to-r from-transparent via-indigo-400/60 to-transparent" />
            <p className="mt-1.5 text-center text-xs font-semibold uppercase tracking-widest text-gray-600">
              Screen
            </p>
          </div>

          {/* Seat grid */}
          <div className="space-y-1.5">
            {ROWS.map((row) => (
              <div key={row} className="flex items-center gap-1.5">
                <span className="w-3 shrink-0 text-center text-xs text-gray-700">{row}</span>
                <div className="flex flex-1 justify-center gap-1">
                  {COLS.map((col) => {
                    const isTheSeat = row === seatRow && col === seatCol;

                    if (isTheSeat && isAvailable) {
                      return (
                        <button
                          key={col}
                          onClick={handleBook}
                          disabled={isBusy}
                          title={`Seat ${row}${col} — Available`}
                          className="h-5 w-5 rounded-t-md rounded-b-sm bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_14px_rgba(52,211,153,0.9)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 sm:h-6 sm:w-6"
                        />
                      );
                    }

                    if (isTheSeat && !isAvailable) {
                      return (
                        <div
                          key={col}
                          title={`Seat ${row}${col} — Just booked`}
                          className="h-5 w-5 rounded-t-md rounded-b-sm bg-red-700/80 sm:h-6 sm:w-6"
                        />
                      );
                    }

                    // Aisle gap between col 5 and 6
                    return (
                      <div
                        key={col}
                        title={`Seat ${row}${col} — Taken`}
                        className={`h-5 w-5 rounded-t-md rounded-b-sm bg-gray-700/60 sm:h-6 sm:w-6 ${col === 6 ? "ml-2" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex justify-center gap-5 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-t bg-gray-700/60" />
              Taken
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-t bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-t bg-red-700/80" />
              Booked
            </span>
          </div>
        </div>

        {/* Result card */}
        {result && (
          <div
            className={`rounded-xl border-2 p-5 text-center transition-all ${
              result.success
                ? "border-emerald-500 bg-emerald-950/60"
                : "border-red-800 bg-red-950/60"
            }`}
          >
            {result.success ? (
              <>
                <div className="text-4xl">🎬</div>
                <div className="mt-2 text-lg font-bold text-emerald-400">
                  Seat {seatLabel} is yours!
                </div>
                {mode === "fast" && (
                  <p className="mt-1 text-xs text-orange-400">
                    Fast mode — others may have also succeeded
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-4xl">😔</div>
                <div className="mt-2 text-lg font-bold text-red-400">
                  {result.reason ?? "Someone else got it"}
                </div>
                {mode === "safe" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Safe mode — exactly one buyer wins.
                  </p>
                )}
              </>
            )}
            <div className="mt-3 font-mono text-xs text-gray-500">
              {(result.latencyMs / 1000).toFixed(2)}s
            </div>
          </div>
        )}

        {/* Book button */}
        <button
          onClick={handleBook}
          disabled={isBusy || !isAvailable}
          className={`w-full rounded-xl py-5 text-xl font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
            isAvailable ? "bg-indigo-600 hover:bg-indigo-500" : "bg-gray-700"
          }`}
        >
          {bookPhase === "checking"
            ? "🔍 Checking availability..."
            : bookPhase === "processing"
              ? `⏳ ${(elapsedMs / 1000).toFixed(1)}s`
              : isAvailable
                ? `Book Seat ${seatLabel}`
                : "Seat Taken"}
        </button>

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
