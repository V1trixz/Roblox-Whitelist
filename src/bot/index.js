const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const { assertBotConfig, config } = require("../shared/config");
const {
  ApiError,
  generateCode,
  getSavedAccount,
  saveAccount
} = require("./apiClient");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function createChoiceRow(ownerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wl-confirm:${ownerId}`)
      .setLabel("Confirmar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`wl-switch:${ownerId}`)
      .setLabel("Trocar")
      .setStyle(ButtonStyle.Secondary)
  );
}

function createNickModal(ownerId, currentValue = "") {
  const modal = new ModalBuilder()
    .setCustomId(`wl-nick:${ownerId}`)
    .setTitle("Nick do Roblox");

  const input = new TextInputBuilder()
    .setCustomId("roblox_username")
    .setLabel("Digite o nick exato do Roblox")
    .setPlaceholder("Exemplo: MeuNick_123")
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(20)
    .setStyle(TextInputStyle.Short);

  if (currentValue) {
    input.setValue(currentValue);
  }

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function formatCodeReply(payload) {
  return [
    `Conta Roblox: **${payload.robloxUsername}**`,
    `Codigo: \`${payload.code}\``,
    `Expira em: **${payload.expiresInMinutes} minutos**`,
    "Esse codigo so funciona para esse nick especifico no Roblox.",
    "Se voce gerar outro codigo, o anterior e cancelado."
  ].join("\n");
}

function parseOwnerId(customId, prefix) {
  const [receivedPrefix, ownerId] = String(customId || "").split(":");

  if (receivedPrefix !== prefix || !ownerId) {
    return null;
  }

  return ownerId;
}

async function getRoleIds(interaction) {
  if (!interaction.inGuild()) {
    return [];
  }

  const rawMember = interaction.member;

  if (rawMember?.roles?.cache) {
    return [...rawMember.roles.cache.keys()];
  }

  if (Array.isArray(rawMember?.roles)) {
    return rawMember.roles;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  return [...member.roles.cache.keys()];
}

function createApiErrorMessage(error, savedUsername) {
  if (error instanceof ApiError) {
    if (savedUsername) {
      return [
        `Conta salva: **${savedUsername}**`,
        error.message
      ].join("\n");
    }

    return error.message;
  }

  return "Falha ao comunicar com o servidor. Tente novamente em alguns segundos.";
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const command = new SlashCommandBuilder()
    .setName("gerar-codigo")
    .setDescription("Gera seu codigo temporario de whitelist para o Roblox.");

  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
    { body: [command.toJSON()] }
  );
}

async function handleSlashCommand(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      ephemeral: true,
      content: "Use esse comando dentro do servidor do Discord."
    });
    return;
  }

  let savedAccount = null;

  try {
    savedAccount = await getSavedAccount(interaction.user.id);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      await interaction.reply({
        ephemeral: true,
        content: createApiErrorMessage(error)
      });
      return;
    }
  }

  if (!savedAccount) {
    await interaction.showModal(createNickModal(interaction.user.id));
    return;
  }

  await interaction.reply({
    ephemeral: true,
    content: `Conta salva encontrada: **${savedAccount.robloxUsername}**\nDeseja usar essa conta para gerar o codigo?`,
    components: [createChoiceRow(interaction.user.id)]
  });
}

async function runGeneration(interaction, robloxUsername) {
  const roleIds = await getRoleIds(interaction);
  const payload = await generateCode({
    discordUserId: interaction.user.id,
    discordTag: interaction.user.username,
    robloxUsername,
    roleIds
  });

  return payload;
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith("wl-confirm:")) {
    const ownerId = parseOwnerId(interaction.customId, "wl-confirm");

    if (ownerId !== interaction.user.id) {
      await interaction.reply({
        ephemeral: true,
        content: "Esse botao pertence a outra pessoa."
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const payload = await runGeneration(interaction);
      await interaction.editReply({
        content: formatCodeReply(payload),
        components: []
      });
    } catch (error) {
      await interaction.editReply({
        content: createApiErrorMessage(error),
        components: []
      });
    }

    return;
  }

  if (interaction.customId.startsWith("wl-switch:")) {
    const ownerId = parseOwnerId(interaction.customId, "wl-switch");

    if (ownerId !== interaction.user.id) {
      await interaction.reply({
        ephemeral: true,
        content: "Esse botao pertence a outra pessoa."
      });
      return;
    }

    let savedUsername = "";

    try {
      const savedAccount = await getSavedAccount(interaction.user.id);
      savedUsername = savedAccount.robloxUsername;
    } catch (error) {
      savedUsername = "";
    }

    await interaction.showModal(createNickModal(interaction.user.id, savedUsername));
  }
}

async function handleModal(interaction) {
  const ownerId = parseOwnerId(interaction.customId, "wl-nick");

  if (ownerId !== interaction.user.id) {
    await interaction.reply({
      ephemeral: true,
      content: "Esse formulario pertence a outra pessoa."
    });
    return;
  }

  const robloxUsername = interaction.fields
    .getTextInputValue("roblox_username")
    .trim();

  await interaction.deferReply({ ephemeral: true });

  try {
    await saveAccount({
      discordUserId: interaction.user.id,
      discordTag: interaction.user.username,
      robloxUsername
    });

    const payload = await runGeneration(interaction, robloxUsername);

    await interaction.editReply({
      content: formatCodeReply(payload)
    });
  } catch (error) {
    await interaction.editReply({
      content: createApiErrorMessage(error, robloxUsername)
    });
  }
}

async function bootstrap() {
  assertBotConfig();

  client.once(Events.ClientReady, async (readyClient) => {
    await registerCommands();
    console.log(`[bot] online como ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "gerar-codigo") {
          await handleSlashCommand(interaction);
        }

        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      }
    } catch (error) {
      console.error("[bot] erro ao tratar interacao", error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "Ocorreu um erro ao processar sua solicitacao."
        });
        return;
      }

      await interaction.reply({
        ephemeral: true,
        content: "Ocorreu um erro ao processar sua solicitacao."
      });
    }
  });

  await client.login(config.discordToken);
  return client;
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("[bot] falha ao iniciar", error);
    process.exit(1);
  });
}

module.exports = {
  bootstrap
};
