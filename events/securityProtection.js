const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getSecurityConfig, addViolation, getUserViolationCount } = require('../config');
const { getJailRole } = require('../config');

module.exports = (client) => {
  // Ban eventini izle
  client.on(Events.GuildBanAdd, async (ban) => {
    await handleModerationAction(ban.guild, null, ban.user, 'ban', 'Kullanıcı banlandı');
  });

  // Kick için audit log'u izle (Discord.js'de direkt kick eventi yok)
  client.on(Events.GuildAuditLogEntryCreate, async (auditLogEntry, guild) => {
    if (auditLogEntry.action === AuditLogEvent.MemberKick) {
      await handleModerationAction(guild, auditLogEntry.executor, auditLogEntry.target, 'kick', auditLogEntry.reason);
    } else if (auditLogEntry.action === AuditLogEvent.MemberBanAdd) {
      await handleModerationAction(guild, auditLogEntry.executor, auditLogEntry.target, 'ban', auditLogEntry.reason);
    }
  });
};

async function handleModerationAction(guild, executor, target, actionType, reason) {
  try {
    // Audit log'dan executor bilgisini al
    if (!executor) {
      try {
        const auditLogs = await guild.fetchAuditLogs({
          type: actionType === 'ban' ? AuditLogEvent.MemberBanAdd : AuditLogEvent.MemberKick,
          limit: 1
        });
        
        const latestLog = auditLogs.entries.first();
        if (latestLog && latestLog.target.id === target.id) {
          executor = latestLog.executor;
          reason = latestLog.reason || reason;
        }
      } catch (error) {
        console.error('Audit log okuma hatası:', error);
        return;
      }
    }

    // Bot'un kendisi veya sistem tarafından yapılan işlemleri yoksay
    if (!executor || executor.bot || executor.system) {
      return;
    }

    const config = getSecurityConfig(guild.id);
    
    // Sistem kapalıysa çık
    if (!config.enabled) {
      return;
    }

    // Whitelist kontrolü
    const executorMember = await guild.members.fetch(executor.id).catch(() => null);
    if (!executorMember) return;

    // Exempt kullanıcı kontrolü
    if (config.exemptUsers.includes(executor.id)) {
      return;
    }

    // Whitelist rol kontrolü
    const hasWhitelistedRole = executorMember.roles.cache.some(role => 
      config.whitelistedRoles.includes(role.id)
    );
    if (hasWhitelistedRole) {
      return;
    }

    // İhlal ekle ve sayıyı kontrol et
    const violationCount = addViolation(guild.id, executor.id, actionType, target.id, reason);
    
    console.log(`Güvenlik sistemi: ${executor.tag} ${actionType} yaptı. Toplam ihlal: ${violationCount}`);

    // Eşik kontrolü
    if (violationCount >= config.banThreshold) {
      await executePunishment(guild, executorMember, violationCount, config);
    } else {
      // Uyarı mesajı gönder
      await sendWarningMessage(guild, executorMember, violationCount, config);
    }

  } catch (error) {
    console.error('Güvenlik sistemi hatası:', error);
  }
}

async function executePunishment(guild, member, violationCount, config) {
  try {
    const originalRoles = member.roles.cache.filter(role => role.name !== '@everyone');
    let punishmentApplied = false;

    // Jail sistemi
    if (config.punishment === 'jail' || config.punishment === 'both') {
      const jailRoleId = getJailRole(guild.id);
      if (jailRoleId) {
        const jailRole = guild.roles.cache.get(jailRoleId);
        if (jailRole) {
          // Tüm rolleri al ve jail rolü ver
          await member.roles.set([jailRole]);
          punishmentApplied = true;
          console.log(`${member.user.tag} jail'e alındı (güvenlik sistemi)`);
        }
      }
    }

    // Rol alma sistemi
    if (config.punishment === 'roleRemove' || config.punishment === 'both') {
      if (!punishmentApplied) {
        // Sadece @everyone rolünü bırak
        await member.roles.set([]);
        punishmentApplied = true;
        console.log(`${member.user.tag} tüm rolleri alındı (güvenlik sistemi)`);
      }
    }

    // Güvenlik log'u gönder
    await sendSecurityLog(guild, member, violationCount, originalRoles, config);

    // Üyeye DM gönder
    await sendPunishmentDM(member, guild, violationCount);

  } catch (error) {
    console.error('Cezalandırma sistemi hatası:', error);
  }
}

