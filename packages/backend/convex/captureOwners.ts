import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { authMutation } from "./functions";
import { hashCaptureSecret } from "./lib/capture";
import { rateLimiter } from "./rateLimit";

export const register = authMutation({
    args: { secret: v.string() },
    returns: v.null(),
    handler: async (ctx, { secret }) => {
        await rateLimiter.limit(ctx, "registerCaptureOwner", { key: ctx.user._id, throws: true });
        const expected = process.env.CAPTURE_SECRET;
        if (!expected) throw new Error("CAPTURE_SECRET environment variable is required but not set");
        if (!secret || secret.length > 4096 || /\s/.test(secret)) {
            throw new Error("Capture secrets must be nonempty, contain no whitespace and be at most 4096 characters");
        }
        const secretHash = await hashCaptureSecret(secret);
        if (secretHash !== await hashCaptureSecret(expected)) {
            throw new Error("Capture secret does not match the configured secret");
        }
        const owner = await ctx.db.query("captureSecretOwners")
            .withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash)).unique();
        if (owner) {
            if (owner.userId !== ctx.user._id) throw new Error("This capture secret already belongs to another user");
            return null;
        }
        await ctx.db.insert("captureSecretOwners", { secretHash, userId: ctx.user._id });
        return null;
    },
});

export const resolve = internalQuery({
    args: { secretHash: v.string() },
    returns: v.union(v.id("users"), v.null()),
    handler: async (ctx, { secretHash }) => {
        const owner = await ctx.db.query("captureSecretOwners")
            .withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash)).unique();
        if (!owner || !await ctx.db.get(owner.userId)) return null;
        return owner.userId;
    },
});
