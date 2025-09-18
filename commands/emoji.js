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
    let isim, gorsel, url, guild, reply;
    if (ctx.options) {
      isim = ctx.options.getString('isim');
      gorsel = ctx.options.getAttachment('gorsel');
      url = ctx.options.getString('url');
      guild = ctx.guild;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      guild = ctx.guild;
      isim = ctx.args[0];
      url = ctx.args[1] && ctx.args[1].startsWith('http') ? ctx.args[1] : null;
      gorsel = ctx.message.attachments.first();
      reply = (msg) => ctx.message.reply(msg);
      if (!isim || (!gorsel && !url)) {
        return ctx.message.reply('Kullanım: /emoji isim:[isim] gorsel:[dosya] veya /emoji isim url:[link]');
      }
    } else {
      return;
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
