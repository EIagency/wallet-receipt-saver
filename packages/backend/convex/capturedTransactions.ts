import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authMutation, authQuery } from "./functions";
import { captureFields } from "./lib/capture";
import { recordCapture } from "./lib/recordCapture";
import { rateLimiter } from "./rateLimit";

const transactionValidator = v.object({
    _id: v.id("capturedTransactions"),
    _creationTime: v.number(),
    userId: v.id("users"),
    ...captureFields,
    status: v.union(v.literal("pending"), v.literal("categorized")),
    category: v.union(v.string(), v.null()),
    source: v.optional(v.literal("Wallet")),
    createdAt: v.number(),
});

export const record = internalMutation({
    args: { userId: v.id("users"), ...captureFields },
    returns: v.union(
        v.object({ code: v.literal(200), id: v.id("capturedTransactions") }),
        v.object({ code: v.literal(208), existingId: v.id("capturedTransactions"), reason: v.literal("duplicate") }),
    ),
    handler: async (ctx, { userId, ...input }) => recordCapture(ctx, userId, input),
});

export const simulateWalletTap = authMutation({
    args: { requestId: v.string() },
    returns: v.id("capturedTransactions"),
    handler: async (ctx, { requestId }) => {
        if (!/^[a-zA-Z0-9-]{1,40}$/.test(requestId)) throw new ConvexError("Invalid simulation request ID");
        const result = await recordCapture(ctx, ctx.user._id, {
            merchant: "Tesco", amountMinor: 1245, currency: "GBP", occurredAt: Date.now(),
            dedupeKey: `sim:${requestId}`,
        });
        const id = result.code === 200 ? result.id : result.existingId;
        const capture = await ctx.db.get(id);
        if (!capture || capture.userId !== ctx.user._id) throw new ConvexError("Simulation request ID is already in use. Try again.");
        return id;
    },
});

export const get = authQuery({
    args: { captureId: v.string() },
    returns: v.union(transactionValidator, v.null()),
    handler: async (ctx, { captureId }) => {
        const id = ctx.db.normalizeId("capturedTransactions", captureId);
        if (!id) return null;
        const capture = await ctx.db.get(id);
        return capture?.userId === ctx.user._id ? capture : null;
    },
});

export const categorize = authMutation({
    args: { captureId: v.id("capturedTransactions"), category: v.string() },
    returns: v.null(),
    handler: async (ctx, { captureId, category }) => {
        const capture = await ctx.db.get(captureId);
        if (!capture || capture.userId !== ctx.user._id) throw new ConvexError("Capture not found");
        if (!["groceries", "dining", "transport", "shopping", "health", "entertainment", "utilities", "other"].includes(category)) {
            throw new ConvexError("Choose a valid expense category");
        }
        if (capture.status === "categorized") return null;
        await rateLimiter.limit(ctx, "categorizeCapture", { key: ctx.user._id });
        await ctx.db.insert("expenses", {
            userId: ctx.user._id, merchant: capture.merchant, amountCents: capture.amountMinor,
            currency: capture.currency, category, date: capture.occurredAt, notificationId: capture._id,
        });
        await ctx.db.patch(captureId, { status: "categorized", category });
        return null;
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
