import { z } from "zod";
import { createTRPCRouter, publicProcedureRaw } from "@/server/api/trpc";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const inventoryRouter = createTRPCRouter({
  getSeat: publicProcedureRaw.query(async ({ ctx }) => {
    const seat = await ctx.db.seat.findFirst();
    return {
      label: seat?.label ?? "E5",
      row: seat?.row ?? "E",
      col: seat?.col ?? 5,
      isAvailable: seat?.isAvailable ?? true,
      bookedBy: seat?.bookedBy ?? null,
      mode: (seat?.mode ?? "latency") as "latency" | "consistency",
    };
  }),

  getPurchases: publicProcedureRaw.query(async ({ ctx }) => {
    return ctx.db.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  book: publicProcedureRaw
    .input(z.object({ customerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const seat = await ctx.db.seat.findFirst();
      if (!seat) {
        return { success: false, customerId: input.customerId, reason: "No seat found" };
      }

      const mode = seat.mode as "latency" | "consistency";
      let success = false;
      let reason: string | undefined;

      if (mode === "latency") {
        if (!seat.isAvailable) {
          reason = "Already booked";
        } else {
          // Simulate processing gap — both users slip through if concurrent.
          await sleep(800);
          await ctx.db.seat.update({
            where: { id: seat.id },
            data: { isAvailable: false, bookedBy: input.customerId },
          });
          success = true;
        }
      } else {
        // Pessimistic lock: SELECT FOR UPDATE holds an exclusive row lock for the
        // entire transaction. Concurrent requests block at the SELECT and queue.
        await ctx.db.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ id: number; isAvailable: boolean }[]>`
            SELECT id, "isAvailable" FROM "Seat" WHERE id = ${seat.id} FOR UPDATE
          `;
          const locked = rows[0];
          if (!locked?.isAvailable) {
            reason = "Already booked";
            return;
          }
          await sleep(800);
          await tx.seat.update({
            where: { id: locked.id },
            data: { isAvailable: false, bookedBy: input.customerId },
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
    .input(z.object({ mode: z.enum(["latency", "consistency"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.seat.upsert({
        where: { id: 1 },
        update: { mode: input.mode },
        create: { id: 1, label: "E5", row: "E", col: 5, isAvailable: true, mode: input.mode },
      });
      return { success: true };
    }),

  reset: publicProcedureRaw.mutation(async ({ ctx }) => {
    await ctx.db.seat.upsert({
      where: { id: 1 },
      update: { isAvailable: true, bookedBy: null },
      create: { id: 1, label: "E5", row: "E", col: 5, isAvailable: true, mode: "latency" },
    });
    await ctx.db.purchase.deleteMany();
    return { success: true };
  }),
});
