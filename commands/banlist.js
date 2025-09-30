const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('Sunucudaki banlı kullanıcıları listeler.')
    .addIntegerOption(option =>
      option.setName('sayfa')
        .setDescription('Gösterilecek sayfa numarası (her sayfada 10 kullanıcı)')
        .setRequired(false)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(ctx) {
    let guild, replyUser, reply, page;
    
    if (ctx.options) {
      // Slash komut
      guild = ctx.guild;
      replyUser = ctx.user;
      page = ctx.options.getInteger('sayfa') || 1;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut
      guild = ctx.guild;
      replyUser = ctx.author;
      page = parseInt(ctx.args[0]) || 1;
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }

    // Yetki kontrolü
    const executorMember = guild.members.cache.get(replyUser.id);
    if (!executorMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: '❌ Bu komutu kullanmak için ban yetkisine sahip olmalısınız!', ephemeral: true });
    }

    try {
      // Ban listesini getir
      const bans = await guild.bans.fetch();
      
      if (bans.size === 0) {
        const noBansEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('📋 Ban Listesi')
          .setDescription('**Bu sunucuda banlı kullanıcı bulunmuyor!** 🎉')
          .addFields(
            {
              name: '✅ Temiz Sunucu',
              value: 'Sunucunuzda hiç banlı kullanıcı yok.',
              inline: false
            },
            {
              name: '🔨 Ban Komutları',
              value: '• `/ban` - Kullanıcı banla\n• `/unban` - Ban kaldır',
              inline: true
            },
            {
              name: '📊 İstatistikler',
              value: `Toplam Ban: **0**\nToplam Üye: **${guild.memberCount}**`,
              inline: true
            }
          )
          .setFooter({ 
            text: `${guild.name} • Moderasyon sistemi`, 
            iconURL: guild.iconURL({ dynamic: true }) || undefined 
          })
          .setTimestamp();
        
        return reply({ embeds: [noBansEmbed], ephemeral: true });
      }

      // Sayfalama hesaplamaları
      const itemsPerPage = 10;
      const totalPages = Math.ceil(bans.size / itemsPerPage);
      
      if (page > totalPages) {
        return reply({ 
          content: `❌ Geçersiz sayfa numarası! Toplam ${totalPages} sayfa var.`, 
          ephemeral: true 
        });
      }

      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const bansArray = Array.from(bans.values());
      const currentPageBans = bansArray.slice(startIndex, endIndex);

      // Ban listesi embed'i oluştur
      const banListEmbed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('📋 Sunucu Ban Listesi')
        .setDescription(`**Toplam ${bans.size} banlı kullanıcı** *(Sayfa ${page}/${totalPages})*`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png');

      // Her ban için field ekle
      currentPageBans.forEach((ban, index) => {
        const globalIndex = startIndex + index + 1;
        const user = ban.user;
        const reason = ban.reason || 'Sebep belirtilmemiş';
        
        // Uzun sebepleri kısalt
        const truncatedReason = reason.length > 100 ? reason.substring(0, 97) + '...' : reason;
        
        banListEmbed.addFields({
          name: `${globalIndex}. ${user.tag}`,
          value: `**ID:** \`${user.id}\`\n**Sebep:** ${truncatedReason}`,
          inline: false
        });
      });

      // Sayfalama bilgisi
      if (totalPages > 1) {
        banListEmbed.addFields({
          name: '📄 Sayfalama',
          value: `\`\`\`\nSayfa: ${page}/${totalPages}\nToplam: ${bans.size} ban\nSayfa başına: ${itemsPerPage} kullanıcı\n\`\`\``,
          inline: false
        });
      }

      // Footer ve timestamp
      banListEmbed.setFooter({ 
        text: `${guild.name} • Moderasyon sistemi • /unban ile ban kaldırabilirsiniz`, 
        iconURL: guild.iconURL({ dynamic: true }) || undefined 
      })
      .setTimestamp();

      return reply({ embeds: [banListEmbed], ephemeral: true });

    } catch (error) {
      console.error('[BANLIST] Hata:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Ban Listesi Alınamadı')
        .setDescription('Ban listesi getirilirken bir hata oluştu.')
        .addFields(
          {
            name: '🔍 Olası Nedenler',
            value: '• Bot yetkisi yetersiz\n• Sunucu erişimi problemi\n• Geçici Discord API sorunu',
            inline: false
          },
          {
            name: '💡 Çözüm Önerileri',
            value: '• Bot yetkilerini kontrol edin\n• Birkaç saniye sonra tekrar deneyin\n• Sunucu yöneticisiyle iletişime geçin',
            inline: false
          }
        )
        .setFooter({ text: 'Hata kodu: ' + (error.code || 'Bilinmiyor') })
        .setTimestamp();
      
      return reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
