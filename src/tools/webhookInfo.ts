import "dotenv/config";
import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is not set");
}

async function main() {
  const bot = new Bot(token as string);
  const info = await bot.api.getWebhookInfo();

  console.log("Telegram webhook status for this bot:\n");
  console.log(JSON.stringify(info, null, 2));

  if (!info.url) {
    console.log("\n✅ No webhook set — polling can receive updates.");
  } else {
    console.log(`\n⚠️  A webhook is still registered: ${info.url}`);
    console.log("   Polling will NOT receive messages while this is set.");
    console.log("   The bot deletes the webhook on startup (bot/index.ts).");
    if (info.last_error_message) {
      console.log(
        `   Last Telegram error: ${info.last_error_message} (at ${new Date((info.last_error_date ?? 0) * 1000)})`
      );
    }
  }
}

main();
