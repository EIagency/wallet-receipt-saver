import { v } from "convex/values";
import { authMutation } from "./functions";

export const save = authMutation({
    args: {
        token: v.string(),
        platform: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("pushTokens")
            .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { token: args.token, platform: args.platform });
        } else {
            await ctx.db.insert("pushTokens", {
                userId: ctx.user._id,
                token: args.token,
                platform: args.platform,
            });
        }
        return null;
    },
});
