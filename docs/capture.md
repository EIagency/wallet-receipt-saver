# Transaction capture endpoint

`POST /capture` accepts structured transaction data, resolves its owner from a hashed secret mapping, and stores a pending captured transaction. It does not create an expense before categorization. Authentication uses `Authorization: Bearer <CAPTURE_SECRET>` with a constant-time comparison.

## Register an owner

While authenticated as the intended owner, call `captureSecretOwners:register` with `{ "secret": "<CAPTURE_SECRET>", "userId": "<your users document ID>" }`. Registration verifies both the authenticated user ID and configured secret, stores only its SHA-256 hash and `createdAt`, and prevents another owner from claiming the same hash. Use a random, high-entropy token (32+ characters recommended, no whitespace). No plaintext secret is stored or indexed. Register the owner before distributing the token to a capture client.

## Request

Header: `Authorization: Bearer <CAPTURE_SECRET>`

```json
{
  "merchant": "Merchant name",
  "amountMinor": 12500,
  "currency": "TRY",
  "occurredAt": 1780000000000,
  "dedupeKey": "stable-source-event-id"
}
```

- `merchant`: string, at most 120 characters.
- `amountMinor`: positive, safe integer in minor currency units.
- `currency`: `TRY`, `USD`, or `EUR`.
- `occurredAt`: finite numeric Unix timestamp in milliseconds.
- `dedupeKey`: string, at most 64 characters; unique per owner, not per token. Use a stable nonempty event identifier.
- Request bodies are limited to 8 KiB. Unknown JSON fields are stripped by Zod and are not forwarded or stored. Clients should never send raw notification text.

## Responses

- `200`: `{ "code": 200, "id": "<capturedTransactions ID>" }`. A new record has `status: "pending"`, `category: null`, and a server-generated `createdAt`.
- `208`: `{ "code": 208, "existingId": "<original ID>", "reason": "duplicate" }`. Dedupe keys are globally unique across owners; replay does not overwrite the original record.
- `400`: invalid JSON or payload, including fractional/nonpositive `amountMinor`, unsupported currency, or fields exceeding size limits.
- `401`: missing, malformed, incorrect, or unregistered bearer secret.
- `413`: body exceeds 8 KiB.
- `429`: owner exceeded the capture rate limit; see `Retry-After`.

Convex supplies document IDs as `_id`; the mutation responses expose them as `id`/`existingId`. User IDs are validated string IDs referencing `users`. Convex indexes are not SQL-style unique constraints: registration and recording enforce uniqueness atomically using indexed lookups in the same transaction as insertion.

## Pending transactions

Call `capturedTransactions:listPending` with `{ "userId": "<your users document ID>" }`. It requires authentication and rejects requests for another user's records. Results are ordered by `occurredAt` descending and returned as `{ page, isDone, continueCursor }` (with optional Convex page-split metadata). The default first page has 50 rows. To page explicitly, pass `paginationOpts: { numItems: 50, cursor: null }`, then use the returned `continueCursor` for the next page.

Captured transactions default to pending in `capturedTransactions:record`, which is internal-only so callers cannot forge ownership. Unknown notification fields are discarded. Only `merchant` and `amountMinor` are explicitly logged; bodies and credentials are never logged by capture code. Rotating `CAPTURE_SECRET` immediately invalidates the old bearer token; register the new secret before capture resumes.

## Regression tests

`packages/backend/convex/capturedTransactions.test.ts` covers unauthorized requests, missing configuration, owner registration/ownership, Zod validation, body size limits, atomic replay/concurrent deduplication, expense creation, and restricted logging. Fixtures use `convex-test` only, never the live database.
