const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadServerTemplates, getServerTemplate } = require('../serverTemplates');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('şablonlar')
    .setDescription('Kayıtlı sunucu şablonlarını görüntüler.')
    .addStringOption(option =>
      option.setName('şablon-id')
        .setDescription('Belirli bir şablonun detaylarını görmek için şablon ID\'si')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  description: 'Kayıtlı sunucu şablonlarını listeler ve detaylarını gösterir.',
  usage: '/şablonlar [şablon-id]',
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(ctx, args) {
    try {
      let templateId;

      if (ctx.isCommand && ctx.isCommand()) {
        // Slash komut
        templateId = ctx.options.getString('şablon-id');
      } else {
        // Prefix komut
        templateId = args[0];
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

      const templates = loadServerTemplates(ctx.guild.id);

      if (!templates || templates.length === 0) {
        const noTemplatesEmbed = new EmbedBuilder()
          .setColor('#F04A47')
          .setTitle('📋 Şablon Bulunamadı')
          .setDescription('Bu sunucu için henüz hiç şablon oluşturulmamış.')
          .addFields(
            {
              name: '🛠️ Şablon Oluşturmak İçin',
              value: '`/şablon-oluştur` komutunu kullanarak yeni bir şablon oluşturabilirsin.',
              inline: false
            }
          )
          .setFooter({ text: 'Şablonlar sunucu yapısını kaydetmek için kullanılır' })
          .setTimestamp();

        return ctx.reply({ embeds: [noTemplatesEmbed] });
      }

      // Belirli bir şablon gösterilmek isteniyorsa
      if (templateId) {
        const template = getServerTemplate(ctx.guild.id, templateId);
        if (!template) {
          return ctx.reply({
            content: '❌ Belirtilen ID ile şablon bulunamadı.',
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
          .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
          .setFooter({ text: `Şablon ID: ${template.id}` })
          .setTimestamp();

        // Detaylı yapı bilgisi
        if (template.structure) {
          let channelInfo = '';
          if (template.structure.categories && template.structure.categories.length > 0) {
            channelInfo += '**📁 Kategoriler:**\n';
            template.structure.categories.slice(0, 5).forEach(cat => {
              channelInfo += `• ${cat.name}\n`;
            });
            if (template.structure.categories.length > 5) {
              channelInfo += `• ... ve ${template.structure.categories.length - 5} kategori daha\n`;
            }
          }

          if (template.structure.roles && template.structure.roles.length > 0) {
            channelInfo += '\n**🎭 Başlıca Roller:**\n';
            template.structure.roles
              .filter(role => !role.managed && role.name !== '@everyone')
              .slice(0, 5)
              .forEach(role => {
                channelInfo += `• ${role.name}\n`;
              });
          }

          if (channelInfo) {
            detailEmbed.addFields({
              name: '🏗️ Yapı Detayları',
              value: channelInfo.substring(0, 1024),
              inline: false
            });
          }
        }

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

        return ctx.reply({
          embeds: [detailEmbed],
          components: [actionRow]
        });
      }

      // Tüm şablonları listele
      const listEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('📋 Kayıtlı Şablonlar')
        .setDescription(`Bu sunucu için **${templates.length}** şablon kayıtlı.`)
        .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Detayları görmek için şablon seçin' })
        .setTimestamp();

      let templateList = '';
      templates.forEach((template, index) => {
        const createdDate = new Date(template.createdAt);
        templateList += `**${index + 1}.** ${template.name}\n`;
        templateList += `🆔 ID: \`${template.id}\`\n`;
        templateList += `📊 ${template.stats.totalChannels} kanal, ${template.stats.totalRoles} rol\n`;
        templateList += `📅 <t:${Math.floor(createdDate.getTime() / 1000)}:R>\n`;
        if (template.templateCode) {
          templateList += `🔗 [Şablonu Kullan](${template.templateUrl})\n`;
        }
        templateList += '\n';
      });

      if (templateList.length > 4096) {
        templateList = templateList.substring(0, 4000) + '...\n\n*Liste çok uzun olduğu için kısaltıldı*';
      }

      const fieldValue = templateList || 'Şablon bulunamadı';
      const safeFieldValue = fieldValue.length > 1024 ? (fieldValue.slice(0, 1000) + '... (kısaltıldı)') : fieldValue;
      listEmbed.addFields({
        name: '📋 Şablon Listesi',
        value: safeFieldValue,
        inline: false
      });

      // Şablon seçim menüsü
      const components = [];
      if (templates.length > 0 && templates.length <= 25) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('template_select')
          .setPlaceholder('Detayları görmek için şablon seçin')
          .addOptions(
            templates.map(template => ({
              label: template.name.substring(0, 100),
              description: `${template.stats.totalChannels} kanal, ${template.stats.totalRoles} rol`,
              value: template.id,
              emoji: '📋'
            }))
          );

        components.push(new ActionRowBuilder().addComponents(selectMenu));
      }

      // Yeni şablon oluştur butonu
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('➕ Yeni Şablon Oluştur')
            .setStyle(ButtonStyle.Success)
            .setCustomId('create_new_template'),
          new ButtonBuilder()
            .setLabel('🔄 Listeyi Yenile')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId('refresh_template_list')
        );

      components.push(buttonRow);

      await ctx.reply({
        embeds: [listEmbed],
        components: components
      });

    } catch (error) {
      console.error('Şablon listeleme hatası:', error);
      await ctx.reply({
        content: '❌ Şablonlar yüklenirken bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};
