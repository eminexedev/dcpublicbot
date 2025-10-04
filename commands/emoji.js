const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Sunucuya yeni emoji ekler.')
    .addStringOption(option =>
      option.setName('isim').setDescription('Eklenecek emojinin ismi').setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('gorsel').setDescription('Emoji görseli (PNG, JPG, GIF)').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('url').setDescription('Emoji görselinin Discord CDN linki').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),
  async execute(interaction) {
    const guild = interaction.guild;
    
    const isim = interaction.options.getString('isim');
    const gorsel = interaction.options.getAttachment('gorsel');
    const url = interaction.options.getString('url');
    
    if (!gorsel && !url) {
      return interaction.reply({
        content: '❌ Emoji eklemek için bir görsel (attachment) veya URL belirtmelisin.',
        ephemeral: true
      });
    }

    let attachmentUrl = null;
    if (url && url.startsWith('http')) {
      attachmentUrl = url;
    } else if (gorsel && gorsel.url) {
      attachmentUrl = gorsel.url;
    }

    if (!attachmentUrl) {
      return interaction.reply({
        content: '❌ Bir görsel dosyası eklemeli veya geçerli bir link vermelisin.',
        ephemeral: true
      });
    }

    try {
      const emoji = await guild.emojis.create({
        name: isim,
        attachment: attachmentUrl
      });
      
      return interaction.reply({
        content: `✅ Emoji başarıyla eklendi: <:${emoji.name}:${emoji.id}>`,
        ephemeral: false
      });
    } catch (err) {
      return interaction.reply({
        content: `❌ Emoji eklenirken hata oluştu: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
