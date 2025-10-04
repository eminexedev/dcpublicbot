const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getSecurityConfig, setSecurityConfig } = require('../securityConfig');
const { setJailRole, getJailRole } = require('../config');

// Güvenlik kurulum interaction handler'ı
async function handleSecuritySetupInteractions(interaction) {
  const customId = interaction.customId;

  try {
    // Jail rolü kurulum
    if (customId === 'security_setup_jail') {
      await handleJailRoleSetup(interaction);
    }
    
    // Log kanalı kurulum
    else if (customId === 'security_setup_log') {
      await handleLogChannelSetup(interaction);
    }
    
    // Whitelist kurulum
    else if (customId === 'security_setup_whitelist') {
      await handleWhitelistSetup(interaction);
    }
    
    // Hızlı kurulum
    else if (customId === 'security_quick_setup') {
      await handleQuickSetup(interaction);
    }
    
    // Sistem testi
    else if (customId === 'security_test_system') {
      await handleSystemTest(interaction);
    }
    
    // Detaylı rehber
    else if (customId === 'security_full_guide') {
      await handleFullGuide(interaction);
    }
    
    // Log kanal seçimi
    else if (customId === 'security_log_channel_select') {
      await handleLogChannelSelect(interaction);
    }
    
    // Whitelist rol seçimi
    else if (customId === 'security_whitelist_role_select') {
      await handleWhitelistRoleSelect(interaction);
    }
    
    // Hızlı kurulum onayı
    else if (customId === 'confirm_quick_setup') {
      await handleQuickSetupConfirm(interaction);
    }
    
    // Jail rol oluşturma
    else if (customId === 'create_jail_role') {
      await handleCreateJailRole(interaction);
    }

  } catch (error) {
    console.error('Güvenlik kurulum interaction hatası:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ İşlem sırasında hata oluştu.',
        ephemeral: true
      });
    }
  }
}

// Jail rolü kurulum
async function handleJailRoleSetup(interaction) {
  const guild = interaction.guild;
  const jailRoles = guild.roles.cache.filter(role => 
    role.name.toLowerCase().includes('jail') || 
    role.name.toLowerCase().includes('ceza') ||
    role.name.toLowerCase().includes('mute')
  );

  const setupEmbed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('🔒 Jail Rolü Kurulumu')
    .setDescription('Güvenlik sistemi için jail rolü ayarlayın.')
    .addFields(
      {
        name: '📋 Jail Rolü Nedir?',
        value: 'Cezalandırılan yetkililerin alacağı özel rol. Bu rol:\n• Tüm kanalları göremez\n• Sadece jail kanalında yazabilir\n• Hiçbir yetkisi yoktur',
        inline: false
      }
    );

  const buttons = new ActionRowBuilder();
  
  if (jailRoles.size > 0) {
    setupEmbed.addFields({
      name: '🔍 Bulunan Jail Rolleri',
      value: jailRoles.map(role => `• ${role.name}`).slice(0, 5).join('\n') + 
             (jailRoles.size > 5 ? `\n... ve ${jailRoles.size - 5} tane daha` : ''),
      inline: false
    });

    // Mevcut roller için seçim menüsü
    const roleSelect = new StringSelectMenuBuilder()
      .setCustomId('security_jail_role_select')
      .setPlaceholder('Jail rolü olarak kullanılacak rolü seçin')
      .addOptions(
        jailRoles.map(role => ({
          label: role.name,
          description: `Üye sayısı: ${role.members.size}`,
          value: role.id,
          emoji: '🔒'
        })).slice(0, 25)
      );

    const selectRow = new ActionRowBuilder().addComponents(roleSelect);
    
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId('create_jail_role')
        .setLabel('➕ Yeni Jail Rolü Oluştur')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [selectRow, buttons],
      ephemeral: true
    });
  } else {
    setupEmbed.addFields({
      name: '❌ Jail Rolü Bulunamadı',
      value: 'Sunucunuzda jail rolü bulunamadı. Yeni bir jail rolü oluşturmanız önerilir.',
      inline: false
    });

    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId('create_jail_role')
        .setLabel('➕ Jail Rolü Oluştur')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [buttons],
      ephemeral: true
    });
  }
}

