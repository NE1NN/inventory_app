import { z } from "zod";
import { createTRPCRouter, publicProcedureRaw } from "@/server/api/trpc";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const inventoryRouter = createTRPCRouter({
  getStock: publicProcedureRaw.query(async ({ ctx }) => {
    const item = await ctx.db.item.findFirst();
    return {
      stock: item?.stock ?? 0,
      name: item?.name ?? "Concert Ticket",
      mode: (item?.mode ?? "safe") as "fast" | "safe" | "lock",
    };
  }),

  getPurchases: publicProcedureRaw.query(async ({ ctx }) => {
    return ctx.db.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  // Unified buy — reads mode from DB so admin controls strategy live.
  buy: publicProcedureRaw
    .input(z.object({ customerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.item.findFirst();
      if (!item) {
        return { success: false, customerId: input.customerId, reason: "No item found" };
      }

      const mode = item.mode as "fast" | "safe" | "lock";
      let success = false;
      let reason: string | undefined;

      if (mode === "fast") {
        if (item.stock <= 0) {
          reason = "Out of stock";
        } else {
          // Simulate processing gap — both users slip through if concurrent.
          await sleep(800);
          await ctx.db.item.update({
            where: { id: item.id },
            data: { stock: { decrement: 1 } },
          });
          success = true;
        }
      } else if (mode === "safe") {
        // Single atomic UPDATE WHERE stock > 0 — no race window.
        const affected = await ctx.db.$executeRaw`
          UPDATE "Item"
          SET stock = stock - 1
          WHERE id = ${item.id} AND stock > 0
        `;
        success = affected > 0;
        if (!success) reason = "Out of stock";
      } else {
        // Pessimistic lock: SELECT FOR UPDATE holds an exclusive row lock for the
        // entire transaction. Concurrent requests block at the SELECT and queue —
        // they only run after the current transaction commits.
        await ctx.db.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ id: number; stock: number }[]>`
            SELECT id, stock FROM "Item" WHERE id = ${item.id} FOR UPDATE
          `;
          const locked = rows[0];
          if (!locked || locked.stock <= 0) {
            reason = "Out of stock";
            return;
          }
          // Sleep while holding the lock — the queue effect is visible here.
          await sleep(800);
          await tx.item.update({
            where: { id: locked.id },
            data: { stock: { decrement: 1 } },
          });
          success = true;
        });
      }

      await ctx.db.purchase.create({
        data: { customerId: input.customerId, success, reason: reason ?? null, mode },
      });

      return { success, customerId: input.customerId, reason };
    }),

  setMode: publicProcedureRaw
    .input(z.object({ mode: z.enum(["fast", "safe", "lock"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.item.upsert({
        where: { id: 1 },
        update: { mode: input.mode },
        create: { id: 1, name: "Concert Ticket", stock: 1, mode: input.mode },
      });
      return { success: true };
    }),

  reset: publicProcedureRaw
    .input(z.object({ stock: z.number().int().min(1).max(10).optional().default(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.item.upsert({
        where: { id: 1 },
        update: { stock: input.stock },
        create: { id: 1, name: "Concert Ticket", stock: input.stock, mode: "safe" },
      });
      await ctx.db.purchase.deleteMany();
      return { success: true };
    }),
});
