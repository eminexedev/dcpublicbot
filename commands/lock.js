const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { findAnyLogChannel } = require('../config');
const { getDefaultLockRole } = require('./lockrol');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Bulunduğunuz metin kanalını kilitler (yazmaya kapatır).')
    .addRoleOption(option =>
      option.setName('yetkili-rol')
        .setDescription('Bu role sahip kullanıcılar kilitle etkilenmez (opsiyonel)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  description: 'Bulunduğunuz metin kanalını kilitler (yazmaya kapatır). Yetkili rol belirterek o rolü istisna yapabilirsiniz. Kullanım: .lock [yetkili-rol]',
  usage: '.lock [yetkili-rol]',
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(ctx, args) {
    console.log(`🔒 [LOCK DEBUG] Komut başlatıldı - Kullanıcı: ${ctx.user?.tag || ctx.author?.tag}`);
    console.log(`🔒 [LOCK DEBUG] Args: ${JSON.stringify(args)}`);
    console.log(`🔒 [LOCK DEBUG] Channel: ${ctx.channel.name} (${ctx.channel.id})`);
    
    if (ctx.channel.type !== 0 && ctx.channel.type !== ChannelType.GuildText) {
      console.log(`🔒 [LOCK DEBUG] Kanal tipi hatalı: ${ctx.channel.type}`);
      return ctx.reply({ 
        content: 'Bu komut sadece metin kanallarında kullanılabilir.', 
        ephemeral: true 
      });
    }

    let exemptRole = null;

    // Yetkili rol parametresini al
    if (ctx.isCommand && ctx.isCommand()) {
      console.log(`🔒 [LOCK DEBUG] Slash komut algılandı`);
      // Slash komut
      exemptRole = ctx.options.getRole('yetkili-rol');
      console.log(`🔒 [LOCK DEBUG] Slash komuttan rol: ${exemptRole ? exemptRole.name : 'null'}`);
    } else {
      console.log(`🔒 [LOCK DEBUG] Prefix komut algılandı`);
      // Prefix komut
      if (args[0]) {
        console.log(`🔒 [LOCK DEBUG] İlk argüman: "${args[0]}"`);
        // Rol mention, ID veya rol ismi kontrolü
        let roleId = null;
        
        // Rol mention kontrolü: <@&123456789>
        const mentionMatch = args[0].match(/^<@&(\d+)>$/);
        if (mentionMatch) {
          roleId = mentionMatch[1];
          console.log(`🔒 [LOCK DEBUG] Rol mention bulundu - ID: ${roleId}`);
        }
        // Sadece ID kontrolü: 123456789
        else if (/^\d+$/.test(args[0])) {
          roleId = args[0];
          console.log(`🔒 [LOCK DEBUG] Rol ID bulundu: ${roleId}`);
        }
        // Rol ismi ile arama
        else {
          const roleName = args.join(' '); // Tüm argümanları birleştir
          console.log(`🔒 [LOCK DEBUG] Rol ismi ile arama: "${roleName}"`);
          console.log(`🔒 [LOCK DEBUG] Sunucudaki roller: ${ctx.guild.roles.cache.map(r => r.name).join(', ')}`);
          
          exemptRole = ctx.guild.roles.cache.find(role => 
            role.name.toLowerCase() === roleName.toLowerCase()
          );
          
          console.log(`🔒 [LOCK DEBUG] İsim araması sonucu: ${exemptRole ? exemptRole.name : 'null'}`);
          
          if (!exemptRole) {
            console.log(`🔒 [LOCK DEBUG] Rol ismi ile bulunamadı: "${roleName}"`);
            return ctx.reply({
              content: `❌ "${roleName}" isimli bir rol bulunamadı. Rol etiketleyin, ID girin veya tam rol ismini yazın.`,
              ephemeral: true
            });
          }
        }
        
        // Eğer rol ID'si varsa, rol fetch et
        if (roleId) {
          console.log(`🔒 [LOCK DEBUG] Rol fetch ediliyor - ID: ${roleId}`);
          try {
            exemptRole = await ctx.guild.roles.fetch(roleId);
            console.log(`🔒 [LOCK DEBUG] Rol başarıyla fetch edildi: ${exemptRole.name}`);
          } catch (error) {
            console.error(`🔒 [LOCK ERROR] Rol fetch hatası:`, error);
            return ctx.reply({
              content: '❌ Belirtilen rol bulunamadı. Geçerli bir rol etiketleyin veya rol ID\'si girin.',
              ephemeral: true
            });
          }
        }
        
        // Final kontrol
        if (!exemptRole) {
          console.log(`🔒 [LOCK DEBUG] Final kontrol - rol bulunamadı`);
          return ctx.reply({
            content: '❌ Rol bulunamadı. Geçerli bir rol etiketleyin, rol ID\'si girin veya rol ismini yazın.\n**Örnek:** `!lock @Moderator` veya `!lock Moderator`',
            ephemeral: true
          });
        }
      } else {
        console.log(`🔒 [LOCK DEBUG] Args boş, varsayılan rol kontrol ediliyor...`);
        
        // Args boş ise varsayılan lock rolünü kullan
        const defaultLockRoleId = getDefaultLockRole(ctx.guild.id);
        console.log(`🔒 [LOCK DEBUG] Varsayılan lock role ID: ${defaultLockRoleId}`);
        
        if (defaultLockRoleId) {
          try {
            exemptRole = await ctx.guild.roles.fetch(defaultLockRoleId);
            console.log(`🔒 [LOCK DEBUG] Varsayılan rol başarıyla fetch edildi: ${exemptRole.name}`);
          } catch (error) {
            console.error(`🔒 [LOCK ERROR] Varsayılan rol fetch hatası:`, error);
            return ctx.reply({
              content: '❌ Ayarlanmış varsayılan lock rolü bulunamadı. Rol silinmiş olabilir.\n`.lockrol @rol` komutu ile yeni bir rol ayarlayın.',
              ephemeral: true
            });
          }
        } else {
          console.log(`🔒 [LOCK DEBUG] Varsayılan rol ayarlanmamış`);
        }
      }
    }

    console.log(`🔒 [LOCK DEBUG] Final exempt role: ${exemptRole ? exemptRole.name : 'null'}`);

    try {
      console.log(`🔒 [LOCK DEBUG] Permission işlemleri başlatılıyor...`);
      
      // Önce @everyone rolünü kilitle
      console.log(`🔒 [LOCK DEBUG] @everyone rolü kilitleniyor...`);
      await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone.id, {
        SendMessages: false
      });
      console.log(`🔒 [LOCK DEBUG] @everyone rolü başarıyla kilitlendi`);

      // Eğer yetkili rol belirtildiyse, o role SendMessages izni ver
      if (exemptRole) {
        console.log(`🔒 [LOCK DEBUG] ${exemptRole.name} rolüne izin veriliyor...`);
        await ctx.channel.permissionOverwrites.edit(exemptRole.id, {
          SendMessages: true
        });
        console.log(`🔒 [LOCK DEBUG] ${exemptRole.name} rolüne izin verildi`);
      }
      
      console.log(`🔒 [LOCK DEBUG] Başarı mesajı hazırlanıyor...`);
      
      // Başarı mesajı gönder
      const lockEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔒 Kanal Kilitlendi')
        .setDescription(`Bu kanal ${ctx.user?.tag || ctx.author?.tag} tarafından kilitlendi.`)
        .addFields(
          {
            name: '📝 Kilitleme Detayları',
            value: exemptRole 
              ? `✅ **${exemptRole.name}** rolüne sahip kullanıcılar yazmaya devam edebilir\n❌ Diğer kullanıcılar yazamaz`
              : '❌ Tüm kullanıcılar (yetkili roller hariç) yazamaz',
            inline: false
          },
          {
            name: '🔓 Kilidi Kaldırma',
            value: 'Kanal kilidi kaldırmak için `.unlock` komutunu kullanın.',
            inline: false
          }
        )
        .setTimestamp();

      console.log(`🔒 [LOCK DEBUG] Embed gönderiliyor...`);
      await ctx.reply({ embeds: [lockEmbed] });
      console.log(`🔒 [LOCK DEBUG] Embed başarıyla gönderildi`);

      console.log(`🔒 [LOCK DEBUG] Log sistemi çağırılıyor...`);
      // Log sistemine kayıt gönder
      await sendLockLog(ctx.guild, ctx.channel, ctx.member || ctx.user, exemptRole);
      console.log(`🔒 [LOCK DEBUG] Log sistemi tamamlandı`);
      
    } catch (error) {
      console.error('🔒 [LOCK ERROR] Lock işlemi hatası:', error);
      console.error('🔒 [LOCK ERROR] Error stack:', error.stack);
      
      try {
        await ctx.reply({
          content: `❌ Kanal kilitlenirken bir hata oluştu.\n**Hata:** ${error.message}`,
          ephemeral: true
        });
      } catch (replyError) {
        console.error('🔒 [LOCK ERROR] Reply gönderilirken hata:', replyError);
      }
    }
  }
};