// Log kanalı kurulum
async function handleLogChannelSetup(interaction) {
  const guild = interaction.guild;
  const logChannels = guild.channels.cache.filter(channel => 
    channel.type === ChannelType.GuildText && (
      channel.name.includes('log') || 
      channel.name.includes('kayıt') ||
      channel.name.includes('güvenlik') ||
      channel.name.includes('security')
    )
  );

  const setupEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📊 Log Kanalı Kurulumu')
    .setDescription('Güvenlik sistemi loglarının gönderileceği kanalı ayarlayın.')
    .addFields(
      {
        name: '📝 Log Kanalı Özellikleri',
        value: '• Sadece yöneticilerin görebileceği özel kanal olmalı\n• Güvenlik uyarıları ve cezalandırma logları buraya gönderilir\n• İhlal takibi ve istatistikler görüntülenir',
        inline: false
      }
    );

  if (logChannels.size > 0) {
    setupEmbed.addFields({
      name: '🔍 Uygun Kanallar',
      value: logChannels.map(channel => `• ${channel.name}`).slice(0, 5).join('\n') + 
             (logChannels.size > 5 ? `\n... ve ${logChannels.size - 5} tane daha` : ''),
      inline: false
    });

    // Kanal seçim menüsü
    const channelSelect = new StringSelectMenuBuilder()
      .setCustomId('security_log_channel_select')
      .setPlaceholder('Log kanalı olarak kullanılacak kanalı seçin')
      .addOptions(
        logChannels.map(channel => ({
          label: `#${channel.name}`,
          description: channel.topic || 'Açıklama yok',
          value: channel.id,
          emoji: '📊'
        })).slice(0, 25)
      );

    const selectRow = new ActionRowBuilder().addComponents(channelSelect);
    
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_security_log_channel')
          .setLabel('➕ Yeni Log Kanalı Oluştur')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [selectRow, buttons],
      ephemeral: true
    });
  } else {
    setupEmbed.addFields({
      name: '❌ Uygun Kanal Bulunamadı',
      value: 'Sunucunuzda uygun log kanalı bulunamadı. Yeni bir güvenlik log kanalı oluşturmanız önerilir.',
      inline: false
    });

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_security_log_channel')
          .setLabel('➕ Güvenlik Log Kanalı Oluştur')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [buttons],
      ephemeral: true
    });
  }
}

// Hızlı kurulum
async function handleQuickSetup(interaction) {
  const guild = interaction.guild;
  const config = getSecurityConfig(guild.id);
  const jailRoleId = getJailRole(guild.id);

  const quickSetupEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('⚡ Hızlı Güvenlik Sistemi Kurulumu')
    .setDescription('Tek tıkla otomatik güvenlik sistemi kurulumu yapar.')
    .addFields(
      {
        name: '🚀 Otomatik Yapılacaklar',
        value: '• `🛡️ Jail` rolü oluşturulacak (yoksa)\n• `🔒 güvenlik-log` kanalı oluşturulacak\n• Admin rolleri muaf listeye eklenecek\n• Sistem aktifleştirilecek',
        inline: false
      },
      {
        name: '⚙️ Varsayılan Ayarlar',
        value: `• **İhlal Eşiği:** 3 ban/kick (24 saatte)\n• **Ceza Türü:** Jail + Rol Alma\n• **Muaf Roller:** Admin rolleri otomatik`,
        inline: false
      },
      {
        name: '⚠️ Dikkat',
        value: 'Bu işlem mevcut ayarları değiştirebilir. Özelleştirilmiş ayarlarınız varsa manuel kurulum yapmanız önerilir.',
        inline: false
      }
    )
    .setFooter({ text: 'Onaylamak için aşağıdaki butona tıklayın' })
    .setTimestamp();

  const confirmButtons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_quick_setup')
        .setLabel('✅ Evet, Hızlı Kurulumu Başlat')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel_quick_setup')
        .setLabel('❌ İptal')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.reply({
    embeds: [quickSetupEmbed],
    components: [confirmButtons],
    ephemeral: true
  });
}

