const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setStatsChannel } = require('../statsConfig');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('istatistikkanal')
    .setDescription('Üye veya aktif kullanıcı sayısını gösterecek yeni kanal oluşturur ve ismini otomatik günceller.')
    .addStringOption(option =>
      option.setName('tip').setDescription('Göstergesi (uye/aktif)').setRequired(true)
        .addChoices(
          { name: 'Üye Sayısı', value: 'uye' },
          { name: 'Aktif Kullanıcı', value: 'aktif' }
        )
    )
    .addStringOption(option =>
      option.setName('kanalturu').setDescription('Kanal türü').setRequired(true)
        .addChoices(
          { name: 'Metin Kanalı', value: 'text' },
          { name: 'Ses Kanalı', value: 'voice' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(ctx) {
    let tip, kanalturu, channel, guild, reply;
    if (ctx.options) {
      tip = ctx.options.getString('tip');
      kanalturu = ctx.options.getString('kanalturu');
      guild = ctx.guild;
      reply = (msg) => ctx.reply(msg);
    } else if (ctx.message) {
      guild = ctx.guild;
      // .istatistikkanal uye/aktif text/voice
      if (!ctx.args[0] || !ctx.args[1]) return ctx.message.reply('Kullanım: .istatistikkanal uye/aktif text/voice');
      tip = ctx.args[0];
      kanalturu = ctx.args[1];
      reply = (msg) => ctx.message.reply(msg);
    } else {
      return;
    }
    if (!['uye','aktif'].includes(tip) || !['text','voice'].includes(kanalturu)) {
      return reply({ content: 'Geçerli tip (uye/aktif) ve kanal türü (text/voice) belirtmelisin.', ephemeral: true });
    }
    if (kanalturu === 'text') {
      channel = await guild.channels.create({
        name: tip === 'uye' ? 'üye-sayısı-0' : 'aktif-kullanıcı-0',
        type: ChannelType.GuildText,
        reason: 'İstatistik kanalı oluşturuldu.'
      });
    } else if (kanalturu === 'voice') {
      channel = await guild.channels.create({
        name: tip === 'uye' ? 'Üye: 0' : 'Aktif: 0',
        type: ChannelType.GuildVoice,
        reason: 'İstatistik kanalı oluşturuldu.'
      });
    }
    setStatsChannel(guild.id, tip, channel.id);
    await reply({ content: `Başarıyla yeni kanal oluşturuldu: ${channel} (${tip === 'uye' ? 'Üye Sayısı' : 'Aktif Kullanıcı'})` });
  }
};
