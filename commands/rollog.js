const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const statsPath = path.join(__dirname, '../statsData.json');

function loadStats() {
  if (!fs.existsSync(statsPath)) return {};
  try { return JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch { return {}; }
}

function formatTime(ts) {
  const s = Math.floor(ts / 1000);
  return `<t:${s}:f> • <t:${s}:R>`; // tam tarih ve relatif
}

function parseId(str, key) {
  const m = str.match(new RegExp(`${key}=([^;]+)`));
  return m ? m[1] : null;
}

function buildCustomId(guildId, targetId, ownerId, page, pageSize) {
  return `rollog:g=${guildId};t=${targetId};o=${ownerId};p=${page};s=${pageSize}`;
}

function buildComponents(guildId, targetId, ownerId, page, totalPages, pageSize) {
  const prevId = buildCustomId(guildId, targetId, ownerId, Math.max(1, page - 1), pageSize);
  const nextId = buildCustomId(guildId, targetId, ownerId, Math.min(totalPages, page + 1), pageSize);
  const prev = new ButtonBuilder().setCustomId(prevId).setLabel('‹ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
  const next = new ButtonBuilder().setCustomId(nextId).setLabel('Sonraki ›').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages);
  return [new ActionRowBuilder().addComponents(prev, next)];
}

function buildPageEmbed(guild, targetUser, logs, page, pageSize) {
  const total = logs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  const slice = logs.slice(start, start + pageSize);

  const lines = slice.map(entry => {
    const when = formatTime(entry.t);
    const state = entry.action === 'add' ? 'Eklendi' : 'Kaldırıldı';
    const roleTag = `<@&${entry.roleId}>`;
    const execTag = entry.executorId ? `<@${entry.executorId}>` : 'Bilinmiyor';
    return `${when} — ${state} — ${roleTag} — Yetkili: ${execTag}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Rol İşlem Geçmişi')
    .setColor(0x5865F2)
    .setDescription(`${targetUser} kullanıcısının geçmişte ve şimdiki zamanda verilen/kaldırılan roller`)
    .setTimestamp(new Date())
    .setFooter({ text: `Sayfa ${p}/${totalPages} • Toplam ${total} kayıt` });

  if (lines.length === 0) {
    embed.addFields({ name: 'Kayıtlar', value: 'Kayıt bulunamadı.' });
  } else {
    // Her sayfada tek alan kullan (1024 limiti için sayfa başına 10 satır güvenli)
    const value = lines.join('\n');
    embed.addFields({ name: 'Kayıtlar', value: value.length > 1024 ? value.slice(0, 1000) + '\n… (kısaltıldı)' : value });
  }

  return { embed, page: p, totalPages };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rollog')
    .setDescription('Bir kullanıcının geçmiş rol ekleme/kaldırma logunu gösterir')
    .addUserOption(o => o.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(ctx, args) {
    const isSlash = typeof ctx.isCommand === 'function' ? ctx.isCommand() : false;
    const guild = ctx.guild || ctx.message?.guild;
    if (!guild) return ctx.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });

    // Yetki kontrolü (prefix için de uygula)
    const member = isSlash ? guild.members.cache.get(ctx.user.id) : ctx.member;
    if (!member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
      return ctx.reply({ content: '❌ Bu komutu kullanmak için Manage Roles yetkisine ihtiyaç var.', ephemeral: isSlash });
    }

    // Hedef kullanıcıyı çöz
    let target = null;
    if (isSlash) {
      target = ctx.options.getUser('kullanici');
    } else {
      const mention = ctx.message.mentions.users.first();
      if (mention) target = mention;
      else if (args[0]) {
        const id = args[0].replace(/[^0-9]/g, '');
        if (id) target = await guild.client.users.fetch(id).catch(() => null);
      }
    }
    if (!target) {
      return ctx.reply({ content: 'Kullanım: (prefix)rollog @kullanıcı | /rollog kullanici:@kullanıcı', ephemeral: isSlash });
    }

    // Veriyi oku
    const stats = loadStats();
    const g = stats[guild.id] || {};
    const logs = (g.roleLogs && g.roleLogs[target.id]) || [];

    // Embed oluştur
    const embed = new EmbedBuilder()
      .setTitle('Rol İşlem Geçmişi')
      .setColor(0x5865F2)
      .setDescription(`${target} kullanıcısının geçmişte ve şimdiki zamanda verilen/kaldırılan roller`)
      .setTimestamp(new Date());

    if (!logs.length) {
      embed.setDescription(`${target} için kayıtlı rol hareketi bulunamadı.`);
      return ctx.reply({ embeds: [embed] });
    }

    // En yeni ilk olacak şekilde sırala ve sayfalı göster
    const sorted = [...logs].sort((a, b) => b.t - a.t);
    const pageSize = 10;
    const { embed: firstEmbed, page, totalPages } = buildPageEmbed(guild, target, sorted, 1, pageSize);
    const components = buildComponents(guild.id, target.id, (isSlash ? ctx.user.id : ctx.author.id), page, totalPages, pageSize);
    return ctx.reply({ embeds: [firstEmbed], components });
  },

  // Sayfalama butonları
  async handleButton(interaction) {
    try {
      if (!interaction.customId?.startsWith('rollog:')) return;
      const guild = interaction.guild;
      const gid = parseId(interaction.customId, 'g');
      const targetId = parseId(interaction.customId, 't');
      const ownerId = parseId(interaction.customId, 'o');
      const pageStr = parseId(interaction.customId, 'p');
      const sizeStr = parseId(interaction.customId, 's');
      const page = Math.max(1, parseInt(pageStr || '1', 10));
      const pageSize = Math.max(1, Math.min(20, parseInt(sizeStr || '10', 10)));

      // Güvenlik: sadece komutu çağıran gezebilsin
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: 'Bu sayfayı sadece komutu kullanan kişi gezebilir.', ephemeral: true });
      }
      if (!guild || guild.id !== gid) {
        return interaction.reply({ content: 'Geçersiz bağlam.', ephemeral: true });
      }

      // Veriyi oku ve render et
      const stats = loadStats();
      const g = stats[guild.id] || {};
      const logs = (g.roleLogs && g.roleLogs[targetId]) || [];
      const sorted = [...logs].sort((a, b) => b.t - a.t);

      const targetUser = await guild.client.users.fetch(targetId).catch(() => ({ id: targetId, toString: () => `<@${targetId}>` }));
      const { embed, totalPages } = buildPageEmbed(guild, targetUser, sorted, page, pageSize);
      const components = buildComponents(guild.id, targetId, ownerId, page, totalPages, pageSize);
      return interaction.update({ embeds: [embed], components });
    } catch (e) {
      console.warn('[rollog.handleButton] Hata:', e.message);
      if (!interaction.replied) {
        return interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
      }
    }
  }
};
