# Comment Automation — Facebook Messenger Automation Platform

A complete, working vertical slice of the larger platform: **Facebook Comment
Automation**. This covers the full path from an inbound Facebook comment
webhook through rule matching, action execution (like / hide / delete /
public reply / private Messenger reply), stats tracking, and the UI to
manage automations.

## What's fully built here

- **Database**: Prisma schema for Users, Workspaces, WorkspaceMembers,
  FacebookPages, Subscribers, Tags, CommentAutomation, AutomationExecutionLog,
  WebhookLog — with real indexes, foreign keys, and a unique constraint that
  enforces "reply once per user" at the database level.
- **Webhook ingestion**: signed (`X-Hub-Signature-256`, HMAC-SHA256, timing-safe
  comparison), verified against Meta's GET handshake, raw-body-based.
- **Queue processing**: BullMQ worker that matches each comment against every
  active automation on the page (keyword include/exclude, schedule window,
  day-of-week, hour range), respects per-automation delay via a real delayed
  job (not a blocking sleep), and re-checks "already handled" after the delay
  in case of a race.
- **Facebook Graph API client**: reply, like, hide, delete, private reply
  (comment → Messenger), standard Send API, long-lived token exchange, page
  webhook subscription.
- **Encrypted token storage**: AES-256-GCM, key from `TOKEN_ENCRYPTION_KEY`.
- **REST API**: JWT-protected, workspace-scoped CRUD + execution log endpoint,
  validated with `class-validator`.
- **Frontend**: Next.js App Router pages, React Hook Form + Zod (schema
  mirrors the backend DTO validation), TanStack Query for data fetching/cache
  invalidation, keyword tag input, live per-automation stats.

## Verified

- `npm install` succeeds for both `api/` and `web/`.
- `web/`: `tsc --noEmit` passes with zero errors, and `next build` completes a
  full production build successfully.
- `api/`: `tsc --noEmit` passes with zero errors **except** those caused by
  `@prisma/client`'s generated types not existing yet (see below) — every one
  of those errors disappears once `prisma generate` runs with normal internet
  access.

## One sandbox limitation

`npx prisma generate` needs to download a query-engine binary from
`binaries.prisma.sh`, which isn't reachable from this sandboxed environment's
allowed domains. Run it yourself once you have the repo locally:

```bash
cd api
npm install
npx prisma generate
npx prisma migrate dev --name init
```

## Explicitly out of scope for this slice

To keep this a genuinely complete, working piece rather than a shallow
sketch across ten features, these are **not** built here (they're separate
features from your spec and should be their own slices):

- Login / registration / password reset / 2FA / Google OAuth (the API
  assumes a valid JWT; `AuthModule` only validates tokens, it doesn't issue
  them yet)
- Facebook Page connection flow (OAuth consent screen, page picker) — this
  slice assumes a `FacebookPage` row already exists with an encrypted token
- The Flow Builder, Broadcasts, Live Chat, Analytics dashboard, Admin panel,
  Billing, Team management

`CommentAutomation.triggerFlowId` is reserved in the schema for when the Flow
Builder exists, but isn't wired to anything yet.

## Meta platform constraints (documented, not bypassed)

- **Private replies to comments** are only valid for **7 days** from the
  comment's creation time, and only once per comment — the code doesn't
  attempt to route around this.
- **Standard Messenger sends** (`sendMessengerMessage` in `FacebookGraphService`)
  are restricted to the **24-hour messaging window** or an approved message
  tag; `messaging_type` is passed explicitly rather than defaulted.
  Comment-triggered follow-ups in this feature use the private-reply endpoint
  specifically because it's Meta's sanctioned channel for this use case.
- **Rate limits**: BullMQ's default job options here use exponential backoff
  over 5 attempts; tune `defaultJobOptions` in `queue.module.ts` per your
  page's rate-limit tier as you scale.
- **Page access tokens expire**: `FacebookPage.tokenExpiresAt` is tracked so a
  future token-refresh job can proactively re-exchange tokens before they
  lapse — the refresh job itself isn't part of this slice.

## Running it

```bash
cp .env.example .env
# fill in FB_APP_ID, FB_APP_SECRET, FB_WEBHOOK_VERIFY_TOKEN, JWT secrets,
# and generate TOKEN_ENCRYPTION_KEY (command is in .env.example)

docker compose up -d postgres redis
cd api && npm install && npx prisma generate && npx prisma migrate dev --name init
npm run start:dev            # API on :4000

cd ../web && npm install
npm run dev                  # Web on :3000
```

Point your Facebook App's webhook subscription (Page → `feed`) at
`https://<your-domain>/api/webhooks/facebook`, verify token = whatever you set
for `FB_WEBHOOK_VERIFY_TOKEN`.

## API surface (this slice)

| Method | Path                              | Description                     |
|--------|-----------------------------------|----------------------------------|
| POST   | `/api/comment-automations`        | Create automation                |
| GET    | `/api/comment-automations`        | List (optionally `?facebookPageId=`) |
| GET    | `/api/comment-automations/:id`    | Get one                          |
| GET    | `/api/comment-automations/:id/logs` | Recent execution logs          |
| PATCH  | `/api/comment-automations/:id`    | Update                           |
| DELETE | `/api/comment-automations/:id`    | Delete                           |
| GET/POST | `/api/webhooks/facebook`        | Meta webhook verification + ingestion |

All `/comment-automations*` routes require `Authorization: Bearer <JWT>`.

## Next slice recommendation

Auth (issuing the JWTs this API already validates) or Facebook Page
Connection (creating the `FacebookPage` rows this feature depends on) are the
natural next pieces — either unblocks actually running this end-to-end
against a real Page.
