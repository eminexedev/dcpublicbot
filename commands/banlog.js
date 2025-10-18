const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setAutoLogChannel, getAutoLogChannel, removeAutoLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlog')
    .setDescription('Ban log kanalını ayarlar veya kaldırır.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('ayarla')
        .setDescription('Ban log kanalını ayarlar.')
        .addChannelOption(option =>
          option.setName('kanal').setDescription('Log kanalı').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kaldir')
        .setDescription('Ban log kanalını kaldırır.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('goster')
        .setDescription('Mevcut ban log kanalını gösterir.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(ctx, args) {
    let subcommand, channel, guild, member, reply;

    // Slash komut mu yoksa prefix komut mu?
    if (ctx.options) {
      // Slash komut
      subcommand = ctx.options.getSubcommand();
      if (subcommand === 'ayarla') {
        channel = ctx.options.getChannel('kanal');
      }
      guild = ctx.guild;
      member = ctx.member;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut
      guild = ctx.guild;
      member = ctx.member;
      reply = (msg) => ctx.message.reply(msg);
      
      if (!args || args.length === 0) {
        return ctx.message.reply('Kullanım:\\n`banlog ayarla #kanal`\\n`banlog kaldir`\\n`banlog goster`');
      }
      
      subcommand = args[0].toLowerCase();
      
      if (subcommand === 'ayarla') {
        if (!args[1]) {
          return ctx.message.reply('❌ Bir kanal belirtmelisiniz!');
        }
        
        const channelMatch = args[1].match(/<#(\d+)>/);
        const channelId = channelMatch ? channelMatch[1] : args[1];
        channel = guild.channels.cache.get(channelId);
        
        if (!channel) {
          return ctx.message.reply('❌ Geçerli bir kanal belirtmelisiniz!');
        }
      }
    } else {
      return;
    }

    // Yetki kontrolü
    if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return reply({
        content: '❌ Bu komutu kullanabilmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız!',
        ephemeral: true
      });
    }

    switch (subcommand) {
      case 'ayarla':
        if (!channel?.isTextBased()) {
          return reply({
            content: '❌ Sadece metin kanalları seçebilirsiniz!',
            ephemeral: true
          });
        }

        const success = setAutoLogChannel(guild.id, channel.id);
        if (success) {
          return reply({
            content: `✅ Ban log kanalı ${channel} olarak ayarlandı!`,
            ephemeral: true
          });
        } else {
          return reply({
            content: '❌ Log kanalı ayarlanırken bir hata oluştu!',
            ephemeral: true
          });
        }

      case 'kaldir':
      case 'kaldır':
        const removed = removeAutoLogChannel(guild.id);
        if (removed) {
          return reply({
            content: '✅ Ban log kanalı kaldırıldı!',
            ephemeral: true
          });
        } else {
          return reply({
            content: '❌ Log kanalı kaldırılırken bir hata oluştu!',
            ephemeral: true
          });
        }

      case 'goster':
      case 'göster':
        const currentChannelId = getAutoLogChannel(guild.id);
        if (currentChannelId) {
          const currentChannel = guild.channels.cache.get(currentChannelId);
          if (currentChannel) {
            return reply({
              content: `📋 Mevcut ban log kanalı: ${currentChannel}`,
              ephemeral: true
            });
          } else {
            return reply({
              content: '❌ Ayarlı log kanalı bulunamadı! (Kanal silinmiş olabilir)',
              ephemeral: true
            });
          }
        } else {
          return reply({
            content: '📋 Henüz bir ban log kanalı ayarlanmamış.',
            ephemeral: true
          });
        }

      default:
        return reply({
          content: 'Kullanım:\\n`banlog ayarla #kanal`\\n`banlog kaldir`\\n`banlog goster`',
          ephemeral: true
        });
    }
  }
};
