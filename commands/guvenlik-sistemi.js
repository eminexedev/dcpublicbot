const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getSecurityConfig, setSecurityConfig, clearUserViolations, getViolations } = require('../securityConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('güvenlik-sistemi')
    .setDescription('Sunucu güvenlik koruma sistemini yönetir')
    .addSubcommand(subcommand =>
      subcommand
        .setName('durum')
        .setDescription('Güvenlik sistemi durumunu gösterir')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('aç')
        .setDescription('Güvenlik sistemini açar')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kapat')
        .setDescription('Güvenlik sistemini kapatır')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ayar')
        .setDescription('Güvenlik sistemi ayarlarını değiştirir')
        .addIntegerOption(option =>
          option.setName('eşik')
            .setDescription('24 saatte kaç ban/kick sonrası tetiklenir (varsayılan: 3)')
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addChannelOption(option =>
          option.setName('log-kanal')
            .setDescription('Güvenlik loglarının gönderileceği kanal')
        )
        .addStringOption(option =>
          option.setName('ceza-türü')
            .setDescription('Uygulanan ceza türü')
            .addChoices(
              { name: 'Jail', value: 'jail' },
              { name: 'Rol Alma', value: 'roleRemove' },
              { name: 'İkisi de', value: 'both' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('muaf-rol')
        .setDescription('Güvenlik sisteminden muaf rol ekler/kaldırır')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Muaf edilecek/kaldırılacak rol')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('işlem')
            .setDescription('Ekle veya kaldır')
            .addChoices(
              { name: 'Ekle', value: 'add' },
              { name: 'Kaldır', value: 'remove' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('muaf-kişi')
        .setDescription('Güvenlik sisteminden muaf kişi ekler/kaldırır')
        .addUserOption(option =>
          option.setName('kullanıcı')
            .setDescription('Muaf edilecek/kaldırılacak kullanıcı')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('işlem')
            .setDescription('Ekle veya kaldır')
            .addChoices(
              { name: 'Ekle', value: 'add' },
              { name: 'Kaldır', value: 'remove' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ihlal-temizle')
        .setDescription('Kullanıcının ihlal geçmişini temizler')
        .addUserOption(option =>
          option.setName('kullanıcı')
            .setDescription('İhlal geçmişi temizlenecek kullanıcı')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ihlal-listesi')
        .setDescription('Sunucudaki tüm ihlalleri listeler')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'admin',
  description: 'Yetkili kötüye kullanımını engelleyen güvenlik sistemi.',
  usage: '/güvenlik-sistemi <alt-komut>',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    try {
      // Yetki kontrolü
      const executorId = ctx.user?.id || ctx.author?.id;
      const executor = await ctx.guild.members.fetch(executorId);
      if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
        return ctx.reply({
          content: '❌ Bu komutu kullanmak için "Yönetici" yetkisine sahip olmalısın.',
          ephemeral: true
        });
      }

      let subcommand;
      if (ctx.isCommand && ctx.isCommand()) {
        subcommand = ctx.options.getSubcommand();
      } else {
        subcommand = args[0];
        if (!subcommand) {
          return ctx.reply({
            content: '❌ Alt komut belirtmelisin: `durum`, `aç`, `kapat`, `ayar`, `muaf-rol`, `muaf-kişi`, `ihlal-temizle`, `ihlal-listesi`',
            ephemeral: true
          });
        }
      }

      const config = getSecurityConfig(ctx.guild.id);

      switch (subcommand) {
        case 'durum':
        case 'status':
          await handleStatus(ctx, config);
          break;
        
        case 'aç':
        case 'enable':
          await handleEnable(ctx, config);
          break;
        
        case 'kapat':
        case 'disable':
          await handleDisable(ctx, config);
          break;
        
        case 'ayar':
        case 'settings':
          await handleSettings(ctx, config);
          break;
        
        case 'muaf-rol':
        case 'exempt-role':
          await handleExemptRole(ctx, config);
          break;
        
        case 'muaf-kişi':
        case 'exempt-user':
          await handleExemptUser(ctx, config);
          break;
        
        case 'ihlal-temizle':
        case 'clear-violations':
          await handleClearViolations(ctx);
          break;
        
        case 'ihlal-listesi':
        case 'violation-list':
          await handleViolationList(ctx);
          break;
        
        default:
          return ctx.reply({
            content: '❌ Geçersiz alt komut.',
            ephemeral: true
          });
      }

    } catch (error) {
      console.error('Güvenlik sistemi komutu hatası:', error);
      await ctx.reply({
        content: '❌ Komut işlenirken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};

async function handleStatus(ctx, config) {
  const statusEmbed = new EmbedBuilder()
    .setColor(config.enabled ? '#57F287' : '#F04A47')
    .setTitle('🛡️ Güvenlik Sistemi Durumu')
    .setDescription(`Yetkili kötüye kullanımını engelleyen güvenlik sistemi ${config.enabled ? '**AKTİF**' : '**KAPALI**'}`)
    .addFields(
      {
        name: '⚙️ Sistem Ayarları',
        value: `**Durum:** ${config.enabled ? '🟢 Aktif' : '🔴 Kapalı'}\n**İhlal Eşiği:** ${config.banThreshold} (24 saatte)\n**Zaman Penceresi:** 24 saat\n**Ceza Türü:** ${config.punishment === 'jail' ? 'Jail' : config.punishment === 'roleRemove' ? 'Rol Alma' : 'Jail + Rol Alma'}`,
        inline: true
      },
      {
        name: '📊 Log Ayarları',
        value: config.logChannel ? `**Log Kanalı:** <#${config.logChannel}>` : '**Log Kanalı:** Ayarlanmamış',
        inline: true
      },
      {
        name: '🔐 Muafiyet Listesi',
        value: `**Muaf Roller:** ${config.whitelistedRoles.length}\n**Muaf Kullanıcılar:** ${config.exemptUsers.length}`,
        inline: true
      }
    )
    .setFooter({ text: 'Güvenlik Koruma Sistemi' })
    .setTimestamp();

  // Muaf roller listesi
  if (config.whitelistedRoles.length > 0) {
    const exemptRoles = config.whitelistedRoles
      .map(roleId => `<@&${roleId}>`)
      .slice(0, 10)
      .join(', ');
    
    statusEmbed.addFields({
      name: '🛡️ Muaf Roller',
      value: exemptRoles + (config.whitelistedRoles.length > 10 ? ` (+${config.whitelistedRoles.length - 10} daha)` : ''),
      inline: false
    });
  }

  // Muaf kullanıcılar listesi
  if (config.exemptUsers.length > 0) {
    const exemptUsers = config.exemptUsers
      .map(userId => `<@${userId}>`)
      .slice(0, 10)
      .join(', ');
    
    statusEmbed.addFields({
      name: '👥 Muaf Kullanıcılar',
      value: exemptUsers + (config.exemptUsers.length > 10 ? ` (+${config.exemptUsers.length - 10} daha)` : ''),
      inline: false
    });
  }

  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(config.enabled ? 'security_disable' : 'security_enable')
        .setLabel(config.enabled ? '🔴 Sistemi Kapat' : '🟢 Sistemi Aç')
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('security_settings')
        .setLabel('⚙️ Ayarlar')
        .setStyle(ButtonStyle.Primary)
    );

  await ctx.reply({
    embeds: [statusEmbed],
    components: [buttons]
  });
}

async function handleEnable(ctx, config) {
  config.enabled = true;
  const success = setSecurityConfig(ctx.guild.id, config);
  
  if (success) {
    const enableEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ Güvenlik Sistemi Aktifleştirildi')
      .setDescription('Yetkili kötüye kullanımı koruma sistemi şimdi aktif!')
      .addFields({
        name: '🛡️ Sistem Bilgisi',
        value: `24 saatte **${config.banThreshold}** ban/kick yapan yetkililer otomatik olarak cezalandırılacak.`,
        inline: false
      })
      .setTimestamp();

    await ctx.reply({ embeds: [enableEmbed] });
  } else {
    await ctx.reply({
      content: '❌ Güvenlik sistemi aktifleştirilirken hata oluştu.',
      ephemeral: true
    });
  }
}

async function handleDisable(ctx, config) {
  config.enabled = false;
  const success = setSecurityConfig(ctx.guild.id, config);
  
  if (success) {
    const disableEmbed = new EmbedBuilder()
      .setColor('#F04A47')
      .setTitle('🔴 Güvenlik Sistemi Devre Dışı')
      .setDescription('Yetkili kötüye kullanımı koruma sistemi kapatıldı.')
      .addFields({
        name: '⚠️ Uyarı',
        value: 'Güvenlik sistemi kapatıldığında yetkili kötüye kullanımı koruması olmayacak.',
        inline: false
      })
      .setTimestamp();

    await ctx.reply({ embeds: [disableEmbed] });
  } else {
    await ctx.reply({
      content: '❌ Güvenlik sistemi kapatılırken hata oluştu.',
      ephemeral: true
    });
  }
}

async function handleSettings(ctx, config) {
  let updated = false;
  const updates = [];

  if (ctx.isCommand && ctx.isCommand()) {
    // Slash komut ayarları
    const threshold = ctx.options.getInteger('eşik');
    const logChannel = ctx.options.getChannel('log-kanal');
    const punishmentType = ctx.options.getString('ceza-türü');

    if (threshold !== null) {
      config.banThreshold = threshold;
      updated = true;
      updates.push(`İhlal eşiği: **${threshold}**`);
    }

    if (logChannel) {
      config.logChannel = logChannel.id;
      updated = true;
      updates.push(`Log kanalı: ${logChannel}`);
    }

    if (punishmentType) {
      config.punishment = punishmentType;
      updated = true;
      const punishmentText = punishmentType === 'jail' ? 'Jail' : 
                            punishmentType === 'roleRemove' ? 'Rol Alma' : 'Jail + Rol Alma';
      updates.push(`Ceza türü: **${punishmentText}**`);
    }
  }

  if (updated) {
    const success = setSecurityConfig(ctx.guild.id, config);
    
    if (success) {
      const updateEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Güvenlik Sistemi Ayarları Güncellendi')
        .setDescription('Güvenlik sistemi ayarları başarıyla güncellendi.')
        .addFields({
          name: '🔄 Güncellenen Ayarlar',
          value: updates.join('\n'),
          inline: false
        })
        .setTimestamp();

      await ctx.reply({ embeds: [updateEmbed] });
    } else {
      await ctx.reply({
        content: '❌ Ayarlar güncellenirken hata oluştu.',
        ephemeral: true
      });
    }
  } else {
    await ctx.reply({
      content: '❌ Güncellenecek ayar belirtmedin.',
      ephemeral: true
    });
  }
}

async function handleExemptRole(ctx, config) {
  const role = ctx.isCommand ? ctx.options.getRole('rol') : null;
  const action = ctx.isCommand ? ctx.options.getString('işlem') : args[2];

  if (!role || !action) {
    return ctx.reply({
      content: '❌ Rol ve işlem türü belirtmelisin.',
      ephemeral: true
    });
  }

  let success = false;
  let message = '';

  if (action === 'add') {
    if (!config.whitelistedRoles.includes(role.id)) {
      config.whitelistedRoles.push(role.id);
      success = setSecurityConfig(ctx.guild.id, config);
      message = `✅ **${role.name}** rolü güvenlik sisteminden muaf edildi.`;
    } else {
      message = `⚠️ **${role.name}** rolü zaten muaf listesinde.`;
      success = true;
    }
  } else if (action === 'remove') {
    const index = config.whitelistedRoles.indexOf(role.id);
    if (index > -1) {
      config.whitelistedRoles.splice(index, 1);
      success = setSecurityConfig(ctx.guild.id, config);
      message = `✅ **${role.name}** rolü muaf listesinden kaldırıldı.`;
    } else {
      message = `⚠️ **${role.name}** rolü muaf listesinde değil.`;
      success = true;
    }
  }

  if (success) {
    await ctx.reply({ content: message });
  } else {
    await ctx.reply({
      content: '❌ İşlem sırasında hata oluştu.',
      ephemeral: true
    });
  }
}

async function handleExemptUser(ctx, config) {
  const user = ctx.isCommand ? ctx.options.getUser('kullanıcı') : null;
  const action = ctx.isCommand ? ctx.options.getString('işlem') : args[2];

  if (!user || !action) {
    return ctx.reply({
      content: '❌ Kullanıcı ve işlem türü belirtmelisin.',
      ephemeral: true
    });
  }

  let success = false;
  let message = '';

  if (action === 'add') {
    if (!config.exemptUsers.includes(user.id)) {
      config.exemptUsers.push(user.id);
      success = setSecurityConfig(ctx.guild.id, config);
      message = `✅ **${user.tag}** güvenlik sisteminden muaf edildi.`;
    } else {
      message = `⚠️ **${user.tag}** zaten muaf listesinde.`;
      success = true;
    }
  } else if (action === 'remove') {
    const index = config.exemptUsers.indexOf(user.id);
    if (index > -1) {
      config.exemptUsers.splice(index, 1);
      success = setSecurityConfig(ctx.guild.id, config);
      message = `✅ **${user.tag}** muaf listesinden kaldırıldı.`;
    } else {
      message = `⚠️ **${user.tag}** muaf listesinde değil.`;
      success = true;
    }
  }

  if (success) {
    await ctx.reply({ content: message });
  } else {
    await ctx.reply({
      content: '❌ İşlem sırasında hata oluştu.',
      ephemeral: true
    });
  }
}

async function handleClearViolations(ctx) {
  const user = ctx.isCommand ? ctx.options.getUser('kullanıcı') : null;

  if (!user) {
    return ctx.reply({
      content: '❌ İhlal geçmişi temizlenecek kullanıcıyı belirtmelisin.',
      ephemeral: true
    });
  }

  const success = clearUserViolations(ctx.guild.id, user.id);

  if (success) {
    const clearEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ İhlal Geçmişi Temizlendi')
      .setDescription(`**${user.tag}** kullanıcısının ihlal geçmişi temizlendi.`)
      .setTimestamp();

    await ctx.reply({ embeds: [clearEmbed] });
  } else {
    await ctx.reply({
      content: '❌ İhlal geçmişi temizlenirken hata oluştu.',
      ephemeral: true
    });
  }
}

async function handleViolationList(ctx) {
  const violations = getViolations(ctx.guild.id);
  
  if (Object.keys(violations).length === 0) {
    const noViolationsEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ İhlal Bulunamadı')
      .setDescription('Son 24 saatte hiç güvenlik ihlali tespit edilmedi.')
      .setTimestamp();

    return ctx.reply({ embeds: [noViolationsEmbed] });
  }

  const listEmbed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('📊 Güvenlik İhlalleri Listesi')
    .setDescription('Son 24 saatteki güvenlik ihlalleri:')
    .setTimestamp();

  let violationText = '';
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);

  for (const [userId, userViolations] of Object.entries(violations)) {
    const recentViolations = userViolations.filter(v => v.timestamp > cutoffTime);
    if (recentViolations.length > 0) {
      violationText += `**<@${userId}>:** ${recentViolations.length} ihlal\n`;
      recentViolations.forEach(violation => {
        const time = new Date(violation.timestamp);
        violationText += `  • ${violation.type.toUpperCase()} - <t:${Math.floor(violation.timestamp / 1000)}:R>\n`;
      });
      violationText += '\n';
    }
  }

  if (violationText.length === 0) {
    violationText = 'Son 24 saatte aktif ihlal yok.';
  }

  if (violationText.length > 4096) {
    violationText = violationText.substring(0, 4000) + '...\n\n*Liste çok uzun olduğu için kısaltıldı*';
  }

  listEmbed.addFields({
    name: '📋 İhlal Detayları',
    value: violationText,
    inline: false
  });

  await ctx.reply({ embeds: [listEmbed] });
}