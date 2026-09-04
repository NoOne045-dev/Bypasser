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

  const result = await bypassSite(url, handler);

  if (result.success && result.finalUrl) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `✅ Final link:\n${result.finalUrl}\n\n(${result.hops ?? 0} hop(s))`
    );
  } else {
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `❌ Couldn't bypass this link: ${result.error ?? "unknown error"}`
    );
  }
});

bot.catch((err) => {
  console.error("Bot error:", err);
});
