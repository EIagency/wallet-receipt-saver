import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-capture-secret-not-a-production-credential";
const payload = {
    merchant: "Test merchant",
    amountMinor: 12345,
    currency: "TRY",
    occurredAt: 1780000000000,
    dedupeKey: "test-key-1",
};

function setup() {
    const t = convexTest(schema, modules);
    rateLimiterTest.register(t);
    return t;
}

async function setupOwner() {
    const t = setup();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Capture owner" }));
    const owner = t.withIdentity({ subject: userId });
    await owner.mutation(api.captureOwners.register, { secret });
    return { t, owner, userId };
}

function post(t: ReturnType<typeof setup>, body: unknown = payload, authorization = `Bearer ${secret}`) {
    return t.fetch("/capture", {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.stubEnv("CAPTURE_SECRET", secret);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("POST /capture", () => {
    it("rejects missing, malformed, wrong and unmapped bearer secrets", async () => {
        const t = setup();
        for (const token of ["", "Basic abc", "Bearer wrong", "Bearer x", `Bearer ${secret} extra`, `Bearer ${secret}`]) {
            expect((await post(t, payload, token)).status).toBe(401);
        }
        expect(console.info).not.toHaveBeenCalled();
    });

    it("fails closed when CAPTURE_SECRET is missing", async () => {
        const { t } = await setupOwner();
        vi.stubEnv("CAPTURE_SECRET", undefined);
        expect((await post(t)).status).toBe(401);
    });

    it("records one expense, returns 208 on replay and logs only merchant and amountMinor", async () => {
        const { t, userId } = await setupOwner();
        const body = { ...payload, rawNotificationText: "PRIVATE NOTIFICATION TEXT" };
        expect((await post(t, body)).status).toBe(200);
        expect((await post(t, { ...body, amountMinor: 999 })).status).toBe(208);
        const transactions = await t.run((ctx) => ctx.db.query("capturedTransactions")
            .withIndex("by_userId_and_dedupeKey", (q) => q.eq("userId", userId).eq("dedupeKey", payload.dedupeKey)).take(2));
        const expenses = await t.run(async (ctx) => ctx.db.query("expenses")
            .withIndex("by_userId_and_date", (q) => q.eq("userId", userId)).take(2));
        expect(transactions).toHaveLength(1);
        expect(expenses).toHaveLength(1);
        expect(expenses[0]).toMatchObject({ userId, amountCents: payload.amountMinor, category: "other" });
        expect(transactions[0]).not.toHaveProperty("rawNotificationText");
        expect(console.info).toHaveBeenCalledExactlyOnceWith({ merchant: payload.merchant, amountMinor: payload.amountMinor });
    });

    it("deduplicates concurrent requests atomically", async () => {
        const { t } = await setupOwner();
        const responses = await Promise.all(Array.from({ length: 5 }, () => post(t)));
        expect(responses.map((response) => response.status).sort()).toEqual([200, 208, 208, 208, 208]);
    });

    it("rejects invalid JSON and oversized bodies", async () => {
        const { t } = await setupOwner();
        for (const [body, status] of [["{", 400], ["x".repeat(8193), 413]] as const) {
            const response = await t.fetch("/capture", {
                method: "POST",
                headers: { Authorization: `Bearer ${secret}` },
                body,
            });
            expect(response.status).toBe(status);
        }
    });

    it.each([
        { ...payload, merchant: "m".repeat(121) },
        { ...payload, dedupeKey: "k".repeat(65) },
        { ...payload, amountMinor: 0 },
        { ...payload, amountMinor: -1 },
        { ...payload, amountMinor: 1.5 },
        { ...payload, amountMinor: Number.MAX_SAFE_INTEGER + 1 },
        { ...payload, currency: "GBP" },
        { ...payload, occurredAt: "1780000000000" },
    ])("rejects invalid payload %#", async (body) => {
        const { t } = await setupOwner();
        expect((await post(t, body)).status).toBe(400);
        expect(console.info).not.toHaveBeenCalled();
    });

    it.each(["TRY", "USD", "EUR"])("accepts %s and maximum string lengths", async (currency) => {
        const { t } = await setupOwner();
        expect((await post(t, { ...payload, currency, merchant: "m".repeat(120), dedupeKey: "k".repeat(64) })).status).toBe(200);
    });
});

describe("capture secret ownership", () => {
    it("requires authentication and proof of the configured secret", async () => {
        const t = setup();
        await expect(t.mutation(api.captureOwners.register, { secret })).rejects.toThrow("Authentication required");
        const userId = await t.run((ctx) => ctx.db.insert("users", {}));
        await expect(t.withIdentity({ subject: userId }).mutation(api.captureOwners.register, { secret: "wrong" }))
            .rejects.toThrow("does not match");
    });

    it("stores only a fingerprint and does not allow another user to claim an existing mapping", async () => {
        const { t, owner, userId } = await setupOwner();
        await owner.mutation(api.captureOwners.register, { secret });
        const mapping = await t.run((ctx) => ctx.db.query("captureSecretOwners")
            .withIndex("by_userId", (q) => q.eq("userId", userId)).unique());
        expect(mapping?.secretHash).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.stringify(mapping)).not.toContain(secret);
        const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
        await expect(t.withIdentity({ subject: otherUserId }).mutation(api.captureOwners.register, { secret }))
            .rejects.toThrow("already belongs to another user");
    });

    it("stops authenticating the old secret immediately after rotation", async () => {
        const { t } = await setupOwner();
        vi.stubEnv("CAPTURE_SECRET", "rotated-secret");
        expect((await post(t)).status).toBe(401);
        expect((await post(t, payload, "Bearer rotated-secret")).status).toBe(401);
    });
});
