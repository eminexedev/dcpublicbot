const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setInviteLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('davetlog')
    .setDescription('Davet loglarının gönderileceği kanalı ayarlar.')
    .addChannelOption(option =>
      option.setName('kanal').setDescription('Log kanalı').setRequired(true)
    )
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
    if (!channel) return reply({ content: 'Kanal bulunamadı.', ephemeral: true });
    setInviteLogChannel(guild.id, channel.id);
    await reply({ content: `Davet log kanalı başarıyla ayarlandı: ${channel}` });
  }
};
