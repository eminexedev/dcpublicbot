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
  async execute(ctx) {
    const { guild, reply } = ctx;
    let isim, gorsel, url;
    
    if (ctx.type === 'slash') {
      isim = ctx.interaction.options.getString('isim');
      gorsel = ctx.interaction.options.getAttachment('gorsel');
      url = ctx.interaction.options.getString('url');
    } else {
      isim = ctx.args[0];
      url = ctx.args[1] && ctx.args[1].startsWith('http') ? ctx.args[1] : null;
      gorsel = ctx.message.attachments.first();
      if (!isim || (!gorsel && !url)) {
        return reply('Kullanım: /emoji isim:[isim] gorsel:[dosya] veya /emoji isim url:[link]');
      }
    }
    if (!guild) return reply('Sunucu bulunamadı.');
    let attachmentUrl = null;
    if (url && url.startsWith('http')) {
      attachmentUrl = url;
    } else if (gorsel && gorsel.url) {
      attachmentUrl = gorsel.url;
    }
    if (!attachmentUrl) return reply('Bir görsel dosyası eklemeli veya geçerli bir link vermelisin.');
    try {
      const emoji = await guild.emojis.create({
        name: isim,
        attachment: attachmentUrl
      });
      return reply(`Emoji başarıyla eklendi: <:${emoji.name}:${emoji.id}>`);
    } catch (err) {
      return reply(`Emoji eklenirken hata oluştu: ${err.message}`);
    }
  }
};
