const fs = require("fs/promises");
const path = require("path");

function createEmptyData() {
  return {
    profiles: {},
    codes: {}
  };
}

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = createEmptyData();
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw);
      this.data.profiles ||= {};
      this.data.codes ||= {};
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      await this.persist();
    }
  }

  async persist() {
    const payload = JSON.stringify(this.data, null, 2);
    this.writeChain = this.writeChain.then(() =>
      fs.writeFile(this.filePath, payload, "utf8")
    );
    return this.writeChain;
  }

  getProfile(discordUserId) {
    return this.data.profiles[discordUserId] || null;
  }

  async setProfile(profile) {
    this.data.profiles[profile.discordUserId] = profile;
    await this.persist();
    return profile;
  }

  getCode(code) {
    return this.data.codes[code] || null;
  }

  getActiveCodeByDiscordUser(discordUserId) {
    const now = Date.now();

    return (
      Object.values(this.data.codes).find((entry) => {
        if (entry.discordUserId !== discordUserId) {
          return false;
        }

        if (entry.revokedAt || entry.usedAt) {
          return false;
        }

        return new Date(entry.expiresAt).getTime() > now;
      }) || null
    );
  }

  async revokeActiveCodesForDiscordUser(discordUserId, reason) {
    let changed = false;
    const now = new Date().toISOString();

    for (const entry of Object.values(this.data.codes)) {
      if (
        entry.discordUserId === discordUserId &&
        !entry.revokedAt &&
        !entry.usedAt &&
        new Date(entry.expiresAt).getTime() > Date.now()
      ) {
        entry.revokedAt = now;
        entry.revokeReason = reason;
        changed = true;
      }
    }

    if (changed) {
      await this.persist();
    }
  }

  async createCode(entry) {
    this.data.codes[entry.code] = entry;
    await this.persist();
    return entry;
  }

  async markCodeUsed(code, usage) {
    const entry = this.getCode(code);

    if (!entry) {
      return null;
    }

    entry.usedAt = new Date().toISOString();
    entry.usedByRobloxUserId = usage.robloxUserId || null;
    entry.usedByRobloxUsername = usage.robloxUsername || null;
    await this.persist();
    return entry;
  }
}

module.exports = {
  JsonStore
};