// Detaylı rehber
async function handleFullGuide(interaction) {
  const guideEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📖 Güvenlik Sistemi Detaylı Kurulum Rehberi')
    .setDescription('Güvenlik sistemini adım adım kurmak için bu rehberi takip edin.')
    .addFields(
      {
        name: '1️⃣ Jail Rolü Kurulumu',
        value: '**Gerekli:** Cezalandırılan yetkililerin alacağı rol\n' +
               '• Yeni rol oluşturun: `🛡️ Jail` veya `🔒 Cezalı`\n' +
               '• Tüm kanallardan izinleri kaldırın\n' +
               '• Sadece jail kanalında yazma izni verin\n' +
               '• `/jail-rol <@rol>` komutuyla ayarlayın',
        inline: false
      },
      {
        name: '2️⃣ Log Kanalı Kurulumu',
        value: '**Önerilen:** Güvenlik loglarının gönderileceği kanal\n' +
               '• Yeni kanal oluşturun: `#güvenlik-log`\n' +
               '• Sadece yöneticiler görebilsin\n' +
               '• `/güvenlik-sistemi ayar log-kanal <#kanal>` ile ayarlayın',
        inline: false
      },
      {
        name: '3️⃣ Muaf Roller Ayarlama',
        value: '**Önerilen:** Bu roller güvenlik sistemine takılmaz\n' +
               '• `/güvenlik-sistemi muaf-rol <@rol> ekle`\n' +
               '• Önerilen muaf roller: Owner, Admin, Senior Mod\n' +
               '• Bot rollerini de muaf yapabilirsiniz',
        inline: false
      },
      {
        name: '4️⃣ Sistem Aktivasyonu',
        value: '**Son Adım:** Sistemi aktifleştirin\n' +
               '• `/güvenlik-sistemi aç` komutuyla aktifleştirin\n' +
               '• `/güvenlik-sistemi durum` ile kontrolünü yapın\n' +
               '• Test için `/güvenlik-kurulum` → Test Et butonunu kullanın',
        inline: false
      },
      {
        name: '⚙️ İsteğe Bağlı Ayarlar',
        value: '• **İhlal Eşiği:** `/güvenlik-sistemi ayar eşik <sayı>`\n' +
               '• **Ceza Türü:** `/güvenlik-sistemi ayar ceza-türü <jail/roleRemove/both>`\n' +
               '• **Muaf Kişiler:** `/güvenlik-sistemi muaf-kişi <@kullanıcı> ekle`',
        inline: false
      }
    )
    .setFooter({ text: 'Sorularınız için sunucu yöneticilerine başvurun' })
    .setTimestamp();

  const guideButtons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('security_setup_jail')
        .setLabel('🔒 Jail Rolü')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('security_setup_log')
        .setLabel('📊 Log Kanalı')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('security_quick_setup')
        .setLabel('⚡ Hızlı Kurulum')
        .setStyle(ButtonStyle.Success)
    );

  await interaction.reply({
    embeds: [guideEmbed],
    components: [guideButtons],
    ephemeral: true
  });
}

// Jail rolü oluşturma
async function handleCreateJailRole(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const guild = interaction.guild;
    
    // Jail rolü oluştur
    const jailRole = await guild.roles.create({
      name: '🛡️ Jail',
      color: '#2F3136',
      reason: 'Güvenlik sistemi için jail rolü (otomatik oluşturuldu)',
      permissions: []
    });

    // Jail rolünü config'e kaydet
    setJailRole(guild.id, jailRole.id);

    // Tüm kanallarda jail rolü için izinleri kaldır
    let channelCount = 0;
    for (const channel of guild.channels.cache.values()) {
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
        try {
          await channel.permissionOverwrites.create(jailRole, {
            ViewChannel: false,
            SendMessages: false,
            Speak: false,
            Connect: false
          });
          channelCount++;
        } catch (error) {
          console.error(`Kanal ${channel.name} için jail izni ayarlanamadı:`, error);
        }
      }
    }

    // Jail kanalı oluştur (yoksa)
    let jailChannel = guild.channels.cache.find(ch => ch.name === 'jail' || ch.name === 'cezalı');
    if (!jailChannel) {
      jailChannel = await guild.channels.create({
        name: 'jail',
        type: ChannelType.GuildText,
        topic: 'Cezalı üyeler için özel kanal',
        reason: 'Güvenlik sistemi için jail kanalı (otomatik oluşturuldu)',
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: ['ViewChannel']
          },
          {
            id: jailRole.id,
            allow: ['ViewChannel', 'SendMessages'],
            deny: ['AddReactions', 'AttachFiles', 'EmbedLinks']
          }
        ]
      });
    } else {
      // Mevcut jail kanalında jail rolü için izin ver
      await jailChannel.permissionOverwrites.create(jailRole, {
        ViewChannel: true,
        SendMessages: true,
        AddReactions: false,
        AttachFiles: false,
        EmbedLinks: false
      });
    }

    const successEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ Jail Rolü Başarıyla Oluşturuldu!')
      .setDescription('Güvenlik sistemi için jail rolü kurulumu tamamlandı.')
      .addFields(
        {
          name: '🔒 Oluşturulan Rol',
          value: `${jailRole} (ID: ${jailRole.id})`,
          inline: true
        },
        {
          name: '📊 İzin Ayarları',
          value: `**Güncellenen Kanallar:** ${channelCount}\n**Jail Kanalı:** ${jailChannel}`,
          inline: true
        },
        {
          name: '✅ Sonraki Adımlar',
          value: '• Log kanalı ayarla\n• Muaf rolleri belirle\n• Sistemi aktifleştir',
          inline: false
        }
      )
      .setFooter({ text: 'Jail rolü artık güvenlik sisteminde kullanılabilir' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Jail rolü oluşturma hatası:', error);
    await interaction.editReply({
      content: '❌ Jail rolü oluşturulurken hata oluştu. Lütfen manuel olarak oluşturun.',
    });
  }
}

