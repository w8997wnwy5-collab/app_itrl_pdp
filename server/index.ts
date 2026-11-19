import { config } from "./config";
import { createApp } from "./app";
import { getDb } from "./db";
import { getVapidKeys } from "./notify";
import { startScheduler } from "./scheduler";
import { getGameSettings } from "./settings";

getDb();
getVapidKeys();
const settings = getGameSettings();

const app = createApp();
const server = app.listen(config.port, (err?: Error) => {
  if (err) {
    console.error(`Impossibile avviare il server sulla porta ${config.port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`⚖️  Chi Perde Vince in ascolto su http://localhost:${config.port}`);
  console.log(`   Sfida: "${settings.challengeName}" (${settings.seasonStart} → ${settings.seasonEnd})`);
  console.log(`   Codice invito: ${settings.inviteCode}`);
  console.log(`   Claude (avatar da foto + Gazzetta): ${config.aiEnabled ? `attivo (${config.claudeModel})` : "non configurato"}`);
});

const stopScheduler = config.schedulerEnabled ? startScheduler() : () => {};

function shutdown() {
  stopScheduler();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
