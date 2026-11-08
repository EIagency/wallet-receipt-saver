import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError } from "convex/values";
import { captureRateLimitSchema, captureSchema } from "../lib/capture";

const MAX_BODY_BYTES = 8192;

export const capture = httpAction(async (ctx, request) => {
    const authorization = request.headers.get("Authorization");
    if (!authorization || authorization.length > 4103) return unauthorized();
    const userId = await ctx.runAction(internal.captureAuth.authenticate, { authorization });
    if (!userId) return unauthorized();

    // Bound the actual stream as Content-Length is not trustworthy (or required).
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Invalid JSON body" }, 400);
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            byteLength += value.byteLength;
            if (byteLength > MAX_BODY_BYTES) {
                await reader.cancel();
                return json({ error: "Request body is too large" }, 413);
            }
            chunks.push(value);
        }
    } catch {
        return json({ error: "Unable to read request body" }, 400);
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    let input: unknown;
    try {
        input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
        return json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = captureSchema.safeParse(input);
    if (!parsed.success) return json({ error: "Invalid capture payload" }, 400);
    try {
        const result = await ctx.runMutation(internal.capturedTransactions.record, { userId, ...parsed.data });
        return json(result, result.code);
    } catch (error: unknown) {
        if (error instanceof ConvexError) {
            const rateLimit = captureRateLimitSchema.safeParse(error.data);
            if (rateLimit.success) {
                return json({ error: "Capture rate limit exceeded" }, 429, {
                    "Retry-After": String(Math.max(1, Math.ceil(rateLimit.data.retryAfterMs / 1000))),
                });
            }
        }
        throw error;
    }
});

function unauthorized(): Response {
    return json({ error: "Unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
}

function json(body: Record<string, string | number>, status: number, extraHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
    });
}