// Jail rol seçimi
async function handleJailRoleSelect(interaction) {
  const roleId = interaction.values[0];
  const role = interaction.guild.roles.cache.get(roleId);
  
  if (!role) {
    return interaction.reply({
      content: '❌ Seçilen rol bulunamadı.',
      ephemeral: true
    });
  }

  // Jail rolünü ayarla
  setJailRole(interaction.guild.id, roleId);

  const successEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Jail Rolü Ayarlandı!')
    .setDescription(`${role} artık güvenlik sistemi jail rolü olarak ayarlandı.`)
    .addFields(
      {
        name: '🔒 Jail Rolü',
        value: `${role.name} (${role.members.size} üye)`,
        inline: true
      },
      {
        name: '✅ Sonraki Adım',
        value: 'Log kanalını ayarlayın ve sistemi aktifleştirin.',
        inline: true
      }
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [successEmbed],
    ephemeral: true
  });
}

// Log kanal seçimi
async function handleLogChannelSelect(interaction) {
  const channelId = interaction.values[0];
  const channel = interaction.guild.channels.cache.get(channelId);
  
  if (!channel) {
    return interaction.reply({
      content: '❌ Seçilen kanal bulunamadı.',
      ephemeral: true
    });
  }

  // Log kanalını ayarla
  const config = getSecurityConfig(interaction.guild.id);
  config.logChannelId = channelId;
  setSecurityConfig(interaction.guild.id, config);

  const successEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Log Kanalı Ayarlandı!')
    .setDescription(`${channel} artık güvenlik sistemi log kanalı olarak ayarlandı.`)
    .addFields(
      {
        name: '📊 Log Kanalı',
        value: `#${channel.name}`,
        inline: true
      },
      {
        name: '✅ Sonraki Adım',
        value: 'Muaf rolleri ayarlayın ve sistemi aktifleştirin.',
        inline: true
      }
    )
    .setTimestamp();

  await interaction.reply({
    embeds: [successEmbed],
    ephemeral: true
  });
}

