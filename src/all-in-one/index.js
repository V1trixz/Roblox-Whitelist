if (!process.env.API_BASE_URL && !process.env.API_HOSTPORT && !process.env.API_HOST) {
  process.env.API_BASE_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
}

const { bootstrap: bootstrapServer } = require("../server");
const { bootstrap: bootstrapBot } = require("../bot");

async function bootstrapAllInOne() {
  const serverResult = await bootstrapServer();
  const botClient = await bootstrapBot();

  console.log("[app] API e bot iniciados no mesmo processo.");

  async function shutdown(signal) {
    console.log(`[app] encerrando por ${signal}`);

    await new Promise((resolve) => {
      serverResult.server.close(() => resolve());
    });

    if (botClient?.isReady()) {
      await botClient.destroy();
    }

    process.exit(0);
  }

  process.once("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      console.error("[app] erro ao encerrar", error);
      process.exit(1);
    });
  });

  process.once("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      console.error("[app] erro ao encerrar", error);
      process.exit(1);
    });
  });
}

bootstrapAllInOne().catch((error) => {
  console.error("[app] falha ao iniciar", error);
  process.exit(1);
});
