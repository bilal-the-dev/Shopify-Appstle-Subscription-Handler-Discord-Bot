exports.handleInteractionReply = async (interaction, reply) => {
	if (!interaction.deferred && !interaction.replied)
		return await interaction.reply(reply);
	return await interaction.editReply(reply);
};
