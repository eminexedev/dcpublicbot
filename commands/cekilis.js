const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAutoLogChannel } = require('../config');

// Çekiliş verilerini tutmak için
const giveaways = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Gelişmiş çekiliş başlatır.')
    .addStringOption(option =>
      option.setName('odul').setDescription('Çekiliş ödülü').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('sure').setDescription('Süre (dakika)').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('kazanan').setDescription('Kazanan sayısı').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(ctx) {
    let odul, sure, kazananSayisi, reply, channel, userTag;
    if (ctx.options) {
      odul = ctx.options.getString('odul');
      sure = ctx.options.getInteger('sure');
      kazananSayisi = ctx.options.getInteger('kazanan');
      reply = (msg) => ctx.reply(msg);
      channel = ctx.channel;
      userTag = ctx.user.tag;
    } else if (ctx.message) {
      if (!ctx.args[0] || !ctx.args[1] || !ctx.args[2]) return ctx.message.reply('Kullanım: .cekilis ödül süre(dk) kazananSayısı');
      odul = ctx.args[0];
      sure = parseInt(ctx.args[1]);
      kazananSayisi = parseInt(ctx.args[2]);
      if (isNaN(sure) || isNaN(kazananSayisi)) return ctx.message.reply('Süre ve kazanan sayısı sayı olmalı.');
      reply = (msg) => ctx.message.reply(msg);
      channel = ctx.channel;
      userTag = ctx.author.tag;
    } else {
      return;
    }
    if (!odul || !sure || !kazananSayisi) {
      return reply({ content: 'Tüm alanları doldurmalısın.', ephemeral: true });
    }
    if (sure < 1 || kazananSayisi < 1) {
      return reply({ content: 'Süre ve kazanan sayısı 1 veya daha büyük olmalı.', ephemeral: true });
    }
    const bitis = Date.now() + sure * 60 * 1000;
    const embed = new EmbedBuilder()
      .setTitle('🎉 Çekiliş Başladı!')
      .setDescription(`Ödül: **${odul}**\nKazanan: **${kazananSayisi}** kişi\nBitiş: <t:${Math.floor(bitis/1000)}:R>\nKatılmak için aşağıdaki butona tıkla!`)
      .setColor('#FFD700')
      .setFooter({ text: `Çekilişi başlatan: ${userTag}` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_giveaway')
        .setLabel('Katıl 🎉')
        .setStyle(ButtonStyle.Success)
    );
    const msg = await reply({ embeds: [embed], components: [row], fetchReply: true });
    giveaways.set(msg.id, { participants: new Set(), kazananSayisi, odul, bitis, message: msg, channel });
    setTimeout(async () => {
      const data = giveaways.get(msg.id);
      if (!data) return;
      const katilanlar = Array.from(data.participants);
      if (katilanlar.length === 0) {
        await data.message.edit({ embeds: [embed.setDescription('Yeterli katılım olmadı, çekiliş iptal edildi.')], components: [] });
        return;
      }
      const winners = [];
      while (winners.length < data.kazananSayisi && katilanlar.length > 0) {
        const idx = Math.floor(Math.random() * katilanlar.length);
        winners.push(`<@${katilanlar[idx]}>`);
        katilanlar.splice(idx, 1);
      }
      await data.message.edit({ embeds: [embed.setDescription(`Kazananlar: ${winners.join(', ')}\nÖdül: **${data.odul}**`)], components: [] });
      await data.channel.send({ content: `🎉 Çekiliş sonuçlandı! Kazananlar: ${winners.join(', ')} | Ödül: **${data.odul}**` });
      for (const winnerMention of winners) {
        const userId = winnerMention.replace(/<@!?([0-9]+)>/, '$1');
        const user = await data.channel.guild.members.fetch(userId).then(m => m.user).catch(() => null);
        if (user) {
          user.send(`🎉 Tebrikler! **${data.odul}** ödüllü çekilişi kazandın!`).catch(() => {});
        }
      }
      giveaways.delete(msg.id);
    }, sure * 60 * 1000);
  },
  async handleButton(interaction) {
    const data = giveaways.get(interaction.message.id);
    if (!data) return interaction.reply({ content: 'Bu çekiliş sona ermiş.', ephemeral: true });
    if (data.participants.has(interaction.user.id)) {
      return interaction.reply({ content: 'Zaten katıldın!', ephemeral: true });
    }
    data.participants.add(interaction.user.id);
    await interaction.reply({ content: 'Çekilişe başarıyla katıldın!', ephemeral: true });
  }
};
