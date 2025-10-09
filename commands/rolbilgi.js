const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolbilgi')
    .setDescription('Etiketlenen roldeki üyeleri ve bulundukları ses kanalını listeler.')
    .addRoleOption(opt =>
      opt.setName('rol')
        .setDescription('Bilgisi gösterilecek rol')
        .setRequired(true)
    ),

  category: 'info',
  description: 'Roldeki üyeleri ve hangi ses kanalında olduklarını listeler.',
  usage: '.rolbilgi @rol | /rolbilgi rol:@rol',

  async execute(ctx, args) {
    // Slash mı prefix mi?
    let isSlash = false;
    try { if (typeof ctx.isChatInputCommand === 'function' && ctx.isChatInputCommand()) isSlash = true; } catch {}

    const guild = ctx.guild || ctx.message?.guild;
    if (!guild) {
      const msg = 'Sunucu bağlamı bulunamadı.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // Rolü al
    let role = null;
    if (isSlash) {
      role = ctx.options?.getRole('rol') || null;
    } else {
      const raw = args?.[0];
      if (!raw) return ctx.reply('Kullanım: `.rolbilgi @rol` veya `.rolbilgi rolID`');
      const idMatch = raw.match(/^(?:<@&?(\d{17,20})>|(\d{17,20}))$/);
      const roleId = idMatch ? (idMatch[1] || idMatch[2]) : null;
      if (roleId) role = guild.roles.cache.get(roleId) || null;
    }

    if (!role) {
      const msg = 'Geçerli bir rol belirtmelisin.';
      return isSlash ? ctx.reply({ content: msg, ephemeral: true }) : ctx.reply(msg);
    }

    // @everyone (guild.id) uyarısı: çok büyük olabilir
    const isEveryone = role.id === guild.id;
    let members = [];
    try {
      // Tüm üyeleri cache'e al (GuildMembers intent gerekli)
      await guild.members.fetch();
      if (isEveryone) {
        members = Array.from(guild.members.cache.values());
      } else {
        members = Array.from(guild.members.cache.values()).filter(m => m.roles.cache.has(role.id));
      }
    } catch {
      // Fallback: sadece cache'te bulunan rol.members
      members = role.members ? Array.from(role.members.values()) : [];
    }

    if (members.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Rol Bilgisi')
        .setDescription(`${role} rolünde üye bulunmuyor.`)
        .setTimestamp();
      return isSlash ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
    }

    // Sırala: önce seste olanlar, sonra olmayanlar; sonra presence; sonra isim
    members.sort((a, b) => {
      const av = a.voice?.channel ? 0 : 1;
      const bv = b.voice?.channel ? 0 : 1;
      if (av !== bv) return av - bv;
      const ps = (x) => x.presence?.status || 'offline';
      const order = { online: 0, idle: 1, dnd: 2, offline: 3 };
      const ap = order[ps(a)] ?? 3;
      const bp = order[ps(b)] ?? 3;
      if (ap !== bp) return ap - bp;
      const an = a.displayName?.toLowerCase() || a.user.username.toLowerCase();
      const bn = b.displayName?.toLowerCase() || b.user.username.toLowerCase();
      return an.localeCompare(bn, 'tr');
    });

    const total = members.length;
    const inVoice = members.filter(m => m.voice?.channel).length;
    const isOfflineFn = (m) => !m.presence || m.presence.status === 'offline';
    const offlineCount = members.filter(isOfflineFn).length;
    const onlineCount = total - offlineCount;

    // Gruplar: Çevrim dışı (seste olmayan), Ses Kanalında (herkes), Aktif - Seste Olmayan
    const isOnVoice = (m) => {
      const ch = m.voice?.channel;
      return ch && [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch.type);
    };
    const voiceMembers = members.filter(isOnVoice);
    const offlineMembers = members.filter(m => !isOnVoice(m) && isOfflineFn(m));
    const activeNoVoiceMembers = members.filter(m => !isOnVoice(m) && !isOfflineFn(m));

    const lineOffline = (m) => `• ${m}`;
    const lineVoice = (m) => `• ${m} — <#${m.voice.channel.id}>`;
    const lineActiveNoVoice = (m) => `• ${m} — Ses kanalında değil`;

    const offlineLines = offlineMembers.map(lineOffline);
    const voiceLines = voiceMembers.map(lineVoice);
    const activeNoVoiceLines = activeNoVoiceMembers.map(lineActiveNoVoice);

    // Başlık ve güvenli limit
    const HEADER = `Rol: ${role} (ID: ${role.id})\nÜye Sayısı: ${total} | Çevrimiçi: ${onlineCount} | Çevrimdışı: ${offlineCount} | Seste Olan: ${voiceMembers.length}`;
    const SAFE_LIMIT = 3900;

    // Bölümleri sırayla yaz: Çevrim dışı -> Ses Kanalında -> Aktif - Seste Olmayan
    let desc = HEADER + '\n\n';
    const sections = [
      { title: `Üyeler (Çevrim dışı) (${offlineLines.length} Kişi)`, lines: offlineLines },
      { title: `Üyeler (Ses Kanalında) (${voiceLines.length} Kişi)`, lines: voiceLines },
      { title: `Üyeler (Aktif - Seste Olmayan) (${activeNoVoiceLines.length} Kişi)`, lines: activeNoVoiceLines }
    ];

    const summaryShown = { offline: 0, voice: 0, activeNoVoice: 0 };

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const head = (i === 0 ? '' : '\n\n') + sec.title + '\n';
      if ((desc.length + head.length) > SAFE_LIMIT) { desc = desc.slice(0, Math.max(0, SAFE_LIMIT - 3)) + '...'; break; }
      desc += head;
      let shown = 0;
      for (const ln of sec.lines) {
        const toAdd = (shown === 0 ? '' : '\n') + ln;
        if ((desc.length + toAdd.length) > SAFE_LIMIT) break;
        desc += toAdd;
        shown++;
      }
      if (i === 0) summaryShown.offline = shown;
      if (i === 1) summaryShown.voice = shown;
      if (i === 2) summaryShown.activeNoVoice = shown;
      if (shown < sec.lines.length) {
        const note = `\n… (${sec.lines.length - shown} kişi daha)`;
        if ((desc.length + note.length) <= SAFE_LIMIT) desc += note; else { desc = desc.slice(0, Math.max(0, SAFE_LIMIT - 3)) + '...'; break; }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Rol Bilgisi')
      .setDescription(desc)
      .setTimestamp();

    if (isEveryone) {
      embed.setFooter({ text: '@everyone listesi çok büyük olabilir.' });
    }

    await (isSlash ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] }));
  }
};
