"use node";

import { createHash, timingSafeEqual } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const authenticate = internalAction({
    args: { authorization: v.string() },
    returns: v.union(v.id("users"), v.null()),
    handler: async (ctx, { authorization }): Promise<Id<"users"> | null> => {
        const expected = process.env.CAPTURE_SECRET;
        // Missing or header-incompatible configuration fails closed.
        if (!expected || expected.length > 4096 || /\s/.test(expected)) return null;
        const match = /^Bearer ([^\s]+)$/i.exec(authorization);
        if (!match || match[1].length > 4096) return null;
        // Fixed-size digests allow timingSafeEqual even for different token lengths.
        const suppliedHash = createHash("sha256").update(match[1], "utf8").digest();
        const expectedHash = createHash("sha256").update(expected, "utf8").digest();
        if (!timingSafeEqual(suppliedHash, expectedHash)) return null;
        return await ctx.runQuery(internal.captureOwners.resolve, {
            secretHash: expectedHash.toString("hex"),
        });
    },
});
