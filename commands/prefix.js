const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPrefix, setPrefix } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Sunucu prefix\'ini gösterir veya değiştirir')
    .addStringOption(o =>
      o.setName('yeni')
        .setDescription('Yeni prefix (1-5 karakter)')
        .setMinLength(1)
        .setMaxLength(5)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  name: 'prefix',
  description: 'Prefix görüntüle/değiştir (slash + prefix)',
  usage: '/prefix [yeni] veya <mevcutPrefix>prefix [yeni]',
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(ctx, args) {
    // Slash mı prefix mi?
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}

    const guild = ctx.guild || (ctx.message && ctx.message.guild);
    if (!guild) {
      const msg = 'Sunucu bağlamı bulunamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    const current = getPrefix(guild.id);

    // Yetki kontrolü sadece değiştirme yapılacaksa gerek
    const member = guild.members.cache.get(isSlash ? ctx.user.id : ctx.author.id);
    const hasPerm = member?.permissions.has(PermissionFlagsBits.ManageGuild);

    let newPrefix = null;
    if (isSlash) {
      if (ctx.options && typeof ctx.options.getString === 'function') {
        newPrefix = ctx.options.getString('yeni');
      }
    } else {
      // Prefix çağrısı: args bekleniyor (commandHandler args gönderiyor)
      if (Array.isArray(args) && args.length > 0) {
        newPrefix = args[0];
      }
    }

    // Sadece göster
    if (!newPrefix) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📝 Prefix Bilgisi')
        .setDescription(`Mevcut prefix: \`${current}\``)
        .addFields(
          { name: 'Örnekler', value: `\`${current}ban @kullanıcı\`\n\`${current}kick @kullanıcı\``, inline: true },
          { name: 'Değiştirme (Slash)', value: '`/prefix yeni:<prefix>`', inline: true },
          { name: 'Değiştirme (Prefix)', value: `\`${current}prefix !\``, inline: false }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    }

    // Yetki kontrolü
    if (!hasPerm) {
      const msg = '❌ Prefix değiştirmek için "Sunucuyu Yönet" izni gerekir.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    newPrefix = newPrefix.trim();
    if (newPrefix.length < 1 || newPrefix.length > 5) {
      const msg = '❌ Prefix uzunluğu 1-5 karakter olmalı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (/\s/.test(newPrefix)) {
      const msg = '❌ Prefix boşluk içeremez.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
    if (newPrefix === current) {
      const msg = '❌ Girdiğin prefix zaten kullanılıyor.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    try {
      setPrefix(guild.id, newPrefix);
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Prefix Güncellendi')
        .addFields(
          { name: 'Eski', value: `\`${current}\``, inline: true },
          { name: 'Yeni', value: `\`${newPrefix}\``, inline: true },
          { name: 'Örnekler', value: `\`${newPrefix}ban @kullanıcı\`\n\`${newPrefix}kick @kullanıcı\``, inline: false }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();
      return isSlash ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Prefix ayarlama hatası:', err);
      const msg = '❌ Prefix ayarlanırken bir hata oluştu.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }
  }
};