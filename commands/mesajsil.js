const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sil')
    .setDescription('Belirtilen sayıda mesajı siler.')
    .addIntegerOption(option =>
      option.setName('sayi')
        .setDescription('Silinecek mesaj sayısı (1-100)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(ctx, args) {
    let sayi, channel, guild, user, reply;

    // Slash komut mu yoksa prefix komut mu?
    if (ctx.options) {
      // Slash komut
      sayi = ctx.options.getInteger('sayi');
      channel = ctx.channel;
      guild = ctx.guild;
      user = ctx.user;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut
      channel = ctx.channel;
      guild = ctx.guild;
      user = ctx.author;
      reply = (msg) => ctx.message.reply(msg);
      
      if (!args || args.length === 0) {
        return channel.send('❌ Lütfen silinecek mesaj sayısını girin! (1-100)')
          .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }
      
      sayi = parseInt(args[0]);
      if (isNaN(sayi)) {
        return channel.send('❌ Lütfen geçerli bir sayı girin! (1-100)')
          .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }
    } else {
      return;
    }

    // Sayı kontrolü
    if (!sayi || sayi < 1 || sayi > 100) {
      const errorMsg = '❌ Lütfen 1 ile 100 arasında bir sayı girin!';
      if (ctx.options) {
        return reply({ content: errorMsg, ephemeral: true });
      } else {
        return channel.send(errorMsg)
          .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      }
    }

    try {
      // Mesajları sil
      const deleted = await channel.bulkDelete(sayi, true);
      const successMsg = `✅ ${deleted.size} mesaj başarıyla silindi!`;
      
      // Başarı mesajını gönder
      if (ctx.options) {
        await reply({ content: successMsg, ephemeral: true });
      } else {
        // Prefix komutunda başarı mesajını kısa süre göster
        channel.send(successMsg).then(msg =>
          setTimeout(() => msg.delete().catch(() => {}), 3000)
        );
      }

      // Log kanalına bildirim gönder
      const logChannelId = getLogChannel(guild.id);
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          try {
            const logEmbed = new EmbedBuilder()
              .setTitle('🗑️ Mesaj Silindi')
              .setDescription(`**${channel}** kanalında **${deleted.size}** mesaj silindi.`)
              .setColor(0xFF6B6B)
              .addFields([
                {
                  name: '👤 Yetkili',
                  value: `${user}`,
                  inline: true
                },
                {
                  name: '📍 Kanal',
                  value: `${channel}`,
                  inline: true
                },
                {
                  name: '🔢 Silinen Mesaj Sayısı',
                  value: `${deleted.size}`,
                  inline: true
                }
              ])
              .setTimestamp()

            await logChannel.send({ embeds: [logEmbed] });
          } catch (logError) {
            console.error('Log kanalına mesaj gönderilemedi:', logError);
          }
        }
      }
    } catch (error) {
      console.error('Mesaj silme hatası:', error);
      const errorMsg = `❌ Mesajlar silinirken bir hata oluştu: ${error.message}`;
      
      if (ctx.options) {
        await reply({ content: errorMsg, ephemeral: true });
      } else {
        channel.send(errorMsg).then(msg => 
          setTimeout(() => msg.delete().catch(() => {}), 7000)
        );
      }
    }
  }
};
