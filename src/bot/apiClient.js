const { config } = require("../shared/config");

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": config.internalApiKey,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10_000)
  });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || "Falha ao comunicar com a API.",
      response.status,
      data
    );
  }

  return data;
}

async function getSavedAccount(discordUserId) {
  return request(`/api/discord/account/${discordUserId}`);
}

async function saveAccount({ discordUserId, discordTag, robloxUsername }) {
  return request("/api/discord/account/save", {
    method: "POST",
    body: {
      discordUserId,
      discordTag,
      robloxUsername
    }
  });
}

async function generateCode({
  discordUserId,
  discordTag,
  robloxUsername,
  roleIds
}) {
  return request("/api/discord/code/generate", {
    method: "POST",
    body: {
      discordUserId,
      discordTag,
      robloxUsername,
      roleIds
    }
  });
}

module.exports = {
  ApiError,
  getSavedAccount,
  saveAccount,
  generateCode
};
