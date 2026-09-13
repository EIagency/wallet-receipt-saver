import { v } from "convex/values";
import { authMutation, authQuery } from "./functions";

export const add = authMutation({
    args: {
        amountCents: v.number(),
        merchant: v.string(),
        category: v.string(),
        date: v.number(),
        currency: v.optional(v.string()),
        cardLast4: v.optional(v.string()),
        notes: v.optional(v.string()),
        notificationId: v.optional(v.string()),
    },
    returns: v.id("expenses"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("expenses", {
            userId: ctx.user._id,
            amountCents: args.amountCents,
            merchant: args.merchant,
            category: args.category,
            date: args.date,
            currency: args.currency ?? "USD",
            cardLast4: args.cardLast4,
            notes: args.notes,
            notificationId: args.notificationId,
        });
    },
});

export const update = authMutation({
    args: {
        id: v.id("expenses"),
        amountCents: v.optional(v.number()),
        merchant: v.optional(v.string()),
        category: v.optional(v.string()),
        date: v.optional(v.number()),
        cardLast4: v.optional(v.string()),
        notes: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const expense = await ctx.db.get(args.id);
        if (!expense || expense.userId !== ctx.user._id) {
            throw new Error("Expense not found");
        }
        const { id, ...updates } = args;
        await ctx.db.patch(id, updates);
        return null;
    },
});

export const remove = authMutation({
    args: { id: v.id("expenses") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const expense = await ctx.db.get(args.id);
        if (!expense || expense.userId !== ctx.user._id) {
            throw new Error("Expense not found");
        }
        await ctx.db.delete(args.id);
        return null;
    },
});

export const listByDateRange = authQuery({
    args: {
        startDate: v.number(),
        endDate: v.number(),
    },
    returns: v.array(
        v.object({
            _id: v.id("expenses"),
            _creationTime: v.number(),
            userId: v.id("users"),
            amountCents: v.number(),
            merchant: v.string(),
            category: v.string(),
            date: v.number(),
            currency: v.string(),
            cardLast4: v.optional(v.string()),
            notes: v.optional(v.string()),
            notificationId: v.optional(v.string()),
        })
    ),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("expenses")
            .withIndex("by_userId_and_date", (q) =>
                q.eq("userId", ctx.user._id).gte("date", args.startDate).lte("date", args.endDate)
            )
            .order("desc")
            .collect();
    },
});

export const statsByCategory = authQuery({
    args: {
        startDate: v.number(),
        endDate: v.number(),
    },
    returns: v.array(
        v.object({
            category: v.string(),
            totalCents: v.number(),
            count: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const expenses = await ctx.db
            .query("expenses")
            .withIndex("by_userId_and_date", (q) =>
                q.eq("userId", ctx.user._id).gte("date", args.startDate).lte("date", args.endDate)
            )
            .collect();
        const map: Record<string, { totalCents: number; count: number }> = {};
        for (const e of expenses) {
            if (!map[e.category]) map[e.category] = { totalCents: 0, count: 0 };
            map[e.category].totalCents += e.amountCents;
            map[e.category].count += 1;
        }
        return Object.entries(map).map(([category, stats]) => ({ category, ...stats }));
    },
});
