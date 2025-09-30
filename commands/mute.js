const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Bir kullanıcıyı susturur - İnteraktif menü ile sebep seçimi.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

  category: 'moderation',
  description: 'Bir kullanıcıyı rol bazlı sistem ile susturur. Dropdown menüden sebep seçimi yapılır.',
  usage: '.mute @kullanici',
  permissions: [PermissionFlagsBits.MuteMembers],

  async execute(ctx, args) {
    // SÜPER GÜÇLÜ KLONLANMA ENGELLEYİCİ
    const antiCloneUserId = ctx.user?.id || ctx.author?.id;
    const executionKey = `mute_${antiCloneUserId}_${Date.now()}`;
    
    // Global execution tracker
    if (!global.muteExecutions) global.muteExecutions = new Set();
    if (global.muteExecutions.has(antiCloneUserId)) {
      console.log(`🚫 [ANTI-CLONE] Mute komutu klonlanma girişimi engellendi: ${antiCloneUserId}`);
      return;
    }
    
    global.muteExecutions.add(antiCloneUserId);
    
    // 5 saniye sonra temizle
    setTimeout(() => {
      global.muteExecutions.delete(antiCloneUserId);
    }, 5000);
    
    // Eğer zaten yanıtlandıysa tekrar işleme
    if (ctx.replied || ctx.deferred) {
      global.muteExecutions.delete(antiCloneUserId);
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
          content: '❌ Bir kullanıcı etiketlemelisin. Örnek: `!mute @kullanıcı`',
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
    if (!executor.permissions.has(PermissionFlagsBits.MuteMembers)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Üyeleri Sustur" yetkisine sahip olmalısın.',
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

    if (!member.moderatable) {
      return ctx.reply({
        content: '❌ Bu kullanıcı susturulamıyor.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ROL HİYERAŞİSİ KONTROLÜ - GÜVENLİK
    const executorHighestRole = executor.roles.highest;
    const targetHighestRole = member.roles.highest;
    
    // Hedef kullanıcının rolü, komutu kullananın rolünden yüksek veya eşitse
    if (targetHighestRole.position >= executorHighestRole.position) {
      return ctx.reply({
        content: `❌ **ROL HİYERARŞİSİ İHLALİ!** ${targetUser.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) seninkinden (\`${executorHighestRole.name}\`) yüksek veya eşit. Kendinden üst roldeki birini susturamıyorsun!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Bot kontrolü - Bot da kendinden yüksek roldeki birini susturamaz
    const botMember = await ctx.guild.members.fetch(ctx.client.user.id);
    const botHighestRole = botMember.roles.highest;
    
    if (targetHighestRole.position >= botHighestRole.position) {
      return ctx.reply({
        content: `❌ **BOT YETKİSİ YETERSİZ!** ${targetUser.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) botun rolünden (\`${botHighestRole.name}\`) yüksek veya eşit. Bot bu kullanıcıyı susturamaz!`,
        flags: MessageFlags.Ephemeral
      });
    }

    console.log(`🔒 [ROL KONTROLÜ] ${executor.user.tag} (${executorHighestRole.name}) -> ${targetUser.tag} (${targetHighestRole.name}) - İZİN VERİLDİ`);

    // İnteraktif mute menüsü oluştur
    const muteEmbed = new EmbedBuilder()
      .setColor('#FF8C00')
      .setTitle('🔇 Mute İşlemi')
      .setDescription(`**${targetUser.tag}** kullanıcısını neden susturmak istiyorsun?`)
      .addFields(
        {
          name: '🤬 Küfür/Hakaret',
          value: 'Süre: 5 dakika',
          inline: true
        },
        {
          name: '👨‍👩‍👧‍👦 Ailevi Değerlere Küfür',
          value: 'Süre: 30 dakika',
          inline: true
        },
        {
          name: '😠 Kişiyi Kışkırtma',
          value: 'Süre: 5 dakika',
          inline: true
        },
        {
          name: '⚠️ Tehditkar Konuşma',
          value: 'Süre: 20 dakika',
          inline: true
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`mute_${targetUser.id}`)
      .setPlaceholder('Mute sebebini seç...')
      .addOptions([
        {
          label: 'Küfür/Hakaret',
          description: '5 dakika susturma',
          value: 'kufur',
          emoji: '🤬'
        },
        {
          label: 'Ailevi Değerlere Küfür (ADK)',
          description: '30 dakika susturma',
          value: 'adk',
          emoji: '👨‍👩‍👧‍👦'
        },
        {
          label: 'Kişiyi Kışkırtma',
          description: '5 dakika susturma',
          value: 'kiskirtma',
          emoji: '😠'
        },
        {
          label: 'Tehditkar Konuşma',
          description: '20 dakika susturma',
          value: 'tehdit',
          emoji: '⚠️'
        }
      ]);

    const row = new ActionRowBuilder()
      .addComponents(selectMenu);

    return ctx.reply({ 
      embeds: [muteEmbed], 
      components: [row],
      flags: MessageFlags.Ephemeral 
    });
  }
};

// Mute select menu etkileşimi
module.exports.handleSelectMenu = async (interaction) => {
  if (!interaction.customId.startsWith('mute_')) return;
  
  // SÜPER GÜÇLÜ SELECT MENU KLONLANMA ENGELLEYİCİ
  const selectMenuUserId = interaction.user.id;
  
  if (!global.muteSelectExecutions) global.muteSelectExecutions = new Set();
  if (global.muteSelectExecutions.has(selectMenuUserId)) {
    console.log(`🚫 [ANTI-CLONE] Mute select menu klonlanma girişimi engellendi: ${selectMenuUserId}`);
    return;
  }
  
  global.muteSelectExecutions.add(selectMenuUserId);
  
  // 5 saniye sonra temizle
  setTimeout(() => {
    global.muteSelectExecutions.delete(selectMenuUserId);
  }, 5000);
  
  // Eğer zaten yanıtlandıysa tekrar işleme
  if (interaction.replied || interaction.deferred) {
    global.muteSelectExecutions.delete(selectMenuUserId);
    return;
  }

  // İnteraction timeout önlemi
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (error) {
    console.log('⚠️ DeferReply hatası (zaten yanıtlanmış olabilir):', error.message);
    global.muteSelectExecutions.delete(selectMenuUserId);
    return;
  }
  
  const targetUserId = interaction.customId.split('_')[1];
  const selectedReason = interaction.values[0];
  
  const muteSebepler = {
    'kufur': { sure: 5, sebep: '🤬 Küfür/Hakaret' },
    'adk': { sure: 30, sebep: '👨‍👩‍👧‍👦 Ailevi Değerlere Küfür (ADK)' },
    'kiskirtma': { sure: 5, sebep: '😠 Kişiyi Kışkırtma' },
    'tehdit': { sure: 20, sebep: '⚠️ Tehditkar Konuşma' }
  };
  
  const secenek = muteSebepler[selectedReason];
  if (!secenek) {
    return interaction.editReply({
      content: '❌ Geçersiz sebep seçimi.'
    });
  }
  
  try {
    const targetUser = await interaction.client.users.fetch(targetUserId);
    const member = await interaction.guild.members.fetch(targetUserId);
    
    if (!member.moderatable) {
      return interaction.editReply({
        content: '❌ Bu kullanıcı susturulamıyor.'
      });
    }
    
    // Mute rolünü bul veya oluştur
    let muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
    
    // Mute rolünü kontrol et ve gerekirse yeniden yapılandır
    if (muteRole) {
      console.log('🔍 Muted rolü mevcut, süper güçlü izinler kontrol ediliyor...');
      
      // Bot member ve roller
      const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
      const botHighestRole = botMember.roles.highest;
      
      // Rol pozisyonunu kontrol et - Mümkün olduğunca yukarıda olmalı (ama bot rolünden aşağıda)
      const idealPosition = Math.max(1, botHighestRole.position - 1);
      
      if (muteRole.position < idealPosition) {
        console.log(`⬆️ Muted rolü pozisyonu yükseltiliyor: ${muteRole.position} -> ${idealPosition}`);
        try {
          await muteRole.setPosition(idealPosition);
          console.log('✅ Muted rol pozisyonu yükseltildi');
        } catch (posError) {
          console.log('❌ Rol pozisyonu yükseltilemedi:', posError.message);
        }
      }
      
      // Rol izinlerini kontrol et - tamamen sıfır olmalı
      if (muteRole.permissions.bitfield !== 0n) {
        console.log('🔧 Muted rolü izinleri sıfırlanıyor...');
        try {
          await muteRole.setPermissions('0', 'Muted rolü - tüm izinler kapatıldı');
          console.log('✅ Muted rol izinleri sıfırlandı');
        } catch (permError) {
          console.log('❌ Rol izinleri sıfırlanamadı:', permError.message);
        }
      }
    }
    
    if (!muteRole) {
      // Mute rolü yoksa oluştur - En güçlü kısıtlamalarla
      muteRole = await interaction.guild.roles.create({
        name: 'Muted',
        color: '#808080',
        reason: 'Mute sistemi için otomatik oluşturuldu',
        permissions: '0', // Hiçbir izin yok
        hoist: false, // Üye listesinde ayrı gösterme
        mentionable: false // Etiketlenemez
      });
      
      console.log(`✅ Muted rolü oluşturuldu: ${muteRole.id}`);
      
      // Tüm kanallarda mute rolü için izinleri ZORLA ayarla
      const channels = interaction.guild.channels.cache;
      let successCount = 0;
      let errorCount = 0;
      
      console.log(`📁 ${channels.size} kanal için Muted rolü izinleri yeniden yapılandırılıyor...`);
      
      for (const [channelId, channel] of channels) {
        try {
          // Önce mevcut override'ı sil (varsa)
          if (channel.permissionOverwrites.cache.has(muteRole.id)) {
            await channel.permissionOverwrites.delete(muteRole);
            console.log(`🗑️ Eski izin silindi: ${channel.name}`);
          }
          
          if (channel.isTextBased()) {
            // SÜPER GÜÇLÜ MUTE - TÜM TEXT İZİNLERİ DENY
            await channel.permissionOverwrites.create(muteRole, {
              ViewChannel: null, // Kanalı görebilir ama yazamaz
              SendMessages: false, // ❌ MESAJ GÖNDEREMİYOR - DENY!
              AddReactions: false, // ❌ REACTION EKLEYEMİYOR - DENY!
              CreatePublicThreads: false, // ❌ PUBLIC THREAD OLUŞTURAMAZ - DENY!
              CreatePrivateThreads: false, // ❌ PRIVATE THREAD OLUŞTURAMAZ - DENY!
              SendMessagesInThreads: false, // ❌ THREAD'LERDE MESAJ GÖNDEREMİYOR - DENY!
              UseApplicationCommands: false, // ❌ SLASH KOMUT KULLANAMAZ - DENY!
              SendTTSMessages: false, // ❌ TTS MESAJ GÖNDEREMİYOR - DENY!
              UseExternalEmojis: false, // ❌ HARİCİ EMOJİ KULLANAMAZ - DENY!
              UseExternalStickers: false, // ❌ HARİCİ STİCKER KULLANAMAZ - DENY!
              AttachFiles: false, // ❌ DOSYA EKLEYEMİYOR - DENY!
              EmbedLinks: false, // ❌ LİNK EMBED YAPAMAZ - DENY!
              MentionEveryone: false, // ❌ EVERYONE MENTION YAPAMAZ - DENY!
              ManageMessages: false, // ❌ MESAJ YÖNETEMİYOR - DENY!
              ManageThreads: false, // ❌ THREAD YÖNETEMİYOR - DENY!
              ReadMessageHistory: true, // ✅ ESKİ MESAJLARI OKUYABİLİR
              SendVoiceMessages: false, // ❌ SES MESAJI GÖNDEREMİYOR - DENY!
              SendPolls: false, // ❌ ANKET GÖNDEREMİYOR - DENY!
              UseEmbeddedActivities: false // ❌ EMBEDDED AKTİVİTE KULLANAMAZ - DENY!
            }, 'SÜPER MUTE - Tüm yazma izinleri tamamen kapatıldı');
            console.log(`✅ Metin kanalı izinleri ZORLA ayarlandı: ${channel.name}`);
            successCount++;
          } else if (channel.isVoiceBased()) {
            await channel.permissionOverwrites.create(muteRole, {
              ViewChannel: null, // Kanalı görebilir
              Connect: true, // Bağlanabilir ama konuşamaz
              Speak: false, // Konuşamaz - EN ÖNEMLİSİ!
              Stream: false, // Yayın yapamaz
              UseVAD: false, // Voice Activity Detection kullanamaz
              UseApplicationCommands: false, // Slash komut kullanamaz
              UseSoundboard: false, // Soundboard kullanamaz
              UseExternalSounds: false, // Harici ses kullanamaz
              SendMessages: false, // Ses kanalındaki text için
              AddReactions: false, // Reaction ekleyemez
              RequestToSpeak: false, // Stage channel'da konuşma isteği yapamaz
              ManageChannels: false, // Kanal yönetemez
              MuteMembers: false, // Başkasını mute edemez
              DeafenMembers: false, // Başkasını deafen edemez
              MoveMembers: false // Üye taşıyamaz
            }, 'Muted rolü - Tüm konuşma izinleri kapatıldı');
            console.log(`✅ Ses kanalı izinleri ZORLA ayarlandı: ${channel.name}`);
            successCount++;
          }
        } catch (error) {
          console.log(`❌ Kanal izni ayarlanamadı: ${channel.name}`, error.message);
          errorCount++;
        }
      }
      
      console.log(`🎯 Toplam: ${successCount} başarılı, ${errorCount} hata`);
    }
    
    // Kullanıcıya mute rolünü ver
    await member.roles.add(muteRole, secenek.sebep);
    
    // Eğer kullanıcı voice kanalındaysa anında mute et
    if (member.voice.channel) {
      try {
        await member.voice.setMute(true, `Muted rolü verildi: ${secenek.sebep}`);
        console.log(`🔇 ${targetUser.username} voice kanalında da susturuldu`);
      } catch (voiceError) {
        console.error(`❌ Voice mute hatası: ${voiceError.message}`);
      }
    }
    
    console.log(`✅ ${targetUser.username} kullanıcısına Muted rolü verildi`);
    
    // 3 saniye bekle ve SÜPER GÜÇLÜ MUTE KONTROLÜ
    setTimeout(async () => {
      try {
        const checkMember = await interaction.guild.members.fetch(targetUserId);
        const hasMuteRole = checkMember.roles.cache.has(muteRole.id);
        
        if (!hasMuteRole) {
          console.log(`⚠️ UYARI: ${targetUser.username} kullanıcısında Muted rolü bulunamadı!`);
          return;
        }
        
        console.log(`🔍 [SÜPER MUTE KONTROLÜ] ${targetUser.username} için tüm kanalları test ediliyor...`);
        
        // TÜM TEXT KANALLARINI TEST ET
        const textChannels = interaction.guild.channels.cache.filter(ch => ch.isTextBased());
        let totalChannels = 0;
        let blockedChannels = 0;
        let problematicChannels = [];
        
        for (const [channelId, channel] of textChannels) {
          // Kullanıcının kanalı görebilip göremediğini kontrol et
          const canView = channel.permissionsFor(checkMember)?.has('ViewChannel');
          
          if (canView) { // Sadece görebildiği kanalları test et
            totalChannels++;
            const canSend = channel.permissionsFor(checkMember)?.has('SendMessages');
            
            if (canSend) {
              problematicChannels.push(channel.name);
              console.log(`🚨 PROBLEM: ${targetUser.username} ${channel.name} kanalında hala mesaj gönderebiliyor!`);
            } else {
              blockedChannels++;
              console.log(`✅ BAŞARILI: ${targetUser.username} ${channel.name} kanalında mesaj gönderemiyor`);
            }
          }
        }
        
        // SONUÇ RAPORU
        if (problematicChannels.length === 0) {
          console.log(`🎯 [SÜPER MUTE BAŞARILI] ${targetUser.username} kullanıcısı ${totalChannels}/${totalChannels} kanalda tamamen susturuldu!`);
        } else {
          console.log(`🚨 [SÜPER MUTE PROBLEM] ${targetUser.username} kullanıcısı ${problematicChannels.length}/${totalChannels} kanalda hala yazabiliyor:`);
          console.log(`   Problem kanallar: ${problematicChannels.join(', ')}`);
        }
        
      } catch (err) {
        console.error('Süper mute doğrulama hatası:', err.message);
      }
    }, 3000);
    
    // Belirtilen süre sonra rolü kaldırmak için timeout ayarla
    setTimeout(async () => {
      try {
        const stillMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (stillMember && stillMember.roles.cache.has(muteRole.id)) {
          await stillMember.roles.remove(muteRole, 'Mute süresi doldu');
          
          // Unmute log
          const logChannelId = getAutoLogChannel(interaction.guild.id);
          if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
              const unmuteEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🔊 Mute Süresi Doldu')
                .addFields(
                  {
                    name: '👤 Kullanıcı',
                    value: `${targetUser.tag} (\`${targetUser.id}\`)`,
                    inline: true
                  },
                  {
                    name: '⏰ Süre',
                    value: `${secenek.sure} dakika tamamlandı`,
                    inline: true
                  },
                  {
                    name: '📝 Orijinal Sebep',
                    value: secenek.sebep,
                    inline: false
                  }
                )
                .setTimestamp();
              
              logChannel.send({ embeds: [unmuteEmbed] });
            }
          }
        }
      } catch (error) {
        console.error('Otomatik unmute hatası:', error);
      }
    }, secenek.sure * 60 * 1000);
    
    // Başarı embed'i
    const successEmbed = new EmbedBuilder()
      .setColor('#FF8C00')
      .setTitle('🔇 Kullanıcı Susturuldu')
      .setDescription(`**${targetUser.tag}** ${secenek.sure} dakika susturuldu.`)
      .addFields(
        {
          name: '📝 Sebep',
          value: secenek.sebep,
          inline: false
        },
        {
          name: '⏱️ Süre',
          value: `${secenek.sure} dakika`,
          inline: true
        },
        {
          name: '🔓 Susturma Bitişi',
          value: `<t:${Math.floor((Date.now() + (secenek.sure * 60 * 1000)) / 1000)}:F>`,
          inline: true
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    
    try {
      // Select menu için her zaman editReply kullan (çünkü deferReply yaptık)
      await interaction.editReply({ 
        embeds: [successEmbed], 
        components: []
      });
      console.log('✅ Mute işlemi başarıyla tamamlandı ve yanıt gönderildi');
    } catch (interactionError) {
      console.error('❌ Interaction response hatası:', interactionError.message);
    }
    
    // Log
    const logChannelId = getAutoLogChannel(interaction.guild.id);
    if (logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const muteEmbed = new EmbedBuilder()
          .setColor('#808080')
          .setTitle('🔇 Kullanıcı Susturuldu')
          .addFields(
            {
              name: '👤 Susturulan Kullanıcı',
              value: `${targetUser.tag} (\`${targetUser.id}\`)`,
              inline: true
            },
            {
              name: '👮‍♂️ Moderatör',
              value: `${interaction.user.tag} (\`${interaction.user.id}\`)`,
              inline: true
            },
            {
              name: '⏱️ Süre',
              value: `${secenek.sure} dakika`,
              inline: true
            },
            {
              name: '📝 Sebep',
              value: `\`${secenek.sebep}\``,
              inline: false
            }
          )
          .setTimestamp();
        
        logChannel.send({ embeds: [muteEmbed] });
      }
    }
  } catch (error) {
    console.error('Mute hatası:', error);
    
    // Anti-clone temizliği (Select Menu)
    const cleanupUserId = interaction.user?.id || interaction.author?.id;
    if (cleanupUserId && global.muteSelectExecutions) {
      global.muteSelectExecutions.delete(cleanupUserId);
    }
    if (cleanupUserId && global.muteExecutions) {
      global.muteExecutions.delete(cleanupUserId);
    }
    
    try {
      const errorMessage = {
        content: '❌ Kullanıcı susturulurken bir hata oluştu.'
      };
      
      // Select menu için her zaman editReply kullan (çünkü başta deferReply yaptık)
      await interaction.editReply(errorMessage);
    } catch (finalError) {
      console.error('Final error handling hatası:', finalError.message);
    }
  }
};
