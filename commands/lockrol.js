const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Lock config dosyası
const lockConfigPath = path.join(__dirname, '..', 'lockConfig.json');

// Lock config helper fonksiyonları
function getLockConfig(guildId) {
  try {
    if (!fs.existsSync(lockConfigPath)) {
      fs.writeFileSync(lockConfigPath, '{}');
      return {};
    }
    const data = fs.readFileSync(lockConfigPath, 'utf8');
    const config = JSON.parse(data);
    return config[guildId] || {};
  } catch (error) {
    console.error('Lock config okuma hatası:', error);
    return {};
  }
}

function setLockConfig(guildId, config) {
  try {
    let allConfig = {};
    if (fs.existsSync(lockConfigPath)) {
      const data = fs.readFileSync(lockConfigPath, 'utf8');
      allConfig = JSON.parse(data);
    }
    
    allConfig[guildId] = { ...allConfig[guildId], ...config };
    fs.writeFileSync(lockConfigPath, JSON.stringify(allConfig, null, 2));
    return true;
  } catch (error) {
    console.error('Lock config yazma hatası:', error);
    return false;
  }
}

function getDefaultLockRole(guildId) {
  const config = getLockConfig(guildId);
  return config.defaultLockRoleId || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockrol')
    .setDescription('Lock sistemi için varsayılan yetkili rolü ayarlar.')
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Lock işlemlerinde varsayılan olarak istisna tutulacak rol')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  description: 'Lock sistemi için varsayılan yetkili rolü ayarlar. Artık !lock yazınca bu rol otomatik istisna olur.',
  usage: '.lockrol @rol',
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(ctx, args) {
    console.log(`🔒 [LOCKROL DEBUG] Komut başlatıldı - Kullanıcı: ${ctx.user?.tag || ctx.author?.tag}`);
    console.log(`🔒 [LOCKROL DEBUG] Args: ${JSON.stringify(args)}`);

    let targetRole = null;

    // Rol parametresini al
    if (ctx.isCommand && ctx.isCommand()) {
      console.log(`🔒 [LOCKROL DEBUG] Slash komut algılandı`);
      targetRole = ctx.options.getRole('rol');
      console.log(`🔒 [LOCKROL DEBUG] Slash komuttan rol: ${targetRole ? targetRole.name : 'null'}`);
    } else {
      console.log(`🔒 [LOCKROL DEBUG] Prefix komut algılandı`);
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: '❌ Bir rol belirtmelisiniz.\n**Kullanım:** `.lockrol @rol` veya `.lockrol 123456789`',
          flags: MessageFlags.Ephemeral
        });
      }

      // Rol mention, ID veya rol ismi kontrolü
      let roleId = null;
      
      // Rol mention kontrolü: <@&123456789>
      const mentionMatch = args[0].match(/^<@&(\d+)>$/);
      if (mentionMatch) {
        roleId = mentionMatch[1];
        console.log(`🔒 [LOCKROL DEBUG] Rol mention bulundu - ID: ${roleId}`);
      }
      // Sadece ID kontrolü: 123456789
      else if (/^\d+$/.test(args[0])) {
        roleId = args[0];
        console.log(`🔒 [LOCKROL DEBUG] Rol ID bulundu: ${roleId}`);
      }
      // Rol ismi ile arama
      else {
        const roleName = args.join(' '); // Tüm argümanları birleştir
        console.log(`🔒 [LOCKROL DEBUG] Rol ismi ile arama: "${roleName}"`);
        console.log(`🔒 [LOCKROL DEBUG] Sunucudaki roller: ${ctx.guild.roles.cache.map(r => r.name).join(', ')}`);
        
        targetRole = ctx.guild.roles.cache.find(role => 
          role.name.toLowerCase() === roleName.toLowerCase()
        );
        
        console.log(`🔒 [LOCKROL DEBUG] İsim araması sonucu: ${targetRole ? targetRole.name : 'null'}`);
      }
      
      // Eğer rol ID'si varsa, rol fetch et
      if (roleId) {
        console.log(`🔒 [LOCKROL DEBUG] Rol fetch ediliyor - ID: ${roleId}`);
        try {
          targetRole = await ctx.guild.roles.fetch(roleId);
          console.log(`🔒 [LOCKROL DEBUG] Rol başarıyla fetch edildi: ${targetRole.name}`);
        } catch (error) {
          console.error(`🔒 [LOCKROL ERROR] Rol fetch hatası:`, error);
          return ctx.reply({
            content: '❌ Belirtilen rol bulunamadı. Geçerli bir rol etiketleyin veya rol ID\'si girin.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Final kontrol
      if (!targetRole) {
        console.log(`🔒 [LOCKROL DEBUG] Final kontrol - rol bulunamadı`);
        return ctx.reply({
          content: '❌ Rol bulunamadı. Geçerli bir rol etiketleyin, rol ID\'si girin veya rol ismini yazın.\n**Örnek:** `.lockrol @Moderator` veya `.lockrol Moderator`',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (!targetRole) {
      return ctx.reply({
        content: '❌ Geçerli bir rol belirtmelisiniz.',
        flags: MessageFlags.Ephemeral
      });
    }

    console.log(`🔒 [LOCKROL DEBUG] Final target role: ${targetRole.name} (${targetRole.id})`);

    try {
      // Konfigürasyonu kaydet
      const success = setLockConfig(ctx.guild.id, {
        defaultLockRoleId: targetRole.id,
        setBy: ctx.user?.id || ctx.author?.id,
        setAt: Date.now()
      });

      if (!success) {
        console.error(`🔒 [LOCKROL ERROR] Config kaydetme başarısız`);
        return ctx.reply({
          content: '❌ Lock rolü ayarlanırken bir hata oluştu.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log(`🔒 [LOCKROL DEBUG] Config başarıyla kaydedildi`);

      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔒 Lock Sistemi Varsayılan Rol Ayarlandı')
        .setDescription('Lock sistemi için varsayılan yetkili rol başarıyla ayarlandı!')
        .addFields(
          {
            name: '🎭 Ayarlanan Rol',
            value: `**${targetRole.name}**\n\`${targetRole.id}\`\nPozisyon: ${targetRole.position}\nRenk: ${targetRole.hexColor}`,
            inline: true
          },
          {
            name: '👮 Ayarlayan Yetkili',
            value: `${ctx.user?.tag || ctx.author?.tag}\n\`${ctx.user?.id || ctx.author?.id}\``,
            inline: true
          },
          {
            name: '📅 Ayarlanma Tarihi',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>\n<t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: true
          },
          {
            name: '📝 Nasıl Çalışır?',
            value: '• `.lock` → Bu rol otomatik istisna olur\n• `.lock @başka-rol` → Geçici olarak farklı rol\n• `.unlock` → Tüm kısıtlamaları kaldırır',
            inline: false
          },
          {
            name: '🔍 Durum Kontrolü',
            value: '`.lockdurumu` komutu ile ayarları görüntüleyebilirsiniz.',
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setFooter({ 
          text: `${ctx.guild.name} • Lock sistemi`,
          iconURL: ctx.client.user.displayAvatarURL()
        })
        .setTimestamp();

      await ctx.reply({
        embeds: [successEmbed],
        flags: MessageFlags.Ephemeral
      });

      console.log(`🔒 [LOCKROL DEBUG] Başarı mesajı gönderildi`);

    } catch (error) {
      console.error('🔒 [LOCKROL ERROR] Lockrol işlemi hatası:', error);
      console.error('🔒 [LOCKROL ERROR] Error stack:', error.stack);
      
      try {
        await ctx.reply({
          content: `❌ Lock rolü ayarlanırken bir hata oluştu.\n**Hata:** ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      } catch (replyError) {
        console.error('🔒 [LOCKROL ERROR] Reply gönderilirken hata:', replyError);
      }
    }
  }
};

// Export helper functions
module.exports.getDefaultLockRole = getDefaultLockRole;
module.exports.getLockConfig = getLockConfig;
module.exports.setLockConfig = setLockConfig;