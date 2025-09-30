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

function getDefaultLockRoles(guildId) {
  const config = getLockConfig(guildId);
  return config.defaultLockRoleIds || [];
}

function addDefaultLockRole(guildId, roleId) {
  const config = getLockConfig(guildId);
  const currentRoles = config.defaultLockRoleIds || [];
  
  if (!currentRoles.includes(roleId)) {
    currentRoles.push(roleId);
    return setLockConfig(guildId, {
      defaultLockRoleIds: currentRoles,
      lastUpdatedBy: config.setBy || null,
      lastUpdatedAt: Date.now()
    });
  }
  return false; // Zaten var
}

function removeDefaultLockRole(guildId, roleId) {
  const config = getLockConfig(guildId);
  const currentRoles = config.defaultLockRoleIds || [];
  
  const index = currentRoles.indexOf(roleId);
  if (index > -1) {
    currentRoles.splice(index, 1);
    return setLockConfig(guildId, {
      defaultLockRoleIds: currentRoles,
      lastUpdatedBy: config.setBy || null,
      lastUpdatedAt: Date.now()
    });
  }
  return false; // Zaten yok
}

// Backward compatibility için
function getDefaultLockRole(guildId) {
  const roles = getDefaultLockRoles(guildId);
  return roles.length > 0 ? roles[0] : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockrol')
    .setDescription('Lock sistemi için varsayılan yetkili rolleri yönetir.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('ekle')
        .setDescription('Lock sistemi için varsayılan rol ekler.')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Eklenecek rol')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sil')
        .setDescription('Lock sisteminden varsayılan rol siler.')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Silinecek rol')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('liste')
        .setDescription('Lock sistemi varsayılan rollerini listeler.')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('temizle')
        .setDescription('Tüm varsayılan lock rollerini temizler.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  category: 'moderation',
  description: 'Lock sistemi için varsayılan yetkili rolleri yönetir. Çoklu rol desteği ile.',
  usage: '.lockrol <ekle|sil|liste|temizle> [@rol]',
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(ctx, args) {
    console.log(`🔒 [LOCKROL DEBUG] Komut başlatıldı - Kullanıcı: ${ctx.user?.tag || ctx.author?.tag}`);
    console.log(`🔒 [LOCKROL DEBUG] Args: ${JSON.stringify(args)}`);

    let action = 'liste'; // Varsayılan eylem
    let targetRole = null;

    // Subcommand'ı al
    if (ctx.isCommand && ctx.isCommand()) {
      console.log(`🔒 [LOCKROL DEBUG] Slash komut algılandı`);
      action = ctx.options.getSubcommand();
      
      if (action === 'ekle' || action === 'sil') {
        targetRole = ctx.options.getRole('rol');
      }
      console.log(`🔒 [LOCKROL DEBUG] Slash action: ${action}, rol: ${targetRole ? targetRole.name : 'null'}`);
    } else {
      console.log(`🔒 [LOCKROL DEBUG] Prefix komut algılandı`);
      // Prefix komut parsing
      if (args[0]) {
        const firstArg = args[0].toLowerCase();
        
        if (['ekle', 'add', '+'].includes(firstArg)) {
          action = 'ekle';
          args = args.slice(1); // İlk argümanı kaldır
        } else if (['sil', 'remove', 'delete', '-'].includes(firstArg)) {
          action = 'sil';
          args = args.slice(1); // İlk argümanı kaldır
        } else if (['liste', 'list', 'ls'].includes(firstArg)) {
          action = 'liste';
        } else if (['temizle', 'clear', 'reset'].includes(firstArg)) {
          action = 'temizle';
        } else {
          // İlk argüman action değilse, ekle olarak kabul et
          action = 'ekle';
        }
        
        console.log(`🔒 [LOCKROL DEBUG] Prefix action: ${action}`);
        
        // Rol parsing (ekle/sil için)
        if ((action === 'ekle' || action === 'sil') && args[0]) {
          targetRole = await parseRole(ctx, args);
        }
      }
    }

    console.log(`🔒 [LOCKROL DEBUG] Final action: ${action}, target role: ${targetRole ? targetRole.name : 'null'}`);

    try {
      switch (action) {
        case 'ekle':
          await handleAddRole(ctx, targetRole);
          break;
        case 'sil':
          await handleRemoveRole(ctx, targetRole);
          break;
        case 'liste':
          await handleListRoles(ctx);
          break;
        case 'temizle':
          await handleClearRoles(ctx);
          break;
        default:
          await ctx.reply({
            content: '❌ Geçersiz eylem!\n**Kullanım:** `.lockrol <ekle|sil|liste|temizle> [@rol]`\n**Örnekler:**\n• `.lockrol ekle @Moderator`\n• `.lockrol sil @Helper`\n• `.lockrol liste`\n• `.lockrol temizle`',
            flags: MessageFlags.Ephemeral
          });
      }
    } catch (error) {
      console.error('🔒 [LOCKROL ERROR] Lockrol işlemi hatası:', error);
      console.error('🔒 [LOCKROL ERROR] Error stack:', error.stack);
      
      try {
        await ctx.reply({
          content: `❌ Lock rolü işlemi sırasında bir hata oluştu.\n**Hata:** ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      } catch (replyError) {
        console.error('🔒 [LOCKROL ERROR] Reply gönderilirken hata:', replyError);
      }
    }
  }
};

// Rol parsing fonksiyonu
async function parseRole(ctx, args) {
  if (!args[0]) return null;

  let roleId = null;
  let targetRole = null;
  
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
      return null;
    }
  }

  return targetRole;
}

// Rol ekleme
async function handleAddRole(ctx, targetRole) {
  if (!targetRole) {
    return ctx.reply({
      content: '❌ Geçerli bir rol belirtmelisiniz.\n**Kullanım:** `.lockrol ekle @rol`',
      flags: MessageFlags.Ephemeral
    });
  }

  const success = addDefaultLockRole(ctx.guild.id, targetRole.id);
  
  if (!success) {
    return ctx.reply({
      content: `❌ **${targetRole.name}** rolü zaten varsayılan lock rolleri arasında!`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Güncel rol listesini al
  const currentRoles = getDefaultLockRoles(ctx.guild.id);
  
  const successEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Lock Rolü Eklendi')
    .setDescription(`**${targetRole.name}** rolü varsayılan lock rolleri arasına eklendi!`)
    .addFields(
      {
        name: '🆕 Eklenen Rol',
        value: `**${targetRole.name}**\n\`${targetRole.id}\`\nPozisyon: ${targetRole.position}`,
        inline: true
      },
      {
        name: '📊 Toplam Rol Sayısı',
        value: `${currentRoles.length} varsayılan rol`,
        inline: true
      },
      {
        name: '👮 Ekleyen',
        value: `${ctx.user?.tag || ctx.author?.tag}`,
        inline: true
      },
      {
        name: '📝 Nasıl Çalışır?',
        value: '• `.lock` → Tüm varsayılan roller otomatik istisna olur\n• `.lockrol liste` → Tüm rolleri görüntüle',
        inline: false
      }
    )
    .setTimestamp();

  await ctx.reply({
    embeds: [successEmbed],
    flags: MessageFlags.Ephemeral
  });

  console.log(`🔒 [LOCKROL DEBUG] Rol eklendi: ${targetRole.name}`);
}

// Rol silme
async function handleRemoveRole(ctx, targetRole) {
  if (!targetRole) {
    return ctx.reply({
      content: '❌ Geçerli bir rol belirtmelisiniz.\n**Kullanım:** `.lockrol sil @rol`',
      flags: MessageFlags.Ephemeral
    });
  }

  const success = removeDefaultLockRole(ctx.guild.id, targetRole.id);
  
  if (!success) {
    return ctx.reply({
      content: `❌ **${targetRole.name}** rolü varsayılan lock rolleri arasında değil!`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Güncel rol listesini al
  const currentRoles = getDefaultLockRoles(ctx.guild.id);
  
  const successEmbed = new EmbedBuilder()
    .setColor('#FF6B6B')
    .setTitle('�️ Lock Rolü Silindi')
    .setDescription(`**${targetRole.name}** rolü varsayılan lock rollerinden çıkarıldı!`)
    .addFields(
      {
        name: '🗑️ Silinen Rol',
        value: `**${targetRole.name}**\n\`${targetRole.id}\``,
        inline: true
      },
      {
        name: '📊 Kalan Rol Sayısı',
        value: `${currentRoles.length} varsayılan rol`,
        inline: true
      },
      {
        name: '👮 Silen',
        value: `${ctx.user?.tag || ctx.author?.tag}`,
        inline: true
      }
    )
    .setTimestamp();

  await ctx.reply({
    embeds: [successEmbed],
    flags: MessageFlags.Ephemeral
  });

  console.log(`🔒 [LOCKROL DEBUG] Rol silindi: ${targetRole.name}`);
}

// Rol listeleme
async function handleListRoles(ctx) {
  const roleIds = getDefaultLockRoles(ctx.guild.id);
  
  if (roleIds.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📋 Varsayılan Lock Rolleri')
      .setDescription('Henüz hiç varsayılan lock rolü ayarlanmamış.')
      .addFields({
        name: '⚙️ Nasıl Ayarlanır?',
        value: '• `.lockrol ekle @rol` → Rol ekle\n• `.lock` → Ayarlanan roller otomatik istisna olur',
        inline: false
      })
      .setTimestamp();

    return ctx.reply({
      embeds: [emptyEmbed],
      flags: MessageFlags.Ephemeral
    });
  }

  // Rolleri fetch et
  const roles = [];
  const missingRoles = [];
  
  for (const roleId of roleIds) {
    try {
      const role = ctx.guild.roles.cache.get(roleId) || await ctx.guild.roles.fetch(roleId);
      if (role) {
        roles.push(role);
      } else {
        missingRoles.push(roleId);
      }
    } catch (error) {
      missingRoles.push(roleId);
    }
  }

  const listEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('📋 Varsayılan Lock Rolleri')
    .setDescription(`${ctx.guild.name} sunucusunun varsayılan lock rolleri`)
    .addFields({
      name: '🎭 Aktif Roller',
      value: roles.length > 0 
        ? roles.map((role, index) => `${index + 1}. **${role.name}** (\`${role.id}\`)`).join('\n')
        : 'Hiç aktif rol yok',
      inline: false
    });

  if (missingRoles.length > 0) {
    listEmbed.addFields({
      name: '⚠️ Eksik Roller',
      value: `${missingRoles.length} rol silinmiş:\n${missingRoles.map(id => `\`${id}\``).join(', ')}`,
      inline: false
    });
  }

  listEmbed.addFields(
    {
      name: '📊 İstatistikler',
      value: `**Toplam:** ${roleIds.length} rol\n**Aktif:** ${roles.length} rol\n**Eksik:** ${missingRoles.length} rol`,
      inline: true
    },
    {
      name: '📝 Nasıl Çalışır?',
      value: '• `.lock` → Bu roller otomatik istisna\n• `.lock @başka-rol` → Geçici istisna',
      inline: true
    }
  )
  .setTimestamp();

  await ctx.reply({
    embeds: [listEmbed],
    flags: MessageFlags.Ephemeral
  });

  console.log(`🔒 [LOCKROL DEBUG] Rol listesi gösterildi: ${roles.length} aktif, ${missingRoles.length} eksik`);
}

// Tüm rolleri temizle
async function handleClearRoles(ctx) {
  const roleIds = getDefaultLockRoles(ctx.guild.id);
  
  if (roleIds.length === 0) {
    return ctx.reply({
      content: '❌ Zaten hiç varsayılan lock rolü ayarlanmamış!',
      flags: MessageFlags.Ephemeral
    });
  }

  const success = setLockConfig(ctx.guild.id, {
    defaultLockRoleIds: [],
    lastUpdatedBy: ctx.user?.id || ctx.author?.id,
    lastUpdatedAt: Date.now()
  });

  if (!success) {
    return ctx.reply({
      content: '❌ Lock rolleri temizlenirken bir hata oluştu.',
      flags: MessageFlags.Ephemeral
    });
  }

  const clearEmbed = new EmbedBuilder()
    .setColor('#FF6B6B')
    .setTitle('🧹 Tüm Lock Rolleri Temizlendi')
    .setDescription('Tüm varsayılan lock rolleri başarıyla temizlendi!')
    .addFields(
      {
        name: '🗑️ Temizlenen',
        value: `${roleIds.length} varsayılan rol`,
        inline: true
      },
      {
        name: '� Temizleyen',
        value: `${ctx.user?.tag || ctx.author?.tag}`,
        inline: true
      },
      {
        name: '📝 Sonraki Adım',
        value: '`.lockrol ekle @rol` ile yeni roller ekleyebilirsiniz',
        inline: false
      }
    )
    .setTimestamp();

  await ctx.reply({
    embeds: [clearEmbed],
    flags: MessageFlags.Ephemeral
  });

  console.log(`🔒 [LOCKROL DEBUG] Tüm roller temizlendi: ${roleIds.length} rol`);
}

// Export helper functions
module.exports.getDefaultLockRole = getDefaultLockRole;
module.exports.getDefaultLockRoles = getDefaultLockRoles;
module.exports.addDefaultLockRole = addDefaultLockRole;
module.exports.removeDefaultLockRole = removeDefaultLockRole;
module.exports.getLockConfig = getLockConfig;
module.exports.setLockConfig = setLockConfig;