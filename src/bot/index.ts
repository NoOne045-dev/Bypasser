import "dotenv/config";
import express from "express";
import { webhookCallback } from "grammy";
import { bot } from "./setup";

const app = express();
const port = process.env.PORT ?? 3000;

// Render injects RENDER_EXTERNAL_URL automatically on every web service
// (e.g. "https://bypass-bot-xyz.onrender.com") — we don't set this
// ourselves. Locally it won't exist, which is how we detect "dev mode"
// and fall back to polling instead.
const publicUrl = process.env.RENDER_EXTERNAL_URL;

// A random-looking path segment so the webhook URL itself isn't guessable.
// Falls back to a fixed value locally where it doesn't matter.
const webhookPath = `/telegram/${process.env.WEBHOOK_SECRET ?? "dev-local"}`;

app.get("/", (_req, res) => {
  res.send("bypass-bot is running");
});

// Telegram's webhook payloads are JSON — express needs this middleware to
// populate req.body before grammy's callback can read it.
app.use(express.json());

// grammy's webhookCallback turns an Express route into a valid Telegram
// webhook handler: it verifies the update shape and dispatches into the
// exact same bot.command()/bot.on() handlers as polling mode does.
// `secretToken` makes grammy check Telegram's X-Telegram-Bot-Api-Secret-Token
// header, rejecting requests that don't have it — cheap protection against
// someone spamming your public webhook URL with fake updates.
app.post(
  webhookPath,
  webhookCallback(bot, "express", {
    secretToken: process.env.WEBHOOK_SECRET,
  })
);

async function main() {
  await new Promise<void>((resolve) => app.listen(port, () => resolve()));
  console.log(`HTTP server listening on port ${port}`);

  if (publicUrl) {
    const fullWebhookUrl = `${publicUrl}${webhookPath}`;
    await bot.api.setWebhook(fullWebhookUrl, {
      secret_token: process.env.WEBHOOK_SECRET,
    });
    console.log(`Webhook mode: registered ${fullWebhookUrl}`);
  } else {
    // Webhook and polling can't both be active for the same bot token —
    // Telegram will silently refuse to deliver via getUpdates() while a
    // webhook is set. Clearing it first is what makes local dev "just work"
    // even right after you've deployed to Render.
    await bot.api.deleteWebhook();
    console.log("No RENDER_EXTERNAL_URL found — dev mode: starting polling");
    bot.start();
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
