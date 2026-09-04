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

  // INTENTIONALLY NOT AWAITED.
  //
  // The bot itself now runs in long-polling (see bot/index.ts) so grammy's
  // ~10s *webhook* handler timeout does not apply. We still fire-and-forget
  // the slow Playwright work so a second incoming message can be ACK'd
  // while a bypass is already in flight — polling getUpdates shouldn't
  // stall behind a 25–40s Chromium session.
  //
  // Follow-up edits use bot.api (not ctx.api): by the time .then() runs
  // the original update is finished. The Bot API client has no such
  // lifecycle, so calling it later is normal.
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
