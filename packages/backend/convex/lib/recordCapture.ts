import { ConvexError } from "convex/values";
import type { z } from "zod";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { captureSchema } from "./capture";
import { rateLimiter } from "../rateLimit";

export async function recordCapture(ctx: MutationCtx, userId: Id<"users">, input: z.infer<typeof captureSchema>) {
    const data = captureSchema.parse(input);
    if (!await ctx.db.get(userId)) throw new ConvexError("Capture owner not found");
    const existing = await ctx.db.query("capturedTransactions")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", data.dedupeKey))
        .unique();
    if (existing) return { code: 208 as const, existingId: existing._id, reason: "duplicate" as const };
    const limit = await rateLimiter.limit(ctx, "captureTransaction", { key: userId, throws: false });
    if (!limit.ok) throw new ConvexError({ code: "CAPTURE_RATE_LIMITED", retryAfterMs: limit.retryAfter });
    const id = await ctx.db.insert("capturedTransactions", {
        userId, ...data, status: "pending", category: null, source: "Wallet", createdAt: Date.now(),
    });
    // Never log bodies, authorization headers, dedupe keys or raw notification text.
    console.info({ merchant: data.merchant, amountMinor: data.amountMinor });
    return { code: 200 as const, id };
}