async function sendWarningMessage(guild, member, violationCount, config) {
  try {
    if (!config.logChannel) return;

    const logChannel = guild.channels.cache.get(config.logChannel);
    if (!logChannel) return;

    const warningEmbed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('⚠️ Güvenlik Sistemi Uyarısı')
      .setDescription(`Yetkili kötüye kullanımı tespit edildi!`)
      .addFields(
        {
          name: '👤 Yetkili',
          value: `${member.user.tag} (<@${member.user.id}>)`,
          inline: true
        },
        {
          name: '📊 İhlal Durumu',
          value: `**${violationCount}/${config.banThreshold}** (24 saatte)\n${config.banThreshold - violationCount} ihlal daha kaldı`,
          inline: true
        },
        {
          name: '⏰ Süre',
          value: 'Son 24 saat içinde',
          inline: true
        }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Güvenlik Koruma Sistemi' })
      .setTimestamp();

    await logChannel.send({ embeds: [warningEmbed] });

  } catch (error) {
    console.error('Uyarı mesajı gönderme hatası:', error);
  }
}

async function sendSecurityLog(guild, member, violationCount, originalRoles, config) {
  try {
    if (!config.logChannel) return;

    const logChannel = guild.channels.cache.get(config.logChannel);
    if (!logChannel) return;

    const punishmentText = config.punishment === 'jail' ? 'Jail\'e alındı' : 
                          config.punishment === 'roleRemove' ? 'Tüm rolleri alındı' : 
                          'Jail\'e alındı ve rolleri kaldırıldı';

    const logEmbed = new EmbedBuilder()
      .setColor('#F04A47')
      .setTitle('🚨 GÜVENLİK SİSTEMİ DEVREDE!')
      .setDescription('Yetkili kötüye kullanımı tespit edildi ve otomatik cezalandırma uygulandı!')
      .addFields(
        {
          name: '👤 Cezalandırılan Yetkili',
          value: `${member.user.tag} (<@${member.user.id}>)`,
          inline: true
        },
        {
          name: '📊 İhlal Sayısı',
          value: `**${violationCount}** ihlal (24 saatte)`,
          inline: true
        },
        {
          name: '⚖️ Uygulanan Ceza',
          value: punishmentText,
          inline: true
        },
        {
          name: '🔓 Alınan Roller',
          value: originalRoles.size > 0 ? 
            originalRoles.map(role => role.name).slice(0, 10).join(', ') + 
            (originalRoles.size > 10 ? ` (+${originalRoles.size - 10} daha)` : '') : 
            'Rolü yoktu',
          inline: false
        },
        {
          name: '⏰ İhlal Penceresi',
          value: 'Son 24 saat',
          inline: true
        },
        {
          name: '🛡️ Sistem Durumu',
          value: 'Aktif ve çalışıyor',
          inline: true
        }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Otomatik Güvenlik Koruma Sistemi' })
      .setTimestamp();

    await logChannel.send({ 
      content: '🚨 **GÜVENLIK UYARISI** 🚨', 
      embeds: [logEmbed] 
    });

  } catch (error) {
    console.error('Güvenlik log gönderme hatası:', error);
  }
}

async function sendPunishmentDM(member, guild, violationCount) {
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor('#F04A47')
      .setTitle('🚨 Güvenlik Sistemi Cezası')
      .setDescription(`**${guild.name}** sunucusunda güvenlik sistemi tarafından cezalandırıldınız.`)
      .addFields(
        {
          name: '⚖️ Ceza Sebebi',
          value: `24 saat içinde **${violationCount}** adet ban/kick işlemi yaptığınız tespit edildi.`,
          inline: false
        },
        {
          name: '🔒 Uygulanan Ceza',
          value: 'Tüm yetkileniz kaldırıldı ve jail rolü verildi.',
          inline: false
        },
        {
          name: '📞 İtiraz',
          value: 'Bu cezanın haksız olduğunu düşünüyorsanız sunucu yöneticileriyle iletişime geçin.',
          inline: false
        }
      )
      .setFooter({ text: 'Otomatik Güvenlik Koruma Sistemi' })
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] });

  } catch (error) {
    console.error('DM gönderme hatası (güvenlik):', error);
    // DM gönderilemezse sessizce devam et
  }
}