// Hızlı kurulum onayı
async function handleQuickSetupConfirm(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const guild = interaction.guild;
    const config = getSecurityConfig(guild.id);
    
    // Config dizilerinin tanımlı olduğundan emin ol
    if (!config.whitelistRoles) config.whitelistRoles = [];
    if (!config.whitelistUsers) config.whitelistUsers = [];
    
    let setupResults = [];

    // 1. Jail rolü kontrolü/oluşturma
    let jailRole = null;
    const existingJailRoleId = getJailRole(guild.id);
    
    if (existingJailRoleId) {
      jailRole = guild.roles.cache.get(existingJailRoleId);
    }
    
    if (!jailRole) {
      // Mevcut jail rollerini kontrol et
      const existingJailRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase().includes('jail') || 
        role.name.toLowerCase().includes('ceza')
      );
      
      if (existingJailRoles.size > 0) {
        jailRole = existingJailRoles.first();
        setJailRole(guild.id, jailRole.id);
        setupResults.push(`✅ Mevcut jail rolü kullanıldı: ${jailRole.name}`);
      } else {
        // Yeni jail rolü oluştur
        jailRole = await guild.roles.create({
          name: '🛡️ Jail',
          color: '#2F3136',
          reason: 'Hızlı güvenlik kurulumu',
          permissions: []
        });
        setJailRole(guild.id, jailRole.id);
        setupResults.push(`✅ Yeni jail rolü oluşturuldu: ${jailRole.name}`);
      }
    } else {
      setupResults.push(`✅ Jail rolü zaten mevcut: ${jailRole.name}`);
    }

    // 2. Log kanalı kontrolü/oluşturma
    let logChannel = null;
    if (config.logChannelId) {
      logChannel = guild.channels.cache.get(config.logChannelId);
    }
    
    if (!logChannel) {
      // Mevcut log kanallarını kontrol et
      const existingLogChannels = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildText && (
          channel.name.includes('güvenlik') ||
          channel.name.includes('security') ||
          channel.name.includes('log')
        )
      );
      
      if (existingLogChannels.size > 0) {
        logChannel = existingLogChannels.first();
        config.logChannelId = logChannel.id;
        setupResults.push(`✅ Mevcut log kanalı kullanıldı: #${logChannel.name}`);
      } else {
        // Yeni log kanalı oluştur
        logChannel = await guild.channels.create({
          name: '🔒-güvenlik-log',
          type: ChannelType.GuildText,
          topic: 'Güvenlik sistemi logları ve uyarıları',
          reason: 'Hızlı güvenlik kurulumu',
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: ['ViewChannel']
            }
          ]
        });
        config.logChannelId = logChannel.id;
        setupResults.push(`✅ Yeni log kanalı oluşturuldu: #${logChannel.name}`);
      }
    } else {
      setupResults.push(`✅ Log kanalı zaten mevcut: #${logChannel.name}`);
    }

    // 3. Admin rollerini muaf listeye ekle
    const adminRoles = guild.roles.cache.filter(role => {
      try {
        return role.permissions && 
               role.permissions.has('Administrator') && 
               !role.managed && 
               role.name !== '@everyone';
      } catch (error) {
        console.error(`Admin rol kontrolü hatası (${role.name}):`, error);
        return false;
      }
    });
    
    let whitelistCount = 0;
    adminRoles.forEach(role => {
      if (!config.whitelistRoles.includes(role.id)) {
        config.whitelistRoles.push(role.id);
        whitelistCount++;
      }
    });
    
    setupResults.push(`✅ ${whitelistCount} admin rolü muaf listeye eklendi`);

    // 4. Varsayılan ayarları uygula
    config.enabled = true;
    config.violationThreshold = 3;
    config.punishmentType = 'both';
    config.timeWindow = 24 * 60 * 60 * 1000; // 24 saat
    
    // 5. Konfigürasyonu kaydet
    setSecurityConfig(guild.id, config);
    
    setupResults.push(`✅ Sistem aktifleştirildi (Eşik: ${config.violationThreshold})`);

    const successEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🎉 Hızlı Kurulum Tamamlandı!')
      .setDescription('Güvenlik sistemi başarıyla kuruldu ve aktifleştirildi.')
      .addFields(
        {
          name: '📋 Yapılan İşlemler',
          value: setupResults.join('\n'),
          inline: false
        },
        {
          name: '⚙️ Sistem Ayarları',
          value: `• **İhlal Eşiği:** ${config.violationThreshold} ban/kick (24 saatte)\n• **Ceza Türü:** Jail + Rol Alma\n• **Muaf Roller:** ${config.whitelistRoles.length} adet`,
          inline: false
        },
        {
          name: '🚀 Sonraki Adımlar',
          value: '• `/güvenlik-sistemi durum` ile sistemi kontrol edin\n• Gerekirse ek muaf roller ekleyin\n• Test için `/güvenlik-kurulum` → Test Et butonunu kullanın',
          inline: false
        }
      )
      .setFooter({ text: 'Güvenlik sistemi artık çalışıyor!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Hızlı kurulum hatası:', error);
    await interaction.editReply({
      content: '❌ Hızlı kurulum sırasında hata oluştu. Lütfen manuel kurulum yapın.',
    });
  }
}

