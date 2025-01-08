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
  EmbedBuilder,
} = require("discord.js");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cron = require("node-cron");

dotenv.config({ path: ".env" });

const verifyEmail = require("./models/verifyEmail");
const { fetchContracts } = require("./apstleAPI");
const { addRole, checkForRole, removeRole } = require("./misc");
const { handleInteractionReply } = require("./handlnteraction");
//
const { TOKEN, GUILD_ID, MONGO_URI, OWNER_ID, LOGS_CHANNEL_ID } = process.env;

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

  checkForSubscriptions();
  cron.schedule("0 0 */2 * *", checkForSubscriptions);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content !== "!send") return;
  console.log("Message was !send");

  if (message.author.id !== OWNER_ID) return;

  console.log("Sending panel");

  const row = generateButtons();
  await message.channel.send({
    content: "Activate your subscription!",
    components: [row],
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId !== "verify") return;

  const modal = new ModalBuilder().setCustomId("email").setTitle("Email");

  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("E-Mail")
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
        `Mail already linked to a Discord account, please contact support`
      );

    console.log(email);
    // no need to make two api requests probably
    // await fetchCustomer(email);

    const { subscriptionFinished, contract } = await fetchContracts(
      `customerName=${email}`
    );

    if (subscriptionFinished)
      throw new Error(
        `You do not seem have to any active subscription. In case you do, please contact support`
      );

    const variantId = await addRole(member, contract);

    const hasAlreadyRegistered = await verifyEmail.findOne({ userId });

    if (hasAlreadyRegistered)
      await hasAlreadyRegistered.updateOne({ email, variantId });

    if (!hasAlreadyRegistered)
      await verifyEmail.create({
        email,
        userId,
        variantId,
      });

    await handleInteractionReply(interaction, {
      content: `Subscription successfully activated for ${email}`,
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
    .setLabel("Verify")
    .setStyle(ButtonStyle.Primary)

    .setEmoji("🚀");

  return new ActionRowBuilder().addComponents(verify);
};

async function checkForSubscriptions() {
  const channel = client.channels.cache.get(LOGS_CHANNEL_ID);

  const docs = await verifyEmail.find().catch((e) => console.log(e));
  console.log("running every minute");

  for (const doc of docs) {
    try {
      const { userId, email, variantId } = doc;
      const guild = client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(userId).catch(() => null);

      if (!member) continue;

      const response = await fetchContracts(`customerName=${email}`);

      const { contract, subscriptionFinished, finishedAt } = response;
      // console.log(response);

      let color;

      const fields = [
        {
          name: "Order No",
          value: `${contract?.orderName ?? "#0000"}`,
        },
        { name: "User", value: `${member} (${member.id})` },
        {
          name: "Status",
          value:
            contract?.status?.toUpperCase() ??
            "No subscription active currently",
        },

        { name: "Email", value: email },
        { name: "Sub finished", value: subscriptionFinished ? "Yes" : "No" },
      ];

      if (subscriptionFinished) {
        if (!checkForRole(member, contract ?? variantId)) continue;

        await removeRole(member);

        console.log(`Removed roles for ${member.user.username}`);

        fields.push({
          name: "Finished At",
          value: `<t:${Math.floor((finishedAt ?? Date.now()) / 1000)}:f>`,
        });

        color = 0xffa500;
      }

      if (!subscriptionFinished) {
        if (checkForRole(member, contract)) continue;

        const newVariantId = await addRole(member, contract);

        console.log(newVariantId);

        if (newVariantId !== variantId)
          await doc.updateOne({ variantId: newVariantId });
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
