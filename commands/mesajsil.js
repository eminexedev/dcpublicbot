const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');

function getLogChannelId(guildId) {
  try {
    const config = require(path.join(__dirname, '../prefixConfig.json'));
    return config[guildId]?.logChannelId;
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sil')
    .setDescription('Belirtilen sayıda mesajı siler.')
    .addIntegerOption(option =>
      option.setName('sayi').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(ctx) {
    let sayi, channel, reply, guild, userId;
    if (ctx.options) {
      sayi = ctx.options.getInteger('sayi');
      channel = ctx.channel;
      guild = ctx.guild;
      userId = ctx.user?.id;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      channel = ctx.channel;
      guild = ctx.guild;
      userId = ctx.author?.id;
      // Eğer sayı 1 ise, komut mesajı + bir önceki mesajı sil
      if (ctx.args[0] === '1') {
        const messages = await channel.messages.fetch({ limit: 2 });
        await channel.bulkDelete(messages, true);
        // Log kanalına sadece send ile düz mesaj gönder
        const logChannelId = getLogChannelId(guild.id);
        if (logChannelId) {
          const logChannel = guild.channels.cache.get(logChannelId);
          if (logChannel) {
            try {
              await logChannel.send({
                embeds: [
                  {
                    title: 'Mesaj Silindi',
                    description: ` ${channel} kanalında komut ve bir önceki mesaj silindi.`,
                    color: 0xED4245,
                    fields: [
                      { name: 'Yetkili', value: `<@${userId}>`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                  }
                ]
              });
            } catch (e) {}
          }
        }
        // Komut mesajı silindiği için reply yerine send kullan
        channel.send('Komut ve bir önceki mesaj silindi.').then(msg => setTimeout(() => msg.delete(), 5000)).catch(() => {});
        return;
      }
      sayi = parseInt(ctx.args[0]);
      if (isNaN(sayi) || sayi < 1 || sayi > 100) {
        channel.send('Lütfen 1 ile 100 arasında bir sayı girin.').then(msg => setTimeout(() => msg.delete(), 5000)).catch(() => {});
        return;
      }
    } else {
      return;
    }
    if (!sayi || sayi < 1 || sayi > 100) {
      channel.send('Lütfen 1 ile 100 arasında bir sayı girin.').then(msg => setTimeout(() => msg.delete(), 5000)).catch(() => {});
      return;
    }
    try {
      const deleted = await channel.bulkDelete(sayi, true);
      channel.send(`${deleted.size} mesaj silindi.`).then(msg => setTimeout(() => msg.delete(), 5000)).catch(() => {});
      // Log kanalına bildir (prefixConfig.json ile)
      const logChannelId = getLogChannelId(guild.id);
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          try {
            await logChannel.send({
              embeds: [
                {
                  title: 'Mesaj Silindi',
                  description: ` ${channel} kanalında ${sayi === 1 ? 'komut ve bir önceki mesaj' : deleted.size + ' mesaj'} silindi.`,
                  color: 0xED4245,
                  fields: [
                    { name: 'Yetkili', value: `<@${userId}>`, inline: true }
                  ],
                  timestamp: new Date().toISOString()
                }
              ]
            });
          } catch (e) {}
        }
      }
    } catch (err) {
      channel.send(`Mesajlar silinirken hata oluştu: ${err.message}`).then(msg => setTimeout(() => msg.delete(), 5000)).catch(() => {});
    }
  }
};
