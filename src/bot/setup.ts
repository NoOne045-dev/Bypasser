import "dotenv/config";
import { Bot } from "grammy";
import { bypassSite } from "../core/bypass";
import { findHandler, supportedSites } from "../sites";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is not set");
}

export const bot = new Bot(token);

const URL_REGEX = /https?:\/\/[^\s]+/i;

bot.command("start", (ctx) =>
  ctx.reply(
    "Send me a link and I'll try to skip the wait/ads and give you the final URL.\n\n" +
      "Supported sites right now:\n" +
      supportedSites()
        .map((s) => `• ${s}`)
        .join("\n")
  )
);

bot.on("message:text", async (ctx) => {
  const match = ctx.message.text.match(URL_REGEX);
  if (!match) {
    return ctx.reply("Send me a link (starting with http:// or https://).");
  }

  const url = match[0];
  const handler = findHandler(url);

  if (!handler) {
    return ctx.reply(
      `I don't have a handler for that site yet. Supported: ${supportedSites().join(", ")}`
    );
  }

  const statusMsg = await ctx.reply(`⏳ Bypassing ${handler.tag}...`);
  const chatId = ctx.chat.id;
  const messageId = statusMsg.message_id;

  // INTENTIONALLY NOT AWAITED. Telegram webhooks need a fast HTTP response
  // — grammy enforces this with a ~10s internal timeout on the handler.
  // bypassSite() can take up to ~25s (launching a real browser, waiting
  // for redirects), so it has to run *after* we've already responded to
  // the webhook, not inside the same request/response cycle.
  //
  // This is the "fire and forget, then follow up" pattern: kick off the
  // slow work, let the function return immediately (satisfying the
  // webhook), and use bot.api directly (not ctx.api) later since by the
  // time .then() runs, the original update/request is long finished —
  // ctx is conceptually "done", but the API client itself has no such
  // lifecycle, so calling it later is completely normal.
  bypassSite(url, handler)
    .then((result) => {
      const text =
        result.success && result.finalUrl
          ? `✅ Final link:\n${result.finalUrl}\n\n(${result.hops ?? 0} hop(s))`
          : `❌ Couldn't bypass this link: ${result.error ?? "unknown error"}`;
      return bot.api.editMessageText(chatId, messageId, text);
    })
    .catch((err) => {
      // Without this .catch, a failure here becomes an "unhandled promise
      // rejection" — Node.js logs a scary warning but the process survives.
      // Catching it explicitly means we control the log message instead.
      console.error("Background bypass failed:", err);
    });
});

bot.catch((err) => {
  console.error("Bot error:", err);
});
