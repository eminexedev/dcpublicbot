/**
 * İzin Sistemi Buton Handler
 * İzin taleplerinin onaylanması/reddedilmesi için buton etkileşimlerini yönetir.
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const {
  getLeaveRequest,
  addLeaveRequest,
  removeLeaveRequest,
  getLeaveRole,
  getLeaveLogChannel,
  getLeaveAuthorizedRoles
} = require('../config');

/**
 * İzin sistemi buton handler'ını başlatır
 * @param {Client} client - Discord.js client
 */
function setupLeaveButtonHandler(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // İzin sistemi butonları mı kontrol et
    if (!customId.startsWith('leave_approve_') && !customId.startsWith('leave_reject_')) {
      return;
    }

    const isApprove = customId.startsWith('leave_approve_');
    const targetUserId = customId.split('_')[2];

    try {
      // Yetki kontrolü - Sadece yönetici onaylayabilir/reddedebilir
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ **Yetkin yok!** Sadece yöneticiler izin taleplerini onaylayabilir veya reddedebilir.',
          ephemeral: true
        });
      }

      // İzin talebini kontrol et
      const leaveRequest = getLeaveRequest(interaction.guild.id, targetUserId);
      if (!leaveRequest) {
        return interaction.reply({
          content: '❌ **İzin talebi bulunamadı!** Talep zaten işlenmiş veya iptal edilmiş olabilir.',
          ephemeral: true
        });
      }

      if (leaveRequest.status !== 'pending') {
        return interaction.reply({
          content: '❌ **Bu talep zaten işlenmiş!**',
          ephemeral: true
        });
      }

      // Talep eden kullanıcıyı bul
      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

      if (isApprove) {
        await handleApprove(interaction, leaveRequest, targetMember, targetUser, member);
      } else {
        await handleReject(interaction, leaveRequest, targetMember, targetUser, member);
      }

    } catch (error) {
      console.error('İzin buton handler hatası:', error);
      await interaction.reply({
        content: '❌ İşlem sırasında bir hata oluştu.',
        ephemeral: true
      }).catch(() => {});
    }
  });

  console.log('✅ İzin sistemi buton handler yüklendi.');
}

/**
 * İzin talebini onaylar
 */
