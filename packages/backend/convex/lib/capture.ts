import { z } from "zod";
import { v } from "convex/values";

export const captureSchema = z.object({
    merchant: z.string().max(120),
    amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.enum(["TRY", "USD", "EUR", "GBP"]),
    occurredAt: z.number().finite(),
    dedupeKey: z.string().max(64),
});

export const captureRateLimitSchema = z.object({
    code: z.literal("CAPTURE_RATE_LIMITED"),
    retryAfterMs: z.number().nonnegative(),
});

export const captureFields = {
    merchant: v.string(),
    amountMinor: v.number(),
    currency: v.union(v.literal("TRY"), v.literal("USD"), v.literal("EUR"), v.literal("GBP")),
    occurredAt: v.number(),
    dedupeKey: v.string(),
};

// Store only a SHA-256 fingerprint, never the capture secret itself.
export async function hashCaptureSecret(secret: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