// Log gönderen fonksiyon
async function sendLockLog(guild, lockedChannel, moderator, exemptRole = null) {
  // Log kanalını bul (öncelik sırasıyla)
  const logChannelId = findAnyLogChannel(guild.id, 'general');
  
  if (!logChannelId) {
    console.log(`[LOCK] Log kanalı bulunamadı - Guild ID: ${guild.id}`);
    return; // Log kanalı ayarlanmamışsa çık
  }
  
  console.log(`[LOCK] Log kanalı bulundu - Channel ID: ${logChannelId}`);
  
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) {
    console.log(`[LOCK] Log kanalına erişilemedi - Channel ID: ${logChannelId}`);
    return; // Log kanalı bulunamazsa çık
  }
  
  console.log(`[LOCK] Log kanalına erişim başarılı - Kanal: ${logChannel.name}`);

  // Lock türünü belirle
  const lockType = exemptRole 
    ? `Kısmi Kilitleme (${exemptRole.name} istisna)` 
    : 'Tam Kilitleme (Tüm kullanıcılar)';

  // Log embed'i oluştur
  const lockEmbed = new EmbedBuilder()
    .setColor(exemptRole ? 0xFF8800 : 0xFF4444) // Orange for partial, red for full lock
    .setTitle('🔒 Kanal Erişimi Kısıtlandı')
    .setDescription(`**Kanal kilitleme işlemi gerçekleştirildi.**\n\n*${lockType}*`)
    .setThumbnail('https://cdn.discordapp.com/emojis/🔒.png')
    .addFields(
      {
        name: '📢 Etkilenen Kanal',
        value: `${lockedChannel}\n\`${lockedChannel.name}\``,
        inline: true
      },
      {
        name: '👮‍♂️ İşlemi Yapan',
        value: `${moderator.user ? moderator.user : moderator}\n\`${moderator.user?.tag || moderator.tag}\``,
        inline: true
      },
      {
        name: '� Kilitleme Türü',
        value: exemptRole 
          ? `**Kısmi Kilitleme**\n${exemptRole} istisna`
          : '**Tam Kilitleme**\nTüm kullanıcılar',
        inline: true
      },
      {
        name: '�🕐 İşlem Zamanı',
        value: `<t:${Math.floor(Date.now() / 1000)}:F>\n<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true
      },
      {
        name: '⚠️ Etkilenmeyen Kullanıcılar',
        value: exemptRole 
          ? `• ${exemptRole.name} rolüne sahip kullanıcılar\n• Yönetici yetkisine sahip kullanıcılar`
          : '• Sadece yönetici yetkisine sahip kullanıcılar',
        inline: true
      },
      {
        name: '🔓 Kilidi Kaldırma',
        value: '`.unlock` komutu ile kaldırılabilir',
        inline: true
      },
      {
        name: '📋 Güvenlik Detayları',
        value: `\`\`\`yaml\nKanal ID: ${lockedChannel.id}\nModeratör ID: ${moderator.user?.id || moderator.id}\nİstisna Rol: ${exemptRole ? `${exemptRole.name} (${exemptRole.id})` : 'Yok'}\nİşlem: ${lockType}\n\`\`\``,
        inline: false
      }
    )
    .setFooter({ 
      text: `${guild.name} • Moderasyon sistemi`, 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    })
    .setTimestamp();

  try {
    console.log(`[LOCK] Log embed gönderiliyor...`);
    await logChannel.send({ embeds: [lockEmbed] });
    console.log(`[LOCK] Log başarıyla gönderildi!`);
  } catch (error) {
    console.error('[LOCK] Log gönderilirken hata:', error);
  }
}