// Sistem testi
async function handleSystemTest(interaction) {
  const guild = interaction.guild;
  const config = getSecurityConfig(guild.id);
  const jailRoleId = getJailRole(guild.id);
  
  let testResults = [];
  let overallScore = 0;
  const maxScore = 6;

  // Test 1: Sistem aktif mi?
  if (config.enabled) {
    testResults.push('✅ Sistem aktif');
    overallScore++;
  } else {
    testResults.push('❌ Sistem pasif - `/güvenlik-sistemi aç` ile aktifleştirin');
  }

  // Test 2: Jail rolü var mı?
  const jailRole = jailRoleId ? guild.roles.cache.get(jailRoleId) : null;
  if (jailRole) {
    testResults.push(`✅ Jail rolü: ${jailRole.name}`);
    overallScore++;
  } else {
    testResults.push('❌ Jail rolü yok - `/jail-rol` ile ayarlayın');
  }

  // Test 3: Log kanalı var mı?
  const logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
  if (logChannel) {
    testResults.push(`✅ Log kanalı: #${logChannel.name}`);
    overallScore++;
  } else {
    testResults.push('❌ Log kanalı yok - `/güvenlik-sistemi ayar log-kanal` ile ayarlayın');
  }

  // Test 4: İhlal eşiği uygun mu?
  if (config.violationThreshold && config.violationThreshold > 0) {
    testResults.push(`✅ İhlal eşiği: ${config.violationThreshold}`);
    overallScore++;
  } else {
    testResults.push('❌ İhlal eşiği ayarlanmamış');
  }

  // Test 5: Muaf rol var mı?
  if (config.whitelistRoles && config.whitelistRoles.length > 0) {
    testResults.push(`✅ Muaf roller: ${config.whitelistRoles.length} adet`);
    overallScore++;
  } else {
    testResults.push('⚠️ Muaf rol yok - Önerilen: Admin rolleri muaf yapın');
  }

  // Test 6: Bot izinleri yeterli mi?
  const botMember = guild.members.cache.get(interaction.client.user.id);
  try {
    if (botMember && botMember.permissions && botMember.permissions.has(['ManageRoles', 'ViewAuditLog'])) {
      testResults.push('✅ Bot izinleri yeterli');
      overallScore++;
    } else {
      testResults.push('❌ Bot izinleri yetersiz - Rol Yönetimi ve Denetim Günlüğü izinleri gerekli');
    }
  } catch (error) {
    console.error('Bot izin kontrolü hatası:', error);
    testResults.push('❌ Bot izinleri kontrol edilemedi');
  }

  // Skor değerlendirmesi
  let scoreColor = '#E74C3C';
  let scoreText = 'Kritik Sorunlar';
  if (overallScore >= 5) {
    scoreColor = '#57F287';
    scoreText = 'Mükemmel';
  } else if (overallScore >= 4) {
    scoreColor = '#F1C40F';
    scoreText = 'İyi';
  } else if (overallScore >= 2) {
    scoreColor = '#E67E22';
    scoreText = 'Orta';
  }

  const testEmbed = new EmbedBuilder()
    .setColor(scoreColor)
    .setTitle('🧪 Güvenlik Sistemi Test Sonuçları')
    .setDescription(`**Genel Skor:** ${overallScore}/${maxScore} - ${scoreText}`)
    .addFields(
      {
        name: '📊 Test Sonuçları',
        value: testResults.join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Sorunları çözmek için kurulum rehberini takip edin' })
    .setTimestamp();

  if (overallScore === maxScore) {
    testEmbed.addFields({
      name: '🎉 Tebrikler!',
      value: 'Güvenlik sisteminiz tam olarak çalışır durumda. Artık yetkili suistimallerine karşı korunuyorsunuz.',
      inline: false
    });
  }

  await interaction.reply({
    embeds: [testEmbed],
    ephemeral: true
  });
}

module.exports = {
  handleSecuritySetupInteractions,
  handleJailRoleSelect,
  handleLogChannelSelect,
  handleQuickSetupConfirm,
  handleSystemTest
};