import { z } from "zod";
import { createTRPCRouter, publicProcedureRaw } from "@/server/api/trpc";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const inventoryRouter = createTRPCRouter({
  getStock: publicProcedureRaw.query(async ({ ctx }) => {
    const item = await ctx.db.item.findFirst();
    return { stock: item?.stock ?? 0, name: item?.name ?? "Item" };
  }),

  // Racy: read → delay → write. Both users slip through the gap.
  buyFast: publicProcedureRaw
    .input(z.object({ user: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.item.findFirst();
      if (!item || item.stock <= 0) {
        return { success: false, user: input.user, reason: "Out of stock" };
      }
      // Simulate real-world processing time (payment check, validation, etc.)
      // This is the race window — both users have already read stock = 1.
      await sleep(800);
      await ctx.db.item.update({
        where: { id: item.id },
        data: { stock: { decrement: 1 } },
      });
      return { success: true, user: input.user };
    }),

  // Safe: single atomic UPDATE WHERE stock > 0. No race window.
  buySafe: publicProcedureRaw
    .input(z.object({ user: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const affected = await ctx.db.$executeRaw`
        UPDATE "Item"
        SET stock = stock - 1
        WHERE id = (SELECT id FROM "Item" ORDER BY id LIMIT 1)
          AND stock > 0
      `;
      if (affected === 0) {
        return { success: false, user: input.user, reason: "Out of stock" };
      }
      return { success: true, user: input.user };
    }),

  reset: publicProcedureRaw.mutation(async ({ ctx }) => {
    await ctx.db.item.upsert({
      where: { id: 1 },
      update: { stock: 1 },
      create: { id: 1, name: "Concert Ticket", stock: 1 },
    });
    return { success: true };
  }),
});
