const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setWelcomeChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hosgeldin-kanal')
    .setDescription('Hoş geldin görselinin gönderileceği kanalı ayarlar.')
    .addChannelOption(opt => opt.setName('kanal').setDescription('Kanal').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(ctx) {
    let channel, guild, reply;
    if (ctx.options) {
      channel = ctx.options.getChannel('kanal');
      guild = ctx.guild;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      guild = ctx.guild;
      if (!ctx.args[0]) return ctx.message.reply('Bir kanal etiketlemelisin.');
      const idMatch = ctx.args[0].match(/<#(\d{17,})>/);
      const channelId = idMatch ? idMatch[1] : null;
      if (!channelId) return ctx.message.reply('Geçerli bir kanal etiketlemelisin.');
      channel = guild.channels.cache.get(channelId);
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!channel || channel.type !== 0) return reply({ content: 'Metin kanalı seçmelisin.', ephemeral: true });
    setWelcomeChannel(guild.id, channel.id);
    await reply({ content: `Hoş geldin kanalı ayarlandı: ${channel}` });
  }
};
