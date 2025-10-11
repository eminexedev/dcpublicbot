const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function readStatsSafe() {
  try {
    const p = path.join(__dirname, '..', 'statsData.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function formatDuration(sec) {
  if (!sec || sec <= 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts = [];
  if (h) parts.push(`${h}sa`);
  if (m) parts.push(`${m}dk`);
  if (s && parts.length < 2) parts.push(`${s}sn`);
  return parts.join(' ') || `${s}sn`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nerede')
    .setDescription('Bir kullanıcının şu anki ve geçmişteki ses kanalı bilgilerini gösterir')
    .addUserOption(opt =>
      opt.setName('kullanici')
        .setDescription('Sorgulanacak kullanıcı')
        .setRequired(true)
    ),

  name: 'nerede',
  description: 'Kullanıcının şu an nerede olduğunu ve geçmişte en çok bulunduğu ses kanallarını gösterir.',
  usage: '.nerede @kullanıcı | .n @kullanıcı | .nerede kullanıcıID',

  async execute(ctx, args) {
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}

    const guild = ctx.guild || ctx.message?.guild;
    if (!guild) return ctx.reply({ content: 'Sunucu bağlamı bulunamadı.', ephemeral: isSlash });

    // Hedef kullanıcıyı al
    let targetId = null;
    if (isSlash) {
      const u = ctx.options?.getUser('kullanici');
      targetId = u?.id || null;
    } else {
      const raw = args?.[0];
      if (!raw) return ctx.reply('Kullanım: `.nerede @kullanıcı` veya `.n @kullanıcı` veya `kullanıcıID`');
      const m = raw.match(/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/);
      targetId = m ? (m[1] || m[2]) : null;
    }
    if (!targetId) return ctx.reply(isSlash ? { content: 'Geçerli bir kullanıcı belirtmelisin.', ephemeral: true } : 'Geçerli bir kullanıcı belirtmelisin.');

    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) return ctx.reply(isSlash ? { content: 'Hedef kullanıcı bulunamadı.', ephemeral: true } : 'Hedef kullanıcı bulunamadı.');

    // Embed
    const embed = new EmbedBuilder()
      .setColor('#2f3136')
      .setAuthor({ name: `${member.user.tag}`, iconURL: member.user.displayAvatarURL({ size: 128 }) })
      .setTitle('Ses Kanalı Bilgisi')
      .setTimestamp();

    // Şu anki durum
    const vc = member.voice?.channel;
    if (vc) {
      const deaf = !!(member.voice.selfDeaf || member.voice.deaf);
      const mute = !!(member.voice.selfMute || member.voice.mute);
      const camera = !!member.voice.selfVideo;
      const stream = !!member.voice.streaming;

      // Mevcut oturum süresi (varsa)
      let currentDur = null;
      try {
        const key = `${guild.id}-${member.id}`;
        const st = ctx.client?.activeVoiceStates?.get(key);
        if (st?.joinTime) currentDur = Math.floor((Date.now() - st.joinTime) / 1000);
      } catch {}

      let nowText = `• **Kanal:** <#${vc.id}>\n`;
      if (currentDur) nowText += `• **Süre:** ${formatDuration(currentDur)}\n`;
      nowText += `• **Kulaklık:** ${deaf ? 'Kapalı' : 'Açık'}\n`;
      nowText += `• **Mikrofon:** ${mute ? 'Kapalı' : 'Açık'}\n`;
      nowText += `• **Kamera:** ${camera ? 'Açık' : 'Kapalı'}\n`;
      nowText += `• **Yayın:** ${stream ? 'Açık' : 'Kapalı'}`;

      embed.addFields({ name: 'Şu An', value: nowText, inline: false });
    } else {
      embed.addFields({ name: 'Şu An', value: 'Seste değil', inline: false });
    }

    // Geçmiş: en çok vakit geçirilen kanallar (top 3)
    const stats = readStatsSafe();
    const g = stats[guild.id];
    let pastText = 'Veri yok';
    if (g && g.userVoiceData && g.userVoiceData[targetId]) {
      const arr = Object.entries(g.userVoiceData[targetId]) // [channelId, seconds]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      if (arr.length > 0) {
        pastText = arr.map(([cid, secs], idx) => `${idx + 1}. <#${cid}> — ${formatDuration(secs)}`).join('\n');
      }
    }
    embed.addFields({ name: 'Geçmiş (En çok geçirilen)', value: pastText, inline: false });

    // Geçmiş: son görülme (kanallara en son giriş zamanı)
    let lastSeenText = 'Veri yok';
    if (g && g.voiceSessions && Array.isArray(g.voiceSessions[targetId])) {
      // En yeniye göre sırala
      const sessions = [...g.voiceSessions[targetId]]
        .filter(s => s && s.channelId && s.startTime)
        .sort((a, b) => b.startTime - a.startTime);
      const nowChannelId = vc?.id;
      const seenByChannel = new Map();
      for (const s of sessions) {
        if (nowChannelId && s.channelId === nowChannelId) continue; // şu anki kanal varsa geçmişteki tekrarını atla
        if (!seenByChannel.has(s.channelId)) {
          seenByChannel.set(s.channelId, s.startTime);
        }
        if (seenByChannel.size >= 3) break;
      }
      if (seenByChannel.size > 0) {
        let i = 0;
        lastSeenText = Array.from(seenByChannel.entries())
          .map(([cid, ts]) => `${++i}. <#${cid}> — <t:${Math.floor(ts / 1000)}:R>`) // örn: 1 saat önce
          .join('\n');
      }
    }
    embed.addFields({ name: 'Geçmiş (Son görülme)', value: lastSeenText, inline: false });

    const content = { embeds: [embed] };
    return isSlash ? ctx.reply(content) : ctx.reply(content);
  }
};