async function handleApprove(interaction, leaveRequest, targetMember, targetUser, approver) {
  const guild = interaction.guild;
  const leaveRoleId = getLeaveRole(guild.id);
  const leaveRole = guild.roles.cache.get(leaveRoleId);

  if (!leaveRole) {
    return interaction.reply({
      content: '❌ **İzinli rolü bulunamadı!** Lütfen önce `.izinli-rol` komutu ile rol ayarlayın.',
      ephemeral: true
    });
  }

  if (!targetMember) {
    // Kullanıcı sunucudan ayrılmış
    removeLeaveRequest(guild.id, leaveRequest.userId);
    
    // Mesajı güncelle
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor('#808080')
      .setTitle('🏖️ İZİN TALEBİ - İPTAL EDİLDİ')
      .spliceFields(-1, 1, {
        name: '⏳ Durum',
        value: '⚫ **İPTAL - Kullanıcı sunucudan ayrılmış**',
        inline: false
      });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
    return;
  }

  const now = new Date();
  const endDate = new Date(leaveRequest.endDate);

  try {
    // Sadece tanımlanan yetkili rollerini al, diğer roller kalsın
    const rolesToRemove = leaveRequest.rolesToRemove || [];
    const currentRoleIds = targetMember.roles.cache
      .filter(role => role.id !== guild.id)
      .map(role => role.id);
    
    // Mevcut rollerden yetkili rollerini çıkar ve izinli rolünü ekle
    const newRoles = currentRoleIds.filter(roleId => !rolesToRemove.includes(roleId));
    if (!newRoles.includes(leaveRoleId)) {
      newRoles.push(leaveRoleId);
    }
    
    await targetMember.roles.set(newRoles, `İzin onaylandı: ${leaveRequest.reason} (${leaveRequest.days} gün) - Onaylayan: ${approver.user.tag}`);

    // İzin kaydını aktif olarak güncelle
    addLeaveRequest(guild.id, leaveRequest.userId, {
      ...leaveRequest,
      status: 'active',
      startDate: now.getTime(),
      endDate: endDate.getTime(),
      approvedBy: approver.user.id,
      approvedByTag: approver.user.tag,
      approvedAt: now.getTime()
    });

    console.log(`✅ İzin onaylandı: ${leaveRequest.username} - Onaylayan: ${approver.user.tag}`);

    // Log mesajını güncelle
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor('#57F287')
      .setTitle('🏖️ İZİN TALEBİ - ONAYLANDI')
      .spliceFields(-1, 1, 
        {
          name: '⏳ Durum',
          value: '🟢 **ONAYLANDI**',
          inline: false
        },
        {
          name: '👮 Onaylayan Yetkili',
          value: `<@${approver.user.id}> (${approver.user.tag})`,
          inline: true
        },
        {
          name: '📅 Onay Tarihi',
          value: `<t:${Math.floor(now.getTime() / 1000)}:F>`,
          inline: true
        }
      );

    await interaction.update({ embeds: [updatedEmbed], components: [] });

    // Kullanıcıya DM gönder
    if (targetUser) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('✅ İzin Talebin Onaylandı!')
          .setDescription(`**${guild.name}** sunucusundaki izin talebin onaylandı.`)
          .addFields(
            {
              name: '📝 Mazeret',
              value: leaveRequest.reason,
              inline: false
            },
            {
              name: '📅 Süre',
              value: `${leaveRequest.days} gün`,
              inline: true
            },
            {
              name: '🏁 Başlangıç',
              value: `<t:${Math.floor(now.getTime() / 1000)}:F>`,
              inline: true
            },
            {
              name: '🔚 Bitiş',
              value: `<t:${Math.floor(endDate.getTime() / 1000)}:F>`,
              inline: true
            },
            {
              name: '👮 Onaylayan',
              value: `${approver.user.tag}`,
              inline: true
            },
            {
              name: '🎭 Verilen Rol',
              value: `${leaveRole.name}`,
              inline: true
            }
          )
          .setFooter({ text: 'İzin süren bittiğinde rollerin otomatik olarak geri verilecek.', iconURL: guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`⚠️ DM gönderilemedi (${leaveRequest.userId}): ${dmError.message}`);
      }
    }

  } catch (error) {
    console.error('İzin onaylama hatası:', error);
    await interaction.reply({
      content: '❌ İzin onaylanırken bir hata oluştu. Rol hiyerarşisini kontrol edin.',
      ephemeral: true
    });
  }
}

/**
 * İzin talebini reddeder
 */
async function handleReject(interaction, leaveRequest, targetMember, targetUser, rejecter) {
  const guild = interaction.guild;
  const now = new Date();

  // İzin kaydını sil
  removeLeaveRequest(guild.id, leaveRequest.userId);

  console.log(`❌ İzin reddedildi: ${leaveRequest.username} - Reddeden: ${rejecter.user.tag}`);

  // Log mesajını güncelle
  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor('#ED4245')
    .setTitle('🏖️ İZİN TALEBİ - REDDEDİLDİ')
    .spliceFields(-1, 1, 
      {
        name: '⏳ Durum',
        value: '🔴 **REDDEDİLDİ**',
        inline: false
      },
      {
        name: '👮 Reddeden Yetkili',
        value: `<@${rejecter.user.id}> (${rejecter.user.tag})`,
        inline: true
      },
      {
        name: '📅 Red Tarihi',
        value: `<t:${Math.floor(now.getTime() / 1000)}:F>`,
        inline: true
      }
    );

  await interaction.update({ embeds: [updatedEmbed], components: [] });

  // Kullanıcıya DM gönder
  if (targetUser) {
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('❌ İzin Talebin Reddedildi')
        .setDescription(`**${guild.name}** sunucusundaki izin talebin reddedildi.`)
        .addFields(
          {
            name: '📝 Mazeret',
            value: leaveRequest.reason,
            inline: false
          },
          {
            name: '📅 Talep Edilen Süre',
            value: `${leaveRequest.days} gün`,
            inline: true
          },
          {
            name: '👮 Reddeden',
            value: `${rejecter.user.tag}`,
            inline: true
          },
          {
            name: '📅 Red Tarihi',
            value: `<t:${Math.floor(now.getTime() / 1000)}:F>`,
            inline: false
          }
        )
        .setFooter({ text: 'Gerekirse yöneticilerle iletişime geçebilirsiniz.', iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`⚠️ DM gönderilemedi (${leaveRequest.userId}): ${dmError.message}`);
    }
  }
}

module.exports = {
  setupLeaveButtonHandler
};
