# Transaction capture

`POST https://<deployment>.convex.site/capture`

## Owner registration

Set `CAPTURE_SECRET` in the backend environment to a random, high-entropy token (32+ characters recommended, no whitespace). While authenticated as the intended expense owner, call the public mutation `captureOwners:register` with `{ "secret": "<CAPTURE_SECRET>" }`. The mutation verifies the configured secret and stores only its SHA-256 fingerprint and the authenticated user's ID in `captureSecretOwners`. The same secret cannot be reassigned to another user. Register the owner before distributing the token to a capture client.

The endpoint returns `401` for a missing/invalid secret, a missing owner mapping, or a deleted owner. Never supply a user ID in the capture request. After rotating the environment secret, register the new token as its intended owner; old tokens immediately stop authenticating.

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

## Responses and writes

- `200`: `{ "status": "recorded" }`. Atomically inserts a capture record and an expense in the `other` category.
- `208`: `{ "status": "duplicate" }`. The owner's dedupe key already exists. No expense is inserted or changed, even if the retried payload differs.
- `400`: invalid JSON or payload.
- `401`: unauthorized. Includes `WWW-Authenticate: Bearer`.
- `413`: body too large.
- `429`: per-owner capture rate limit exceeded. Includes `Retry-After` in seconds.

Node's `timingSafeEqual` compares fixed-size SHA-256 digests of the supplied token and `CAPTURE_SECRET`. Verification runs in an internal Node action because Convex HTTP actions run in the default runtime. Owner lookup and recording functions are internal, not publicly callable mutations.

Only successful new records emit an application log containing `{ merchant, amountMinor }`. The HTTP handler never logs request bodies, headers, secret fingerprints, dedupe keys, or validation input. Capture records retain dedupe keys even if the related expense is later removed, so retries cannot recreate deleted expenses.

## Regression tests

`packages/backend/convex/capturedTransactions.test.ts` covers unauthorized requests, missing configuration, owner registration/ownership, Zod validation, body size limits, atomic replay/concurrent deduplication, expense creation, and restricted logging. Fixtures use `convex-test` only, never the live database.
