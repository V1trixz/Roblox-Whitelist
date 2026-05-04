const crypto = require("crypto");

const express = require("express");

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeRobloxUsername(value) {
  const username = String(value || "").trim();

  if (!username) {
    return "";
  }

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return "";
  }

  return username;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function safeCompare(expected, received) {
  const left = Buffer.from(String(expected || ""));
  const right = Buffer.from(String(received || ""));

  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function hasAllowedRole(roleIds, allowedRoleIds) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return false;
  }

  if (!allowedRoleIds || allowedRoleIds.size === 0) {
    return false;
  }

  return roleIds.some((roleId) => allowedRoleIds.has(String(roleId)));
}

function createCodeCandidate() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";

  while (output.length < 10) {
    const randomByte = crypto.randomBytes(1)[0];
    output += alphabet[randomByte % alphabet.length];
  }

  return `WL-${output.slice(0, 5)}-${output.slice(5, 10)}`;
}

function createUniqueCode(store) {
  let code = createCodeCandidate();

  while (store.getCode(code)) {
    code = createCodeCandidate();
  }

  return code;
}

function ensureInternalRequest(req, res, config) {
  const providedKey = req.header("x-internal-api-key");

  if (!safeCompare(config.internalApiKey, providedKey)) {
    res.status(401).json({ message: "Chave interna invalida." });
    return false;
  }

  return true;
}

function ensureRobloxRequest(req, res, config) {
  const providedSecret = req.header("x-roblox-shared-secret");

  if (!safeCompare(config.robloxSharedSecret, providedSecret)) {
    res.status(401).json({ message: "Segredo do Roblox invalido." });
    return false;
  }

  return true;
}

function createApp({ config, store }) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get(
    "/api/discord/account/:discordUserId",
    asyncHandler(async (req, res) => {
      if (!ensureInternalRequest(req, res, config)) {
        return;
      }

      const profile = store.getProfile(req.params.discordUserId);

      if (!profile) {
        res.status(404).json({ message: "Nenhum nick salvo para esse usuario." });
        return;
      }

      res.json(profile);
    })
  );

  app.post(
    "/api/discord/account/save",
    asyncHandler(async (req, res) => {
      if (!ensureInternalRequest(req, res, config)) {
        return;
      }

      const discordUserId = String(req.body.discordUserId || "").trim();
      const discordTag = String(req.body.discordTag || "").trim();
      const robloxUsername = normalizeRobloxUsername(req.body.robloxUsername);

      if (!discordUserId || !robloxUsername) {
        res.status(400).json({
          message: "Informe um usuario do Discord e um nick valido do Roblox."
        });
        return;
      }

      const profile = {
        discordUserId,
        discordTag,
        robloxUsername,
        updatedAt: new Date().toISOString()
      };

      await store.setProfile(profile);
      res.json(profile);
    })
  );

  app.post(
    "/api/discord/code/generate",
    asyncHandler(async (req, res) => {
      if (!ensureInternalRequest(req, res, config)) {
        return;
      }

      const discordUserId = String(req.body.discordUserId || "").trim();
      const discordTag = String(req.body.discordTag || "").trim();
      const roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds : [];
      const providedUsername = normalizeRobloxUsername(req.body.robloxUsername);
      const savedProfile = discordUserId ? store.getProfile(discordUserId) : null;
      const robloxUsername = providedUsername || savedProfile?.robloxUsername || "";

      if (!discordUserId) {
        res.status(400).json({ message: "Usuario do Discord invalido." });
        return;
      }

      if (!hasAllowedRole(roleIds, config.allowedRoleIds)) {
        res.status(403).json({
          message: "Voce nao tem permissao para gerar codigo de whitelist."
        });
        return;
      }

      if (!robloxUsername) {
        res.status(400).json({
          message: "Nenhum nick do Roblox foi informado ou salvo para esse usuario."
        });
        return;
      }

      await store.setProfile({
        discordUserId,
        discordTag,
        robloxUsername,
        updatedAt: new Date().toISOString()
      });

      await store.revokeActiveCodesForDiscordUser(
        discordUserId,
        "replaced_by_new_code"
      );

      const createdAt = new Date();
      const expiresAt = new Date(
        createdAt.getTime() + config.codeTtlMinutes * 60 * 1000
      );
      const code = createUniqueCode(store);

      await store.createCode({
        code,
        discordUserId,
        discordTag,
        robloxUsername,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        usedAt: null,
        usedByRobloxUserId: null,
        usedByRobloxUsername: null,
        revokedAt: null,
        revokeReason: null
      });

      res.json({
        code,
        robloxUsername,
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: config.codeTtlMinutes
      });
    })
  );

  app.post(
    "/api/roblox/validate",
    asyncHandler(async (req, res) => {
      if (!ensureRobloxRequest(req, res, config)) {
        return;
      }

      const code = normalizeCode(req.body.code);
      const robloxUsername = normalizeRobloxUsername(req.body.robloxUsername);
      const robloxUserId = String(req.body.robloxUserId || "").trim();

      if (!code || !robloxUsername || !robloxUserId) {
        res.status(400).json({
          message: "Codigo, nick do Roblox e userId do Roblox sao obrigatorios."
        });
        return;
      }

      const entry = store.getCode(code);

      if (!entry) {
        res.status(404).json({ message: "Codigo invalido." });
        return;
      }

      if (entry.revokedAt || entry.usedAt) {
        res.status(400).json({ message: "Codigo invalido ou ja utilizado." });
        return;
      }

      if (new Date(entry.expiresAt).getTime() <= Date.now()) {
        res.status(400).json({ message: "Codigo expirado." });
        return;
      }

      if (entry.robloxUsername.toLowerCase() !== robloxUsername.toLowerCase()) {
        res.status(403).json({
          message: "Esse codigo pertence a outro nick do Roblox."
        });
        return;
      }

      await store.markCodeUsed(code, {
        robloxUserId,
        robloxUsername
      });

      res.json({
        success: true,
        robloxUsername: entry.robloxUsername
      });
    })
  );

  app.use((error, req, res, next) => {
    console.error("[server] erro nao tratado", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  });

  return app;
}

module.exports = {
  createApp
};
