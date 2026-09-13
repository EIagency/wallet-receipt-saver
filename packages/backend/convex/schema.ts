import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
    ...authTables,
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
