const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mutefix')
    .setDescription('Muted rolünün tüm kanallardaki izinlerini düzeltir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'moderation',
  description: 'Muted rolünün tüm kanallardaki izinlerini düzeltir.',
  usage: '.mutefix',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    // Eğer zaten yanıtlandıysa tekrar işleme
    if (ctx.replied || ctx.deferred) return;
    
    // Mute rolünü bul
    const muteRole = ctx.guild.roles.cache.find(role => role.name === 'Muted');
    
    if (!muteRole) {
      return ctx.reply({
        content: '❌ Muted rolü bulunamadı. Önce birini mute edin ki rol oluşturulsun.',
        ephemeral: true
      });
    }

    await ctx.reply({
      content: '🔧 Muted rolü izinleri düzeltiliyor...',
      ephemeral: true
    });

    let fixedChannels = 0;
    let errorChannels = 0;

    // Tüm kanallarda izinleri düzelt
    const channels = ctx.guild.channels.cache;
    for (const [channelId, channel] of channels) {
      try {
        if (channel.isTextBased()) {
          await channel.permissionOverwrites.edit(muteRole, {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false,
            UseApplicationCommands: false,
            SendTTSMessages: false,
            UseExternalEmojis: false,
            UseExternalStickers: false
          });
          fixedChannels++;
        } else if (channel.isVoiceBased()) {
          await channel.permissionOverwrites.edit(muteRole, {
            Speak: false,
            Stream: false,
            UseVAD: false,
            UseApplicationCommands: false,
            UseSoundboard: false,
            UseExternalSounds: false
          });
          fixedChannels++;
        }
      } catch (error) {
        console.log(`Kanal izni düzeltilemedi: ${channel.name}`, error.message);
        errorChannels++;
      }
    }

    // Sonuç embed'i
    const resultEmbed = new EmbedBuilder()
      .setColor(errorChannels > 0 ? '#FFA500' : '#57F287')
      .setTitle('🔧 Mute İzinleri Düzeltildi')
      .addFields(
        {
          name: '✅ Düzeltilen Kanallar',
          value: `${fixedChannels} kanal`,
          inline: true
        },
        {
          name: '❌ Hata Alan Kanallar',
          value: `${errorChannels} kanal`,
          inline: true
        },
        {
          name: '📋 Toplam Kanal',
          value: `${fixedChannels + errorChannels} kanal`,
          inline: true
        }
      )
      .setDescription(
        errorChannels > 0 
          ? '⚠️ Bazı kanallarda izin düzeltme işlemi başarısız oldu. Bot\'un o kanallarda yeterli yetkisi olmayabilir.'
          : '✅ Tüm kanallarda Muted rolü izinleri başarıyla düzeltildi!'
      )
      .setTimestamp();

    await ctx.followUp({ embeds: [resultEmbed], ephemeral: true });
  }
};