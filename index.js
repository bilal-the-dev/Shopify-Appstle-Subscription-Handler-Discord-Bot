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

  cron.schedule("0 0 * * *", checkForSubscriptions);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id !== OWNER_ID) return;
  if (message.content !== "!send") return;

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

    console.log(email);
    const user = await fetchCustomer(email);

    const contract = await fetchContracts(`customerName=${user.name}`);

    if (!contract)
      throw new Error(
        `Das Abonnement für ${email} ist abgelaufen, kontaktiere bitte den Support im ${channelMention(
          SUPPORT_CHANNEL_ID
        )} Channel"`
      );
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

  return new ActionRowBuilder().addComponents(verify, link);
};

async function checkForSubscriptions() {
  const docs = await verifyEmail.find().catch((e) => console.log(e));
  console.log("running every minute");

  for (const doc of docs) {
    try {
      const { userId, email } = doc;
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(userId).catch(() => null);

      if (!member) continue;

      const user = await fetchCustomer(email).catch(() => null);

      let response;

      if (user)
        response = await fetchContracts(`customerName=${user.name}`).catch(
          () => null
        );

      if (!response || !user) {
        if (!checkForRoles(member)) continue;
        console.log(`Removed roles for ${member.user.username}`);
        await removeRoles(member);
        continue;
      }

      // const hasNoSubscription =
      //   response.status != "active" &&
      //   new Date(response.nextBillingDate) < new Date();

      // if (hasNoSubscription) {
      if (checkForRoles(member)) continue;
      console.log(`Added roles for ${member.user.username}`);

      await addRoles(member);
      // }

      // if (!hasNoSubscription) {
      //   if (member.roles.cache.has(SUBSCRIPTION_ROLE_ID)) continue;
      //   console.log(`Added roles for ${member.user.username}`);

      //   await addRoles(member);
      // }
    } catch (error) {
      console.log(error);
    }
  }
}
