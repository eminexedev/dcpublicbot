const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
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

    // En yeni ilk olacak şekilde sırala, ilk 25-30 satırı sığdır
    const sorted = [...logs].sort((a, b) => b.t - a.t);
    const lines = sorted.slice(0, 30).map(entry => {
      const when = formatTime(entry.t);
      const state = entry.action === 'add' ? 'Eklendi' : 'Kaldırıldı';
      const roleTag = `<@&${entry.roleId}>`;
      const execTag = entry.executorId ? `<@${entry.executorId}>` : 'Bilinmiyor';
      return `${when} — ${state} — ${roleTag} — Yetkili: ${execTag}`;
    });

    // Çok uzun ise bilgilendirme
    if (sorted.length > lines.length) {
      lines.push(`… ve ${sorted.length - lines.length} kayıt daha`);
    }

    embed.addFields({ name: 'Kayıtlar', value: lines.join('\n') });

    return ctx.reply({ embeds: [embed] });
  }
};
