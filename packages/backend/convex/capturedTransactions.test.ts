import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-capture-secret-not-a-production-credential";
const payload = {
    merchant: "Test merchant",
    amountMinor: 12345,
    currency: "TRY" as const,
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
    await owner.mutation(api.captureSecretOwners.register, { secret, userId });
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

    it("stores a pending capture without creating an expense, returns response IDs and logs only merchant and amountMinor", async () => {
        const { t, userId } = await setupOwner();
        const body = { ...payload, rawNotificationText: "PRIVATE NOTIFICATION TEXT" };
        const recorded = await post(t, body);
        const duplicate = await post(t, { ...body, amountMinor: 999 });
        expect(recorded.status).toBe(200);
        expect(duplicate.status).toBe(208);
        const transactions = await t.run((ctx) => ctx.db.query("capturedTransactions")
            .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", payload.dedupeKey)).take(2));
        const expenses = await t.run((ctx) => ctx.db.query("expenses")
            .withIndex("by_userId_and_date", (q) => q.eq("userId", userId)).take(2));
        expect(transactions).toHaveLength(1);
        expect(transactions[0]).toMatchObject({ userId, status: "pending", category: null, amountMinor: payload.amountMinor });
        expect(transactions[0].createdAt).toBeTypeOf("number");
        expect(expenses).toHaveLength(0);
        expect(await recorded.json()).toEqual({ code: 200, id: transactions[0]._id });
        expect(await duplicate.json()).toEqual({ code: 208, existingId: transactions[0]._id, reason: "duplicate" });
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
        const userId = await t.run((ctx) => ctx.db.insert("users", {}));
        await expect(t.mutation(api.captureSecretOwners.register, { secret, userId })).rejects.toThrow("Authentication required");
        await expect(t.withIdentity({ subject: userId }).mutation(api.captureSecretOwners.register, { secret: "wrong", userId }))
            .rejects.toThrow("does not match");
    });

    it("stores only a fingerprint and does not allow another user to claim an existing mapping", async () => {
        const { t, owner, userId } = await setupOwner();
        await owner.mutation(api.captureSecretOwners.register, { secret, userId });
        const mapping = await t.run((ctx) => ctx.db.query("captureSecretOwners")
            .withIndex("by_userId", (q) => q.eq("userId", userId)).unique());
        expect(mapping?.secretHash).toMatch(/^[a-f0-9]{64}$/);
        expect(mapping?.createdAt).toBeTypeOf("number");
        expect(JSON.stringify(mapping)).not.toContain(secret);
        const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
        await expect(t.withIdentity({ subject: otherUserId }).mutation(api.captureSecretOwners.register, { secret, userId: otherUserId }))
            .rejects.toThrow("already belongs to another user");
        await expect(owner.mutation(api.captureSecretOwners.register, { secret, userId: otherUserId }))
            .rejects.toThrow("only register a capture secret for yourself");
    });

    it("stops authenticating the old secret immediately after rotation", async () => {
        const { t } = await setupOwner();
        vi.stubEnv("CAPTURE_SECRET", "rotated-secret");
        expect((await post(t)).status).toBe(401);
        expect((await post(t, payload, "Bearer rotated-secret")).status).toBe(401);
    });
});

describe("captured transactions", () => {
    it("enforces global dedupe keys across owners", async () => {
        const { t, userId } = await setupOwner();
        const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
        const first = await t.mutation(internal.capturedTransactions.record, { userId, ...payload });
        if (first.code !== 200) throw new Error("First capture should be new");
        const duplicate = await t.mutation(internal.capturedTransactions.record, { userId: otherUserId, ...payload });
        expect(duplicate).toEqual({ code: 208, existingId: first.id, reason: "duplicate" });
    });

    it("lists only the caller's pending captures in descending occurredAt order with pagination", async () => {
        const { t, owner, userId } = await setupOwner();
        for (const occurredAt of [1000, 3000, 2000, 4000]) {
            const result = await t.mutation(internal.capturedTransactions.record, {
                userId, ...payload, occurredAt, dedupeKey: `time-${occurredAt}`,
            });
            if (result.code === 200 && occurredAt === 4000) {
                await t.run((ctx) => ctx.db.patch(result.id, { status: "categorized", category: "food" }));
            }
        }
        const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
        await t.mutation(internal.capturedTransactions.record, {
            userId: otherUserId, ...payload, occurredAt: 5000, dedupeKey: "other-owner",
        });
        const first = await owner.query(api.capturedTransactions.listPending, {
            userId, paginationOpts: { numItems: 2, cursor: null },
        });
        expect(first.page.map((row) => row.occurredAt)).toEqual([3000, 2000]);
        expect(first.isDone).toBe(false);
        const next = await owner.query(api.capturedTransactions.listPending, {
            userId, paginationOpts: { numItems: 2, cursor: first.continueCursor },
        });
        expect(next.page.map((row) => row.occurredAt)).toEqual([1000]);
        expect(next.isDone).toBe(true);
        expect((await owner.query(api.capturedTransactions.listPending, { userId })).page).toHaveLength(3);
        await expect(t.query(api.capturedTransactions.listPending, { userId })).rejects.toThrow("Authentication required");
        await expect(owner.query(api.capturedTransactions.listPending, { userId: otherUserId }))
            .rejects.toThrow("only list your own");
    });
});
