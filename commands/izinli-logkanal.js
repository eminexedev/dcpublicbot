const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, MessageFlags } = require('discord.js');
const { setLeaveLogChannel, getLeaveLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('izinli-logkanal')
    .setDescription('İzin taleplerinin gönderileceği log kanalını ayarlar.')
    .addChannelOption(option =>
      option.setName('kanal')
        .setDescription('Log kanalı')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'config',
  description: 'İzin taleplerinin ve izin işlemlerinin loglanacağı kanalı ayarlar.',
  usage: '.izinli-logkanal #kanal',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(ctx, args) {
    // Slash mı prefix mi kontrol
    let isSlash = false;
    try {
      if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) {
        isSlash = true;
      }
    } catch {}

    const guild = ctx.guild;
    if (!guild) {
      const msg = '❌ Bu komut sadece sunucularda kullanılabilir.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Yetki kontrolü
    const executorId = ctx.user?.id || ctx.author?.id;
    const executor = await guild.members.fetch(executorId);
    if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
      const msg = '❌ Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    let channel = null;

    if (isSlash) {
      channel = ctx.options.getChannel('kanal');
    } else {
      // Prefix komut
      const raw = args && args[0];
      if (!raw) {
        // Mevcut ayarı göster
        const currentChannelId = getLeaveLogChannel(guild.id);
        if (currentChannelId) {
          const currentChannel = guild.channels.cache.get(currentChannelId);
          const infoEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Mevcut İzin Log Kanalı')
            .setDescription(currentChannel ? `<#${currentChannel.id}>` : `Kanal silinmiş (ID: ${currentChannelId})`)
            .setFooter({ text: 'Değiştirmek için: .izinli-logkanal #yeniKanal' })
            .setTimestamp();
          return ctx.reply({ embeds: [infoEmbed] });
        }
        return ctx.reply('❌ Kullanım: `.izinli-logkanal #kanal` veya `.izinli-logkanal kanalID`');
      }
      
      const idMatch = raw.match(/^(?:<#)?(\d{17,20})>?$/);
      if (idMatch) {
        channel = guild.channels.cache.get(idMatch[1]);
      }
    }

    if (!channel) {
      const msg = '❌ Geçerli bir kanal belirtmelisin.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    // Text tabanlı kanal kontrolü
    const isTextLike = channel.isTextBased && channel.isTextBased();
    if (!isTextLike || channel.type === ChannelType.GuildVoice) {
      const msg = '❌ Lütfen metin tabanlı (text/announcement) bir kanal seç.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }

    try {
      setLeaveLogChannel(guild.id, channel.id);

      console.log(`✅ İzinli log kanalı ayarlandı: ${guild.name} -> #${channel.name}`);

      const successEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ İzin Log Kanalı Ayarlandı')
        .setDescription(`İzin talepleri artık <#${channel.id}> kanalına gönderilecek.`)
        .addFields(
          {
            name: '📺 Kanal',
            value: `<#${channel.id}>`,
            inline: true
          },
          {
            name: '📋 Bilgi',
            value: 'İzin talepleri, izin başlangıçları ve izin bitişleri bu kanala loglanacak.',
            inline: false
          }
        )
        .setTimestamp();

      if (isSlash) return ctx.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      return ctx.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('İzinli log kanal ayarlama hatası:', error);
      const msg = '❌ Kanal ayarlanırken bir hata oluştu.';
      if (isSlash) return ctx.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return ctx.reply(msg);
    }
  }
};
