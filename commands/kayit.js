const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { getAutoLogChannel } = require('../config');

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

    // YETKİ KONTROLÜ - GÜVENLİK
    const executorId = ctx.user?.id || ctx.author?.id;
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

    return ctx.reply({ 
      embeds: [kayitEmbed], 
      components: [row],
      flags: MessageFlags.Ephemeral 
    });
  },

  // Kayıt cinsiyet seçim menüsü
  async handleSelectMenu(interaction) {
    if (!interaction.customId.startsWith('kayit_')) return;
    
    const targetUserId = interaction.customId.split('_')[1];
    const selectedGender = interaction.values[0];
    
    // Yaş modal'ı oluştur
    const ageModal = new ModalBuilder()
      .setCustomId(`age_${targetUserId}_${selectedGender}`)
      .setTitle('Yaş Bilgisi');

    const ageInput = new TextInputBuilder()
      .setCustomId('age_input')
      .setLabel('Kullanıcının yaşını giriniz')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örnek: 18')
      .setRequired(true)
      .setMaxLength(2)
      .setMinLength(1);

    const ageRow = new ActionRowBuilder().addComponents(ageInput);
    ageModal.addComponents(ageRow);

    await interaction.showModal(ageModal);
  },

  // Yaş modal'ı işleme
  async handleModal(interaction) {
    if (!interaction.customId.startsWith('age_')) return;
    
    const [, targetUserId, selectedGender] = interaction.customId.split('_');
    const age = interaction.fields.getTextInputValue('age_input');
    
    // Yaş kontrolü
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 99) {
      return interaction.reply({
        content: '❌ Geçerli bir yaş giriniz (1-99 arası).',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const targetUser = await interaction.client.users.fetch(targetUserId);
      const member = await interaction.guild.members.fetch(targetUserId);
      
      // Cinsiyet emoji'si
      const genderEmoji = selectedGender === 'erkek' ? '👨' : '👩';
      const genderText = selectedGender === 'erkek' ? 'Erkek' : 'Kadın';
      
      // Yeni nickname oluştur (isim | yaş)
      const newNickname = `${targetUser.username} | ${age}`;
      
      // Nickname'i değiştir
      try {
        await member.setNickname(newNickname);
      } catch (error) {
        console.log('Nickname değiştirilemedi:', error.message);
      }
      
      // Başarı embed'i
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Kayıt Tamamlandı')
        .setDescription(`**${targetUser.tag}** başarıyla kayıt edildi!`)
        .addFields(
          {
            name: '👤 Kullanıcı',
            value: `${targetUser.tag}`,
            inline: true
          },
          {
            name: `${genderEmoji} Cinsiyet`,
            value: genderText,
            inline: true
          },
          {
            name: '🎂 Yaş',
            value: `${age} yaşında`,
            inline: true
          },
          {
            name: '📝 Yeni İsim',
            value: newNickname,
            inline: false
          },
          {
            name: '👮‍♂️ Kayıt Eden',
            value: `${interaction.user.tag}`,
            inline: true
          },
          {
            name: '⏰ Tarih',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      
      await interaction.reply({ 
        embeds: [successEmbed],
        ephemeral: false
      });
      
      // Log
      const logChannelId = getAutoLogChannel(interaction.guild.id);
      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('👤 Yeni Üye Kayıt')
            .addFields(
              {
                name: '👤 Kayıt Edilen',
                value: `${targetUser.tag} (\`${targetUser.id}\`)`,
                inline: true
              },
              {
                name: '👮‍♂️ Kayıt Eden',
                value: `${interaction.user.tag} (\`${interaction.user.id}\`)`,
                inline: true
              },
              {
                name: `${genderEmoji} Cinsiyet`,
                value: genderText,
                inline: true
              },
              {
                name: '🎂 Yaş',
                value: `${age} yaşında`,
                inline: true
              },
              {
                name: '📝 Yeni İsim',
                value: newNickname,
                inline: true
              },
              {
                name: '📊 Toplam Üye',
                value: `${interaction.guild.memberCount}`,
                inline: true
              }
            )
            .setTimestamp();
          
          logChannel.send({ embeds: [logEmbed] });
        }
      }
      
      // Kullanıcıya hoşgeldin mesajı gönder
      try {
        const welcomeDM = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`🎉 ${interaction.guild.name} Sunucusuna Hoşgeldin!`)
          .setDescription(`Merhaba **${targetUser.username}**! Sunucumuza başarıyla kayıt oldun.`)
          .addFields(
            {
              name: '📊 Bilgilerin',
              value: `**Cinsiyet:** ${genderText}\n**Yaş:** ${age}\n**Yeni İsmin:** ${newNickname}`,
              inline: false
            },
            {
              name: '📋 Sunucu Kuralları',
              value: 'Sunucu kurallarına uymayı unutma ve iyi eğlenceler!',
              inline: false
            }
          )
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setTimestamp();
        
        await targetUser.send({ embeds: [welcomeDM] });
      } catch (error) {
        console.log('DM gönderilemedi:', error.message);
      }
      
    } catch (error) {
      console.error('Kayıt hatası:', error);
      await interaction.reply({
        content: '❌ Kayıt işlemi sırasında bir hata oluştu.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
