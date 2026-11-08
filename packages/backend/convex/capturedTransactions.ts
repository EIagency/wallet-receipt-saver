import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authQuery } from "./functions";
import { captureFields, captureSchema } from "./lib/capture";
import { rateLimiter } from "./rateLimit";

const transactionValidator = v.object({
    _id: v.id("capturedTransactions"),
    _creationTime: v.number(),
    userId: v.id("users"),
    ...captureFields,
    status: v.union(v.literal("pending"), v.literal("categorized")),
    category: v.union(v.string(), v.null()),
    createdAt: v.number(),
});

export const record = internalMutation({
    args: { userId: v.id("users"), ...captureFields },
    returns: v.union(
        v.object({ code: v.literal(200), id: v.id("capturedTransactions") }),
        v.object({ code: v.literal(208), existingId: v.id("capturedTransactions"), reason: v.literal("duplicate") }),
    ),
    handler: async (ctx, { userId, ...input }) => {
        const data = captureSchema.parse(input);
        if (!await ctx.db.get(userId)) throw new Error("Capture owner not found");
        // The index lookup and insert share a transaction, enforcing global uniqueness under OCC.
        const existing = await ctx.db.query("capturedTransactions")
            .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", data.dedupeKey))
            .unique();
        if (existing) return { code: 208 as const, existingId: existing._id, reason: "duplicate" as const };
        const limit = await rateLimiter.limit(ctx, "captureTransaction", { key: userId, throws: false });
        if (!limit.ok) throw new ConvexError({ code: "CAPTURE_RATE_LIMITED", retryAfterMs: limit.retryAfter });
        const id = await ctx.db.insert("capturedTransactions", {
            userId,
            ...data,
            status: "pending",
            category: null,
            createdAt: Date.now(),
        });
        // Never log bodies, authorization headers, dedupe keys or raw notification text.
        console.info({ merchant: data.merchant, amountMinor: data.amountMinor });
        return { code: 200 as const, id };
    },
});

export const listPending = authQuery({
    args: { userId: v.id("users"), paginationOpts: v.optional(paginationOptsValidator) },
    returns: v.object({
        page: v.array(transactionValidator),
        isDone: v.boolean(),
        continueCursor: v.string(),
        splitCursor: v.optional(v.union(v.string(), v.null())),
        pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
    }),
    handler: async (ctx, { userId, paginationOpts }) => {
        if (userId !== ctx.user._id) throw new Error("You can only list your own captured transactions");
        return await ctx.db.query("capturedTransactions")
            .withIndex("by_userId_and_status_and_occurredAt", (q) => q.eq("userId", userId).eq("status", "pending"))
            .order("desc")
            .paginate(paginationOpts ?? { numItems: 50, cursor: null });
    },
});
