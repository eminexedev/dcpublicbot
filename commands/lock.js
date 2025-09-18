const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Bulunduğunuz metin kanalını kilitler (yazmaya kapatır).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(ctx) {
    let channel, guild, member, reply;
    if (ctx.options) {
      guild = ctx.guild;
      member = ctx.member;
      channel = ctx.channel;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      guild = ctx.guild;
      member = ctx.member;
      channel = ctx.channel;
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return reply({ content: 'Bu komutu kullanmak için kanal yönetme yetkisine sahip olmalısın.', ephemeral: true });
    }
    if (channel.type !== 0 && channel.type !== ChannelType.GuildText) {
      return reply({ content: 'Bu komut sadece metin kanallarında kullanılabilir.', ephemeral: true });
    }
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
    await reply({ content: `🔒 ${channel} kanalı başarıyla kilitlendi!` });
  }
};
