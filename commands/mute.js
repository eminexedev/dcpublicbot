const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getAutoLogChannel } = require('../autoLogConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Bir kullanıcıyı belirli süreliğine susturur.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('sure').setDescription('Süre (dakika)').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep').setDescription('Susturma sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),
  async execute(ctx) {
    let user, sure, reason, guild, member, replyUser, reply, logChannelId, logChannel;
    if (ctx.options) {
      user = ctx.options.getUser('kullanici');
      sure = ctx.options.getInteger('sure');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi.';
      guild = ctx.guild;
      replyUser = ctx.user;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      guild = ctx.guild;
      replyUser = ctx.author;
      // .mute @kullanici sure [sebep]
      if (!ctx.args[0] || !ctx.args[1]) return ctx.message.reply('Kullanıcı ve süre belirtmelisin. Örnek: .mute @kullanıcı 10 [sebep]');
      const idMatch = ctx.args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (!userId) return ctx.message.reply('Geçerli bir kullanıcı etiketlemelisin veya ID girmelisin.');
      user = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
      sure = parseInt(ctx.args[1]);
      if (isNaN(sure) || sure < 1) return ctx.message.reply('Geçerli bir süre (dakika) belirtmelisin.');
      reason = ctx.args.slice(2).join(' ') || 'Sebep belirtilmedi.';
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!user) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: true });
    if (!member.moderatable) return reply({ content: 'Bu kullanıcı susturulamıyor.', ephemeral: true });
    await member.timeout(sure * 60 * 1000, reason);
    await reply({ content: `${user.tag} ${sure} dakika susturuldu. Sebep: ${reason}` });
    // Log
    logChannelId = getAutoLogChannel(guild.id);
    if (logChannelId) {
      logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        logChannel.send({ content: `:mute: ${user.tag} ${sure} dakika susturuldu. Yetkili: ${replyUser.tag} | Sebep: ${reason}` });
      }
    }
  }
};
