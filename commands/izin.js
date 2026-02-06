const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
  getLeaveAuthorizedRoles, 
  getLeaveRole, 
  getLeaveLogChannel,
  addLeaveRequest,
  getLeaveRequest
} = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('izin')
    .setDescription('İzin talebi oluşturur.')
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('İzin sebebi/mazereti')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('gun')
        .setDescription('İzin süresi (gün)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30)),

  category: 'moderation',
  description: 'Yetkililerin izin talebi oluşturmasını sağlar. Talep yetkili onayına gönderilir.',
  usage: '.izin [sebep] {gün}',
  permissions: [],

  async execute(ctx, args) {
    let isSlash = false;
    try {
      if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) {
        isSlash = true;
      }
    } catch {}

    const guild = ctx.guild;
    if (!guild) {
      const msg = '❌ Bu komut sadece sunucularda kullanılabilir.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await guild.members.fetch(executorId);

    // Yetkili rol kontrolü
    const authorizedRoles = getLeaveAuthorizedRoles(guild.id);
    if (authorizedRoles.length === 0) {
      const msg = '❌ **İzin sistemi henüz ayarlanmamış!** Bir yönetici `.izinli-yetkili-rol ekle @rol` komutu ile yetkili rollerini tanımlamalı.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Kullanıcının yetkili rollerinden birine sahip olup olmadığını kontrol et
    const hasAuthorizedRole = authorizedRoles.some(role => executor.roles.cache.has(role.id));
    if (!hasAuthorizedRole) {
      const msg = '❌ **İzin almaya yetkin yok!**\n Sadece yetkili ekip üyeleri izin alabilir.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // İzinli rolü kontrolü
    const leaveRoleId = getLeaveRole(guild.id);
    if (!leaveRoleId) {
      const msg = '❌ **İzinli rolü ayarlanmamış!** Bir yönetici `.izinli-rol @rol` komutu ile izinli rolünü tanımlamalı.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    const leaveRole = guild.roles.cache.get(leaveRoleId);
    if (!leaveRole) {
      const msg = '❌ **Ayarlanmış izinli rolü bulunamadı!** Rol silinmiş olabilir, yeniden `.izinli-rol` komutu ile ayarlayın.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Log kanalı kontrolü
    const logChannelId = getLeaveLogChannel(guild.id);
    if (!logChannelId) {
      const msg = '❌ **İzin log kanalı ayarlanmamış!** Bir yönetici `.izinli-logkanal #kanal` komutu ile log kanalını tanımlamalı.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) {
      const msg = '❌ **Ayarlanmış log kanalı bulunamadı!** Kanal silinmiş olabilir, yeniden `.izinli-logkanal` komutu ile ayarlayın.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Zaten bekleyen veya aktif izin var mı kontrol et
    const existingLeave = getLeaveRequest(guild.id, executorId);
    if (existingLeave) {
      if (existingLeave.status === 'pending') {
        const msg = `❌ **Zaten bekleyen bir izin talebin var!** Onay bekleniyor.`;
        if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
        return ctx.reply(msg);
      }
      if (existingLeave.status === 'active') {
        const endDate = new Date(existingLeave.endDate);
        const msg = `❌ **Zaten izinlisin!** Mevcut izin bitiş tarihin: <t:${Math.floor(endDate.getTime() / 1000)}:F>`;
        if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
        return ctx.reply(msg);
      }
    }

    let reason, days;

    if (isSlash) {
      reason = ctx.options.getString('sebep');
      days = ctx.options.getInteger('gun');
    } else {
      // Prefix komut: .izinli [sebep] {gün}
      if (!args || args.length < 2) {
        return ctx.reply('❌ Kullanım: `.izinli [sebep] {gün}`\nÖrnek: `.izinli Tatil 5`');
      }

      // Son argüman gün sayısı
      const daysArg = args[args.length - 1];
      days = parseInt(daysArg);
      
      if (isNaN(days) || days < 1 || days > 30) {
        return ctx.reply('❌ Gün sayısı 1-30 arasında bir sayı olmalı.');
      }

      // Geri kalan argümanlar sebep
      reason = args.slice(0, -1).join(' ');
      if (!reason || reason.trim().length === 0) {
        return ctx.reply('❌ Bir mazeret/sebep belirtmelisin.');
      }
    }

    // Bot rol pozisyon kontrolü
    const botMember = await guild.members.fetch(ctx.client.user.id);
    const botHighestRole = botMember.roles.highest;

    if (leaveRole.position >= botHighestRole.position) {
      const msg = `❌ **ROL HİYERARŞİSİ HATASI!** İzinli rolü (\`${leaveRole.name}\`) botun rolünden yüksek. Bot bu rolü veremez!`;
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Kullanıcının en yüksek rolü bottan yüksek mi kontrol et
    const userHighestRole = executor.roles.highest;
    if (userHighestRole.position >= botHighestRole.position) {
      const msg = `❌ **ROL HİYERARŞİSİ HATASI!** Senin rolün botun rolünden yüksek. Bot senin rollerini yönetemez!`;
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    try {
      // Sadece tanımlanan yetkili rollerinden sahip olunanları kaydet (izin bitince geri vermek için)
      const authorizedRoleIds = authorizedRoles.map(r => r.id);
      const rolesToRemove = executor.roles.cache
        .filter(role => role.id !== guild.id && authorizedRoleIds.includes(role.id))
        .map(role => role.id);

      const now = new Date();
      const endDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
      const requestId = `${executorId}-${now.getTime()}`;

      // İzin talebini BEKLEMEDE olarak kaydet (henüz onaylanmadı)
      addLeaveRequest(guild.id, executorId, {
        status: 'pending', // beklemede
        userId: executorId,
        username: executor.user.username,
        userTag: executor.user.tag,
        reason: reason,
        days: days,
        requestDate: now.getTime(),
        endDate: endDate.getTime(),
        rolesToRemove: rolesToRemove, // Sadece alınacak yetkili rolleri
        leaveRoleId: leaveRoleId,
        requestId: requestId
      });

      console.log(`📝 ${executor.user.username} izin talebi oluşturdu - ${days} gün - Sebep: ${reason}`);

      // Kullanıcıya bilgi mesajı
      const pendingEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📝 İzin Talebin Gönderildi')
        .setDescription(`İzin talebin yetkililere iletildi. Onay bekliyor...`)
        .addFields(
          {
            name: '📝 Mazeret',
            value: reason,
            inline: false
          },
          {
            name: '📅 Talep Edilen Süre',
            value: `${days} gün`,
            inline: true
          },
          {
            name: '⏳ Durum',
            value: '🟡 Onay Bekliyor',
            inline: true
          }
        )
        .setThumbnail(executor.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Sonuç DM üzerinden bildirilecek.' })
        .setTimestamp();

      if (isSlash) {
        await ctx.reply({ embeds: [pendingEmbed], flags: MessageFlags.Ephemeral });
      } else {
        await ctx.reply({ embeds: [pendingEmbed] });
      }

      // Log kanalına onay butonlarıyla mesaj gönder
      const logEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🏖️ YENİ İZİN TALEBİ - ONAY BEKLİYOR')
        .setDescription('Bir yetkili izin talep etti. Lütfen talebi değerlendirin.')
        .addFields(
          {
            name: '👤 Talep Eden Yetkili',
            value: `**İsim:** ${executor.user.username}\n**Tag:** ${executor.user.tag}\n**ID:** \`${executorId}\`\n**Mention:** <@${executorId}>`,
            inline: true
          },
          {
            name: '📋 Talep Detayları',
            value: `**Mazeret:** ${reason}\n**Süre:** ${days} gün\n**Verilecek Rol:** <@&${leaveRoleId}>`,
            inline: true
          },
          {
            name: '⏰ Tarih Bilgileri',
            value: `**Talep Tarihi:** <t:${Math.floor(now.getTime() / 1000)}:F>\n**Bitiş (Onaylanırsa):** <t:${Math.floor(endDate.getTime() / 1000)}:F>`,
            inline: false
          },
          {
            name: '🔐 Alınacak Yetkili Rolleri',
            value: rolesToRemove.length > 0 
              ? rolesToRemove.slice(0, 10).map(r => `<@&${r}>`).join(', ') + (rolesToRemove.length > 10 ? ` +${rolesToRemove.length - 10} rol daha...` : '')
              : 'Alınacak yetkili rolü yok',
            inline: false
          },
          {
            name: '⏳ Durum',
            value: '🟡 **ONAY BEKLİYOR**',
            inline: false
          }
        )
        .setThumbnail(executor.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Talep ID: ${requestId}` })
        .setTimestamp();

      // Onay/Red butonları
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`leave_approve_${executorId}`)
            .setLabel('✅ Onayla')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`leave_reject_${executorId}`)
            .setLabel('❌ Reddet')
            .setStyle(ButtonStyle.Danger)
        );

      await logChannel.send({ embeds: [logEmbed], components: [row] });

    } catch (error) {
      console.error('İzin talebi hatası:', error);
      const msg = '❌ İzin talebi oluşturulurken bir hata oluştu.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }
  }
};
