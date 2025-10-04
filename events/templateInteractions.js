const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getServerTemplate, loadServerTemplates, deleteServerTemplate, updateServerTemplate } = require('../serverTemplates');
const { handleSecuritySetupInteractions } = require('./securitySetupHandler');

module.exports = (client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // Güvenlik kurulum interaction'ları
      const securitySetupIds = [
        'security_setup_jail', 'security_setup_log', 'security_setup_whitelist',
        'security_quick_setup', 'security_test_system', 'security_full_guide',
        'security_log_channel_select', 'security_whitelist_role_select',
        'confirm_quick_setup', 'create_jail_role', 'security_jail_role_select'
      ];
      
      if (securitySetupIds.includes(interaction.customId)) {
        return await handleSecuritySetupInteractions(interaction);
      }

      // Select menu etkileşimleri için güvenlik kontrolü
      if (interaction.isStringSelectMenu()) {
        const securityMenuIds = [
          'security_jail_role_select', 'security_log_channel_select', 'security_whitelist_role_select'
        ];
        
        if (securityMenuIds.includes(interaction.customId)) {
          return await handleSecuritySetupInteractions(interaction);
        }
      }

      // Buton etkileşimleri
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Şablon detayları butonu
        if (customId.startsWith('template_details_')) {
          const guildId = customId.split('_')[2];
          const templates = loadServerTemplates(guildId);
          
          if (!templates || templates.length === 0) {
            return interaction.reply({
              content: '❌ Bu sunucu için şablon bulunamadı.',
              ephemeral: true
            });
          }

          const template = templates[0]; // En son şablonu al
          
          const detailEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📋 ${template.name} - Detaylar`)
            .setDescription(template.description || 'Açıklama yok')
            .addFields(
              {
                name: '📊 Kanal Yapısı',
                value: `**📁 Kategoriler:** ${template.stats.totalCategories}\n**💬 Metin:** ${template.stats.textChannels}\n**🔊 Ses:** ${template.stats.voiceChannels}\n**🗂️ Forum:** ${template.stats.forumChannels}`,
                inline: true
              },
              {
                name: '🎭 Roller',
                value: `**Toplam:** ${template.stats.totalRoles}\n**Yönetici:** ${template.structure.roles?.filter(r => r.permissions && r.permissions.includes('ADMINISTRATOR')).length || 0}\n**Özel:** ${template.structure.roles?.filter(r => !r.managed && r.name !== '@everyone').length || 0}`,
                inline: true
              }
            )
            .setTimestamp();

          // Kategori detayları
          if (template.structure.categories && template.structure.categories.length > 0) {
            let categoryDetails = '';
            template.structure.categories.slice(0, 8).forEach(cat => {
              const channelCount = template.structure.channels?.filter(ch => ch.parentId === cat.id).length || 0;
              categoryDetails += `**${cat.name}** (${channelCount} kanal)\n`;
            });
            
            if (template.structure.categories.length > 8) {
              categoryDetails += `*... ve ${template.structure.categories.length - 8} kategori daha*`;
            }

            detailEmbed.addFields({
              name: '📁 Kategori Detayları',
              value: categoryDetails.substring(0, 1024),
              inline: false
            });
          }

          return interaction.reply({
            embeds: [detailEmbed],
            ephemeral: true
          });
        }

        // Şablon güncelleme butonu
        if (customId.startsWith('template_update_')) {
          const templateId = customId.split('_')[2];
          
          const modal = new ModalBuilder()
            .setCustomId(`template_update_modal_${templateId}`)
            .setTitle('Şablon Güncelle');

          const nameInput = new TextInputBuilder()
            .setCustomId('template_name')
            .setLabel('Şablon İsmi')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true);

          const descInput = new TextInputBuilder()
            .setCustomId('template_description')
            .setLabel('Şablon Açıklaması')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(120)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(descInput)
          );

          return interaction.showModal(modal);
        }

        // Şablon silme butonu
        if (customId.startsWith('template_delete_')) {
          const templateId = customId.split('_')[2];
          const template = getServerTemplate(interaction.guildId, templateId);
          
          if (!template) {
            return interaction.reply({
              content: '❌ Şablon bulunamadı.',
              ephemeral: true
            });
          }

          const confirmEmbed = new EmbedBuilder()
            .setColor('#F04A47')
            .setTitle('⚠️ Şablon Silme Onayı')
            .setDescription(`**${template.name}** isimli şablonu silmek istediğinizden emin misiniz?`)
            .addFields({
              name: '⚠️ Uyarı',
              value: 'Bu işlem geri alınamaz. Şablon kalıcı olarak silinecek.',
              inline: false
            })
            .setFooter({ text: 'Bu işlem 30 saniye içinde iptal edilecek' })
            .setTimestamp();

          const confirmRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`confirm_delete_${templateId}`)
                .setLabel('🗑️ Evet, Sil')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('❌ İptal')
                .setStyle(ButtonStyle.Secondary)
            );

          return interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            ephemeral: true
          });
        }

        // Silme onayı
        if (customId.startsWith('confirm_delete_')) {
          const templateId = customId.split('_')[2];
          const success = deleteServerTemplate(interaction.guildId, templateId);
          
          if (success) {
            return interaction.update({
              content: '✅ Şablon başarıyla silindi.',
              embeds: [],
              components: []
            });
          } else {
            return interaction.update({
              content: '❌ Şablon silinirken bir hata oluştu.',
              embeds: [],
              components: []
            });
          }
        }

        // Silme iptali
        if (customId === 'cancel_delete') {
          return interaction.update({
            content: '🔄 Silme işlemi iptal edildi.',
            embeds: [],
            components: []
          });
        }

        // Yeni şablon oluştur
        if (customId === 'create_new_template') {
          const modal = new ModalBuilder()
            .setCustomId('create_template_modal')
            .setTitle('Yeni Şablon Oluştur');

          const nameInput = new TextInputBuilder()
            .setCustomId('template_name')
            .setLabel('Şablon İsmi')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true)
            .setPlaceholder('Örnek: Oyun Sunucusu Şablonu');

          const descInput = new TextInputBuilder()
            .setCustomId('template_description')
            .setLabel('Şablon Açıklaması')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(120)
            .setRequired(false)
            .setPlaceholder('Bu şablonun ne için kullanılacağını açıklayın...');

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(descInput)
          );

          return interaction.showModal(modal);
        }

        // Liste yenileme
        if (customId === 'refresh_template_list') {
          const templates = loadServerTemplates(interaction.guildId);
          
          const refreshEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🔄 Liste Yenilendi')
            .setDescription(`Toplam **${templates?.length || 0}** şablon bulundu.`)
            .setTimestamp();

          return interaction.reply({
            embeds: [refreshEmbed],
            ephemeral: true
          });
        }

        // Discord şablonları yönetimi
        if (customId === 'sync_all_templates') {
          try {
            const discordTemplates = await interaction.guild.fetchTemplates();
            let syncCount = 0;
            let errorCount = 0;

            for (const template of discordTemplates.values()) {
              try {
                await template.sync();
                syncCount++;
              } catch (error) {
                console.error(`Şablon sync hatası: ${template.code}`, error);
                errorCount++;
              }
            }

            const resultEmbed = new EmbedBuilder()
              .setColor(errorCount > 0 ? '#FEE75C' : '#57F287')
              .setTitle('🔄 Toplu Senkronizasyon Tamamlandı')
              .setDescription(`**${syncCount}** şablon başarıyla senkronize edildi.${errorCount > 0 ? `\n**${errorCount}** şablonda hata oluştu.` : ''}`)
              .setTimestamp();

            return interaction.reply({
              embeds: [resultEmbed],
              ephemeral: true
            });
          } catch (error) {
            console.error('Toplu sync hatası:', error);
            return interaction.reply({
              content: '❌ Şablonlar senkronize edilirken hata oluştu.',
              ephemeral: true
            });
          }
        }

        if (customId === 'delete_all_templates') {
          const confirmEmbed = new EmbedBuilder()
            .setColor('#F04A47')
            .setTitle('⚠️ Tüm Discord Şablonlarını Sil')
            .setDescription('**UYARI:** Bu işlem tüm Discord şablonlarını kalıcı olarak silecek!')
            .addFields({
              name: '⚠️ DİKKAT',
              value: 'Bu işlem geri alınamaz. Tüm şablon linkleri çalışmaz hale gelecek.',
              inline: false
            })
            .setFooter({ text: 'Bu işlem 30 saniye içinde iptal edilecek' })
            .setTimestamp();

          const confirmRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('confirm_delete_all_templates')
                .setLabel('🗑️ EVET, TÜMÜNİ SİL')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cancel_delete_all')
                .setLabel('❌ İptal')
                .setStyle(ButtonStyle.Secondary)
            );

          return interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            ephemeral: true
          });
        }

        if (customId === 'confirm_delete_all_templates') {
          try {
            const discordTemplates = await interaction.guild.fetchTemplates();
            let deleteCount = 0;

            for (const template of discordTemplates.values()) {
              try {
                await template.delete();
                deleteCount++;
              } catch (error) {
                console.error(`Şablon silme hatası: ${template.code}`, error);
              }
            }

            return interaction.update({
              content: `✅ **${deleteCount}** Discord şablonu başarıyla silindi.`,
              embeds: [],
              components: []
            });
          } catch (error) {
            console.error('Toplu silme hatası:', error);
            return interaction.update({
              content: '❌ Şablonlar silinirken hata oluştu.',
              embeds: [],
              components: []
            });
          }
        }

        if (customId === 'cancel_delete_all') {
          return interaction.update({
            content: '🔄 Toplu silme işlemi iptal edildi.',
            embeds: [],
            components: []
          });
        }

        // Güvenlik sistemi butonları
        if (customId === 'security_enable') {
          const { getSecurityConfig, setSecurityConfig } = require('../securityConfig');
          const config = getSecurityConfig(interaction.guildId);
          config.enabled = true;
          
          const success = setSecurityConfig(interaction.guildId, config);
          if (success) {
            return interaction.reply({
              content: '✅ Güvenlik sistemi aktifleştirildi!',
              ephemeral: true
            });
          } else {
            return interaction.reply({
              content: '❌ Güvenlik sistemi aktifleştirilemedi.',
              ephemeral: true
            });
          }
        }

        if (customId === 'security_disable') {
          const { getSecurityConfig, setSecurityConfig } = require('../securityConfig');
          const config = getSecurityConfig(interaction.guildId);
          config.enabled = false;
          
          const success = setSecurityConfig(interaction.guildId, config);
          if (success) {
            return interaction.reply({
              content: '🔴 Güvenlik sistemi devre dışı bırakıldı.',
              ephemeral: true
            });
          } else {
            return interaction.reply({
              content: '❌ Güvenlik sistemi kapatılamadı.',
              ephemeral: true
            });
          }
        }

        if (customId === 'security_settings') {
          const { getSecurityConfig } = require('../securityConfig');
          const config = getSecurityConfig(interaction.guildId);
          
          const settingsEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Güvenlik Sistemi Ayarları')
            .setDescription('Mevcut güvenlik sistemi ayarları:')
            .addFields(
              {
                name: '🎯 İhlal Eşiği',
                value: `${config.banThreshold} ban/kick (24 saatte)`,
                inline: true
              },
              {
                name: '⚖️ Ceza Türü',
                value: config.punishment === 'jail' ? 'Jail' : 
                       config.punishment === 'roleRemove' ? 'Rol Alma' : 'Jail + Rol Alma',
                inline: true
              },
              {
                name: '📊 Log Kanalı',
                value: config.logChannel ? `<#${config.logChannel}>` : 'Ayarlanmamış',
                inline: true
              }
            )
            .setFooter({ text: 'Ayarları değiştirmek için /güvenlik-sistemi ayar komutunu kullanın' })
            .setTimestamp();

          return interaction.reply({
            embeds: [settingsEmbed],
            ephemeral: true
          });
        }
      }

      // Seçim menüsü etkileşimleri
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'template_select') {
          const templateId = interaction.values[0];
          const template = getServerTemplate(interaction.guildId, templateId);
          
          if (!template) {
            return interaction.reply({
              content: '❌ Seçilen şablon bulunamadı.',
              ephemeral: true
            });
          }

          const detailEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📋 ${template.name}`)
            .setDescription(template.description || 'Açıklama yok')
            .addFields(
              {
                name: '📊 İstatistikler',
                value: `**📁 Kategoriler:** ${template.stats.totalCategories}\n**💬 Metin Kanalları:** ${template.stats.textChannels}\n**🔊 Ses Kanalları:** ${template.stats.voiceChannels}\n**🗂️ Forum Kanalları:** ${template.stats.forumChannels}\n**🎭 Roller:** ${template.stats.totalRoles}`,
                inline: true
              },
              {
                name: '🔗 Şablon Bilgileri',
                value: template.templateCode ? `**Kod:** \`${template.templateCode}\`\n**Link:** [Şablonu Kullan](${template.templateUrl})` : '⚠️ Discord şablonu mevcut değil',
                inline: true
              },
              {
                name: '💾 Kayıt Bilgileri',
                value: `**Oluşturulma:** <t:${Math.floor(new Date(template.createdAt).getTime() / 1000)}:R>\n**Oluşturan:** <@${template.creatorId}>\n**ID:** \`${template.id}\``,
                inline: false
              }
            )
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `Şablon ID: ${template.id}` })
            .setTimestamp();

          const actionRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setLabel('🔄 Şablonu Güncelle')
                .setStyle(ButtonStyle.Primary)
                .setCustomId(`template_update_${template.id}`),
              new ButtonBuilder()
                .setLabel('🗑️ Şablonu Sil')
                .setStyle(ButtonStyle.Danger)
                .setCustomId(`template_delete_${template.id}`)
            );

          if (template.templateUrl) {
            actionRow.addComponents(
              new ButtonBuilder()
                .setLabel('🌐 Şablonu Aç')
                .setStyle(ButtonStyle.Link)
                .setURL(template.templateUrl)
            );
          }

          return interaction.reply({
            embeds: [detailEmbed],
            components: [actionRow],
            ephemeral: true
          });
        }
      }

      // Modal etkileşimleri
      if (interaction.isModalSubmit()) {
        // Yeni şablon oluşturma modalı
        if (interaction.customId === 'create_template_modal') {
          const templateName = interaction.fields.getTextInputValue('template_name');
          const templateDescription = interaction.fields.getTextInputValue('template_description') || 'Bot tarafından oluşturulan şablon';

          // Şablon oluşturma komutunu simüle et
          const createCommand = require('../commands/sablon-olustur.js');
          
          // Sahte context oluştur
          const fakeCtx = {
            guild: interaction.guild,
            user: interaction.user,
            reply: async (options) => await interaction.reply(options),
            editReply: async (options) => await interaction.editReply(options),
            isCommand: () => false
          };

          await createCommand.execute(fakeCtx, [templateName, templateDescription]);
        }

        // Şablon güncelleme modalı
        if (interaction.customId.startsWith('template_update_modal_')) {
          const templateId = interaction.customId.split('_')[3];
          const newName = interaction.fields.getTextInputValue('template_name');
          const newDescription = interaction.fields.getTextInputValue('template_description') || '';

          const success = updateServerTemplate(interaction.guildId, templateId, {
            name: newName,
            description: newDescription
          });

          if (success) {
            const successEmbed = new EmbedBuilder()
              .setColor('#57F287')
              .setTitle('✅ Şablon Güncellendi')
              .setDescription(`**${newName}** isimli şablon başarıyla güncellendi.`)
              .addFields({
                name: '📝 Yeni Bilgiler',
                value: `**İsim:** ${newName}\n**Açıklama:** ${newDescription || 'Açıklama yok'}`,
                inline: false
              })
              .setTimestamp();

            return interaction.reply({
              embeds: [successEmbed],
              ephemeral: true
            });
          } else {
            return interaction.reply({
              content: '❌ Şablon güncellenirken bir hata oluştu.',
              ephemeral: true
            });
          }
        }
      }

    } catch (error) {
      console.error('Interaction hatası:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Bir hata oluştu. Lütfen tekrar deneyin.',
          ephemeral: true
        });
      }
    }
  });
};