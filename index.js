const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const config = require("./config.json");
const { startServer } = require("./alive.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const suggestionChannelId = config.suggestionChannelId;
const approverRoleId = config.approverRoleId;
const userVotes = {};

client.once("ready", () => {
  console.log("Bot is online!");
  console.log("Code by Wick Studio");
  console.log("discord.gg/wicks");
});

client.on("messageCreate", (message) => {
  if (message.channel.id === suggestionChannelId) {
    const messageContent = message.content;

    if (!messageContent.trim()) {
      console.log("A new suggestion has been sent.");
      return;
    }

    const suggestionEmbed = new EmbedBuilder()
      .setColor(0x00b2ff)
      .setTitle("📝 new suggestion")
      .setDescription(`**suggestion :**\n\`\`\`${messageContent}\`\`\``)
      .setTimestamp()
      .setFooter({ text: `send by : ${message.author.tag}` })
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: "status", value: "⏳ pending", inline: true },
        { name: "support", value: "👍 0 | 👎 0", inline: true },
      );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${message.author.id}`)
        .setLabel("accepted")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${message.author.id}`)
        .setLabel("rejected")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("upvote")
        .setLabel("👍")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("downvote")
        .setLabel("👎")
        .setStyle(ButtonStyle.Primary),
    );

    message.channel
      .send({ embeds: [suggestionEmbed], components: [row] })
      .then(() => message.delete())
      .catch(console.error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const messageId = interaction.message.id;
  const userId = interaction.user.id;

  if (
    interaction.customId.startsWith("accept") ||
    interaction.customId.startsWith("reject")
  ) {
    const roleId = approverRoleId;
    if (!interaction.member.roles.cache.has(roleId)) {
      return interaction.reply({
        content: "You do not have permission to use this button.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`response-modal-${interaction.customId}`)
      .setTitle("Response");

    const reasonInput = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("Reason")
      .setStyle(TextInputStyle.Paragraph);

    const actionRow = new ActionRowBuilder().addComponents(reasonInput);

    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  } else if (
    interaction.customId === "upvote" ||
    interaction.customId === "downvote"
  ) {
    if (!userVotes[messageId]) userVotes[messageId] = new Set();
    if (userVotes[messageId].has(userId)) {
      return interaction.reply({
        content: "You have already voted on this suggestion.",
        ephemeral: true,
      });
    }
    userVotes[messageId].add(userId);

    const originalEmbed = interaction.message.embeds[0];
    const fields = originalEmbed.fields;
    let upvotes = parseInt(fields[1].value.split("|")[0].trim().split(" ")[1]);
    let downvotes = parseInt(
      fields[1].value.split("|")[1].trim().split(" ")[1],
    );

    if (interaction.customId === "upvote") upvotes++;
    if (interaction.customId === "downvote") downvotes++;

    const updatedEmbed = new EmbedBuilder(originalEmbed).spliceFields(1, 1, {
      name: "support",
      value: `👍 ${upvotes} | 👎 ${downvotes}`,
      inline: true,
    });

    await interaction.update({
      embeds: [updatedEmbed],
      components: interaction.message.components,
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isModalSubmit()) {
    const reason = interaction.fields.getTextInputValue("reason");
    const originalEmbed = interaction.message.embeds[0];
    const decision = interaction.customId.includes("accept")
      ? "accepted"
    : "denied";

    const acceptedColor = 0x28a745;
    const rejectedColor = 0xdc3545;

    const color = decision === "accepted" ? acceptedColor : rejectedColor;

    const updatedButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("upvote")
        .setLabel("👍")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("downvote")
        .setLabel("👎")
        .setStyle(ButtonStyle.Primary),
    );

    const updatedEmbed = new EmbedBuilder(originalEmbed)
      .spliceFields(0, 1, { name: decision, value: reason, inline: true })
      .setColor(color);

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [updatedButtons],
    });

    await interaction.reply({
      content: `The suggestion has been ${decision.toLowerCase()}.`,
      ephemeral: true,
    });

    const user = await interaction.guild.members.fetch(
      interaction.customId.split("_")[1],
    );

    if (user) {
      user.send({ content: `Your suggestion was answered: ${decision}` });
    }
  }
});

startServer();

client.login(process.env.TOKEN);
