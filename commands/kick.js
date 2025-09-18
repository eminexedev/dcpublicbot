const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getAutoLogChannel } = require('../autoLogConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Bir kullanıcıyı sunucudan atar.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep').setDescription('Atılma sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(ctx) {
    let user, reason, guild, member, replyUser, reply, logChannelId, logChannel;
    if (ctx.options) {
      user = ctx.options.getUser('kullanici');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi.';
      guild = ctx.guild;
      replyUser = ctx.user;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      guild = ctx.guild;
      replyUser = ctx.author;
      // .kick @kullanici [sebep]
      if (!ctx.args[0]) return ctx.message.reply('Bir kullanıcı etiketlemelisin veya ID girmelisin.');
      const idMatch = ctx.args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (!userId) return ctx.message.reply('Geçerli bir kullanıcı etiketlemelisin veya ID girmelisin.');
      user = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
      reason = ctx.args.slice(1).join(' ') || 'Sebep belirtilmedi.';
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!user) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    if (!member.kickable) return reply({ content: 'Bu kullanıcı atılamıyor.', ephemeral: true });
    await member.kick(reason);
    await reply({ content: `${user.tag} başarıyla atıldı. Sebep: ${reason}` });
    // Log
    logChannelId = getAutoLogChannel(guild.id);
    if (logChannelId) {
      logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send({ content: `:boot: ${user.tag} atıldı. Yetkili: ${replyUser.tag} | Sebep: ${reason}` });
      }
    }
  }
};
