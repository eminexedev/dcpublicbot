const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { findAnyLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Bir kullanıcının banını kaldırır.')
    .addStringOption(option =>
      option.setName('kullanici_id').setDescription('Ban kaldırılacak kullanıcının ID\'si').setRequired(true)
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
    let userId, reason;

    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      userId = ctx.options.getString('kullanici_id');
      reason = ctx.options.getString('sebep') || 'Sebep belirtilmedi.';
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: 'Bir kullanıcı ID\'si girmelisin.',
          ephemeral: true
        });
      }
      userId = args[0];
      reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
    }

    if (!userId) {
      return ctx.reply({
        content: 'Bir kullanıcı ID\'si girmelisin.',
        ephemeral: true
      });
    }

    // ID formatını kontrol et
    if (!/^\d{17,19}$/.test(userId)) {
      return ctx.reply({ 
        content: '❌ Geçerli bir kullanıcı ID\'si girmelisin. (17-19 haneli sayı)', 
        ephemeral: true 
      });
    }

    // Ban log kanalı kontrolü (ZORUNLU)
    const banLogChannelId = findAnyLogChannel(ctx.guild.id, 'ban');
    if (!banLogChannelId) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ Ban Log Kanalı Gerekli')
        .setDescription('**Unban komutu kullanımı için log kanalı zorunludur.**\n\nGüvenlik ve şeffaflık amacıyla tüm unban işlemleri loglanmalıdır.')
        .addFields(
          {
            name: '🔧 Kurulum Adımları',
            value: '```bash\n/banlogkanal #ban-log-kanalı\n```\nKomutunu kullanarak özel ban log kanalı ayarlayın.',
            inline: false
          },
          {
            name: '📋 Desteklenen Formatlar',
            value: '• `/banlogkanal #kanal` *(Slash komut)*\n• `.banlogkanal #kanal` *(Prefix komut)*',
            inline: true
          },
          {
            name: '👮‍♂️ Gerekli Yetki',
            value: '**Yönetici** yetkisi',
            inline: true
          },
          {
            name: '📊 Durum Kontrolü',
            value: '`/banlogdurum` ile mevcut ayarları görüntüleyin',
            inline: true
          }
        )
        .setFooter({ 
          text: `${ctx.guild.name} • Güvenlik protokolü aktif`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Ban log kanalının hala var olup olmadığını kontrol et
    const banLogChannel = ctx.guild.channels.cache.get(banLogChannelId);
    if (!banLogChannel) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ Ban Log Kanalı Bulunamadı')
        .setColor(0xFFA500)
        .setDescription('Ayarlanan ban log kanalı silinmiş veya erişilemiyor.')
        .addFields(
          {
            name: '🔧 Çözüm',
            value: '`/banlogkanal #yeni-kanal` komutunu kullanarak yeni bir ban log kanalı ayarlayın.',
            inline: false
          },
          {
            name: '🆔 Kayıtlı Kanal ID',
            value: `\`${banLogChannelId}\``,
            inline: true
          },
          {
            name: '📊 Durum Kontrolü',
            value: '`/banlogdurum` komutuyla mevcut durumu kontrol edebilirsiniz.',
            inline: false
          }
        )
        .setFooter({ text: 'Unban işlemi iptal edildi.' })
        .setTimestamp();
      
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    // Yetki kontrolleri
    const botMember = ctx.guild.members.cache.get(ctx.client.user.id);
    if (!botMember) {
      console.log('[UNBAN DEBUG] Bot member bulunamadı!');
      return ctx.reply({ content: '❌ Bot bilgisi alınamıyor. Lütfen tekrar deneyin.', ephemeral: true });
    }
    
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      console.log(`[UNBAN DEBUG] Bot unban yetkisi yok. Bot yetkileri: ${botMember.permissions.toArray().join(', ')}`);
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Bot Yetkisi Yetersiz')
        .setColor(0xFF0000)
        .setDescription('Botun unban yetkisi bulunmuyor.')
        .addFields(
          {
            name: '🔧 Çözüm',
            value: 'Bot rolüne **"Üyeleri Yasakla"** yetkisini verin.',
            inline: false
          },
          {
            name: '🤖 Bot Mevcut Yetkileri',
            value: botMember.permissions.toArray().slice(0, 10).join(', ') + (botMember.permissions.toArray().length > 10 ? '...' : ''),
            inline: false
          }
        )
        .setTimestamp();
      return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Komutu kullanan kişinin yetkisini kontrol et
    const executorMember = ctx.guild.members.cache.get(ctx.user.id);
    if (!executorMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return ctx.reply({ content: '❌ Unban yetkisine sahip değilsiniz!', ephemeral: true });
    }

    try {
      console.log(`[UNBAN DEBUG] Unban işlemi başlatılıyor - User ID: ${userId}`);
      
      // Kullanıcının banlı olup olmadığını kontrol et
      const banInfo = await ctx.guild.bans.fetch(userId).catch(() => null);
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
        return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      // Unban işlemi
      await ctx.guild.members.unban(userId, reason);
      console.log(`[UNBAN DEBUG] Unban işlemi başarılı - User ID: ${userId}`);
      
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
            value: `**${ctx.user.tag}**\n\`ID: ${ctx.user.id}\``,
            inline: true
          },
          {
            name: '📝 Unban Sebebi',
            value: `\`${reason}\``,
            inline: false
          }
        )
        .setFooter({ 
          text: `${ctx.guild.name} • Kullanıcı artık sunucuya tekrar katılabilir`, 
          iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
        })
        .setTimestamp();
      
      await ctx.reply({ embeds: [successEmbed] });
      
      // Unban log sistemine gönder
      await sendUnbanLog(ctx.guild, banInfo.user, ctx.user, reason, banInfo.reason);
      
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
      
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

// Unban log gönderen fonksiyon
async function sendUnbanLog(guild, unbannedUser, moderator, reason, originalBanReason) {
  // Log kanalını bul (ban kanalı öncelikli, sonra diğerleri)
  const logChannelId = findAnyLogChannel(guild.id, 'ban');
  
  if (!logChannelId) {
    console.log(`[UNBAN] Log kanalı bulunamadı - Guild ID: ${guild.id}`);
    return; // Log kanalı ayarlanmamışsa çık
  }
  
  console.log(`[UNBAN] Log kanalı bulundu - Channel ID: ${logChannelId}`);
  
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) {
    console.log(`[UNBAN] Log kanalına erişilemedi - Channel ID: ${logChannelId}`);
    return; // Log kanalı bulunamazsa çık
  }
  
  console.log(`[UNBAN] Log kanalına erişim başarılı - Kanal: ${logChannel.name}`);

  // Unban log embed'i oluştur
  const unbanEmbed = new EmbedBuilder()
    .setColor(0x00FF00) // Green color for unban
    .setTitle('🔓 Kullanıcı Ban Kaldırıldı')
    .setDescription(`**Bir kullanıcının banı kaldırıldı.**\n\n*Kullanıcı artık sunucuya tekrar katılabilir.*`)
    .setThumbnail(unbannedUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      {
        name: '👤 Ban Kaldırılan Kullanıcı',
        value: `**${unbannedUser.tag}**\n\`ID: ${unbannedUser.id}\``,
        inline: true
      },
      {
        name: '👮‍♂️ Moderatör',
        value: `**${moderator.tag}**\n\`ID: ${moderator.id}\``,
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
        value: `\`${originalBanReason || 'Sebep belirtilmemiş'}\``,
        inline: false
      },
      {
        name: '🔧 İşlem Detayları',
        value: `\`\`\`yaml\nKullanıcı ID: ${unbannedUser.id}\nModeratör ID: ${moderator.id}\nİşlem: Ban Kaldırma\nDurum: Başarılı\n\`\`\``,
        inline: false
      }
    )
    .setFooter({ 
      text: `${guild.name} • Moderasyon sistemi`, 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    })
    .setTimestamp();

  try {
    console.log(`[UNBAN] Log embed gönderiliyor...`);
    await logChannel.send({ embeds: [unbanEmbed] });
    console.log(`[UNBAN] Log başarıyla gönderildi!`);
  } catch (error) {
    console.error('[UNBAN] Log gönderilirken hata:', error);
  }
}
