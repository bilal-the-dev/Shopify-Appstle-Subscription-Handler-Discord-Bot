const {
  Client,
  Events,
  IntentsBitField: { Flags },
  ButtonStyle,
  ButtonBuilder,
  ModalBuilder,
  TextInputStyle,
  TextInputBuilder,
  ActionRowBuilder,
  channelMention,
  EmbedBuilder,
} = require("discord.js");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cron = require("node-cron");

dotenv.config({ path: ".env" });

const verifyEmail = require("./models/verifyEmail");
const { fetchCustomer, fetchContracts } = require("./apstleAPI");
const { addRoles, checkForRoles, removeRoles } = require("./misc");
const { handleInteractionReply } = require("./handlnteraction");
//
const {
  TOKEN,
  GUILD_ID,
  SUBSCRIPTION_ROLE_ID,
  MONGO_URI,
  SUPPORT_CHANNEL_ID,
  OWNER_ID,
  LOGS_CHANNEL_ID,
} = process.env;

const client = new Client({
  intents: [
    Flags.Guilds,
    Flags.MessageContent,
    Flags.GuildMessages,
    Flags.GuildPresences,
    Flags.GuildMembers,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("Connected to db 🧨"))
    .catch((e) => console.log("Error connecting to database" + e));

  cron.schedule("0 0 */2 * *", checkForSubscriptions);
  // cron.schedule("* * * * *", checkForSubscriptions);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content !== "!send") return;
  console.log("Message was !send");

  if (message.author.id !== OWNER_ID) return;

  console.log("Sending panel");

  const row = generateButtons();
  await message.channel.send({
    content: "Aktiviere dein Abo!",
    components: [row],
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId !== "link") return;
  await handleInteractionReply(interaction, {
    content: `Trete unserer Community bei! https://www.dreamtrades.de`,
    ephemeral: true,
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId !== "verify") return;

  const modal = new ModalBuilder().setCustomId("email").setTitle("Email");

  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("Deine E-Mail")
    .setStyle(TextInputStyle.Short);

  const firstActionRow = new ActionRowBuilder().addComponents(email);

  modal.addComponents(firstActionRow);

  await interaction.showModal(modal).catch(() => null);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return;

    const {
      customId,
      fields: { fields },
      user: { id: userId },
      member,
    } = interaction;

    if (customId !== "email") return;

    await interaction.deferReply({ ephemeral: true });

    const email = fields.get("email").value;
    const isEmailUsed = await verifyEmail.findOne({
      email,
      userId: { $ne: userId },
    });

    if (isEmailUsed)
      throw new Error(
        `Mail bereits mit einem Discord-Account verknüpft, kontaktiere bitte den Support im ${channelMention(
          SUPPORT_CHANNEL_ID
        )} Channel`
      );

    console.log(email);
    await fetchCustomer(email);

    const { subscriptionFinished } = await fetchContracts(
      `customerName=${email}`
    );

    // if (subscriptionFinished)
    //   throw new Error(
    //     `Das Abonnement für ${email} ist abgelaufen, kontaktiere bitte den Support im ${channelMention(
    //       SUPPORT_CHANNEL_ID
    //     )} Channel"`
    //   );

    await member.roles.add(SUBSCRIPTION_ROLE_ID);

    const hasAlreadyRegistered = await verifyEmail.findOne({ userId });

    if (hasAlreadyRegistered) await hasAlreadyRegistered.updateOne({ email });

    if (!hasAlreadyRegistered)
      await verifyEmail.create({
        email,
        userId,
      });

    await handleInteractionReply(interaction, {
      content: `Abonnement für ${email} erfolgreich aktiviert`,
    });
  } catch (error) {
    console.log(error);
    await handleInteractionReply(interaction, {
      content: `Err! **${error.message}**.`,
      ephemeral: true,
    });
  }
});

client.login(TOKEN);

const generateButtons = () => {
  const verify = new ButtonBuilder()
    .setCustomId("verify")
    .setLabel("Verifizieren")
    .setStyle(ButtonStyle.Primary)

    .setEmoji("🚀");
  const link = new ButtonBuilder()
    .setLabel("Jetzt dazugehören")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId("link")
    .setEmoji("🌏");

  return new ActionRowBuilder().addComponents(verify);
};

checkForSubscriptions();

async function checkForSubscriptions() {
  const channel = client.channels.cache.get(LOGS_CHANNEL_ID);

  const docs = await verifyEmail.find().catch((e) => console.log(e));
  console.log("running every minute");

  for (const doc of docs) {
    try {
      const { userId, email } = doc;
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(userId).catch(() => null);

      if (!member) continue;

      const response = await fetchContracts(`customerName=${email}`);

      const { contract, subscriptionFinished, finishedAt } = response;
      console.log(response);

      let color;

      const fields = [
        {
          name: "Order No",
          value: `${contract.orderName}`,
        },
        { name: "User", value: `${member} (${member.id})` },
        { name: "Status", value: contract.status.toUpperCase() },

        { name: "Email", value: email },
        { name: "Sub finished", value: subscriptionFinished ? "Yes" : "No" },
      ];

      if (subscriptionFinished) {
        if (!checkForRoles(member)) continue;

        await removeRoles(member);

        console.log(`Removed roles for ${member.user.username}`);

        fields.push({
          name: "Finished At",
          value: `<t:${Math.floor(finishedAt / 1000)}:f>`,
        });

        color = 0xffa500;
      }

      if (!subscriptionFinished) {
        if (checkForRoles(member)) continue;

        await addRoles(member);
        color = 0x00ff00;
      }

      const embed = new EmbedBuilder()
        .setFields(fields)
        .setColor(color)
        .setThumbnail(member.displayAvatarURL());

      await channel?.send({ embeds: [embed] });
    } catch (error) {
      console.log(error);

      const errorEmbed = {
        color: 0xff0000,
        title: "Error Processing User",
        description: `**User:** <@${doc.userId}>\n\n\`\`\`yaml\n${error.message}\n\`\`\``,
        timestamp: new Date(),
      };

      await channel?.send({ embeds: [errorEmbed] }).catch(console.error);
    }
  }
}
