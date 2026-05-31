"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/trpc/react";

type Mode = "fast" | "safe";
type UserState = "idle" | "checking" | "booked" | "rejected";

interface LogEntry {
  id: number;
  user: "A" | "B" | "system";
  message: string;
  type: "info" | "success" | "error";
  ms?: number;
}

export function InventoryDemo() {
  const [mode, setMode] = useState<Mode>("fast");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stateA, setStateA] = useState<UserState>("idle");
  const [stateB, setStateB] = useState<UserState>("idle");
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const isRunning = stateA === "checking" || stateB === "checking";

  const { data, refetch } = api.inventory.getStock.useQuery(undefined, {
    refetchInterval: false,
  });
  const buyFast = api.inventory.buyFast.useMutation();
  const buySafe = api.inventory.buySafe.useMutation();
  const resetMut = api.inventory.reset.useMutation({
    onSuccess: () => {
      void refetch();
      setLogs([]);
      setStateA("idle");
      setStateB("idle");
    },
  });

  const stock = data?.stock ?? 0;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (
    user: LogEntry["user"],
    message: string,
    type: LogEntry["type"],
    ms?: number,
  ) => {
    setLogs((prev) => [
      ...prev,
      { id: logIdRef.current++, user, message, type, ms },
    ]);
  };

  const simulateRace = async () => {
    setStateA("checking");
    setStateB("checking");
    setLogs([]);

    const label =
      mode === "fast"
        ? "Fast Mode — read › delay › write"
        : "Safe Mode — atomic UPDATE WHERE stock > 0";
    addLog("system", `Firing A + B simultaneously (${label})`, "info");

    const buy = mode === "fast" ? buyFast : buySafe;
    const t0 = Date.now();

    const handleResult = (
      result: { success: boolean; user: string; reason?: string },
      user: "A" | "B",
    ) => {
      const elapsed = Date.now() - t0;
      const set = user === "A" ? setStateA : setStateB;
      if (result.success) {
        set("booked");
        addLog(user, "Booked!", "success", elapsed);
      } else {
        set("rejected");
        addLog(user, result.reason ?? "Rejected", "error", elapsed);
      }
    };

    await Promise.all([
      buy.mutateAsync({ user: "A" }).then((r) => handleResult(r, "A")),
      buy.mutateAsync({ user: "B" }).then((r) => handleResult(r, "B")),
    ]).finally(() => void refetch());
  };

  const isOversold = stock < 0;
  const bothBooked = stateA === "booked" && stateB === "booked";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
      <div className="w-full max-w-xl space-y-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            Race Condition Demo
          </h1>
          <p className="mt-1 text-gray-400">
            Two users. One item. Choose your tradeoff.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-2xl bg-gray-900 p-1">
          <button
            onClick={() => setMode("fast")}
            className={`flex-1 rounded-xl py-3 font-semibold transition-all ${
              mode === "fast"
                ? "bg-orange-500 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            ⚡ Fast Mode
            <div className="mt-0.5 text-xs font-normal opacity-70">
              No lock · may oversell
            </div>
          </button>
          <button
            onClick={() => setMode("safe")}
            className={`flex-1 rounded-xl py-3 font-semibold transition-all ${
              mode === "safe"
                ? "bg-emerald-500 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🔒 Safe Mode
            <div className="mt-0.5 text-xs font-normal opacity-70">
              Atomic update · consistent
            </div>
          </button>
        </div>

        {/* Stock counter */}
        <div
          className={`rounded-2xl border-2 p-8 text-center transition-all duration-300 ${
            isOversold
              ? "border-red-500 bg-red-950"
              : stock === 0
                ? "border-gray-700 bg-gray-900"
                : "border-gray-800 bg-gray-900"
          }`}
        >
          <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">
            Stock Available
          </div>
          <div
            className={`text-9xl font-black transition-all duration-300 ${
              isOversold
                ? "text-red-400"
                : stock === 0
                  ? "text-gray-600"
                  : "text-white"
            }`}
          >
            {stock}
          </div>
          {isOversold && (
            <div className="mt-3 animate-pulse text-lg font-bold text-red-400">
              ⚠️ OVERSOLD — consistency violated
            </div>
          )}
          {stock === 0 && !isOversold && (
            <div className="mt-3 text-sm text-gray-600">Sold out</div>
          )}
        </div>

        {/* User cards */}
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as const).map((user) => {
            const s = user === "A" ? stateA : stateB;
            return (
              <div
                key={user}
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${
                  s === "booked"
                    ? "border-emerald-500 bg-emerald-950"
                    : s === "rejected"
                      ? "border-red-500 bg-red-950"
                      : s === "checking"
                        ? "animate-pulse border-blue-500 bg-gray-900"
                        : "border-gray-800 bg-gray-900"
                }`}
              >
                <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">
                  User {user}
                </div>
                <div className="text-xl font-bold">
                  {s === "idle" && "—"}
                  {s === "checking" && "⏳ Checking..."}
                  {s === "booked" && "✅ Booked!"}
                  {s === "rejected" && "❌ Rejected"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Oversell callout */}
        {bothBooked && mode === "fast" && (
          <div className="rounded-xl border border-red-700 bg-red-950/60 p-4 text-sm">
            <span className="font-bold text-red-400">Both users "succeeded" — </span>
            <span className="text-gray-300">
              they both read{" "}
              <code className="rounded bg-gray-800 px-1 text-white">stock = 1</code>{" "}
              before either wrote. Classic TOCTOU race condition.
            </span>
          </div>
        )}

        {/* Simulate button */}
        <button
          onClick={simulateRace}
          disabled={isRunning}
          className={`w-full rounded-xl py-4 text-lg font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
            mode === "fast"
              ? "bg-orange-500 hover:bg-orange-400"
              : "bg-emerald-500 hover:bg-emerald-400"
          }`}
        >
          {isRunning ? "Running..." : "⚡ Simulate Race — A + B simultaneously"}
        </button>

        <button
          onClick={() => resetMut.mutate()}
          disabled={isRunning || resetMut.isPending}
          className="w-full rounded-xl bg-gray-800 py-3 font-medium text-gray-300 transition-all hover:bg-gray-700 active:scale-95 disabled:opacity-50"
        >
          ↺ Reset stock to 1
        </button>

        {/* Activity log */}
        {logs.length > 0 && (
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl bg-gray-900 p-4">
            <div className="mb-3 text-xs uppercase tracking-widest text-gray-600">
              Activity Log
            </div>
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs ${
                    log.user === "system"
                      ? "bg-gray-700 text-gray-300"
                      : log.user === "A"
                        ? "bg-blue-900 text-blue-300"
                        : "bg-purple-900 text-purple-300"
                  }`}
                >
                  {log.user === "system" ? "SYS" : `User ${log.user}`}
                </span>
                <span
                  className={
                    log.type === "success"
                      ? "text-emerald-400"
                      : log.type === "error"
                        ? "text-red-400"
                        : "text-gray-300"
                  }
                >
                  {log.message}
                </span>
                {log.ms !== undefined && (
                  <span className="ml-auto shrink-0 text-xs text-gray-600">
                    {log.ms}ms
                  </span>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* Explanation card */}
        <div
          className={`rounded-xl border p-4 text-sm transition-all ${
            mode === "fast"
              ? "border-orange-800 bg-orange-950/40"
              : "border-emerald-800 bg-emerald-950/40"
          }`}
        >
          {mode === "fast" ? (
            <>
              <div className="mb-2 font-semibold text-orange-400">
                ⚡ Fast Mode — what the code does
              </div>
              <pre className="mb-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">{`const item = await db.item.findFirst()   // read stock
if (item.stock > 0) {
  await sleep(800)                        // processing gap ← race lives here
  await db.item.update({ stock: -1 })    // write
}`}</pre>
              <p className="text-gray-400">
                Both users read{" "}
                <code className="rounded bg-gray-800 px-1">stock = 1</code>,
                both pass the check, both decrement. Stock becomes{" "}
                <code className="rounded bg-gray-800 px-1">-1</code>.
              </p>
            </>
          ) : (
            <>
              <div className="mb-2 font-semibold text-emerald-400">
                🔒 Safe Mode — what the code does
              </div>
              <pre className="mb-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">{`UPDATE "Item"
  SET stock = stock - 1
  WHERE stock > 0          -- atomic check + write`}</pre>
              <p className="text-gray-400">
                Single SQL statement. The database guarantees only one row
                matches. Second user gets 0 rows affected → rejected.
              </p>
            </>
          )}
          <div
            className={`mt-3 rounded-lg p-2 text-xs ${
              mode === "fast" ? "bg-orange-900/40" : "bg-emerald-900/40"
            }`}
          >
            <span className="font-semibold">Tradeoff: </span>
            {mode === "fast" ? (
              <span className="text-gray-300">
                Latency ↓ &nbsp;·&nbsp; Consistency ↓
              </span>
            ) : (
              <span className="text-gray-300">
                Latency ↑ (slightly) &nbsp;·&nbsp; Consistency ↑
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
