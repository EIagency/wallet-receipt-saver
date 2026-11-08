import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
    ...authTables,
    captureSecretOwners: defineTable({
        secretHash: v.string(),
        userId: v.id("users"),
    })
        .index("by_secretHash", ["secretHash"])
        .index("by_userId", ["userId"]),
    capturedTransactions: defineTable({
        userId: v.id("users"),
        expenseId: v.id("expenses"),
        merchant: v.string(),
        amountMinor: v.number(),
        currency: v.union(v.literal("TRY"), v.literal("USD"), v.literal("EUR")),
        occurredAt: v.number(),
        dedupeKey: v.string(),
    })
        .index("by_userId_and_dedupeKey", ["userId", "dedupeKey"])
        .index("by_expenseId", ["expenseId"]),
    expenses: defineTable({
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
        .index("by_userId", ["userId"])
        .index("by_userId_and_date", ["userId", "date"]),
    pushTokens: defineTable({
        userId: v.id("users"),
        token: v.string(),
        platform: v.string(),
    }).index("by_userId", ["userId"]),
});
