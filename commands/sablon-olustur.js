const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveServerTemplate, analyzeChannelStructure, analyzeRoleStructure } = require('../serverTemplates');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('şablon-oluştur')
    .setDescription('Mevcut sunucunun yapısından şablon oluşturur.')
    .addStringOption(option =>
      option.setName('isim')
        .setDescription('Şablon ismi')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option.setName('açıklama')
        .setDescription('Şablon açıklaması')
        .setRequired(false)
        .setMaxLength(120)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  description: 'Mevcut sunucunun kanal ve rol yapısını analiz ederek Discord şablonu oluşturur.',
  usage: '/şablon-oluştur <isim> [açıklama]',
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(ctx, args) {
    try {
      let templateName, templateDescription;

      if (ctx.isCommand && ctx.isCommand()) {
        // Slash komut
        templateName = ctx.options.getString('isim');
        templateDescription = ctx.options.getString('açıklama') || 'Bot tarafından oluşturulan şablon';
      } else {
        // Prefix komut
        if (!args[0]) {
          return ctx.reply({
            content: '❌ Şablon ismi belirtmelisin. Örnek: `!şablon-oluştur "Oyun Sunucusu" "Oyun topluluğu için hazır şablon"`',
            ephemeral: true
          });
        }

        templateName = args[0];
        templateDescription = args.slice(1).join(' ') || 'Bot tarafından oluşturulan şablon';
      }

      // Yetki kontrolü
      const executorId = ctx.user?.id || ctx.author?.id;
      const executor = await ctx.guild.members.fetch(executorId);
      if (!executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return ctx.reply({
          content: '❌ Bu komutu kullanmak için "Sunucuyu Yönet" yetkisine sahip olmalısın.',
          ephemeral: true
        });
      }

      // İşleme başladığını bildir
      const processingEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⚙️ Şablon Oluşturuluyor')
        .setDescription('Sunucu yapısı analiz ediliyor ve şablon oluşturuluyor...')
        .addFields(
          { name: '📊 İşlemler', value: '🔄 Kanallar analiz ediliyor\n🔄 Roller analiz ediliyor\n⏳ Discord şablonu oluşturuluyor', inline: false }
        )
        .setFooter({ text: 'Bu işlem birkaç saniye sürebilir' })
        .setTimestamp();

      const processingMsg = await ctx.reply({ embeds: [processingEmbed] });

      // Sunucu yapısını analiz et
      const { channels, categories } = analyzeChannelStructure(ctx.guild);
      const roles = analyzeRoleStructure(ctx.guild);

      // Discord şablonu oluştur
      let templateCode = null;
      let templateUrl = null;
      let discordTemplateError = null;
      
      try {
        // Mevcut şablonları kontrol et (max 1 şablon per guild)
        const existingTemplates = await ctx.guild.fetchTemplates();
        
        if (existingTemplates.size > 0) {
          // Mevcut şablonu güncelle
          const existingTemplate = existingTemplates.first();
          const updatedTemplate = await existingTemplate.edit({
            name: templateName.substring(0, 100),
            description: templateDescription.substring(0, 120)
          });
          
          // Şablonu sync et (güncel sunucu durumunu yansıt)
          await updatedTemplate.sync();
          
          templateCode = updatedTemplate.code;
          templateUrl = `https://discord.new/${updatedTemplate.code}`;
          
          console.log(`Mevcut şablon güncellendi: ${templateCode}`);
        } else {
          // Discord şablonu oluşturmadan önce permission overwrite sayısını kontrol et
          let totalPermissionOverwrites = 0;
          ctx.guild.channels.cache.forEach(channel => {
            totalPermissionOverwrites += channel.permissionOverwrites.cache.size;
          });

          // Discord'un limit kontrolü (1000 permission overwrite)
          if (totalPermissionOverwrites > 950) { // Güvenlik marjı bırak
            console.log(`Çok fazla permission overwrite (${totalPermissionOverwrites}). Discord şablonu oluşturulamayacak.`);
            discordTemplateError = `Sunucuda çok fazla kanal izni ayarı bulunuyor (${totalPermissionOverwrites}). Discord şablonu oluşturulamaz ancak bot şablonu kaydedilecek.`;
          } else {
            // Yeni Discord şablonu oluştur
            const template = await ctx.guild.createTemplate(
              templateName.substring(0, 100),
              templateDescription.substring(0, 120)
            );
            
            templateCode = template.code;
            templateUrl = `https://discord.new/${template.code}`;
            
            console.log(`Yeni şablon oluşturuldu: ${templateCode}`);
          }
        }
      } catch (error) {
        console.error('Discord şablonu oluşturma hatası:', error);
        
        if (error.code === 30060) {
          discordTemplateError = 'Sunucuda çok fazla kanal izni ayarı bulunuyor (1000 limit). Discord şablonu oluşturulamaz.';
        } else if (error.code === 30031) {
          discordTemplateError = 'Bu sunucu için zaten maksimum sayıda şablon mevcut.';
        } else if (error.code === 50013) {
          discordTemplateError = 'Bu işlem için gerekli yetkilere sahip değilsiniz.';
        } else if (error.code === 50001) {
          discordTemplateError = 'Bot bu sunucuya erişim yetkisine sahip değil.';
        } else {
          discordTemplateError = `Discord şablonu oluşturulurken hata: ${error.message || 'Bilinmeyen hata'}`;
        }
      }

      // Veri yapısını oluştur
      const templateData = {
        name: templateName,
        description: templateDescription,
        guildName: ctx.guild.name,
        guildId: ctx.guild.id,
        creatorId: executorId,
        templateCode: templateCode,
        templateUrl: templateUrl,
        structure: {
          channels: channels,
          categories: categories,
          roles: roles
        },
        stats: {
          totalChannels: channels.length,
          totalCategories: categories.length,
          totalRoles: roles.length,
          textChannels: channels.filter(c => c.type === 0).length,
          voiceChannels: channels.filter(c => c.type === 2).length,
          forumChannels: channels.filter(c => c.type === 15).length
        }
      };

      // Şablonu kaydet
      const saved = saveServerTemplate(ctx.guild.id, templateData);

      if (!saved) {
        const errorMsg = {
          content: '❌ Şablon kaydedilirken bir hata oluştu.',
          embeds: []
        };
        
        if (ctx.isCommand && ctx.isCommand()) {
          return ctx.editReply(errorMsg);
        } else {
          return ctx.reply(errorMsg);
        }
      }

      // Başarı mesajı
      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Şablon Başarıyla Oluşturuldu')
        .setDescription(`**${templateName}** isimli şablon oluşturuldu ve kaydedildi!`)
        .addFields(
          {
            name: '📊 Analiz Sonuçları',
            value: `**📁 Kategoriler:** ${templateData.stats.totalCategories}\n**💬 Metin Kanalları:** ${templateData.stats.textChannels}\n**🔊 Ses Kanalları:** ${templateData.stats.voiceChannels}\n**🗂️ Forum Kanalları:** ${templateData.stats.forumChannels}\n**🎭 Roller:** ${templateData.stats.totalRoles}`,
            inline: true
          },
          {
            name: '🔗 Şablon Bilgileri',
            value: templateCode ? `**Kod:** \`${templateCode}\`\n**Link:** [Şablonu Kullan](${templateUrl})` : `⚠️ Discord şablonu oluşturulamadı\n${discordTemplateError || '(Sunucu yapısı yine de kaydedildi)'}`,
            inline: true
          },
          {
            name: '💾 Kayıt Bilgileri',
            value: `**Kayıt Tarihi:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Oluşturan:** ${executor.displayName}\n**Durum:** Aktif`,
            inline: false
          }
        )
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Şablon artık kullanıma hazır!' })
        .setTimestamp();

      // Butonlar
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('📋 Şablon Detayları')
            .setStyle(ButtonStyle.Primary)
            .setCustomId(`template_details_${ctx.guild.id}`),
          new ButtonBuilder()
            .setLabel('🔄 Şablonu Güncelle')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`template_update_${ctx.guild.id}`)
        );

      if (templateUrl) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setLabel('🌐 Şablonu Aç')
            .setStyle(ButtonStyle.Link)
            .setURL(templateUrl)
        );
      }

      const replyData = {
        embeds: [successEmbed],
        components: [actionRow]
      };

      if (ctx.isCommand && ctx.isCommand()) {
        await ctx.editReply(replyData);
      } else {
        await ctx.reply(replyData);
      }

    } catch (error) {
      console.error('Şablon oluşturma hatası:', error);
      
      const errorData = {
        content: '❌ Şablon oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.',
        ephemeral: true
      };

      if (!ctx.replied && !ctx.deferred) {
        await ctx.reply(errorData);
      }
    }
  }
};