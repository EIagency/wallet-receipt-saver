import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
    registerCaptureOwner: { kind: "fixed window", rate: 5, period: HOUR },
    captureTransaction: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 100 },
});

// =============================================================================
// USAGE IN MUTATIONS
// =============================================================================
// Import this rateLimiter in your mutations to enforce limits:
//
// import { rateLimiter } from "./rateLimit";
//
// export const sendMessage = authMutation({
//   args: { text: v.string() },
//   returns: v.null(),
//   handler: async (ctx, args) => {
//     await rateLimiter.limit(ctx, "sendMessage", { key: ctx.user._id });
//     await ctx.db.insert("messages", { text: args.text, userId: ctx.user._id });
//     return null;
//   },
// });
