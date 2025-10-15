const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { addInfraction, getUserInfractions, getCountsByType } = require('../utils/infractions');

function fmtDuration(min) {
  if (!min || min <= 0) return '—';
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}s ${m}dk` : `${h}s`;
}

function buildPageEmbed(guild, targetUser, infractions, page, pageSize) {
  const total = infractions.length;
  const start = page * pageSize;
  const slice = infractions.slice(start, start + pageSize);
  const e = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Sicil Bilgileri — ${targetUser.tag || targetUser.username || targetUser.id}`)
    .setThumbnail(targetUser.displayAvatarURL?.({ dynamic: true }) || null)
    .setFooter({ text: `${guild.name} • Sayfa ${page + 1}/${Math.max(1, Math.ceil(total / pageSize))}` })
    .setTimestamp();

  if (!total) {
    e.setDescription('Kayıt bulunamadı.');
    return e;
  }

  for (const rec of slice) {
    const when = Math.floor((rec.t || Date.now()) / 1000);
    const typeEmoji = rec.type === 'ban' ? '🔨' :
                      rec.type === 'unban' ? '🔓' :
                      rec.type === 'kick' ? '👢' :
                      rec.type === 'mute' ? '🔇' :
                      rec.type === 'unmute' ? '🔊' :
                      rec.type === 'jail' ? '🔒' :
                      rec.type === 'unjail' ? '🔓' : '📌';
    e.addFields({
      name: `${typeEmoji} ${rec.type?.toUpperCase?.() || 'KAYIT'} • <t:${when}:R>`,
      value:
        `• Sebep: ${rec.reason || '—'}\n` +
        `• Süre: ${fmtDuration(rec.durationMin)}\n` +
        (rec.executorId ? `• Yetkili: <@${rec.executorId}> (\`${rec.executorId}\`)\n` : '') +
        `• Zaman: <t:${when}:F>`
    });
  }
  return e;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sicil')
    .setDescription('Bir üyenin moderasyon sicilini gösterir.')
    .addUserOption(o => o.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  description: 'Bir üyenin ban/kick/mute/jail geçmişini listeler. .sicil @kullanici',
  usage: '.sicil @kullanici',
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(ctx, args) {
    const isSlash = typeof ctx.isCommand === 'function' ? ctx.isCommand() : !!ctx.options;
    const guild = ctx.guild || ctx.message?.guild;
    const invoker = isSlash ? ctx.user : ctx.author;
    const reply = (msg) => ctx.reply(msg);

    // Yetki kontrolü
    const executorMember = await guild.members.fetch(invoker.id).catch(() => null);
    if (!executorMember?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return reply({ content: '❌ Bu komutu kullanmak için "Üyeleri Zaman Aşımına Uğrat" yetkisine sahip olmalısınız.', ephemeral: isSlash });
    }

    // Hedef kullanıcı
    let user = null;
    if (isSlash) {
      user = ctx.options.getUser('kullanici');
    } else {
      if (!args || args.length === 0) {
        return ctx.message.reply('Bir kullanıcı etiketlemelisin veya ID girmelisin.');
      }
      const idMatch = args[0].match(/(\d{17,})/);
      const userId = idMatch ? idMatch[1] : null;
      if (userId) user = await guild.client.users.fetch(userId).catch(() => null);
    }
    if (!user) return reply({ content: 'Kullanıcı bulunamadı.', ephemeral: isSlash });

    // Kayıtları oku
    const all = getUserInfractions(guild.id, user.id);
    const sorted = [...all].sort((a, b) => (b.t || 0) - (a.t || 0));
    const counts = getCountsByType(guild.id, user.id);

    // Özet başlık
    const header = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle(`Sicil Detay — ${user.tag || user.username || user.id}`)
      .setThumbnail(user.displayAvatarURL?.({ dynamic: true }) || null)
      .addFields(
        { name: 'Toplam Kayıt', value: String(sorted.length), inline: true },
        { name: 'Ban', value: String(counts.ban || 0), inline: true },
        { name: 'Kick', value: String(counts.kick || 0), inline: true },
        { name: 'Mute', value: String(counts.mute || 0), inline: true },
        { name: 'Unmute', value: String(counts.unmute || 0), inline: true },
        { name: 'Jail', value: String(counts.jail || 0), inline: true },
        { name: 'Unjail', value: String(counts.unjail || 0), inline: true },
      )
      .setFooter({ text: guild.name })
      .setTimestamp();

    const pageSize = 5;
    let page = 0;
    const embed = buildPageEmbed(guild, user, sorted, page, pageSize);

    // Sayfalama butonları
    const prev = new ButtonBuilder().setCustomId(`sicil:prev:${guild.id}:${user.id}`).setStyle(ButtonStyle.Secondary).setEmoji('◀️');
    const next = new ButtonBuilder().setCustomId(`sicil:next:${guild.id}:${user.id}`).setStyle(ButtonStyle.Secondary).setEmoji('▶️');
    const row = new ActionRowBuilder().addComponents(prev, next);

    const msg = await reply({ embeds: [header, embed], components: [row], flags: isSlash ? MessageFlags.Ephemeral : undefined });
  },

  // Butonlar
  async handleButton(interaction) {
    if (!interaction.customId?.startsWith('sicil:')) return;
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const guildId = parts[2];
    const userId = parts[3];
    if (!guildId || !userId || interaction.guild?.id !== guildId) {
      return interaction.reply({ content: 'Geçersiz istek.', ephemeral: true });
    }

    try { await interaction.deferUpdate(); } catch {}

    const all = getUserInfractions(guildId, userId);
    const sorted = [...all].sort((a, b) => (b.t || 0) - (a.t || 0));
    const pageSize = 5;

    // Mevcut sayfayı embed footer'ından tahmin etmek yerine, mesajdaki 2. embed üzerinden başlık bilgisi alınamazsa varsayım yapacağız.
    // Kolaylık için mesajda sayfa bilgisini izlemeden ileri/geri kaydıracağız.
    // Bu nedenle buton tıklandığında, mesajdaki ikinci embed'in footer text'inden sayfayı çıkarma denemesi:
    let currentPage = 0;
    try {
      const second = interaction.message.embeds?.[1];
      if (second && second.footer && typeof second.footer.text === 'string') {
        const m = second.footer.text.match(/Sayfa\s(\d+)\/(\d+)/);
        if (m) currentPage = Math.max(0, parseInt(m[1], 10) - 1);
      }
    } catch {}

    if (action === 'next') currentPage++;
    if (action === 'prev') currentPage--;
    const maxPage = Math.max(0, Math.ceil(sorted.length / pageSize) - 1);
    if (currentPage < 0) currentPage = 0;
    if (currentPage > maxPage) currentPage = maxPage;

    const user = await interaction.client.users.fetch(userId).catch(() => ({ id: userId, username: 'Bilinmiyor' }));
    const embed = buildPageEmbed(interaction.guild, user, sorted, currentPage, pageSize);

    const prev = new ButtonBuilder().setCustomId(`sicil:prev:${guildId}:${userId}`).setStyle(ButtonStyle.Secondary).setEmoji('◀️');
    const next = new ButtonBuilder().setCustomId(`sicil:next:${guildId}:${userId}`).setStyle(ButtonStyle.Secondary).setEmoji('▶️');
    const row = new ActionRowBuilder().addComponents(prev, next);

    await interaction.editReply({ embeds: [interaction.message.embeds?.[0], embed], components: [row] }).catch(async () => {
      // Fallback: mesaj düzenlenemiyorsa reply
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    });
  }
};
