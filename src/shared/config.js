require("dotenv").config();

const path = require("path");

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  port: parseInteger(process.env.PORT, 3000),
  dataFile: path.resolve(
    process.cwd(),
    process.env.DATA_FILE || "./data/whitelist-storage.json"
  ),
  internalApiKey: process.env.INTERNAL_API_KEY || "",
  robloxSharedSecret: process.env.ROBLOX_SHARED_SECRET || "",
  allowedRoleIds: new Set(parseCsv(process.env.DISCORD_ALLOWED_ROLE_IDS || "")),
  codeTtlMinutes: Math.max(1, parseInteger(process.env.CODE_TTL_MINUTES, 15)),
  apiBaseUrl: String(
    process.env.API_BASE_URL ||
      (process.env.API_HOSTPORT
        ? `http://${process.env.API_HOSTPORT}`
        : process.env.API_HOST
          ? `http://${process.env.API_HOST}:${process.env.API_PORT || 10000}`
          : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  discordToken: process.env.DISCORD_TOKEN || "",
  discordClientId: process.env.DISCORD_CLIENT_ID || "",
  discordGuildId: process.env.DISCORD_GUILD_ID || ""
};

function assertServerConfig() {
  const missing = [];

  if (!config.internalApiKey) {
    missing.push("INTERNAL_API_KEY");
  }

  if (!config.robloxSharedSecret) {
    missing.push("ROBLOX_SHARED_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `Variaveis obrigatorias do servidor ausentes: ${missing.join(", ")}`
    );
  }
}

function assertBotConfig() {
  const missing = [];

  if (!config.discordToken) {
    missing.push("DISCORD_TOKEN");
  }

  if (!config.discordClientId) {
    missing.push("DISCORD_CLIENT_ID");
  }

  if (!config.discordGuildId) {
    missing.push("DISCORD_GUILD_ID");
  }

  if (!config.apiBaseUrl) {
    missing.push("API_BASE_URL");
  }

  if (!config.internalApiKey) {
    missing.push("INTERNAL_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Variaveis obrigatorias do bot ausentes: ${missing.join(", ")}`);
  }
}

module.exports = {
  config,
  parseCsv,
  assertServerConfig,
  assertBotConfig
};
