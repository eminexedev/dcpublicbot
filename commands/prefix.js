const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { setPrefix, getPrefix } = require('../prefixConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Sunucu için komut prefixini ayarlayın.'),
  async execute(interactionOrMessage, args) {
    // Slash komut mu?
    if (interactionOrMessage.isChatInputCommand && interactionOrMessage.isChatInputCommand()) {
      // Slash komut için
      return interactionOrMessage.reply({
        content: 'Prefix komutu (slash komut).',
        flags: 64 // 64 = Ephemeral
      });
    }
    // Prefix komut mu?
    if (interactionOrMessage.content) {
      // Prefix komut için
      return interactionOrMessage.reply('Prefix komutu (prefix komut).');
    }
    // Diğer durumlar
    return;
  },
  async handleSelect(interaction) {
    if (interaction.customId !== 'prefix_select') return;
    const prefix = interaction.values[0];
    setPrefix(interaction.guild.id, prefix);
    await interaction.update({ content: `Prefix başarıyla ayarlandı: \`${prefix}\``, components: [], ephemeral: true });
  }
};
