# API Rules

## Logging

`apps/api/src/logging`. `new Logger(Thing.name)` picks up `ContextLogger`. **Never
`console.log`.** Format follows `NODE_ENV` and is not configurable.

- **One object, not extra arguments** — `logger.log({ message: "Saved", userId })`;
  Nest prints a line per argument.
- **Errors pass the stack second** — `logger.error({ message }, err.stack)`. Passing
  the error object drops the trace.
- **Never log headers, query strings, or bodies** — cookies and personal data.
- **`LoggingModule` stays first in `AppModule`'s imports**, and Better Auth routes log
  via its own `middleware` option — it mounts before `MiddlewareConsumer`, so
  `/api/auth/*` never reaches ours.
- `requestId` from `RequestLoggerMiddleware` via `AsyncLocalStorage`;
  `UserContextInterceptor` adds `userId`. Prisma statements are opt-in
  (`PRISMA_LOG_QUERIES`).

## Intelligence never lives in the API

The API serves HTTP, auth, tRPC and the mailbox sync. It does **not** research, enrich,
score, summarise, match identities or decide anything about a person or company — not
as a fallback, not behind a flag. That is the eve agent in `apps/agent`, which owns
the vendor clients, the confidence model and the writes.

Nest's half is to report *that something happened*: `AgentTriggerService` writes an
`AgentTask` row. A row, not an HTTP call — the agent already leases from that table,
so the row survives the agent being down.

About to add a vendor client to `apps/api`? You want `apps/agent/agent/lib`. One
documented exception, for timing: the exchange-rate fetcher, below.

## One organization, and it is not a tenancy boundary

Single tenant. No org header, no org interceptor, no org-scoped cache keys, **no
`organizationId` on any CRM record.**

