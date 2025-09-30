const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');
const { getJailRole, getJailLogChannel, getUnjailLogChannel } = require('../jailConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Bir kullanıcıyı jail\'e atar - Tüm rolleri alınır ve jail rolü verilir.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Jail\'e atılacak kullanıcı').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'moderation',
  description: 'Bir kullanıcıyı jail\'e atar. Tüm rolleri alınır ve jail rolü verilir. Dropdown menüden sebep seçimi yapılır.',
  usage: '.jail @kullanici',
  permissions: [PermissionFlagsBits.BanMembers],

  async execute(ctx, args) {
    // SÜPER GÜÇLÜ KLONLANMA ENGELLEYİCİ
    const antiCloneUserId = ctx.user?.id || ctx.author?.id;
    const executionKey = `jail_${antiCloneUserId}_${Date.now()}`;
    
    // Global execution tracker
    if (!global.jailExecutions) global.jailExecutions = new Set();
    if (global.jailExecutions.has(antiCloneUserId)) {
      console.log(`🚫 [ANTI-CLONE] Jail komutu klonlanma girişimi engellendi: ${antiCloneUserId}`);
      return;
    }
    
    global.jailExecutions.add(antiCloneUserId);
    
    // 5 saniye sonra temizle
    setTimeout(() => {
      global.jailExecutions.delete(antiCloneUserId);
    }, 5000);
    
    // Eğer zaten yanıtlandıysa tekrar işleme
    if (ctx.replied || ctx.deferred) {
      global.jailExecutions.delete(antiCloneUserId);
      return;
    }
    
    let targetUser;

    // Hedef kullanıcıyı belirle
    if (ctx.isCommand && ctx.isCommand()) {
      // Slash komut
      targetUser = ctx.options.getUser('kullanici');
    } else {
      // Prefix komut
      if (!args[0]) {
        return ctx.reply({
          content: '❌ Bir kullanıcı etiketlemelisin. Örnek: `!jail @kullanıcı`',
          flags: MessageFlags.Ephemeral
        });
      }

      // Kullanıcıyı bul
      const userMatch = args[0].match(/^<@!?(\d+)>$|^(\d+)$/);
      if (!userMatch) {
        return ctx.reply({
          content: '❌ Geçerli bir kullanıcı etiketlemelisin.',
          flags: MessageFlags.Ephemeral
        });
      }

      const userId = userMatch[1] || userMatch[2];
      try {
        targetUser = await ctx.client.users.fetch(userId);
      } catch (error) {
        return ctx.reply({
          content: '❌ Kullanıcı bulunamadı.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (!targetUser) {
      return ctx.reply({
        content: '❌ Bir kullanıcı etiketlemelisin veya ID girmelisin.',
        flags: MessageFlags.Ephemeral
      });
    }

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Yasakla" yetkisine sahip olmalısın.',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return ctx.reply({
        content: '❌ Kullanıcı sunucuda bulunamadı.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!member.manageable) {
      return ctx.reply({
        content: '❌ Bu kullanıcının rolleri yönetilemez.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ROL HİYERAŞİSİ KONTROLÜ - GÜVENLİK
    const executorHighestRole = executor.roles.highest;
    const targetHighestRole = member.roles.highest;
    
    // Hedef kullanıcının rolü, komutu kullananın rolünden yüksek veya eşitse
    if (targetHighestRole.position >= executorHighestRole.position) {
      return ctx.reply({
        content: `❌ **ROL HİYERARŞİSİ İHLALİ!** ${targetUser.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) seninkinden (\`${executorHighestRole.name}\`) yüksek veya eşit. Kendinden üst roldeki birini jail'e atamazsın!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Bot kontrolü - Bot da kendinden yüksek roldeki birini jail'e atamaz
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    const botHighestRole = botMember.roles.highest;
    
    if (targetHighestRole.position >= botHighestRole.position) {
      return ctx.reply({
        content: `❌ **BOT YETKİSİ YETERSİZ!** ${targetUser.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) botun rolünden (\`${botHighestRole.name}\`) yüksek veya eşit. Bot bu kullanıcıyı jail'e atamaz!`,
        flags: MessageFlags.Ephemeral
      });
    }

    console.log(`🔒 [ROL KONTROLÜ] ${executor.user.tag} (${executorHighestRole.name}) -> ${targetUser.tag} (${targetHighestRole.name}) - İZİN VERİLDİ`);

    // ÖN-KONTROL: Jail sistemi kurulumu kontrolü
    const jailRoleId = getJailRole(ctx.guild.id);
    if (!jailRoleId) {
      return ctx.reply({
        content: '❌ **Jail rolü ayarlanmamış!** Önce bir yetkili `.jailrol @rol` komutu ile jail rolünü ayarlamalı.',
        flags: MessageFlags.Ephemeral
      });
    }

    const jailRole = ctx.guild.roles.cache.get(jailRoleId);
    if (!jailRole) {
      return ctx.reply({
        content: '❌ **Ayarlanmış jail rolü bulunamadı!** Rol silinmiş olabilir, yeniden `.jailrol` komutu ile ayarlayın.',
        flags: MessageFlags.Ephemeral
      });
    }

    const jailLogChannelId = getJailLogChannel(ctx.guild.id);
    if (!jailLogChannelId) {
      return ctx.reply({
        content: '❌ **Jail log kanalı ayarlanmamış!** Önce bir yetkili `.jaillogkanal #kanal` komutu ile jail log kanalını ayarlamalı.',
        flags: MessageFlags.Ephemeral
      });
    }

    const unjailLogChannelId = getUnjailLogChannel(ctx.guild.id);
    if (!unjailLogChannelId) {
      return ctx.reply({
        content: '❌ **Unjail log kanalı ayarlanmamış!** Önce bir yetkili `.unjaillogkanal #kanal` komutu ile unjail log kanalını ayarlamalı.',
        flags: MessageFlags.Ephemeral
      });
    }

    const jailLogChannel = ctx.guild.channels.cache.get(jailLogChannelId);
    if (!jailLogChannel) {
      return ctx.reply({
        content: '❌ **Ayarlanmış jail log kanalı bulunamadı!** Kanal silinmiş olabilir, yeniden `.jaillogkanal` komutu ile ayarlayın.',
        flags: MessageFlags.Ephemeral
      });
    }

    const unjailLogChannel = ctx.guild.channels.cache.get(unjailLogChannelId);
    if (!unjailLogChannel) {
      return ctx.reply({
        content: '❌ **Ayarlanmış unjail log kanalı bulunamadı!** Kanal silinmiş olabilir, yeniden `.unjaillogkanal` komutu ile ayarlayın.',
        flags: MessageFlags.Ephemeral
      });
    }

    console.log(`✅ Jail sistemi kontrolleri başarılı - Rol: ${jailRole.name}, Jail Log: #${jailLogChannel.name}, Unjail Log: #${unjailLogChannel.name}`);

    // İnteraktif jail menüsü oluştur
    const jailEmbed = new EmbedBuilder()
      .setColor('#8B0000')
      .setTitle('🔒 Jail İşlemi')
      .setDescription(`**${targetUser.tag}** kullanıcısını neden jail'e atmak istiyorsun?`)
      .addFields(
        {
          name: '🔗 Spam/Flood',
          value: 'Süre: 1 saat',
          inline: true
        },
        {
          name: '🚫 Kuralları Çiğneme',
          value: 'Süre: 3 saat',
          inline: true
        },
        {
          name: '⚠️ Ciddi İhlal',
          value: 'Süre: 6 saat',
          inline: true
        },
        {
          name: '💀 Ağır Suç',
          value: 'Süre: 12 saat',
          inline: true
        },
        {
          name: '🎯 Özel Durum',
          value: 'Süre: 24 saat',
          inline: true
        },
        {
          name: '🔥 Kalıcı Jail',
          value: 'Süre: ∞ (Manuel çıkarılmalı)',
          inline: true
        }
      )
      .setFooter({ text: 'Aşağıdaki menüden jail sebepini seçin' })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`jail_${targetUser.id}_${Date.now()}`)
          .setPlaceholder('Jail sebepini seçin...')
          .addOptions([
            {
              label: '🔗 Spam/Flood',
              description: '1 saat jail cezası',
              value: 'spam'
            },
            {
              label: '🚫 Kuralları Çiğneme',
              description: '3 saat jail cezası',
              value: 'kural'
            },
            {
              label: '⚠️ Ciddi İhlal',
              description: '6 saat jail cezası',
              value: 'ciddi'
            },
            {
              label: '💀 Ağır Suç',
              description: '12 saat jail cezası',
              value: 'agir'
            },
            {
              label: '🎯 Özel Durum',
              description: '24 saat jail cezası',
              value: 'ozel'
            },
            {
              label: '🔥 Kalıcı Jail',
              description: 'Manuel çıkarılmalı',
              value: 'kalici'
            }
          ])
      );

    return ctx.reply({
      embeds: [jailEmbed],
      components: [row],
      flags: MessageFlags.Ephemeral 
    });
  }
};

// Jail select menu etkileşimi
module.exports.handleSelectMenu = async (interaction) => {
  if (!interaction.customId.startsWith('jail_')) return;
  
  // SÜPER GÜÇLÜ SELECT MENU KLONLANMA ENGELLEYİCİ
  const selectMenuUserId = interaction.user.id;
  const interactionId = interaction.customId;
  
  if (!global.jailSelectExecutions) global.jailSelectExecutions = new Set();
  
  // Eğer bu interaction zaten işlendiyse engelle
  if (global.jailSelectExecutions.has(interactionId)) {
    console.log(`🚫 [ANTI-DUPLICATE] Bu jail interaction zaten işlendi: ${interactionId}`);
    return;
  }
  
  // User bazlı engelleme de ekle
  if (global.jailSelectExecutions.has(selectMenuUserId)) {
    console.log(`🚫 [ANTI-CLONE] Jail select menu klonlanma girişimi engellendi: ${selectMenuUserId}`);
    return;
  }
  
  // Hem interaction ID'sini hem user ID'sini kaydet
  global.jailSelectExecutions.add(interactionId);
  global.jailSelectExecutions.add(selectMenuUserId);
  
  // 30 saniye sonra temizle (daha uzun süre)
  setTimeout(() => {
    global.jailSelectExecutions.delete(interactionId);
    global.jailSelectExecutions.delete(selectMenuUserId);
  }, 30000);

  // İnteraction timeout önlemi
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (error) {
    console.log('⚠️ DeferReply hatası (zaten yanıtlanmış olabilir):', error.message);
    global.jailSelectExecutions.delete(interactionId);
    global.jailSelectExecutions.delete(selectMenuUserId);
    return;
  }
  
  // customId'den target user ID'sini çıkar
  const customIdParts = interaction.customId.split('_');
  const targetUserId = customIdParts[1];
  const selectedReason = interaction.values[0];
  
  const jailSebepler = {
    'spam': { sure: 60, sebep: '🔗 Spam/Flood' },
    'kural': { sure: 180, sebep: '🚫 Kuralları Çiğneme' },
    'ciddi': { sure: 360, sebep: '⚠️ Ciddi İhlal' },
    'agir': { sure: 720, sebep: '💀 Ağır Suç' },
    'ozel': { sure: 1440, sebep: '🎯 Özel Durum' },
    'kalici': { sure: 0, sebep: '🔥 Kalıcı Jail' }
  };
  
  const secenek = jailSebepler[selectedReason];
  if (!secenek) {
    return interaction.editReply({
      content: '❌ Geçersiz sebep seçimi.'
    });
  }
  
  try {
    const targetUser = await interaction.client.users.fetch(targetUserId);
    const member = await interaction.guild.members.fetch(targetUserId);
    
    if (!member.manageable) {
      return interaction.editReply({
        content: '❌ Bu kullanıcının rolleri yönetilemez.'
      });
    }
    
    // Ayarlanan jail rolünü kontrol et
    const jailRoleId = getJailRole(interaction.guild.id);
    if (!jailRoleId) {
      return interaction.editReply({
        content: '❌ **Jail rolü ayarlanmamış!** Önce bir yetkili `.jailrol @rol` komutu ile jail rolünü ayarlamalı.'
      });
    }
    
    const jailRole = interaction.guild.roles.cache.get(jailRoleId);
    if (!jailRole) {
      return interaction.editReply({
        content: '❌ **Ayarlanmış jail rolü bulunamadı!** Rol silinmiş olabilir, yeniden `.jailrol` komutu ile ayarlayın.'
      });
    }
    
    // Bot bu rolü verebilir mi kontrol et
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    const botHighestRole = botMember.roles.highest;
    
    if (jailRole.position >= botHighestRole.position) {
      return interaction.editReply({
        content: `❌ **ROL HİYERARŞİSİ HATASI!** Jail rolü (\`${jailRole.name}\`) botun en yüksek rolünden (\`${botHighestRole.name}\`) yüksek veya eşit konumda. Bot bu rolü veremez!`
      });
    }
    
    // Log kanallarının ayarlı olup olmadığını kontrol et
    const jailLogChannelId = getJailLogChannel(interaction.guild.id);
    const unjailLogChannelId = getUnjailLogChannel(interaction.guild.id);
    
    if (!jailLogChannelId) {
      return interaction.editReply({
        content: '❌ **Jail log kanalı ayarlanmamış!** Önce bir yetkili `.jaillogkanal #kanal` komutu ile jail log kanalını ayarlamalı.'
      });
    }
    
    if (!unjailLogChannelId) {
      return interaction.editReply({
        content: '❌ **Unjail log kanalı ayarlanmamış!** Önce bir yetkili `.unjaillogkanal #kanal` komutu ile unjail log kanalını ayarlamalı.'
      });
    }
    
    // Log kanallarının mevcut olup olmadığını kontrol et
    const jailLogChannel = interaction.guild.channels.cache.get(jailLogChannelId);
    const unjailLogChannel = interaction.guild.channels.cache.get(unjailLogChannelId);
    
    if (!jailLogChannel) {
      return interaction.editReply({
        content: '❌ **Ayarlanmış jail log kanalı bulunamadı!** Kanal silinmiş olabilir, yeniden `.jaillogkanal` komutu ile ayarlayın.'
      });
    }
    
    if (!unjailLogChannel) {
      return interaction.editReply({
        content: '❌ **Ayarlanmış unjail log kanalı bulunamadı!** Kanal silinmiş olabilir, yeniden `.unjaillogkanal` komutu ile ayarlayın.'
      });
    }
    
    console.log(`✅ Jail rolü kontrol edildi: ${jailRole.name}`);
    console.log(`✅ Jail log kanalı kontrol edildi: #${jailLogChannel.name}`);
    console.log(`✅ Unjail log kanalı kontrol edildi: #${unjailLogChannel.name}`);
    
    // Kullanıcının mevcut rollerini kaydet (jail'den çıkarken geri vermek için)
    const currentRoles = member.roles.cache
      .filter(role => role.id !== interaction.guild.id) // @everyone rolünü filtrele
      .map(role => role.id);
    
    console.log(`💾 ${targetUser.username} kullanıcısının ${currentRoles.length} rolü kaydedildi`);
    
    // Tüm rolleri kaldır ve jail rolünü ver
    try {
      await member.roles.set([jailRole.id], `Jail: ${secenek.sebep}`);
      console.log(`✅ ${targetUser.username} kullanıcısının tüm rolleri alındı ve ${jailRole.name} rolü verildi`);
    } catch (roleError) {
      console.error('❌ Rol değişimi hatası:', roleError);
      return interaction.editReply({
        content: '❌ Kullanıcının rolleri değiştirilemedi.'
      });
    }
    
    // Eğer kullanıcı voice kanalındaysa kes
    if (member.voice.channel) {
      try {
        await member.voice.disconnect(`Jail'e atıldı: ${secenek.sebep}`);
        console.log(`🔇 ${targetUser.username} voice kanalından atıldı`);
      } catch (voiceError) {
        console.error(`❌ Voice disconnect hatası: ${voiceError.message}`);
      }
    }
    
    // Jail verilerini saklama (basit bellekte - gerçek projelerde database kullanın)
    if (!global.jailedUsers) global.jailedUsers = new Map();
    global.jailedUsers.set(targetUserId, {
      originalRoles: currentRoles,
      jailTime: Date.now(),
      reason: secenek.sebep,
      duration: secenek.sure,
      guild: interaction.guild.id
    });
    
    // Log mesajı hazırla - DETAYLI JAIL LOG SİSTEMİ
    // Log kanalları yukarıda kontrol edildi ve var
    const jailTime = new Date();
    const jailTimeTimestamp = Math.floor(jailTime.getTime() / 1000);
    
    const logEmbed = new EmbedBuilder()
      .setColor('#8B0000')
      .setTitle('🔒 JAIL İŞLEMİ GERÇEKLEŞTİRİLDİ')
      .setDescription('Bir kullanıcı jail\'e atıldı. İşlem detayları aşağıda yer almaktadır.')
      .addFields(
        {
          name: '👤 Jail\'e Atılan Kullanıcı',
          value: `**İsim:** ${targetUser.username}\n**Tag:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\`\n**Mention:** <@${targetUser.id}>`,
              inline: true
            },
            {
              name: '👮 İşlemi Gerçekleştiren Yetkili',
              value: `**İsim:** ${interaction.user.username}\n**Tag:** ${interaction.user.tag}\n**ID:** \`${interaction.user.id}\`\n**Mention:** <@${interaction.user.id}>`,
              inline: true
            },
            {
              name: '� İşlem Detayları',
              value: `**Sebep:** ${secenek.sebep}\n**Süre:** ${secenek.sure === 0 ? 'Kalıcı (Manuel çıkarılmalı)' : `${secenek.sure} dakika`}\n**Alınan Rol Sayısı:** ${currentRoles.length}`,
              inline: false
            },
            {
              name: '🕐 Jail\'e Atılma Saati',
              value: `**Tam Tarih:** ${jailTime.toLocaleString('tr-TR', { 
                timeZone: 'Europe/Istanbul',
                year: 'numeric',
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}\n**Discord Timestamp:** <t:${jailTimeTimestamp}:F>\n**Relatif Zaman:** <t:${jailTimeTimestamp}:R>`,
              inline: true
            },
            {
              name: '🎭 Rol Durumu',
              value: currentRoles.length > 0 
                ? `✅ ${currentRoles.length} adet rol başarıyla alındı ve kaydedildi`
                : '⚪ Kullanıcının alınacak rolü yoktu (@everyone hariç)',
              inline: true
            }
          )
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .setFooter({ 
            text: `Jail Log Sistemi • Sunucu: ${interaction.guild.name}`,
            iconURL: interaction.guild.iconURL({ dynamic: true })
          })
          .setTimestamp();
        
        // Eğer süre varsa bitiş zamanını da ekle
        if (secenek.sure > 0) {
          const endTime = Math.floor((Date.now() + (secenek.sure * 60 * 1000)) / 1000);
          logEmbed.addFields({
            name: '🔓 Jail Bitiş Saati',
            value: `**Discord Timestamp:** <t:${endTime}:F>\n**Relatif Zaman:** <t:${endTime}:R>\n**Kalan Süre:** ${secenek.sure} dakika`,
            inline: false
          });
        }
        
        // Sunucu bilgilerini ekle
        logEmbed.addFields({
          name: '🏠 Sunucu Bilgileri',
          value: `**Sunucu:** ${interaction.guild.name}\n**Sunucu ID:** \`${interaction.guild.id}\`\n**Üye Sayısı:** ${interaction.guild.memberCount}`,
          inline: false
        });
        
        await jailLogChannel.send({ embeds: [logEmbed] });
        console.log(`📝 Jail log mesajı gönderildi: ${targetUser.tag} jail'e atıldı`);
    
    // Otomatik jail kaldırma (kalıcı jail hariç)
    if (secenek.sure > 0) {
      setTimeout(async () => {
        try {
          const stillMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          const jailData = global.jailedUsers?.get(targetUserId);
          
          if (stillMember && jailData && stillMember.roles.cache.has(jailRole.id)) {
            // Jail rolünü kaldır ve eski rolleri geri ver
            const rolesToRestore = jailData.originalRoles.filter(roleId => 
              interaction.guild.roles.cache.has(roleId)
            );
            
            await stillMember.roles.set(rolesToRestore, 'Jail süresi doldu - rolleri geri verildi');
            global.jailedUsers?.delete(targetUserId);
            
            // Otomatik Unjail log - DETAYLI LOG SİSTEMİ
            const unjailLogChannelId = getUnjailLogChannel(interaction.guild.id);
            if (unjailLogChannelId) {
              const unjailLogChannel = interaction.guild.channels.cache.get(unjailLogChannelId);
              if (unjailLogChannel) {
                const autoUnjailTime = new Date();
                const autoUnjailTimeTimestamp = Math.floor(autoUnjailTime.getTime() / 1000);
                
                const unjailEmbed = new EmbedBuilder()
                  .setColor('#57F287')
                  .setTitle('🔓 OTOMATİK UNJAIL - SÜRE DOLDU')
                  .setDescription('Bir kullanıcının jail süresi doldu ve otomatik olarak çıkarıldı.')
                  .addFields(
                    {
                      name: '👤 Jail\'den Çıkarılan Kullanıcı',
                      value: `**İsim:** ${targetUser.username}\n**Tag:** ${targetUser.tag}\n**ID:** \`${targetUser.id}\`\n**Mention:** <@${targetUser.id}>`,
                      inline: true
                    },
                    {
                      name: '⏰ Süre Bilgileri',
                      value: `**Tamamlanan Süre:** ${secenek.sure} dakika\n**Başlangıç:** <t:${Math.floor(jailData.jailTime / 1000)}:F>\n**Bitiş:** <t:${autoUnjailTimeTimestamp}:F>`,
                      inline: true
                    },
                    {
                      name: '📋 İşlem Detayları',
                      value: `**İşlem Türü:** Otomatik Unjail\n**Geri Verilen Rol Sayısı:** ${rolesToRestore.length}\n**Orijinal Sebep:** ${secenek.sebep}`,
                      inline: false
                    },
                    {
                      name: '🎭 Rol Durumu',
                      value: rolesToRestore.length > 0 
                        ? `✅ ${rolesToRestore.length} adet rol başarıyla geri verildi`
                        : '⚪ Geri verilecek rol yoktu',
                      inline: true
                    },
                    {
                      name: '� Çıkarılma Saati',
                      value: `**Tam Tarih:** ${autoUnjailTime.toLocaleString('tr-TR', { 
                        timeZone: 'Europe/Istanbul',
                        year: 'numeric',
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}\n**Relatif Zaman:** <t:${autoUnjailTimeTimestamp}:R>`,
                      inline: true
                    }
                  )
                  .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                  .setFooter({ 
                    text: `Otomatik Unjail Log Sistemi • Sunucu: ${interaction.guild.name}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                  })
                  .setTimestamp();
                
                await unjailLogChannel.send({ embeds: [unjailEmbed] });
                console.log(`📝 Otomatik unjail log mesajı gönderildi: ${targetUser.tag}`);
              } else {
                console.log('⚠️ Unjail log kanalı bulunamadı, log gönderilemedi');
              }
            } else {
              console.log('⚠️ Bu sunucu için unjail log kanalı ayarlanmamış');
            }
            
            console.log(`✅ ${targetUser.username} otomatik olarak jail'den çıkarıldı`);
          }
        } catch (error) {
          console.error('Otomatik unjail hatası:', error);
        }
      }, secenek.sure * 60 * 1000);
    }
    
    // Başarı embed'i
    const successEmbed = new EmbedBuilder()
      .setColor('#8B0000')
      .setTitle('🔒 Kullanıcı Jail\'e Atıldı')
      .setDescription(`**${targetUser.tag}** ${secenek.sure === 0 ? 'kalıcı olarak' : secenek.sure + ' dakika'} jail'e atıldı.`)
      .addFields(
        {
          name: '📝 Sebep',
          value: secenek.sebep,
          inline: false
        },
        {
          name: '⏱️ Süre',
          value: secenek.sure === 0 ? 'Kalıcı (Manual çıkarılmalı)' : `${secenek.sure} dakika`,
          inline: true
        },
        {
          name: '🎭 Alınan Roller',
          value: `${currentRoles.length} rol alındı`,
          inline: true
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    
    if (secenek.sure > 0) {
      successEmbed.addFields({
        name: '🔓 Jail Bitişi',
        value: `<t:${Math.floor((Date.now() + (secenek.sure * 60 * 1000)) / 1000)}:F>`,
        inline: false
      });
    }
    
    try {
      // Select menu için her zaman editReply kullan (çünkü deferReply yaptık)
      await interaction.editReply({ 
        embeds: [successEmbed], 
        components: []
      });
      
      // Orijinal mesajdaki dropdown'ı devre dışı bırak
      try {
        const originalMessage = interaction.message;
        if (originalMessage && originalMessage.editable) {
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`jail_disabled_${Date.now()}`)
                .setPlaceholder('Bu jail komutu işlendi ve artık kullanılamaz')
                .setDisabled(true)
                .addOptions([
                  {
                    label: 'İşlem Tamamlandı',
                    description: 'Bu jail komutu artık kullanılamaz',
                    value: 'disabled'
                  }
                ])
            );

          const disabledEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle('🔒 Jail İşlemi - Tamamlandı')
            .setDescription(`**${targetUser.tag}** jail işlemi tamamlandı.`)
            .addFields({
              name: '✅ Durum',
              value: 'Jail işlemi başarıyla tamamlandı ve komut devre dışı bırakıldı.',
              inline: false
            })
            .setTimestamp();

          await originalMessage.edit({
            embeds: [disabledEmbed],
            components: [disabledRow]
          });
        }
      } catch (editError) {
        console.log('⚠️ Orijinal mesaj düzenlenemedi (normal durum):', editError.message);
      }
      
      console.log('✅ Jail işlemi başarıyla tamamlandı ve yanıt gönderildi');
    } catch (interactionError) {
      console.error('❌ Interaction response hatası:', interactionError.message);
    }
    
  } catch (error) {
    console.error('Jail hatası:', error);
    
    // Cleanup
    const cleanupUserId = interaction.user?.id || interaction.author?.id;
    if (cleanupUserId && global.jailSelectExecutions) {
      global.jailSelectExecutions.delete(cleanupUserId);
    }
    if (cleanupUserId && global.jailExecutions) {
      global.jailExecutions.delete(cleanupUserId);
    }
    
    try {
      const errorMessage = {
        content: '❌ Kullanıcı jail\'e atılırken bir hata oluştu.'
      };
      
      // Select menu için her zaman editReply kullan (çünkü başta deferReply yaptık)
      await interaction.editReply(errorMessage);
    } catch (finalError) {
      console.error('Final error handling hatası:', finalError.message);
    }
  }
};