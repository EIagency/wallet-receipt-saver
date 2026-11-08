import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
    ...authTables,
    captureSecretOwners: defineTable({
        secretHash: v.string(),
        userId: v.id("users"),
        createdAt: v.number(),
    })
        .index("by_secretHash", ["secretHash"])
        .index("by_userId", ["userId"]),
    capturedTransactions: defineTable({
        userId: v.id("users"),
        merchant: v.string(),
        amountMinor: v.number(),
        currency: v.union(v.literal("TRY"), v.literal("USD"), v.literal("EUR"), v.literal("GBP")),
        source: v.optional(v.literal("Wallet")),
        occurredAt: v.number(),
        status: v.union(v.literal("pending"), v.literal("categorized")),
        category: v.union(v.string(), v.null()),
        dedupeKey: v.string(),
        createdAt: v.number(),
    })
        .index("by_dedupeKey", ["dedupeKey"])
        .index("by_userId_and_status_and_occurredAt", ["userId", "status", "occurredAt"]),
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
