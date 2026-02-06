/**
 * İzin Sistemi Scheduler
 * Periyodik olarak izinleri kontrol eder ve süresi dolmuş izinleri sonlandırır.
 * İzin biten yetkililerin rolleri otomatik olarak geri verilir.
 */

const { EmbedBuilder } = require('discord.js');
const { 
  getAllLeavesGlobal, 
  removeLeaveRequest,
  getLeaveLogChannel
} = require('../config');

// Kontrol aralığı (milisaniye) - Her 1 dakikada bir kontrol
const CHECK_INTERVAL = 60 * 1000;

let checkInterval = null;

/**
 * İzin sistemini başlatır
 * @param {Client} client - Discord.js client
 */
function startLeaveScheduler(client) {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  console.log('🏖️ İzin sistemi scheduler başlatıldı.');

  // İlk kontrolü hemen yap
  checkExpiredLeaves(client);

  // Periyodik kontrol başlat
  checkInterval = setInterval(() => {
    checkExpiredLeaves(client);
  }, CHECK_INTERVAL);
}

/**
 * İzin sistemini durdurur
 */
function stopLeaveScheduler() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('🏖️ İzin sistemi scheduler durduruldu.');
  }
}

/**
 * Süresi dolmuş izinleri kontrol eder ve işler
 * @param {Client} client - Discord.js client
 */
async function checkExpiredLeaves(client) {
  try {
    const allLeaves = getAllLeavesGlobal();
    const now = Date.now();

    for (const [guildId, guildLeaves] of Object.entries(allLeaves)) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      for (const [userId, leaveData] of Object.entries(guildLeaves)) {
        // Sadece aktif izinleri kontrol et (pending/beklemede olanları değil)
        if (leaveData.status !== 'active') continue;
        if (leaveData.endDate > now) continue;

        // İzin süresi dolmuş - işle
        await processExpiredLeave(client, guild, userId, leaveData);
      }
    }
  } catch (error) {
    console.error('❌ İzin kontrol hatası:', error);
  }
}

/**
 * Süresi dolmuş bir izni işler (rolleri geri verir)
 * @param {Client} client - Discord.js client
 * @param {Guild} guild - Discord guild
 * @param {string} userId - Kullanıcı ID
 * @param {Object} leaveData - İzin verileri
 */
async function processExpiredLeave(client, guild, userId, leaveData) {
  try {
    console.log(`🔄 İzin süresi doldu: ${leaveData.username} (${userId}) - ${guild.name}`);

    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (!member) {
      console.log(`⚠️ Kullanıcı sunucuda bulunamadı: ${userId}`);
      // Kullanıcı sunucudan ayrılmış, kaydı sil
      removeLeaveRequest(guild.id, userId);
      return;
    }

    // Alınan yetkili rollerini geri ver (mevcut rollerin üzerine ekle)
    const rolesToRestore = leaveData.rolesToRemove || [];
    const currentRoleIds = member.roles.cache
      .filter(role => role.id !== guild.id)
      .map(role => role.id);
    
    // İzinli rolünü çıkar
    const leaveRoleId = leaveData.leaveRoleId;
    const rolesWithoutLeave = currentRoleIds.filter(roleId => roleId !== leaveRoleId);
    
    // Geri verilecek rolleri ekle (geçerli olanları)
    const botMember = await guild.members.fetch(client.user.id);
    const validRolesToRestore = [];
    
    for (const roleId of rolesToRestore) {
      const role = guild.roles.cache.get(roleId);
      if (role && role.position < botMember.roles.highest.position) {
        validRolesToRestore.push(roleId);
      }
    }
    
    // Mevcut roller + geri verilecek roller (tekrarları önle)
    const finalRoles = [...new Set([...rolesWithoutLeave, ...validRolesToRestore])];

    try {
      // Rolleri güncelle
      await member.roles.set(finalRoles, `İzin süresi doldu - Yetkili rolleri geri verildi`);
      console.log(`✅ ${leaveData.username} kullanıcısının ${validRolesToRestore.length} yetkili rolü geri verildi`);
    } catch (roleError) {
      console.error(`❌ Rol geri verme hatası (${userId}):`, roleError.message);
    }

    // İzin kaydını sil
    removeLeaveRequest(guild.id, userId);

    // Log kanalına bildirim gönder
    const logChannelId = getLeaveLogChannel(guild.id);
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const startDate = new Date(leaveData.startDate);
        const endDate = new Date(leaveData.endDate);

        const logEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('🔔 İZİN SÜRESİ DOLDU')
          .setDescription('Bir yetkilinin izin süresi doldu ve rolleri geri verildi.')
          .addFields(
            {
              name: '👤 Yetkili',
              value: `**İsim:** ${leaveData.username}\n**Tag:** ${leaveData.userTag}\n**ID:** \`${userId}\`\n**Mention:** <@${userId}>`,
              inline: true
            },
            {
              name: '📋 İzin Detayları',
              value: `**Mazeret:** ${leaveData.reason}\n**Süre:** ${leaveData.days} gün`,
              inline: true
            },
            {
              name: '⏰ Tarih Bilgileri',
              value: `**Başlangıç:** <t:${Math.floor(startDate.getTime() / 1000)}:F>\n**Bitiş:** <t:${Math.floor(endDate.getTime() / 1000)}:F>`,
              inline: false
            },
            {
              name: '🔓 Geri Verilen Yetkili Rolleri',
              value: validRolesToRestore.length > 0 
                ? validRolesToRestore.slice(0, 10).map(r => `<@&${r}>`).join(', ') + (validRolesToRestore.length > 10 ? ` +${validRolesToRestore.length - 10} rol daha...` : '')
                : 'Geri verilebilecek yetkili rolü bulunamadı',
              inline: false
            }
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'İzin sistemi tarafından otomatik işlendi' })
          .setTimestamp();

        try {
          await logChannel.send({ embeds: [logEmbed] });
        } catch (sendError) {
          console.error(`❌ Log mesajı gönderilemedi:`, sendError.message);
        }
      }
    }

    // Kullanıcıya DM gönder (opsiyonel)
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔔 İzin Süren Doldu!')
        .setDescription(`**${guild.name}** sunucusundaki izin süren doldu ve yetkili rollerin geri verildi.`)
        .addFields(
          {
            name: '📝 İzin Mazereti',
            value: leaveData.reason,
            inline: false
          },
          {
            name: '📅 İzin Süresi',
            value: `${leaveData.days} gün`,
            inline: true
          }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      // DM kapalı olabilir, sessizce devam et
      console.log(`⚠️ DM gönderilemedi (${userId}): ${dmError.message}`);
    }

  } catch (error) {
    console.error(`❌ İzin işleme hatası (${userId}):`, error);
  }
}

module.exports = {
  startLeaveScheduler,
  stopLeaveScheduler,
  checkExpiredLeaves
};
