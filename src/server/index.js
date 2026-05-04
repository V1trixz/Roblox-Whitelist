const { config, assertServerConfig } = require("../shared/config");
const { createApp } = require("./app");
const { JsonStore } = require("./store");

async function bootstrap() {
  assertServerConfig();

  const store = new JsonStore(config.dataFile);
  await store.init();

  const app = createApp({ config, store });

  const server = app.listen(config.port, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : config.port;
    console.log(`[server] ouvindo na porta ${port}`);
    console.log(`[server] arquivo de dados: ${config.dataFile}`);
  });

  return {
    app,
    server,
    store
  };
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("[server] falha ao iniciar", error);
    process.exit(1);
  });
}

module.exports = {
  bootstrap
};
