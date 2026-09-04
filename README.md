# bypass-bot

Telegram bot that runs a headless browser, replays your `linkpoi.in.user.js`
click/timer logic inside it, and replies with the final destination URL.

## How it fits together

```
src/
├── core/
│   ├── types.ts        # SiteHandler + BypassResult interfaces
│   ├── browserCore.ts  # your userscript's core, generalized, as a string
│   │                    # that gets injected INTO the headless page
│   └── bypass.ts        # Node side: launches Chromium, injects the core,
│                         # polls page.url() until it settles
├── sites/
│   ├── linkpoi.in.ts    # per-site config (selectors/textHints/etc)
│   └── index.ts          # dispatcher: hostname -> handler
└── bot/
    └── index.ts          # grammy Telegram bot + Express keepalive server
```

Adding a new site later = one new file in `src/sites/` shaped like
`linkpoi.in.ts`, plus one line in `sites/index.ts`. Nothing else changes.

## Local setup (polling mode)

```bash
npm install                 # also runs `playwright install --with-deps chromium`
cp .env.example .env        # then paste your bot token from @BotFather
npm run dev                 # ts-node-dev, auto-restarts on file changes
```

Locally there's no `RENDER_EXTERNAL_URL`, so the app auto-detects that and
runs in **polling** mode — no public URL needed to test on your machine.

Get a token: message **@BotFather** on Telegram → `/newbot` → follow prompts
→ paste the token it gives you into `.env`.

## Deploy on Render (webhook mode)

1. Push this folder to a GitHub repo.
2. On Render: **New +** → **Blueprint** → pick your repo. It reads
   `render.yaml` automatically: Docker web service, `WEBHOOK_SECRET`
   auto-generated, `BOT_TOKEN` left for you to fill in.
3. In the Render dashboard, open the new service → **Environment** → add
   `BOT_TOKEN` with your real token.
4. Deploy. On boot, the app reads Render's auto-injected
   `RENDER_EXTERNAL_URL`, registers itself with Telegram via
   `bot.api.setWebhook(...)`, and switches to webhook mode — no long-poll
   loop, so it plays nicely with Render's free-tier idle behavior.

### Confirming it actually works

Three checks, cheapest first:

```bash
# 1. Locally, ask Telegram directly what it currently has on file:
npm run webhook:info
```
Look for `"url"` pointing at your `.onrender.com` address and no
`last_error_message`.

```bash
# 2. Check Render's own logs (dashboard -> your service -> Logs) for:
#    "Webhook mode: registered https://<your-app>.onrender.com/telegram/..."
```

3. Open Telegram, message your bot `/start`. If it replies, the whole chain
   (Telegram → Render → Express → grammy → your handler) is confirmed
   working end to end. Then send it a `linkpoi.in` link as the real test.

If step 3 doesn't respond: re-run `npm run webhook:info` — a
`last_error_message` there tells you exactly what Telegram saw when it
tried to reach Render (timeout, wrong status code, TLS issue, etc.), which
is much more precise than staring at Render logs alone.

Note: Render's free plan spins the service down after inactivity. The
*first* webhook delivery after idle time will be slow (cold start), but it
will still arrive — Telegram retries failed webhook deliveries automatically.

## TypeScript concepts introduced in this project

- **`interface`** (`core/types.ts`) — defines the required shape of an
  object; any object matching that shape satisfies it, no explicit
  "implements" needed (structural typing).
- **`satisfies`** (`sites/linkpoi.in.ts`) — checks a literal against a type
  without widening it, so you keep precise autocomplete on the object.
- **Union types with `| null` / `| undefined`** (`sites/index.ts`) — TS
  forces you to handle the "not found" case instead of letting it slip
  through silently.
- **`Promise<T>` return types + `async/await`** (`core/bypass.ts`) — every
  async function's signature tells you exactly what it eventually resolves
  to.
- **`try/catch/finally`** — `finally` in `bypass.ts` guarantees the browser
  closes even on error, which matters a lot for not leaking memory on a
  free-tier server.
- **Type narrowing via context** (`bot/setup.ts`) — grammy's
  `bot.on("message:text", ...)` narrows `ctx.message.text` to `string`
  automatically, no manual `if (typeof ... === "string")` needed.
- **`new Promise<void>((resolve) => ...)`** (`bot/index.ts`) — wraps
  Express's callback-style `app.listen(port, callback)` into something you
  can `await`, so "start the webhook" provably happens only after the HTTP
  server is actually listening.
- **Environment-based branching, not a config flag** (`bot/index.ts`) — the
  code asks "does `RENDER_EXTERNAL_URL` exist?" rather than reading an
  explicit `MODE=webhook` setting. One fewer thing to misconfigure, and it's
  impossible for local dev to accidentally register a dead webhook.

## What this bot does *not* do

It only automates clicking through countdown/"get link" pages exactly like
your original userscript — it does not attempt to solve CAPTCHAs or bypass
Cloudflare challenges. If `isProtectedPage()` detects one, it just waits
(same as your script) rather than trying to defeat it. That's why we're
starting with `linkpoi.in`, which doesn't use either.
