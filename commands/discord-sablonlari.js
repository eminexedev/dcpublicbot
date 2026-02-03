const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('discord-şablonları')
    .setDescription('Discord şablonlarını yönetir (resmi Discord şablonları)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('listele')
        .setDescription('Sunucudaki Discord şablonlarını listeler')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sil')
        .setDescription('Belirtilen Discord şablonunu siler')
        .addStringOption(option =>
          option.setName('kod')
            .setDescription('Silinecek şablonun kodu')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sync')
        .setDescription('Discord şablonunu güncel sunucu durumuyla senkronize eder')
        .addStringOption(option =>
          option.setName('kod')
            .setDescription('Senkronize edilecek şablonun kodu')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'admin',
  description: 'Discord\'un resmi şablon sistemini yönetir.',
  usage: '/discord-şablonları <alt-komut>',
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(ctx, args) {
    try {
      // Yetki kontrolü
      const executorId = ctx.user?.id || ctx.author?.id;
      const executor = await ctx.guild.members.fetch(executorId);
      if (!executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return ctx.reply({
          content: '❌ Bu komutu kullanmak için "Sunucuyu Yönet" yetkisine sahip olmalısın.',
          ephemeral: true
        });
      }

      let subcommand;
      if (ctx.isCommand && ctx.isCommand()) {
        subcommand = ctx.options.getSubcommand();
      } else {
        subcommand = args[0];
        if (!subcommand) {
          return ctx.reply({
            content: '❌ Alt komut belirtmelisin: `listele`, `sil`, `sync`',
            ephemeral: true
          });
        }
      }

      // Mevcut Discord şablonlarını getir
      const templates = await ctx.guild.fetchTemplates();

      switch (subcommand) {
        case 'listele':
        case 'list':
          await handleListTemplates(ctx, templates);
          break;
        
        case 'sil':
        case 'delete':
          const deleteCode = ctx.isCommand ? ctx.options.getString('kod') : args[1];
          await handleDeleteTemplate(ctx, templates, deleteCode);
          break;
        
        case 'sync':
        case 'senkronize':
          const syncCode = ctx.isCommand ? ctx.options.getString('kod') : args[1];
          await handleSyncTemplate(ctx, templates, syncCode);
          break;
        
        default:
          return ctx.reply({
            content: '❌ Geçersiz alt komut. Kullanılabilir komutlar: `listele`, `sil`, `sync`',
            ephemeral: true
          });
      }

    } catch (error) {
      console.error('Discord şablonları yönetim hatası:', error);
      await ctx.reply({
        content: '❌ Şablon işlemi sırasında bir hata oluştu.',
        ephemeral: true
      });
    }
  }
};

async function handleListTemplates(ctx, templates) {
  if (templates.size === 0) {
    const noTemplatesEmbed = new EmbedBuilder()
      .setColor('#F04A47')
      .setTitle('📋 Discord Şablonu Bulunamadı')
      .setDescription('Bu sunucu için henüz hiç Discord şablonu oluşturulmamış.')
      .addFields(
        {
          name: '🛠️ Şablon Oluşturmak İçin',
          value: '`/şablon-oluştur` komutunu kullanarak yeni bir şablon oluşturabilirsin.',
          inline: false
        }
      )
      .setFooter({ text: 'Discord şablonları resmi Discord özelliğidir' })
      .setTimestamp();

    return ctx.reply({ embeds: [noTemplatesEmbed] });
  }

  const listEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📋 Discord Şablonları')
    .setDescription(`Bu sunucu için **${templates.size}** Discord şablonu mevcut.`)
    .setThumbnail(ctx.guild.iconURL({ dynamic: true }))
    .setFooter({ text: 'Discord\'un resmi şablon sistemi' })
    .setTimestamp();

  let templateList = '';
  templates.forEach((template, index) => {
    const createdDate = new Date(template.createdAt);
    const updatedDate = new Date(template.updatedAt);
    
    templateList += `**${index + 1}.** ${template.name}\n`;
    templateList += `🆔 Kod: \`${template.code}\`\n`;
    templateList += `📝 Açıklama: ${template.description || 'Açıklama yok'}\n`;
    templateList += `👤 Oluşturan: <@${template.creatorId}>\n`;
    templateList += `📅 Oluşturulma: <t:${Math.floor(createdDate.getTime() / 1000)}:R>\n`;
    templateList += `🔄 Son Güncelleme: <t:${Math.floor(updatedDate.getTime() / 1000)}:R>\n`;
    templateList += `📊 Kullanım: ${template.usageCount || 0} kez\n`;
    templateList += `🔗 [Şablonu Kullan](https://discord.new/${template.code})\n\n`;
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

  // Yönetim butonları
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('🔄 Tümünü Senkronize Et')
        .setStyle(ButtonStyle.Primary)
        .setCustomId('sync_all_templates'),
      new ButtonBuilder()
        .setLabel('🗑️ Tümünü Sil')
        .setStyle(ButtonStyle.Danger)
        .setCustomId('delete_all_templates')
    );

  await ctx.reply({
    embeds: [listEmbed],
    components: [buttonRow]
  });
}

async function handleDeleteTemplate(ctx, templates, templateCode) {
  if (!templateCode) {
    return ctx.reply({
      content: '❌ Silinecek şablonun kodunu belirtmelisin.',
      ephemeral: true
    });
  }

  const template = templates.find(t => t.code === templateCode);
  if (!template) {
    return ctx.reply({
      content: '❌ Belirtilen kodla şablon bulunamadı.',
      ephemeral: true
    });
  }

  try {
    await template.delete();
    
    const successEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ Şablon Silindi')
      .setDescription(`**${template.name}** isimli Discord şablonu başarıyla silindi.`)
      .addFields(
        {
          name: '🗑️ Silinen Şablon',
          value: `**Kod:** \`${template.code}\`\n**İsim:** ${template.name}\n**Açıklama:** ${template.description || 'Açıklama yok'}`,
          inline: false
        }
      )
      .setTimestamp();

    await ctx.reply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Şablon silme hatası:', error);
    await ctx.reply({
      content: '❌ Şablon silinirken bir hata oluştu.',
      ephemeral: true
    });
  }
}

async function handleSyncTemplate(ctx, templates, templateCode) {
  if (!templateCode) {
    return ctx.reply({
      content: '❌ Senkronize edilecek şablonun kodunu belirtmelisin.',
      ephemeral: true
    });
  }

  const template = templates.find(t => t.code === templateCode);
  if (!template) {
    return ctx.reply({
      content: '❌ Belirtilen kodla şablon bulunamadı.',
      ephemeral: true
    });
  }

  try {
    const updatedTemplate = await template.sync();
    
    const successEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🔄 Şablon Senkronize Edildi')
      .setDescription(`**${template.name}** isimli Discord şablonu güncel sunucu durumuyla senkronize edildi.`)
      .addFields(
        {
          name: '🔄 Güncellenen Şablon',
          value: `**Kod:** \`${template.code}\`\n**İsim:** ${template.name}\n**Son Güncelleme:** <t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false
        },
        {
          name: '🔗 Şablon Linki',
          value: `[Güncel Şablonu Kullan](https://discord.new/${template.code})`,
          inline: false
        }
      )
      .setTimestamp();

    await ctx.reply({ embeds: [successEmbed] });

  } catch (error) {
    console.error('Şablon senkronizasyon hatası:', error);
    await ctx.reply({
      content: '❌ Şablon senkronize edilirken bir hata oluştu.',
      ephemeral: true
    });
  }
}
