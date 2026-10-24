# Task 3/3 — Public PDF Tool and guest ownership

## Task level
Initial and final: Level 3. Adds an authorization boundary, guest cookie and additive migration 0028.

## Problem
The original PR #7 required a teacher login, while the approved experience is public /tools without any login. The previous UI also failed TypeScript/production build. Visitors must not gain another visitor's history or the teacher's private PDF history.

## Decision
Keep the original authenticated /api/pdf contract unchanged. Add separate /api/public/pdf endpoints using a 256-bit opaque HttpOnly, SameSite=Strict guest cookie bound to persisted ownership. Public GET history shows only the issuing browser's batches; create/retry/download require the same guest. POST mutations enforce the exact public site Origin. The existing teacher owner's quotas apply across all guests, plus IP-level fixed-window limits for guest sessions and submissions. A browser can lose its history if the cookie is deleted. All processing remains disabled in production until the previously agreed cloud activation.

## Changes
- Header/tools palette uses pastel pink, not lavender.
- Public /tools contains the Drive link input, rights confirmation, status/history and ticketed download.
- Schema migration 0028 adds guest session token hashes and a join table binding guest sessions to PDF batches; existing migration 0027 is unchanged.
- Anonymous session issuance is server-side and conditional on PDF capabilities enabled. The cookie is never sent to Google or placed in a URL.
- The background outbox/reconciler remains independent of browser lifetime; existing private Worker v1 unchanged.
- PDF name shown to the user is currently a fallback based on Drive file ID because Worker v1 does not return source display names.
- No automatic Google Drive archive, public GCS access, cloud deployment or new PDF processing dependency on VPS.

## Verification
PR #7 GitHub CI is the only remote verification here; do not claim a PASS before all required jobs succeed. The existing browser smoke has been adapted for public unavailable-state behavior, with simulated API responses. Real cloud E2E and guest-enabled MySQL HTTP tests are still required before release.

## Rollback
Keep processing disabled. Revert branch code and public routes if needed; preserve new guest tables and historical batch records. Never drop tables or remove private buckets during rollback.

## Remaining risks
The public guest model adds untrusted submissions and shared capacity. IP limits are in-process only; abuse protections, same-origin rules, migration rehearsal, token expiry, cookie-proxy behavior and private-cloud end-to-end must be validated before activation. Guest ownership shares the single active teacher's durable producer account but cannot query teacher history through public routes. No real producer identity has been approved; activation remains blocked. The 24-hour result expiry still applies, even though metadata/history can remain longer. For durable PDF links after 24 hours a separate retention/storage decision is needed.
