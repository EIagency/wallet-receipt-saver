import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { captureFields, captureSchema } from "./lib/capture";
import { rateLimiter } from "./rateLimit";

export const record = internalMutation({
    args: { userId: v.id("users"), ...captureFields },
    returns: v.union(
        v.object({ status: v.literal("recorded") }),
        v.object({ status: v.literal("duplicate") }),
        v.object({ status: v.literal("rateLimited"), retryAfterMs: v.number() }),
    ),
    handler: async (ctx, { userId, ...input }) => {
        const data = captureSchema.parse(input);
        if (!await ctx.db.get(userId)) throw new Error("Capture owner not found");
        const existing = await ctx.db.query("capturedTransactions")
            .withIndex("by_userId_and_dedupeKey", (q) => q.eq("userId", userId).eq("dedupeKey", data.dedupeKey))
            .unique();
        if (existing) return { status: "duplicate" as const };
        const limit = await rateLimiter.limit(ctx, "captureTransaction", { key: userId, throws: false });
        if (!limit.ok) return { status: "rateLimited" as const, retryAfterMs: limit.retryAfter };
        const expenseId = await ctx.db.insert("expenses", {
            userId,
            amountCents: data.amountMinor,
            merchant: data.merchant,
            currency: data.currency,
            date: data.occurredAt,
            category: "other",
        });
        await ctx.db.insert("capturedTransactions", { userId, ...data, expenseId });
        // Never log the request, authorization header, dedupe key or notification text.
        console.info({ merchant: data.merchant, amountMinor: data.amountMinor });
        return { status: "recorded" as const };
    },
});