A **singleton workspace** exists — Better Auth's `organization` plugin, one row with
id `WORKSPACE_ID` (the literal `workspace`, in `@crm/db`, re-exported by `@crm/auth`
so the agent needn't depend on it). It answers only: what are we called, who works
here, what do we sell.

- **The id is a constant, never a parameter.** A function taking an `organizationId`
  has turned the plugin into tenancy plumbing.
- **Signing in is the join; no invite flow.** `ensureWorkspaceMembership` runs in
  `databaseHooks.session.create.before` and **degrades, never throws** — a throw fails
  the session create and locks everyone out. The plugin's `invitation` table is unused.
- **First account is owner**, and the hook enrols pre-existing users, oldest first.
- **Permissions come from `@crm/auth`** — `canRenameWorkspace`, `canChangeRole`,
  `canConfigureSso`, `canManageCurrency` — enforced by the service *and* used to
  disable the UI control, so the button and the 403 cannot disagree.
  `WorkspaceService` adds one invariant: **the last owner cannot be demoted**, with
  `FOR UPDATE` on the owner rows before counting.
- **Reads and writes go through tRPC**, not `authClient.organization.*`.
- **Name and website are required at onboarding and cannot be skipped**, in the form
  *and* in `updateWorkspaceInput`, posting the same `workspace.update` as settings.
- **Onboarded state is `onboardedAt` inside the plugin's `metadata` blob**, not a
  column; `isOnboarded`/`markOnboarded` (`@crm/db/workspace`) are the only accessors,
  and `markOnboarded` preserves every other key.
- **The name starts as `DEFAULT_WORKSPACE_NAME` (`CRM`), a placeholder not an
  answer.** The header renders `<name> CRM`, so `workspaceLabel` tests the name rather
  than comparing to the default.
- **The website queues the agent's `workspace-profile` task** and goes through
  `normalizeDomain`, rejecting null. Stored canonical, so re-saving uncanonically
  counts as a change and re-queues research.

### Gates in `proxy.ts`

Onboarding, then `/onboarding/research` for the Context key. Asked server-side every
request.

- **`getSessionCookie()` decides signed-in**; pages still resolve the real session via
  `requireMailboxAccess()`.
- **Nothing is cached in a cookie** — both facts revert on a database reset while a
  year-long marker insists the gate passed. Cache in the API if cost ever matters.
- **Both reads run concurrently**, but order decides which is *asked* — the research
  read is never made while onboarding is open.
- **An unreachable API fails open** (`unknown` lets the request through). The read
  waits `GATE_TIMEOUT_MS`, which has to outlast a cold start of the API: a signed-in
  rep whose gate read times out at `/` is shown the landing page.
- **`RESEARCH_KEY_OPTIONAL` skips the key gate** and its read. See `environment.md`.
- **`/sign-in`, `/grant-access`, `/eve` are ungated.** `/sign-in` is the only path a
  stranger may read; `/` joins it only when `IS_MARKETING` is set.
- **There is no way past the key gate but to answer** — Skip stranded installs, every
  later company sitting `PENDING` with nothing saying so.

### The name is also the URL

Served under the workspace slug (`/comp-ai/companies`). **Cosmetic, not tenancy** —
every query still resolves through `WORKSPACE_ID`.

- **The slug is the plugin's column**, written by `workspaceSlug(name)`
  (`@crm/db/workspace`) on rename and create. **Never derive it on read.**
- `ensureWorkspaceMembership` reconciles it; `RESERVED_SLUGS` prevents collision with
  a real route (a collision gets `-crm`).
- **The proxy is the only thing that puts the slug on.** Missing or stale slugs are
  redirected with the query string intact, not 404'd; `[slug]/layout.tsx` is the
  backstop.
- `appPath` in `proxy.ts` is the one place `/` resolves for a signed-in rep, which
  keeps every `callbackURL` correct without knowing about slugs.
- **Renaming moves the URL**, so `workspace-form.tsx` replaces the location onto the
  slug `workspace.update` returns.

## SSO is a row, not a deployment

An `ssoProvider` row via Better Auth's `sso` plugin, on Settings → SSO, because a
self-hoster's admin cannot redeploy.

- **OpenID Connect only** — issuer, client id, secret; endpoints from discovery. No
  SAML UI: it needs an X.509 cert and SP signing key we have nowhere to keep.
- `SsoService` passes `WORKSPACE_ID`, never an input.
- **Management is tRPC (`sso.*`); signing in is `authClient.signIn.sso()`.**
- **`sso.signInOptions` is the one public procedure in the app.** Every other `sso.*`
  takes `AuthMiddleware` at the *method*, which is what leaves it open. A client
  secret is never read back out.
- **It is the API's answer, not the app's** — the API serves `/api/auth/*`.
- **An install with no Google, no Microsoft and no provider says so**, naming the
  variables; a read that *fails* falls back to offering Google.
- **A provider hides the social buttons, it does not disable them** —
  `/sign-in?method=google` and `?method=microsoft` still work, so a mistyped issuer
  cannot lock an admin out.
- **Signing in with an IdP does not cost you Gmail.** `needsMailboxGrant` (`@crm/auth`)
  walls only an account whose sign-in rows are *all* mailbox providers — Google,
  Microsoft, or both — and none of them granted. `mailboxGrantsNeeded` returns which,
  so `/grant-access` offers the button they can actually use.
- `ALLOWED_SIGN_IN` still decides who gets an account, in
  `databaseHooks.user.create.before`, for SSO sign-ups too.
- `organizationProvisioning: { disabled: true }` — `ensureWorkspaceMembership` already
  does the join.

## tRPC is the data surface; REST is auth and health only

- **One router per module**, `*.router.ts` (the codegen glob), with
  `@Router({ alias })` and `@UseMiddlewares(AuthMiddleware)`. **No `AuthMiddleware`
  means public — there is no other guard.**
- **Routers are thin**: zod in, service call out; Prisma lives in `*.service.ts`.
- Services throw Nest's `HttpException` family; `DomainErrorMiddleware` maps them.
- **Filter, sort and paginate in Prisma.** List procedures take `listInput` and return
  `{ rows, total, facetCounts }`. Never filter a whole table in the browser; never
  interpolate `sort` into a field name — use `resolveOrderBy`.
- **`src/generated/server.ts` is generated *and committed*, and `build` must never
  regenerate it** — the generator needs GLIBC 2.39, newer than Vercel's build image.
  Only `check-types` and `dev` run it. If the app cannot see a new procedure, it has
  not run.

## The OpenAPI document is built at runtime, not committed

`GET /openapi.json` serves one document: Nest's own controllers plus a REST bridge
under `/rest` generated from every tRPC procedure. Swagger UI renders it at `/`.
`createApp` builds both halves and merges them, so nothing is generated at build
time and no file is checked in — the document is whatever the routers are.

`SwaggerModule.setup` runs **before** `app.init()`, because it registers its Express
routes synchronously and Nest's own routing would otherwise shadow them. The factory
form defers building the document to the first request, which is what lets it read
the tRPC router that only exists after init.

Two rules follow for the serverless build:

- `@nestjs/swagger` stays in `EXTERNALS` in `apps/api/scripts/build-func.mjs`, because
  `swagger-ui-dist` resolves its assets from disk at runtime and cannot be bundled.
- Anything external must be **vendored**, and vendoring follows non-optional
  `peerDependencies`, not only `dependencies`. Nest packages declare their runtime
  needs as peers, so following `dependencies` alone ships a function that throws
  `MODULE_NOT_FOUND` on the first request. Adding a name to `EXTERNALS` without
  checking it lands in `.vercel/output` breaks production, and the build stays green.

## Two mail providers, one pipeline

`apps/api/src/mailbox` is everything neither Google nor Microsoft owns:
`MailboxApiClient` (bearer GET, and the one place a status code becomes an outcome),
`SyncStateService` (the `MailboxSync` row), `MailboxTokenService`,
`MailboxMatchService`, `participants.ts`, `message-text.ts`, and
`ThreadWriterService`.

- **`ThreadWriterService.store` is the only writer of `EmailThread`, `EmailMessage`
  and the `EMAIL` activity.** Gmail and Outlook each parse their own wire format down
  to one `IncomingMessage` and hand it over; matching, threading, counting and
  stamping happen once. A second copy of that is how a rule like *reply before you
  create a company* comes to be true in one inbox and not the other.
- **A thread is keyed by RFC message id, not by the provider's thread id.** Root comes
  from `References` → `In-Reply-To` → own `Message-ID`, so a rep on Gmail and a rep on
  Outlook land on the same `EmailThread` for the same conversation. Graph only returns
  `internetMessageHeaders` when `$select`ed and not for every message, so Outlook falls
  back to `outlook-conversation:<conversationId>` — threading that still holds inside
  Outlook, just not across to Gmail.
- **`MailboxSync.source` is the discriminator** — `calendar`, `gmail`, `outlook`,
  `imap`, `asana`. Each provider's module only ever sees its own, and `sync/mailbox-sync.service.ts` is the
  one place that dispatches. One cron, one budget:
  `POST /internal/sync/mailboxes` (`/google` is kept as an alias so an existing
  deployment's cron keeps working).
- **Gmail is forward-only from a `historyId`, Outlook from a timestamp.** Graph has no
  mailbox-wide delta, so the Outlook cursor is the last `receivedDateTime` seen,
  re-read with a one-second overlap; `rfcMessageId` is unique, so the overlap costs a
  duplicate fetch and never a duplicate row.
- **Microsoft has no token-revocation endpoint.** `revoke` clears the columns and the
  UI says the consent itself is removed in the user's Microsoft account. Google's still
  posts to `oauth2.googleapis.com/revoke` and refuses to clear if that fails.

## IMAP is a third mail source, and it is configured, not typed

`apps/api/src/imap` reads a mailbox no OAuth provider owns — a hosting company's
mail server, an on-premise one. It hands `ThreadWriterService` the same
`IncomingMessage` Gmail and Outlook do, so nothing downstream knows the difference.

- **The host is the install's, never the rep's.** `IMAP_HOST` (and `IMAP_PORT`,
  default 993) are environment variables. A rep supplies an address and a password
  and nothing else, so the API only ever opens a socket to one known server. A host
  field on the form is an SSRF primitive for every signed-in member.
- **Implicit TLS on 993, STARTTLS required anywhere else.** `ImapClient` sets
  `doSTARTTLS: true` off 993, so a server that offers neither is refused rather than
  sent a password in cleartext. Loopback is the one exception, for a local test server.
- **The password is sealed, not stored.** `CredentialVaultService` (`mailbox/`) is
  AES-256-GCM under a key derived from `BETTER_AUTH_SECRET` with HKDF. `open` returns
  `null` for anything it cannot read, and a `null` is `NEEDS_RECONNECT`, never a throw:
  rotating the auth secret asks reps to reconnect, it does not break the tick.
- **`ImapCredentialsService` is the only reader of `imapConnection`.** Nothing returns
  the secret, and no log line carries it.
- **The cursor is a UID per folder, with its `UIDVALIDITY`**, as JSON in
  `MailboxSync.cursor` (`imap-cursor.ts`, parsed with Zod). A changed `UIDVALIDITY`
  restarts that folder from the window; `rfcMessageId` is unique, so a restart costs
  fetches and never rows.
- **Sent is read before the inbox.** `store` only creates a company for somebody the
  rep has replied to, so the reply has to exist before the message it answers is
  judged. Reading the inbox first files an import as a list of strangers.
- **IMAP is the one source that looks back.** The first check starts
  `IMAP.backfill.windowMs` (30 days) before now, because a mailbox connected to an
  empty CRM is otherwise empty for a month. Gmail and Outlook stay forward-only.
- **One tick reads at most `IMAP.tick.maxMessages` in `IMAP.tick.budgetMs`.** The
  cursor's `importing` flag says more is waiting; `imap.status` returns it and the
  connection page keeps calling `imap.syncNow` from the click that started it. The
  cron finishes whatever a closed tab left.
- **Bodies are one part, not the message.** `textPartOf` picks `text/plain`, else
  `text/html`, and `download` fetches only that part, capped at `IMAP.body.maxBytes`.
  Attachments are never downloaded.

### The mailbox is also a way in

`IMAP_SIGN_IN` lets a rep sign in with the address and password of a mailbox on
`IMAP_HOST`. It exists for a team with no Google, Microsoft or SSO account to sign in
with. It is `POST /api/auth/sign-in/imap`, a Better Auth plugin in
`packages/auth/src/imap-sign-in.ts`, so it is auth and stays off tRPC.

- **The mail server is the identity provider.** A login it accepts for
  `rep@acme.com` is the proof that the caller owns `rep@acme.com`. The login name is
  always the address, never a separate username.
- **`IMAP_SIGN_IN` lists mail domains, it is not a switch.** Only an address at a
  listed domain is tried. An allowed address whose mail is hosted elsewhere must not
  be accepted from this server: somebody else could register that address there.
  The match is exact, so a subdomain is not included.
- **`ALLOWED_SIGN_IN` still decides.** `acceptsImapSignIn` checks both lists before
  the mail server is asked anything, and `user.create.before` checks again.
- **`@crm/auth` cannot open a socket, so the API hosts the check.**
  `ImapSignInService` registers `verify` and `connect` with `hostImapSignIn` at
  module init, the same shape as `onSignedIn`. No host means `503`, never a pass.
- **Three answers, not two.** `refused` is `401`, `unavailable` is `503`. A server
  that is down must not tell a rep the password is wrong.
- **No password is stored for sign-in.** The `account` row has provider `imap` and
  no secret. Every sign-in asks the mail server again.
- **Signing in connects the mailbox.** `ImapConnectionService.remember` seals the
  password and ensures the `MailboxSync` row, so the rep does not type it twice and
  a changed password heals `NEEDS_RECONNECT` at the next sign-in. A new row starts
  with `IMAP.signIn.autoCreate`; an existing row keeps what the rep chose. A failed
  save is logged and never fails the sign-in.
- **The form leaves with a full page load, never `router.replace`.** The sign-in page
  links to `/`, the router prefetches it signed out, and the cached answer is a
  redirect back to `/sign-in`: a client navigation after signing in goes nowhere.
- **The endpoint is always mounted and answers `404` when the variable is unset**,
  so the client type does not depend on the environment.
- **`IMAP_SIGN_IN.attempts` is the rate limit**, declared on the plugin. Behind the
  app proxy every caller shares one bucket, so it is a ceiling on guessing for the
  whole install.
- **`sso.signInOptions` returns `imap`**, and the sign-in page shows the form above
  the other buttons. `needsMailboxGrant` ignores an `imap` row, like an SSO rep.

## Asana is the agenda where there is no calendar

`apps/api/src/asana` is the calendar's counterpart for a team whose mail server has
none. It is a sync, like the mailbox — not enrichment — which is why it may live here.

- **One project per rep, chosen once.** A personal access token, sealed in the same
  vault, and the gid of the project that holds their commitments
  (`asanaConnection`). Per rep and not per workspace: a shared token would let any
  member read any project its owner can.
- **A dated open task is a `TASK` activity**, owned by the rep, keyed by
  `activity.asanaTaskGid`. `due_at` wins; a bare `due_on` ends with its day
  (`ASANA.task.dateOnlyDueTime`). Undated tasks are not agenda and are skipped.
- **Only the window is brought in** — `ASANA.window`, 30 days back to 180 ahead — but
  a task already tracked is followed wherever it is rescheduled to.
- **Completion is read from absence.** Each check lists every open task; a tracked
  task that is no longer in that list is completed here. When the list was cut short
  (`ASANA.api.maxTaskPages`) nothing is completed, because absence proves nothing.
- **Nothing is sent.** Completing a task in the CRM does not complete it in Asana.
- **A task is filed on a contact only by an address written in it.** The name and
  notes are searched for email addresses and matched exactly against `contact.email`.
  No name matching, no guessing — that would be the agent's job, not the API's.
- **Asana payloads are parsed with Zod in `asana.client.ts`**, and a payload that does
  not parse is a failed check with a plain reason, not a half-read task.

## Not every address on a thread is a person

`externalParticipants` (`mailbox/participants.ts`) is the one gate, discarding **us**
(allow-list domains, `User` table), **rep decisions** (`SuppressedContact`,
`SuppressedDomain`), and **addresses no human reads**.

- **`isMachineDomain` (`companies/domain.ts`) sits beside `FREE_EMAIL_DOMAINS`**;
  `domainFromEmail` returns null for both, and `companyForEmail` is the only path from
  address to company — so a caller ignorant of the rule still cannot create one.
  `.calendar.google.com` covers shared calendars, rooms and ICS feeds.
- **Matches the host, never a substring** — `calendar.acme.com` is a real company.
- **`isMachineAddress` also catches opaque local parts** (24 hex chars, UUIDs),
  deliberately narrow: a false positive is a real customer never filed.
- **It leaves no row** — a rep may still type these into quick-add; only the *inbox*
  is barred from deciding. `syncAttendees` filters the same addresses beside
  `attendee.resource`.
- **`isAutomatedAddress` is a separate list about the local part** (`sales@`,
  `noreply@`), which is why `support@acme.com` never becomes a lead.

## People on a deal

`DealContact` is the join, and `deals.attachContact` / `detachContact` /
`setContactRole` are the only ways to write it. `deals.contactOptions` is what the
picker reads.

- **A contact on a deal works at that deal's company**, enforced in the service and
  not merely by the picker — the same rule as `companies.setPrimaryContact`.
- **Attaching is an upsert and re-attaching keeps the role already there**, so a
  double click cannot blank what somebody typed.
- **Detaching removes the row, never the contact.** They stay in the CRM, on the
  company, with their history.
- **`role` is blanked to null, never stored as `""`** — `blankToNull`, as everywhere
  else.

## Deleting a record is archive first, purge later

`contacts.archive`, `companies.archive`, `deals.archive` set `archivedAt`. Nothing
else changes — no suppression, no cascade cleanup, no stamp recompute — because the
row is still there, just filtered out of every list.

- **`archivedFilter(input.archived)` is in every `buildWhere` and every `facetCounts`
  where.** A list call defaults to `archived: false`; the Archived view is the same
  procedure with `archived: true`. There is no third "everything" mode — mixing
  active and archived rows in one table is exactly what this feature removes.
- **`archive`/`restore` are a bare `update({ archivedAt })`, nothing more.** They do
  not touch `AgentTask`, `SuppressedContact`, or `lastActivityAt` — the record is
  unchanged, only hidden.
- **`purge` is the old `delete`.** Same transaction, same suppression, same
  `AgentTask`/`AgentEvent` cleanup, same `ActivityStampService.recomputeAfterDelete`.
  Read the rest of this section as `purge`'s contract, not `archive`'s.
- **A rep can `purge` straight from the Archived view — retention is a ceiling, not a
  wait.** `bulkPurge`/the per-record "Delete forever" action call it directly, no
  different from the cron.

**Pruning**: `ArchiveRetentionController` (`internal/archive/prune`, `CRON_SECRET`-gated,
`apps/api/vercel.json`) reads `AppSetting.archiveRetentionDays`
(`readArchiveRetentionDays`, `@crm/db/settings`, default 180) and calls each service's
`purgeExpired(before)` — `findMany({ archivedAt: { lte: before } })` capped at
`ARCHIVE.prune.maxBatch` (`archive/archive-config.ts`), then `purge` per row through
the ordinary `runBulk`. Settings → General has the day count
(`settings.archiveRetention` / `setArchiveRetention`).

Below is `purge`'s contract — everything that used to be `delete`'s:

- **A purged contact is suppressed by address**, or the sync recreates them from the
  next thread. `ContactsService.purge` writes `SuppressedContact`, and
  `externalParticipants` drops it like a `SuppressedDomain` — one filter covering
  contact creation, company auto-creation and attribution.
- **Keyed lower case.** `normalizeEmail` (`crm/values.ts`) is the one canonicaliser,
  on `contacts.create`, `.update` and the suppression; conflict checks and `allowAgain`
  match case-insensitively.
- **The address comes from the delete itself**
  (`tx.contact.delete({ select: { email: true } })`), not a read before it — and the
  404 is that statement's own `P2025` through `translate`.
- **Adding them back lifts the suppression** via `allowAgain` **inside the write's
  transaction**. Never automatic.
- **Purging a company does not suppress its domain** — its people survive with no
  company, and domain suppression stays the explicit Settings → Connections control.
- **Clear `AgentTask` and `AgentEvent` yourself** — they carry `contactId`/`companyId`
  with no foreign key, so nothing cascades.
- **Recompute `lastActivityAt` on exactly the records the purge reached.**
  `ActivityStampService.targetsOf(where)` collects them *inside* the transaction (the
  evidence is what gets deleted); `recomputeMany` restamps. A company's `where` must
  follow its deals: `{ OR: [{ companyId }, { deal: { companyId } }] }`.
  `recomputeAll()` is for a purge only.
- **Recompute after commit, logging rather than throwing** — the row is already gone,
  and a raised error makes the browser skip invalidation and retry into a 404.

## A mirror is pushed in, and the other system stays the master

`mirror.push` (`POST /rest/mirror/push`, with the API key of an owner or an admin)
is how a system that already holds the customer base — an order portal, an ERP —
keeps a copy of it here. `mirror.status` reports what each source has sent.
`apps/api/src/mirror` is the whole feature and `MIRROR` (`mirror-config.ts`) holds
its limits.

- **The API does not match identities here either.** The sender names every record
  with its own `externalId`, and `MirrorRecord` (`source`, `entity`, `externalId`)
  is the only link. The two adoptions are exact-key reads, not matching: a company
  at the same normalised domain, a contact with the same address.
- **Pushed again, a record is updated, never duplicated.** `hash` is the SHA-256 of
  the record as sent, and an equal hash returns `unchanged` without a write.
- **Every record is saved under `pg_advisory_xact_lock` and re-read inside its
  transaction** (`claim`). A sender that times out retries while the first request
  is still running; without the lock both requests create the company.
- **One record is one transaction, and a bad record does not fail the batch.** It
  comes back in `failed` with a reason and the rest are saved.
- **Mirrored companies and contacts are `source: IMPORT`,
  `enrichmentStatus: SKIPPED`, and write no `AgentTask` and no CRM event.** The base
  is already known, and researching a few hundred customers on arrival spends
  credits nobody asked to spend.
- **History keeps its own dates.** `createdAt`, `closedAt`, `stageChangedAt` and an
  activity's `occurredAt` come from the push, so a deal won in March counts in
  March.
- **A stage that moves writes a `STAGE_CHANGE` activity**, dated at the close when
  there is one.
- **The sender owns what it sends.** A push overwrites it, so an edit made in the CRM
  lasts only until that record changes at the source. On a company or a contact an
  empty value never blanks what is there; a deal is written whole. A record that
  disappears at the source is not removed here.
- **Owners are named by e-mail.** An unknown address leaves a deal with the key's
  user, `MirrorRecord.ownerEmail` remembers whose it is, and `reconcileOwners` hands
  the records over on the first push after that person signs in.
- **`fields` creates the custom fields it names** with `agentFilled: false`, so the
  agent never researches a value the source system owns.
- **A second company at a domain is stored without the domain.** Two customers share
  a mail address more often than two companies share a site.

## What a person reads is Brazilian Portuguese

This install is used by a Brazilian team, and the text is written in the code. There
is no translation layer.

- **A message that reaches the screen is in pt-BR**: an HTTP exception, a Zod message
  in a `*.contracts.ts`, and a string saved for the timeline (an activity `subject`, an
  audit summary, a connection's `lastError`).
- **A message nobody reads on a screen stays in English**: a log line, an OpenAPI
  `summary`, the answer of an `internal/*` cron route, and anything handed to the
  model (an `AgentTask.reason`, a tool description).
- **A Zod message ends with a full stop.** `trpc/error-formatter.ts` treats only a
  string ending in `.`, `!` or `?` as a sentence it can show as it is.
- **`LOCALE` (`config/locale.ts`) is the only locale a formatter takes.** The app has
  its own in `@crm/ui/lib/locale`; the two hold the same value.
- **Nobody compares against a message.** A caller that needs to tell two failures
  apart reads the code or the status, because the sentence is free to change.

## Money

A deal is sold in one currency and reported in another, and **only `baseAmount` may
ever be summed**. The rules — `baseCurrency`, `countedWhere`/`pendingWhere`, frozen
rates, the supported currencies, the keyless feed, and why the fetcher is the one
documented exception to *no intelligence in the API* — are in **`docs/currency.md`**.
Read it before touching any amount, total, chart or rate.

## Freshness: invalidate the query, don't disable the cache

- **Invalidate in `onSuccess` through `useCrmCache()`** (`lib/trpc/cache.ts`), never by
  listing keys at the call site. Say what changed — `cache.deal(id)`,
  `cache.company(id)`, `cache.contact(id)`, `cache.activity()`. **A new mutation adds a
  call there, not a new list of keys.**
- **A deletion is `cache.removed(ref)`** — one wide fan-out, and the only place
  `refetchType: "none"` is right: the deleted record's `byId` query is still mounted
  while the sheet animates shut, so refetching reads a 404 into the closing sheet,
  while leaving it alone serves 30s of a dead record from cache.
- **`{ settle: "record" }`** for inline editors, so the field's spinner clears without
  waiting for the table.
- **Infinite queries need `pathKey()`, not `queryKey()`** — the latter stamps
  `{ type: "query" }` and silently cannot match `{ type: "infinite" }`.
  `activities.timeline` is read both ways.
- **`cache-manager` is per-value and opt-in**, not an interceptor;
  `AuthService.getProfile` is the model.
- **Background writes need polling, not invalidation** — `refetchInterval` while
  `PENDING`/`RUNNING`, via `isEnriching()` and `ENRICHMENT_POLL_MS`. **Lists poll too,
  not just the sheet.**
