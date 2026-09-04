import "dotenv/config";
import express from "express";
import { bot } from "./setup";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// Dummy HTTP only. Render's web-service health check needs *something*
// bound to $PORT or it kills the dyno. Telegram updates are NOT processed
// here — the real bot loop is long polling below.
app.get("/", (_req, res) => {
  res.status(200).send("bypass-bot is running (polling)");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, mode: "polling" });
});

app.use(express.json());

// Dummy webhook: if a leftover webhook still POSTs here (Telegram retrying
// an old URL, a scanner, etc.) we ACK 200 immediately and drop the body.
// We never call webhookCallback / bot.handleUpdate — polling owns updates.
app.post(["/webhook", "/telegram", "/telegram/:secret"], (_req, res) => {
  res.status(200).json({ ok: true, ignored: true, mode: "polling" });
});

async function main() {
  await new Promise<void>((resolve) =>
    app.listen(port, "0.0.0.0", () => resolve())
  );
  console.log(`Dummy HTTP on :${port} (Render health + ignored webhook)`);

  // Webhook and polling cannot both receive updates. Delete any previously
  // registered webhook (from older deploys) so getUpdates() actually fires.
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.log("Webhook deleted — starting long polling");

  await bot.start({
    onStart: (me) => {
      console.log(`Polling as @${me.username}`);
    },
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
