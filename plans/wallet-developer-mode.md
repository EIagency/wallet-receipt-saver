# Wallet developer mode

## Status: completed

## Goal
Simulate a persisted Tesco £12.45 Wallet capture and use the same categorization route for simulated and real pending captures.

## Steps
- [x] Add GBP support and authenticated, rate-limited simulation using the real capture insert helper.
- [x] Add a shared capture categorization mutation and screen, reachable from real pending captures and the simulator.
- [x] Add Developer mode controls in Settings and a Pending tab for captured transactions.
- [x] Verify available diagnostics and user-test the flow.

## Decisions
- Settings pending list stays read-only; the Pending tab opens the shared categorization screen.
- Simulation creates real test records only when explicitly requested; no automatic seeding.
- Existing captures without provenance display Wallet; optional source supports historical records without rewriting data.

## Verification
- User confirmed the Settings simulator, GBP display, categorization, Pending removal, and expense creation work correctly.
- Added regression coverage for simulation, categorization idempotency, and cross-user access.
- Automated tests could not run: Bun runtime is unavailable in this sandbox. Bloom's log service also reports it could not be set up, so TS/ESLint verification is unavailable.
- Deployed simulator correctly rejected a diagnostic invocation without an authenticated identity; no record was created by that diagnostic.
