const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');
const { getRegistrationConfig, isRegistrationConfigured } = require('../registrationConfig');
const { addRegistration } = require('../registrationStats');

// Aktif kayıt işlemlerini takip etmek için Map
const activeRegistrations = new Map();

// Eski kayıt işlemlerini temizleme fonksiyonu
function cleanupExpiredRegistrations() {
  const now = Date.now();
  const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 dakika
  
  for (const [key, registration] of activeRegistrations.entries()) {
    if (now - registration.startTime > TIMEOUT_DURATION) {
      activeRegistrations.delete(key);
      console.log(`🧹 Süresi dolmuş kayıt işlemi temizlendi: ${key}`);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kayıt')
    .setDescription('Sunucuya yeni üye kayıt eder.')
    .addUserOption(option =>
      option.setName('kullanici').setDescription('Kayıt edilecek kullanıcı').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  category: 'moderation',
  description: 'Sunucuya yeni üye kayıt eder. İnteraktif menü ile cinsiyet ve yaş belirtimi.',
  usage: '.kayıt @kullanici',
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(ctx, args) {
    // Süresi dolmuş kayıt işlemlerini temizle
    cleanupExpiredRegistrations();
    
    // İlk olarak kayıt sistemi yapılandırma kontrolü
    if (!isRegistrationConfigured(ctx.guild.id)) {
      const configEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⚠️ Kayıt Sistemi Yapılandırılmamış')
        .setDescription('Kayıt sistemi kullanılmadan önce yapılandırılmalıdır.')
        .addFields(
          {
            name: '📋 Gerekli Ayarlar',
            value: '• Log kanalı\n• Erkek rolü\n• Kadın rolü\n• Üye rolü',
            inline: false
          },
          {
            name: '🛠️ Yapılandırma',
            value: '`/kayıt-ayar durum` - Mevcut durum\n`/kayıt-ayar log-kanal` - Log kanalı ayarla\n`/kayıt-ayar erkek-rol` - Erkek rolü ayarla\n`/kayıt-ayar kadın-rol` - Kadın rolü ayarla\n`/kayıt-ayar üye-rol` - Üye rolü ayarla\n`/kayıt-ayar kayıtsız-rol` - Kayıtsız rolü ayarla',
            inline: false
          }
        )
        .setFooter({ text: 'Sadece "Sunucuyu Yönet" yetkisine sahip kişiler yapılandırabilir' })
        .setTimestamp();

      return ctx.reply({
        embeds: [configEmbed],
        flags: MessageFlags.Ephemeral
      });
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
          content: '❌ Bir kullanıcı etiketlemelisin. Örnek: `!kayıt @kullanıcı`',
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

    // Aktif kayıt kontrolü
    const activeRegKey = `${ctx.guild.id}_${targetUser.id}`;
    if (activeRegistrations.has(activeRegKey)) {
      const activeReg = activeRegistrations.get(activeRegKey);
      const currentRegisterer = await ctx.guild.members.fetch(activeReg.registrar).catch(() => null);
      const timeElapsed = Date.now() - activeReg.startTime;
      const remainingTime = Math.max(0, (10 * 60 * 1000) - timeElapsed);
      const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
      
      return ctx.reply({
        content: `❌ **${targetUser.username}** için zaten ${currentRegisterer ? `**${currentRegisterer.displayName}**` : 'başka bir yetkili'} tarafından kayıt işlemi devam ediyor.\n⏱️ ${remainingMinutes} dakika sonra otomatik sıfırlanacak.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorId = ctx.user?.id || ctx.author?.id;
    
    // Aynı yetkili tarafından aynı anda birden fazla kayıt kontrolü
    const ongoingByRegistrar = Array.from(activeRegistrations.values()).find(reg => reg.registrar === executorId);
    if (ongoingByRegistrar) {
      const ongoingUser = await ctx.guild.members.fetch(ongoingByRegistrar.targetUserId).catch(() => null);
      const timeElapsed = Date.now() - ongoingByRegistrar.startTime;
      const remainingTime = Math.max(0, (10 * 60 * 1000) - timeElapsed); // 10 dakika
      const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
      
      return ctx.reply({
        content: `❌ Sen zaten **${ongoingUser ? ongoingUser.displayName : 'başka bir kullanıcı'}** için kayıt işlemi yapıyorsun. Önce onu tamamla!\n⏱️ Veya ${remainingMinutes} dakika bekle, otomatik sıfırlanacak.`,
        flags: MessageFlags.Ephemeral
      });
    }
    const executor = await ctx.guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return ctx.reply({
        content: '❌ **YETKİSİZ ERİŞİM!** Bu komutu kullanmak için "Rolleri Yönet" yetkisine sahip olmalısın.',
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

    // ROL HİYERAŞİSİ KONTROLÜ - GÜVENLİK
    const executorHighestRole = executor.roles.highest;
    const targetHighestRole = member.roles.highest;
    
    if (targetHighestRole.position >= executorHighestRole.position) {
      return ctx.reply({
        content: `❌ **ROL HİYERARŞİSİ İHLALİ!** ${targetUser.tag} kullanıcısının rolü (\`${targetHighestRole.name}\`) seninkinden (\`${executorHighestRole.name}\`) yüksek veya eşit. Kendinden üst roldeki birini kayıt edemezsin!`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Kayıt menüsü embed'i
    const kayitEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('👤 Üye Kayıt Sistemi')
      .setDescription(`**${targetUser.tag}** kullanıcısını kayıt etmek için cinsiyet seçiniz.`)
      .addFields(
        {
          name: '👨 Erkek',
          value: 'Erkek olarak kayıt et',
          inline: true
        },
        {
          name: '👩 Kadın',
          value: 'Kadın olarak kayıt et',
          inline: true
        },
        {
          name: '📋 Bilgilendirme',
          value: 'Cinsiyet seçimi sonrasında yaş bilgisi istenecektir.',
          inline: false
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setFooter({ 
        text: `Kayıt eden: ${(ctx.author || ctx.user).tag}`,
        iconURL: (ctx.author || ctx.user).displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`kayit_${targetUser.id}`)
      .setPlaceholder('Cinsiyet seçiniz...')
      .addOptions([
        {
          label: 'Erkek',
          description: 'Kullanıcıyı erkek olarak kayıt et',
          value: 'erkek',
          emoji: '👨'
        },
        {
          label: 'Kadın',
          description: 'Kullanıcıyı kadın olarak kayıt et',
          value: 'kadin',
          emoji: '👩'
        }
      ]);

    const row = new ActionRowBuilder()
      .addComponents(selectMenu);

    const response = await ctx.reply({ 
      embeds: [kayitEmbed], 
      components: [row],
      flags: MessageFlags.Ephemeral 
    });

    // Aktif kayıt işlemini ekle
    const registrationKey = `${ctx.guild.id}_${targetUser.id}`;
    activeRegistrations.set(registrationKey, {
      userId: targetUser.id,
      targetUserId: targetUser.id,
      guildId: ctx.guild.id,
      registrar: executorId,
      startTime: Date.now(),
      messageId: response.id
    });

    // 5 dakika timeout ile collector başlat
    const filter = (interaction) => {
      return interaction.customId.startsWith('kayit_') && 
             interaction.customId.includes(targetUser.id);
    };

    const collector = response.createMessageComponentCollector({ 
      filter, 
      time: 300000 // 5 dakika
    });

    collector.on('end', async (collected, reason) => {
      // Aktif kayıt işlemini sil
      const registrationKey = `${ctx.guild.id}_${targetUser.id}`;
      activeRegistrations.delete(registrationKey);
      
      if (reason === 'time' && collected.size === 0) {
        // Timeout oldu ve hiç interaction olmadı
        try {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('⏰ Kayıt Süresi Doldu')
            .setDescription(`**${targetUser.username}** için kayıt işlemi zaman aşımına uğradı.`)
            .addFields({
              name: '🔄 Yeniden Deneme',
              value: 'Kayıt işlemini yeniden başlatmak için `/kayıt` komutunu kullanın.',
              inline: false
            })
            .setTimestamp();

          const disabledSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`kayit_timeout_${targetUser.id}`)
            .setPlaceholder('⏰ Süre doldu - Kayıt iptal edildi')
            .setDisabled(true)
            .addOptions([
              {
                label: 'Süre Doldu',
                description: 'Bu kayıt işlemi zaman aşımına uğramıştır',
                value: 'timeout',
                emoji: '⏰'
              }
            ]);

          const disabledRow = new ActionRowBuilder()
            .addComponents(disabledSelectMenu);

          await response.edit({
            embeds: [timeoutEmbed],
            components: [disabledRow]
          });
        } catch (error) {
          console.log('Timeout mesajı güncellenemedi:', error.message);
        }
      }
    });

    return;
  },

  // Kayıt cinsiyet seçim menüsü - Tek modal (düzeltilmiş)
  async handleSelectMenu(interaction) {
    if (!interaction.customId.startsWith('kayit_')) return;
    
    try {
      const userId = interaction.customId.split('_')[1];
      
      // Target user'ı kontrol et
      const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!targetUser) {
        return await interaction.reply({
          content: '❌ Hedef kullanıcı bulunamadı.',
          ephemeral: true
        });
      }

      // YETKİLİ KONTROLÜ - GÜVENLIK: Sadece kayıt işlemini başlatan yetkili devam edebilir
      const registrationKey = `${interaction.guild.id}_${userId}`;
      const activeRegistration = activeRegistrations.get(registrationKey);
      
      if (!activeRegistration) {
        return await interaction.reply({
          content: '❌ Bu kayıt işlemi artık geçerli değil veya süresi dolmuş.',
          ephemeral: true
        });
      }
      
      if (activeRegistration.registrar !== interaction.user.id) {
        const originalRegistrar = await interaction.guild.members.fetch(activeRegistration.registrar).catch(() => null);
        return await interaction.reply({
          content: `❌ **GÜVENLİK İHLALİ!** Bu kayıt işlemini sadece ${originalRegistrar ? `**${originalRegistrar.displayName}**` : 'başlatan yetkili'} tamamlayabilir. Sen müdahale edemezsin!`,
          ephemeral: true
        });
      }

      // Kayıt config'ini kontrol et
      const registrationConfig = getRegistrationConfig(interaction.guild.id);
      if (!registrationConfig.isConfigured) {
        return await interaction.reply({
          content: '❌ Kayıt sistemi yapılandırılmamış.',
          ephemeral: true
        });
      }

      // Kullanıcının zaten kayıt olup olmadığını kontrol et
      const maleRoleId = registrationConfig.maleRoleId;
      const femaleRoleId = registrationConfig.femaleRoleId;
      const memberRoleId = registrationConfig.memberRoleId;
      
      const hasGenderRole = targetUser.roles.cache.has(maleRoleId) || targetUser.roles.cache.has(femaleRoleId);
      const hasMemberRole = memberRoleId ? targetUser.roles.cache.has(memberRoleId) : false;
      
      if (hasGenderRole || hasMemberRole) {
        const alreadyRegisteredEmbed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('⚠️ Kullanıcı Zaten Kayıtlı')
          .setDescription(`**${targetUser.user.username}** zaten kayıt edilmiş.`)
          .addFields({
            name: '🔄 Tekrar Kayıt',
            value: 'Bu kullanıcı için yeniden kayıt işlemi yapılamaz. Önce mevcut rollerini kaldırın.',
            inline: false
          })
          .setTimestamp();

        // Orijinal mesajı da güncelle
        const disabledSelectMenu = new StringSelectMenuBuilder()
          .setCustomId(`kayit_disabled_${targetUser.id}`)
          .setPlaceholder('⚠️ Kullanıcı zaten kayıtlı')
          .setDisabled(true)
          .addOptions([
            {
              label: 'Zaten Kayıtlı',
              description: 'Bu kullanıcı zaten kayıt edilmiş',
              value: 'already_registered',
              emoji: '⚠️'
            }
          ]);

        const disabledRow = new ActionRowBuilder()
          .addComponents(disabledSelectMenu);

        await interaction.update({
          embeds: [alreadyRegisteredEmbed],
          components: [disabledRow]
        });
        return;
      }

      const selectedGender = interaction.values[0];
      
      // Tek modalda hem isim hem yaş - Discord.js limitation fix
      const registrationModal = new ModalBuilder()
        .setCustomId(`registration_${targetUser.id}_${selectedGender}`)
        .setTitle(`${selectedGender === 'erkek' ? '👨' : '👩'} Kayıt Bilgileri`);

      const nameInput = new TextInputBuilder()
        .setCustomId('name_input')
        .setLabel('Kullanıcının gerçek ismini giriniz')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örnek: Ahmet, Mehmet, Ayşe, Fatma')
        .setRequired(true)
        .setMaxLength(20)
        .setMinLength(2);

      const ageInput = new TextInputBuilder()
        .setCustomId('age_input')
        .setLabel('Kullanıcının yaşını giriniz')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('13-99 arası bir sayı giriniz')
        .setRequired(true)
        .setMaxLength(2)
        .setMinLength(1);

      const nameRow = new ActionRowBuilder().addComponents(nameInput);
      const ageRow = new ActionRowBuilder().addComponents(ageInput);
      registrationModal.addComponents(nameRow, ageRow);

      // Tek seferde modal göster
      await interaction.showModal(registrationModal);
      
    } catch (error) {
      console.error('[SELECT MENU ERROR]', error);
      
      // Eğer modal gösterilemezse, normal reply ile hata mesajı
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Modal gösterilirken bir hata oluştu. Lütfen tekrar deneyin.',
          ephemeral: true
        });
      }
    }
  },

  // Modal işleme - Tek modal (düzeltilmiş)
  async handleModal(interaction) {
    try {
      if (interaction.customId.startsWith('registration_')) {
        await this.handleRegistrationModal(interaction);
      } else {
        await interaction.reply({
          content: '❌ Bilinmeyen modal türü.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('[MODAL ERROR]', error);
      
      const errorMsg = {
        content: '❌ Modal işlenirken bir hata oluştu. Lütfen kayıt işlemini tekrar deneyin.',
        ephemeral: true
      };
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMsg);
      }
    }
  },

  // Tek modal işleme - İsim ve yaş birlikte
  async handleRegistrationModal(interaction) {
    const customIdParts = interaction.customId.split('_');
    if (customIdParts.length !== 3) {
      return await interaction.reply({
        content: '❌ Geçersiz modal formatı.',
        ephemeral: true
      });
    }
    
    const userId = customIdParts[1];
    const selectedGender = customIdParts[2];

    // YETKİLİ KONTROLÜ - GÜVENLIK: Sadece kayıt işlemini başlatan yetkili devam edebilir
    const registrationKey = `${interaction.guild.id}_${userId}`;
    const activeRegistration = activeRegistrations.get(registrationKey);
    
    if (!activeRegistration) {
      return await interaction.reply({
        content: '❌ Bu kayıt işlemi artık geçerli değil veya süresi dolmuş.',
        ephemeral: true
      });
    }
    
    if (activeRegistration.registrar !== interaction.user.id) {
      const originalRegistrar = await interaction.guild.members.fetch(activeRegistration.registrar).catch(() => null);
      return await interaction.reply({
        content: `❌ **GÜVENLİK İHLALİ!** Bu kayıt işlemini sadece ${originalRegistrar ? `**${originalRegistrar.displayName}**` : 'başlatan yetkili'} tamamlayabilir. Sen müdahale edemezsin!`,
        ephemeral: true
      });
    }

    const name = interaction.fields.getTextInputValue('name_input');
    const ageInput = interaction.fields.getTextInputValue('age_input');
    
    // İsim validasyonu
    if (!name || name.trim().length === 0) {
      return await interaction.reply({
        content: '❌ İsim boş olamaz.',
        ephemeral: true
      });
    }
    
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      return await interaction.reply({
        content: '❌ İsim 2-20 karakter arasında olmalıdır.',
        ephemeral: true
      });
    }
    
    // Sadece harf, sayı ve bazı özel karakterlere izin ver
    const nameRegex = /^[a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s\-\.]+$/;
    if (!nameRegex.test(trimmedName)) {
      return await interaction.reply({
        content: '❌ İsim sadece harf, sayı, boşluk, tire ve nokta içerebilir.',
        ephemeral: true
      });
    }
    
    // Yaş validasyonu
    if (!ageInput || ageInput.trim().length === 0) {
      return await interaction.reply({
        content: '❌ Yaş bilgisi boş olamaz.',
        ephemeral: true
      });
    }
    
    const ageNum = parseInt(ageInput.trim());
    if (isNaN(ageNum)) {
      return await interaction.reply({
        content: '❌ Yaş için geçerli bir sayı giriniz.',
        ephemeral: true
      });
    }
    
    if (ageNum < 13 || ageNum > 99) {
      return await interaction.reply({
        content: '❌ Yaş 13-99 arasında olmalıdır.',
        ephemeral: true
      });
    }
    
    // Hedef kullanıcıyı kontrol et
    try {
      const targetUser = await interaction.client.users.fetch(userId);
      const member = await interaction.guild.members.fetch(userId);
      
      // ROL HİYERARŞİSİ KONTROLÜ 
      const executor = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.highest.position >= executor.roles.highest.position) {
        return await interaction.reply({
          content: `❌ **GÜVENLİK:** ${targetUser.tag} kullanıcısının rol hiyerarşisi sizden yüksek veya eşit!`,
          ephemeral: true
        });
      }
      
      // İşlem süresi 3 saniyeyi aşabileceği için yanıtı önceden ayır
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
      
      // Kayıt config'ini al
      const registrationConfig = getRegistrationConfig(interaction.guild.id);
      
      const genderEmoji = selectedGender === 'erkek' ? '👨' : '👩';
      const genderText = selectedGender === 'erkek' ? 'Erkek' : 'Kadın';
      const newNickname = `${trimmedName} | ${ageNum}`;
      
      // Cinsiyet rolünü belirle
      const genderRoleId = selectedGender === 'erkek' ? 
        registrationConfig.maleRoleId : 
        registrationConfig.femaleRoleId;
      
      const genderRole = interaction.guild.roles.cache.get(genderRoleId);
      const memberRole = interaction.guild.roles.cache.get(registrationConfig.memberRoleId);
      
      // Nickname değiştirme
      try {
        await member.setNickname(newNickname, `Kayıt sistemi - ${interaction.user.tag}`);
      } catch (error) {
        console.log('Nickname değiştirilemedi:', error.message);
      }
      
      // Rolleri verme (önce temizle, sonra ver)
      let genderRoleResult = null;
      let memberRoleResult = null;
      
      // Mevcut rolleri kaydet (bot rolü ve @everyone hariç)
      const currentRoles = member.roles.cache.filter(role => 
        !role.managed && // Bot rolleri değil
        role.id !== interaction.guild.id && // @everyone değil
        role.position < member.guild.members.me.roles.highest.position // Bot'un verebileceği roller
      );
      
      try {
        // Mevcut rolleri kaldır (güvenlik için tek tek)
        for (const [roleId, role] of currentRoles) {
          try {
            await member.roles.remove(role, `Kayıt sistemi - Rol temizleme - ${interaction.user.tag}`);
          } catch (roleError) {
            console.log(`Rol kaldırılamadı (${role.name}):`, roleError.message);
          }
        }
        
        // Yeni rolleri ver
        const rolesToAdd = [];
        if (genderRole) rolesToAdd.push(genderRole);
        if (memberRole) rolesToAdd.push(memberRole);
        
        if (rolesToAdd.length > 0) {
          await member.roles.add(rolesToAdd, `Kayıt sistemi - ${interaction.user.tag}`);
          genderRoleResult = genderRole;
          memberRoleResult = memberRole;
        }
        
      } catch (error) {
        console.log('Rol güncelleme hatası:', error.message);
        
        // Hata durumunda rolleri tek tek vermeye çalış
        if (genderRole) {
          try {
            await member.roles.add(genderRole, `Kayıt sistemi (fallback) - ${interaction.user.tag}`);
            genderRoleResult = genderRole;
          } catch (error) {
            console.log('Cinsiyet rolü verilemedi:', error.message);
          }
        }
        
        if (memberRole) {
          try {
            await member.roles.add(memberRole, `Kayıt sistemi (fallback) - ${interaction.user.tag}`);
            memberRoleResult = memberRole;
          } catch (error) {
            console.log('Üye rolü verilemedi:', error.message);
          }
        }
      }
      
      // İstatistikleri güncelle
      addRegistration(interaction.guild.id, interaction.user.id, selectedGender, targetUser.id, trimmedName);
      
      // Başarı embed'i (ephemeral)
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Kayıt Başarılı')
        .setDescription(`${genderEmoji} **${targetUser.username}** başarıyla kayıt edildi!`)
        .addFields(
          { name: '👤 İsim', value: trimmedName, inline: true },
          { name: '🎂 Yaş', value: ageNum.toString(), inline: true },
          { name: '⚥ Cinsiyet', value: genderText, inline: true },
          { name: '🏷️ Yeni Nick', value: newNickname, inline: false },
          { 
            name: '🎭 Cinsiyet Rolü', 
            value: genderRoleResult ? `${genderRoleResult} ✅` : '❌ Verilemedi', 
            inline: true 
          },
          { 
            name: '👥 Üye Rolü', 
            value: memberRoleResult ? `${memberRoleResult} ✅` : '❌ Verilemedi', 
            inline: true 
          },
          { 
            name: '🗑️ Temizlenen Roller', 
            value: `${currentRoles.size} rol kaldırıldı`, 
            inline: true 
          },
          { name: '👮‍♂️ Kayıt Eden', value: interaction.user.toString(), inline: true },
          { name: '⏰ Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
          text: `ID: ${targetUser.id}`,
          iconURL: interaction.guild.iconURL({ dynamic: true })
        })
        .setTimestamp();
      
      // İlk olarak ephemeral response (defer sonrası edit)
      await interaction.editReply({ 
        embeds: [successEmbed],
        ephemeral: true
      });
      
      // Genel kanala bildirim (followUp ile)
      const publicSuccessEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🎉 Yeni Üye Kayıt Edildi')
        .setDescription(`${genderEmoji} **${trimmedName}** sunucumuza hoşgeldin!`)
        .addFields(
          { name: '🎂 Yaş', value: `${ageNum} yaşında`, inline: true },
          { name: '⚥ Cinsiyet', value: genderText, inline: true },
          { 
            name: '🎭 Rol', 
            value: genderRoleResult ? genderRoleResult.toString() : 'Belirtilmemiş', 
            inline: true 
          },
          { name: '👮‍♂️ Kayıt Bilgileri', value: `Yetkili: ${interaction.user.toString()}\nÜye: ${targetUser.toString()}`, inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      
      await interaction.followUp({
        embeds: [publicSuccessEmbed],
        ephemeral: false
      });

      // Kayıt tamamlandığını gösteren ek mesaj
      await interaction.followUp({
        content: `✅ **${targetUser.username}** için kayıt işlemi tamamlandı! Artık bu kullanıcı için yeni kayıt işlemi başlatabilirsiniz.`,
        ephemeral: true
      });
      
      // Auto log - Kayıt config'indeki log kanalını kullan
      const registrationLogChannelId = registrationConfig.logChannelId;
      if (registrationLogChannelId) {
        const logChannel = interaction.guild.channels.cache.get(registrationLogChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('👤 Yeni Üye Kayıt')
            .addFields(
              { name: '�‍♂️ Kayıt Bilgileri', value: `**Yetkili:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Üye:** ${targetUser.tag} (\`${targetUser.id}\`)`, inline: false },
              { name: `${genderEmoji} Cinsiyet`, value: genderText, inline: true },
              { name: '🎂 Yaş', value: `${ageNum} yaşında`, inline: true },
              { name: '📝 Yeni İsim', value: newNickname, inline: true },
              { 
                name: '🎭 Cinsiyet Rolü', 
                value: genderRoleResult ? `${genderRoleResult.name} (${genderRoleResult.id})` : 'Verilemedi', 
                inline: true 
              },
              { 
                name: '👥 Üye Rolü', 
                value: memberRoleResult ? `${memberRoleResult.name} (${memberRoleResult.id})` : 'Verilemedi', 
                inline: true 
              },
              { 
                name: '🗑️ Kaldırılan Roller', 
                value: `${currentRoles.size} rol temizlendi`, 
                inline: true 
              },
              { name: '📊 Toplam Üye', value: `${interaction.guild.memberCount}`, inline: true }
            )
            .setTimestamp();
          
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
      
      // Aktif kayıt işlemini kaldır (başarılı kayıt)
      const completedRegistrationKey = `${interaction.guild.id}_${targetUser.id}`;
      activeRegistrations.delete(completedRegistrationKey);
      
      // Kullanıcıya DM gönder
      try {
        const welcomeDM = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`🎉 ${interaction.guild.name} Sunucusuna Hoşgeldin!`)
          .setDescription(`Merhaba **${trimmedName}**! Sunucumuza başarıyla kayıt oldun.`)
          .addFields(
            { 
              name: '📊 Bilgilerin', 
              value: `**Cinsiyet:** ${genderText}\n**Yaş:** ${ageNum}\n**Yeni İsmin:** ${newNickname}\n**Cinsiyet Rolün:** ${genderRoleResult ? genderRoleResult.name : 'Verilemedi'}\n**Üye Rolün:** ${memberRoleResult ? memberRoleResult.name : 'Verilemedi'}\n**Temizlenen Roller:** ${currentRoles.size} rol kaldırıldı`, 
              inline: false 
            },
            { name: '📋 Sunucu Kuralları', value: 'Sunucu kurallarına uymayı unutma ve iyi eğlenceler!', inline: false }
          )
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setTimestamp();
        
        await targetUser.send({ embeds: [welcomeDM] });
      } catch (error) {
        console.log('DM gönderilemedi - kullanıcı DM kapalı olabilir:', error.message);
      }

      // Original message'ı güncelle - butonları devre dışı bırak
      try {
        const completedEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('✅ Kayıt Tamamlandı')
          .setDescription(`${genderEmoji} **${targetUser.username}** başarıyla kayıt edildi!`)
          .addFields(
            { name: '👤 İsim', value: trimmedName, inline: true },
            { name: '🎂 Yaş', value: ageNum.toString(), inline: true },
            { name: '⚥ Cinsiyet', value: genderText, inline: true },
            { name: '👮‍♂️ Kayıt Bilgileri', value: `Yetkili: ${interaction.user.toString()}\nÜye: ${targetUser.toString()}`, inline: true },
            { name: '⏰ Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        const disabledSelectMenu = new StringSelectMenuBuilder()
          .setCustomId(`kayit_completed_${targetUser.id}`)
          .setPlaceholder('✅ Kayıt tamamlandı')
          .setDisabled(true)
          .addOptions([
            {
              label: 'Kayıt Tamamlandı',
              description: 'Bu işlem başarıyla tamamlanmıştır',
              value: 'completed',
              emoji: '✅'
            }
          ]);

        const disabledRow = new ActionRowBuilder()
          .addComponents(disabledSelectMenu);

        // Eğer bu modal submit bir select menu interaction'dan geliyorsa, o mesajı güncelle
        if (interaction.message && interaction.message.components.length > 0) {
          await interaction.message.edit({
            embeds: [completedEmbed],
            components: [disabledRow]
          });
        } else {
          // Alternatif olarak kanal mesajlarında ara
          const kayitChannel = interaction.channel;
          if (kayitChannel) {
            const messages = await kayitChannel.messages.fetch({ limit: 5 });
            const kayitMessage = messages.find(msg => 
              msg.embeds.length > 0 && 
              msg.embeds[0].description?.includes(targetUser.username) &&
              (msg.embeds[0].title?.includes('Kayıt İşlemi') || msg.embeds[0].title?.includes('Üye Kayıt')) &&
              msg.components.length > 0 &&
              msg.author.id === interaction.client.user.id
            );

            if (kayitMessage) {
              await kayitMessage.edit({
                embeds: [completedEmbed],
                components: [disabledRow]
              });
            }
          }
        }
      } catch (editError) {
        console.log('Original message güncellenemedi:', editError.message);
      }
      
    } catch (error) {
      console.error('[REGISTRATION ERROR]', error);
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({
            content: '❌ Kayıt işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
            embeds: [],
            components: []
          });
        } else {
          await interaction.reply({
            content: '❌ Kayıt işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('[REPLY ERROR]', replyError);
      }
    }
  }
};

// Her 5 dakikada bir eski kayıt işlemlerini temizle
setInterval(() => {
  cleanupExpiredRegistrations();
}, 5 * 60 * 1000); // 5 dakika
