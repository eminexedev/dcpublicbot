const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getAutoLogChannel } = require('../autoLogConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Bir kullanıcının banını kaldırır.')
    .addStringOption(option =>
      option.setName('kullanici_id').setDescription('Banı kaldırılacak kullanıcının ID\'si').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep').setDescription('Unban sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  
  category: 'moderation',
  description: 'Bir kullanıcının banını kaldırır. Kullanım: .unban <kullanıcı_id> [sebep]',
  usage: '.unban <kullanıcı_id> [sebep]',
  permissions: [PermissionFlagsBits.BanMembers],
  
  async execute(ctx, args) {
    // Slash komut mu yoksa prefix komut mu?
    let userId, reason, guild, replyUser, reply;
    
    if (ctx.options) {
      // Slash komut
      userId = ctx.options.getString('kullanici_id');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi.';
      guild = ctx.guild;
      replyUser = ctx.user;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      // Prefix komut
      guild = ctx.guild;
      replyUser = ctx.author;
      
      if (!args || args.length === 0) {
        return ctx.message.reply('Bir kullanıcı ID\'si girmelisin.');
      }
      
      // ID'yi doğrudan al
      userId = args[0];
      reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    
    // ID formatını kontrol et
    if (!/^\d{17,19}$/.test(userId)) {
      return reply({ 
        content: '❌ Geçerli bir kullanıcı ID\'si girmelisin. (17-19 haneli sayı)'
      });
    }

    // Yetki kontrolleri
    const botMember = guild?.members?.cache?.get(guild.members.me.id);
    if (!botMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: 'Botun ban kaldırma yetkisi yok! \nLütfen "Üyeleri Yasakla" yetkisini verin.' });
    }

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorMember = guild?.members?.cache?.get(replyUser?.id);
    if (!executorMember?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return reply({ content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Yasakla" yetkisine sahip olmalısın.' });
    }

    try {
      console.log(`[UNBAN] Unban işlemi başlatılıyor - User ID: ${userId}`);
      
      // Kullanıcının banlı olup olmadığını kontrol et
      const banInfo = await guild.bans.fetch(userId).catch(() => null);
      if (!banInfo) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ Kullanıcı Banlı Değil')
          .setDescription('Bu kullanıcı sunucuda banlı görünmüyor.')
          .addFields(
            {
              name: '🆔 Kontrol Edilen ID',
              value: `\`${userId}\``,
              inline: true
            },
            {
              name: '💡 Öneriler',
              value: '• ID\'yi tekrar kontrol edin\n• `/banlist` ile ban listesini görüntüleyin\n• Kullanıcı zaten unban edilmiş olabilir',
              inline: false
            }
          )
          .setFooter({ text: 'Unban işlemi iptal edildi' })
          .setTimestamp();
        return reply({ embeds: [errorEmbed] });
      }

      // Unban işlemi
      await guild.members.unban(userId, reason);
      console.log(`[UNBAN] Unban işlemi başarılı - User ID: ${userId}`);
      
      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Unban İşlemi Başarılı')
        .setDescription(`**${banInfo.user.tag}** kullanıcısının banı başarıyla kaldırıldı.`)
        .setThumbnail(banInfo.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '👤 Unban Edilen Kullanıcı',
            value: `**${banInfo.user.tag}**\n\`ID: ${banInfo.user.id}\``,
            inline: true
          },
          {
            name: '👮‍♂️ İşlemi Yapan',
            value: `**${replyUser.tag}**\n\`ID: ${replyUser.id}\``,
            inline: true
          },
          {
            name: '📝 Unban Sebebi',
            value: `\`${reason}\``,
            inline: false
          }
        )
        .setFooter({ 
          text: `${guild.name} • Kullanıcı artık sunucuya tekrar katılabilir`, 
          iconURL: guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      await reply({ embeds: [successEmbed] });
      
      // Unban Log sistemi
      const logChannelId = getAutoLogChannel(guild.id);
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          // Unban log embed'i
          const unbanLogEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔓 Kullanıcı Banı Kaldırıldı')
            .setDescription(`**Bir kullanıcının banı kaldırıldı.**\n\n*Kullanıcı artık sunucuya tekrar katılabilir.*`)
            .setThumbnail(banInfo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
              {
                name: '👤 Ban Kaldırılan Kullanıcı',
                value: `**${banInfo.user.tag}**\n\`ID: ${banInfo.user.id}\``,
                inline: true
              },
              {
                name: '👮‍♂️ Yetkili',
                value: `**${replyUser.tag}**\n\`ID: ${replyUser.id}\``,
                inline: true
              },
              {
                name: '🕐 Unban Zamanı',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>\n<t:${Math.floor(Date.now() / 1000)}:R>`,
                inline: true
              },
              {
                name: '📝 Unban Sebebi',
                value: `\`${reason}\``,
                inline: false
              },
              {
                name: '📋 Orijinal Ban Sebebi',
                value: `\`${banInfo.reason || 'Sebep belirtilmemiş'}\``,
                inline: false
              }
            )
            .setFooter({ 
              text: `${guild.name} • Moderasyon sistemi`, 
              iconURL: guild.iconURL({ dynamic: true }) || undefined 
            })
            .setTimestamp();

          await logChannel.send({ embeds: [unbanLogEmbed] });
        }
      }
    } catch (err) {
      console.error('[UNBAN DEBUG] Unban işlemi hatası:', err);
      console.error('[UNBAN DEBUG] Hata detayları:', {
        code: err.code,
        message: err.message,
        httpStatus: err.httpStatus,
        method: err.method,
        path: err.path
      });
      
      let errorMessage = '❌ Unban işlemi sırasında bir hata oluştu.';
      let errorDetails = 'Bilinmeyen hata';
      
      // Discord API hata kodlarına göre spesifik mesajlar
      switch (err.code) {
        case 50013:
          errorMessage = '❌ Bot yetkisi yetersiz!';
          errorDetails = 'Botun "Üyeleri Yasakla" yetkisi yok veya rol hiyerarşisi problemi var.';
          break;
        case 50001:
          errorMessage = '❌ Erişim reddedildi!';
          errorDetails = 'Bot bu kullanıcıya veya sunucu ayarlarına erişemiyor.';
          break;
        case 10026:
          errorMessage = '❌ Kullanıcı bulunamadı!';
          errorDetails = 'Bu ID\'ye sahip banlı kullanıcı bulunamadı.';
          break;
        default:
          errorDetails = err.message || 'Detay bulunamadı';
      }
      
      const errorEmbed = new EmbedBuilder()
        .setTitle(errorMessage)
        .setColor(0xFF0000)
        .addFields(
          {
            name: '📝 Hata Detayı',
            value: errorDetails,
            inline: false
          },
          {
            name: '🔍 Teknik Bilgi',
            value: `Hata Kodu: \`${err.code || 'Bilinmiyor'}\`\nHTTP Durum: \`${err.httpStatus || 'Bilinmiyor'}\``,
            inline: false
          },
          {
            name: '💡 Öneriler',
            value: '• Bot yetkilerini kontrol edin\n• Kullanıcı ID\'sini doğrulayın\n• Ban listesini kontrol edin',
            inline: false
          }
        )
        .setTimestamp();
      
      await reply({ embeds: [errorEmbed] });
    }
  }
};