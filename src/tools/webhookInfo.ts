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
    console.log("\n⚠️  No webhook set — bot is in polling mode (or not started).");
  } else if (info.last_error_message) {
    console.log(`\n⚠️  Webhook is set but Telegram reported an error:`);
    console.log(`   ${info.last_error_message} (at ${new Date((info.last_error_date ?? 0) * 1000)})`);
    console.log("   This usually means Render's URL is unreachable or returned a non-2xx status.");
  } else {
    console.log(`\n✅ Webhook is set to: ${info.url}`);
    console.log("   No delivery errors reported by Telegram.");
  }
}

main();
