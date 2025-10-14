const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getPrivateVoiceConfig, setPrivateVoiceConfig, getLogChannel } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ozeloda')
    .setDescription('Özel oda sistemi kurulum sihirbazı')
    .addSubcommand(sub =>
      sub.setName('durum')
        .setDescription('Özel oda sisteminin mevcut ayarlarını gösterir'))
    .addSubcommand(sub =>
      sub.setName('ac')
        .setDescription('Özel oda sistemini aktif eder ve tetikleyici kanalı oluşturur')
  .addStringOption(o=>o.setName('tetikleyici_ad').setDescription('Birden fazla ad için virgül veya | ile ayırın. Örn: özel oda oluştur, bot özel oda oluştur').setRequired(false))
        .addStringOption(o=>o.setName('isim_sablonu').setDescription('Örn: {user} Channel').setRequired(false))
        .addChannelOption(o=>o.setName('kategori').setDescription('Kanalın oluşturulacağı kategori').addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        .addIntegerOption(o=>o.setName('kullanici_limiti').setDescription('User limit (2-99)').setRequired(false))
        .addIntegerOption(o=>o.setName('bitrate').setDescription('Bitrate (kbps, 8-384)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('kapat')
        .setDescription('Özel oda sistemini devre dışı bırakır'))
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Özel oda kontrol panelini belirtilen kanala gönderir')
        .addChannelOption(o=>o.setName('kanal').setDescription('Panelin gönderileceği kanal').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(ctx) {
    // Context türünü belirle (slash vs prefix)
    const isSlash = typeof ctx.isCommand === 'function' ? ctx.isCommand() : !!(ctx.options && ctx.guild && ctx.user);
    const reply = (payload) => ctx.reply ? ctx.reply(payload) : ctx.message.reply(payload);
    const guild = ctx.guild || (ctx.message && ctx.message.guild);
    if (!guild) return;
    const sub = isSlash ? ctx.options.getSubcommand() : ((ctx.args && ctx.args[0]) || 'durum');

    // Prefix çağrıları için admin yetkisi kontrolü (durum hariç)
    if (!isSlash && ['ac','kapat','panel'].includes(sub)) {
      const member = ctx.member || (ctx.message && ctx.message.member);
      if (!member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return reply({ content: '❌ Bu işlemi yapmak için yönetici olmanız gerekir.' });
      }
    }

    const showStatus = async () => {
      const cfg = getPrivateVoiceConfig(guild.id);
      // Log kanalı zorunluluğu
      const logId = getLogChannel(guild.id);
      if (!logId) {
        return reply({ content: '❌ Bu paneli kullanabilmek için önce log kanalı ayarlayın: /logkanal #kanal', ephemeral: isSlash });
      }
      const embed = new EmbedBuilder()
        .setTitle('🔧 Özel Oda Sistemi - Durum')
        .setColor(cfg.enabled ? 0x57F287 : 0xED4245)
        .addFields(
          { name: 'Durum', value: cfg.enabled ? 'Aktif' : 'Kapalı', inline: true },
          { name: 'Tetikleyici Adları', value: (cfg.triggerNames||[]).join(', ') || '—', inline: false },
          { name: 'İsim Şablonu', value: cfg.nameTemplate || '{user} Channel', inline: true },
          { name: 'Otomatik Sil', value: cfg.autoDelete ? 'Evet' : 'Hayır', inline: true },
          { name: 'Kategori', value: cfg.categoryId ? `<#${cfg.categoryId}>` : 'Varsayılan', inline: true },
          { name: 'Limit', value: cfg.userLimit ? String(cfg.userLimit) : 'Varsayılan', inline: true },
          { name: 'Bitrate', value: cfg.bitrate ? `${cfg.bitrate} kbps` : 'Varsayılan', inline: true }
        )
        .setTimestamp();
      return reply({ embeds: [embed], ephemeral: isSlash });
    };

    if (sub === 'durum') {
      return showStatus();
    }

    if (sub === 'kapat') {
      setPrivateVoiceConfig(guild.id, { enabled: false });
      return reply({ content: '🛑 Özel oda sistemi devre dışı bırakıldı.', ephemeral: isSlash });
    }

    if (sub === 'ac') {
      // Parametreleri topla
      let trigName = isSlash ? ctx.options.getString('tetikleyici_ad') : (ctx.args && ctx.args[1]);
      let nameTpl = isSlash ? ctx.options.getString('isim_sablonu') : (ctx.args && ctx.args[2]);
      const kategori = isSlash ? ctx.options.getChannel('kategori') : null;
      const limit = isSlash ? ctx.options.getInteger('kullanici_limiti') : null;
      const bitrate = isSlash ? ctx.options.getInteger('bitrate') : null;

      // Çoklu tetikleyici adı desteği (virgül, |, ; ve satır sonuna göre ayır)
      let triggerNamesArr;
      if (trigName && typeof trigName === 'string') {
        triggerNamesArr = trigName
          .split(/[,|;\n]/g)
          .map(s => s.trim())
          .filter(Boolean);
      }

      const updates = {
        enabled: true,
        triggerNames: triggerNamesArr && triggerNamesArr.length ? triggerNamesArr : undefined,
        nameTemplate: nameTpl || undefined,
        categoryId: kategori?.id || undefined,
        userLimit: limit || undefined,
        bitrate: bitrate || undefined
      };
      setPrivateVoiceConfig(guild.id, updates);

      // Tetikleyici kanallar yoksa oluştur (hepsi için)
      const effectiveTriggers = (triggerNamesArr && triggerNamesArr.length
        ? triggerNamesArr
        : getPrivateVoiceConfig(guild.id).triggerNames) || [];
      for (const trig of effectiveTriggers) {
        const exists = guild.channels.cache.find(c=> c.type===ChannelType.GuildVoice && c.name.toLowerCase() === trig.toLowerCase());
        if (!exists) {
          await guild.channels.create({
            name: trig,
            type: ChannelType.GuildVoice,
            parent: kategori?.id || undefined,
            reason: 'Özel oda sistemi tetikleyici kanalı'
          }).catch(()=>{});
        }
      }

      await showStatus();
      const logId = getLogChannel(guild.id);
      if (logId) {
        const lc = guild.channels.cache.get(logId);
        if (lc) lc.send({ content: `🛠️ Özel oda sistemi ${guild.name} için yeniden yapılandırıldı.`}).catch(()=>{});
      }
      return;
    }

    if (sub === 'panel') {
      let channel = isSlash ? ctx.options.getChannel('kanal') : null;
      if (!isSlash) {
        // Prefix format: ozeloda panel [kanal]
        const raw = ctx.args && ctx.args[1];
        if (!raw) {
          return reply('Kullanım: ozeloda panel #kanal');
        }
        // Mention -> ID
        const idMatch = raw.match(/^(?:<#)?(\d{16,20})>?$/);
        const id = idMatch ? idMatch[1] : null;
        if (id) {
          channel = guild.channels.cache.get(id) || null;
        }
        if (!channel) {
          // İsimle ara
          const nameQ = raw.toLowerCase();
          channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === nameQ) || null;
        }
      }
      if (!channel || channel.type !== ChannelType.GuildText) {
        return reply({ content: '❌ Lütfen geçerli bir metin kanalı belirtin.', ephemeral: isSlash });
      }

  const { embed, rows, files } = await composePanel(ctx.client, guild, ctx.member || null);
  const sent = await channel.send({ embeds: [embed], components: rows, files });
      setPrivateVoiceConfig(guild.id, { panelChannelId: channel.id, panelMessageId: sent.id });
      const confirmation = await reply({ content: `✅ Kontrol paneli gönderildi: ${channel}`, ephemeral: isSlash });
      if (!isSlash && confirmation && typeof confirmation.delete === 'function') {
        setTimeout(() => confirmation.delete().catch(()=>{}), 8000);
      }
      return;
    }

    // Prefix help
    if (!isSlash) {
      return reply(
        'Kullanım:\n' +
        '  /ozeloda durum\n' +
        '  /ozeloda kapat\n' +
        '  /ozeloda ac tetikleyici_ad:"özel oda oluştur, bot özel oda oluştur" isim_sablonu:"{user} Channel"\n' +
        '  /ozeloda panel kanal:#panel-kanalı\n' +
        '  ozeloda panel #panel-kanalı\n' +
        '\n' +
        'Notlar:\n' +
        '  • Birden fazla tetikleyici adı için virgül, | veya ; ile ayırabilirsiniz.\n' +
        '  • İsim şablonunda {user}, {tag}, {id} değişkenlerini kullanabilirsiniz.'
      );
    }
  },

  // Button interactions
  async handleButton(interaction) {
    if (!interaction.customId || !interaction.customId.startsWith('pv:')) return;
    const { guild, member, client } = interaction;

    const isAdminAction = ['toggle','autodelete'].includes(interaction.customId.split(':')[1]);
    if (isAdminAction) {
      if (!member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Bu paneli kullanmak için yönetici olmanız gerekir.', ephemeral: true });
      }
      const logId = getLogChannel(guild.id);
      if (!logId) {
        return interaction.reply({ content: '❌ Önce log kanalı ayarlayın: /logkanal #kanal', ephemeral: true });
      }
      const sub = interaction.customId.split(':')[1];
      const cfg = getPrivateVoiceConfig(guild.id);
      if (sub === 'toggle') setPrivateVoiceConfig(guild.id, { enabled: !cfg.enabled });
      if (sub === 'autodelete') setPrivateVoiceConfig(guild.id, { autoDelete: !cfg.autoDelete });
      // refresh: no-op
      return await this._renderPanel(interaction, guild.id);
    }

    // Herkes için Yenile
    if (interaction.customId === 'pv:refresh') {
      const logId = getLogChannel(guild.id);
      if (!logId) {
        return interaction.reply({ content: '❌ Önce log kanalı ayarlansın: /logkanal #kanal', ephemeral: true });
      }
      return await this._renderPanel(interaction, guild.id);
    }

    // Kullanıcı aksiyonları
    const pv = client.privateVoice;
    const logIdReq = getLogChannel(guild.id);
    if (!logIdReq) {
      return interaction.reply({ content: '❌ Sistem kilitli: Lütfen yöneticiler log kanalını ayarlasın: /logkanal #kanal', ephemeral: true });
    }
    const voice = member?.voice?.channel;
    if (!voice || !pv?.created.has(voice.id)) {
      return interaction.reply({ content: '❌ Önce kendi özel ses kanalınızda olmalısınız.', ephemeral: true });
    }
    // Sahip kontrolü
    const ownerId = pv.owners.get(voice.id);
    if (ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Bu kanalı yönetme izniniz yok.', ephemeral: true });
    }

    const parts = interaction.customId.split(':'); // örn: ['pv','u','limit','down']
    const scope = parts[1];
    const action = parts[2];
    const extra = parts[3];
    if (scope === 'u') {
      try {
        if (action === 'rename') {
          // Modal aç
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId('pv:modal:rename').setTitle('Kanal Adını Değiştir');
          const input = new TextInputBuilder().setCustomId('name').setLabel('Yeni Kanal Adı').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(90).setPlaceholder(voice.name);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return await interaction.showModal(modal);
        }
        if (action === 'limit') {
          const me = guild.members.me;
          const canManage = me?.permissionsIn(voice)?.has(PermissionFlagsBits.ManageChannels);
          if (!canManage) {
            return interaction.reply({ content: '❌ Botun bu kanalda Kanalı Yönet (Manage Channels) izni yok.', ephemeral: true });
          }
          const dir = extra === 'up' ? 'up' : 'down';
          const curr = voice.userLimit || 0;
          let next = curr;
          if (dir === 'up') {
            if (curr === 0) next = 2; else next = Math.min(99, curr + 1);
          } else {
            next = curr <= 2 ? 0 : curr - 1;
          }
          try {
            await voice.setUserLimit(next);
            return interaction.reply({ content: `✅ Kullanıcı limiti: ${next === 0 ? 'Sınırsız' : next}`, ephemeral: true });
          } catch (e) {
            return interaction.reply({ content: `❌ Limit değiştirilemedi: ${e.message || 'bilinmeyen hata'}`, ephemeral: true });
          }
        }
        if (action === 'lock') {
          await voice.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }).catch(()=>{});
          return interaction.reply({ content: '🔒 Kanal kilitlendi.', ephemeral: true });
        }
        if (action === 'unlock') {
          await voice.permissionOverwrites.edit(guild.roles.everyone, { Connect: null }).catch(()=>{});
          return interaction.reply({ content: '🔓 Kanal kilidi açıldı.', ephemeral: true });
        }
        if (action === 'muteall') {
          for (const [, m] of voice.members) { if (m.manageable) await m.voice.setMute(true).catch(()=>{}); }
          return interaction.reply({ content: '🔇 Herkes susturuldu.', ephemeral: true });
        }
        if (action === 'unmuteall') {
          for (const [, m] of voice.members) { if (m.manageable) await m.voice.setMute(false).catch(()=>{}); }
          return interaction.reply({ content: '🔈 Herkesin sesi açıldı.', ephemeral: true });
        }
        if (action === 'invite') {
          try {
            const invite = await voice.createInvite({ maxAge: 1800, maxUses: 5, reason: 'Özel oda davet' });
            return interaction.reply({ content: `🔗 Davet bağlantısı (30dk/5 kullanımlık): ${invite.url}`, ephemeral: true });
          } catch (e) {
            return interaction.reply({ content: `❌ Davet oluşturulamadı: ${e.message || 'bilinmeyen hata'}`, ephemeral: true });
          }
        }
        if (action === 'disconnect') {
          // Basit: Sahibi hariç herkesi at
          for (const [, m] of voice.members) { if (m.id !== member.id) await m.voice.disconnect().catch(()=>{}); }
          return interaction.reply({ content: '🔌 Kullanıcılar kanaldan çıkarıldı (sahip hariç).', ephemeral: true });
        }
        if (action === 'region') {
          // Discord artık bölgeyi otomatik seçiyor; alternatif: RTC region override
          try {
            const regions = ['brazil','hongkong','india','rotterdam','singapore','southafrica','sydney','us-east','us-west'];
            const curr = voice.rtcRegion || null;
            const idx = regions.indexOf(curr);
            const next = regions[(idx + 1 + regions.length) % regions.length];
            await voice.setRTCRegion(next);
            return interaction.reply({ content: `🌐 Bölge değiştirildi: ${next}`, ephemeral: true });
          } catch (e) {
            return interaction.reply({ content: `❌ Bölge değiştirilemedi: ${e.message || 'bilinmeyen hata'}`, ephemeral: true });
          }
        }
        if (action === 'claim') {
          const ownerId = interaction.client.privateVoice.owners.get(voice.id);
          if (ownerId && ownerId !== member.id) {
            interaction.client.privateVoice.owners.set(voice.id, member.id);
            return interaction.reply({ content: '👑 Oda sahipliği üzerinize alındı.', ephemeral: true });
          }
          return interaction.reply({ content: 'ℹ️ Zaten sahibisiniz veya sahip yok.', ephemeral: true });
        }
        if (action === 'transfer') {
          // En basit hali: Sahip harici ilk kullanıcıya devret
          const target = [...voice.members.values()].find(m => m.id !== member.id);
          if (!target) return interaction.reply({ content: '❌ Devredilecek bir kullanıcı bulunamadı.', ephemeral: true });
          interaction.client.privateVoice.owners.set(voice.id, target.id);
          return interaction.reply({ content: `➡️ Oda sahipliği ${target} kullanıcısına devredildi.`, ephemeral: true });
        }
        if (action === 'moveout') {
          for (const [, m] of voice.members) { if (m.id !== member.id) await m.voice.disconnect().catch(()=>{}); }
          return interaction.reply({ content: '↘️ Herkes kanaldan atıldı.', ephemeral: true });
        }
        if (action === 'delete') {
          await voice.delete('Sahibi tarafından panelden silindi.').catch(()=>{});
          return interaction.reply({ content: '🗑️ Kanal silindi.', ephemeral: true });
        }
      } catch (e) {
        return interaction.reply({ content: `❌ İşlem başarısız: ${e.message || 'bilinmeyen hata'}`, ephemeral: true });
      }
    }
  },

  async handleModal(interaction) {
    if (!interaction.customId || interaction.customId !== 'pv:modal:rename') return;
    const voice = interaction.member?.voice?.channel;
    if (!voice) return interaction.reply({ content: '❌ Bir ses kanalında değilsiniz.', ephemeral: true });
    const newName = interaction.fields.getTextInputValue('name')?.trim();
    if (!newName) return interaction.reply({ content: '❌ Geçerli bir ad girin.', ephemeral: true });
    try {
      await voice.setName(newName);
      return interaction.reply({ content: `✅ Kanal adı güncellendi: ${newName}`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `❌ Ad güncellenemedi: ${e.message || 'bilinmeyen hata'}`, ephemeral: true });
    }
  },

  async _renderPanel(interaction, guildId) {
    const { embed, rows, files } = await composePanel(interaction.client, interaction.guild, interaction.member || null);
    try {
      await interaction.update({ embeds: [embed], components: rows, files });
    } catch {
      await interaction.reply({ embeds: [embed], components: rows, files, ephemeral: true });
    }
  }
};

async function composePanel(client, guild, member) {
  const cfg = getPrivateVoiceConfig(guild.id);
  const logId = getLogChannel(guild.id);
  const triggers = (cfg.triggerNames || []);
  const triggerText = triggers.length ? (triggers.length > 6 ? `${triggers.slice(0,6).join(', ')} … (+${triggers.length-6})` : triggers.join(', ')) : '—';

  // Aktif özel kanal sayısı (bu guild'e ait oluşturulanlar)
  let activeCount = 0;
  if (client?.privateVoice?.created) {
    for (const id of client.privateVoice.created) {
      const ch = guild.channels.cache.get(id);
      if (ch) activeCount++;
    }
  }

  // Üyenin bulunduğu özel kanal bilgisi
  let userInfo = '—';
  if (member?.voice?.channelId && client?.privateVoice?.created?.has(member.voice.channelId)) {
    const ch = member.voice.channel;
    const locked = ch.permissionOverwrites.resolve(guild.roles.everyone.id)?.deny?.has?.(PermissionFlagsBits.Connect) ? 'Kilitli' : 'Açık';
    const limit = ch.userLimit === 0 ? 'Sınırsız' : String(ch.userLimit);
    userInfo = `Kanal: ${ch.name}\nÜye: ${ch.members.size}\nLimit: ${limit}\nDurum: ${locked}`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Özel Oda Kontrol Paneli')
    .setColor(0x5865F2)
    .setDescription('• Yönetici satırı: sistemi aç/kapat, otomatik sil, yenile.\n• Kullanıcı satırı: kendi özel kanalını yeniden adlandır, limit değiştir, kilitle, herkesi sustur/aç, herkesi at, kanalı sil.')
    .addFields(
      { name: 'Durum', value: cfg.enabled ? 'Aktif' : 'Kapalı', inline: true },
      { name: 'Otomatik Sil', value: cfg.autoDelete ? 'Açık' : 'Kapalı', inline: true },
      { name: 'Log Kanalı', value: logId ? `<#${logId}>` : '— (ayarlanmalı)', inline: true },
      { name: 'İsim Şablonu', value: cfg.nameTemplate || '{user} Channel', inline: true },
      { name: 'Kategori', value: cfg.categoryId ? `<#${cfg.categoryId}>` : 'Varsayılan', inline: true },
      { name: 'Varsayılan Limit', value: cfg.userLimit ? String(cfg.userLimit) : 'Varsayılan/Sınırsız', inline: true },
      { name: 'Varsayılan Bitrate', value: cfg.bitrate ? `${cfg.bitrate} kbps` : 'Varsayılan', inline: true },
      { name: 'Aktif Özel Kanal', value: String(activeCount), inline: true },
      { name: 'Senin Durumun', value: userInfo, inline: false }
    )

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pv:toggle').setLabel(cfg.enabled ? 'Kapat' : 'Aç').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('pv:autodelete').setLabel(cfg.autoDelete ? 'Oto Sil: Kapalı' : 'Oto Sil: Açık').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:refresh').setLabel('Yenile').setStyle(ButtonStyle.Primary)
  );
  const userRow1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pv:u:rename').setLabel('Ad Değiştir').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:limit:down').setLabel('Limit -').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:limit:up').setLabel('Limit +').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:lock').setLabel('Kilitle').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:unlock').setLabel('Kilidi Aç').setStyle(ButtonStyle.Secondary)
  );
  const userRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pv:u:muteall').setLabel('Herkesi Sustur').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:unmuteall').setLabel('Herkesin Sesini Aç').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:moveout').setLabel('Herkesi At').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('pv:u:delete').setLabel('Kanalı Sil').setStyle(ButtonStyle.Danger)
  );
  const userRow3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pv:u:invite').setLabel('Davet Bağlantısı').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:disconnect').setLabel('Kullanıcıyı Kopar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:region').setLabel('Bölge Değiştir').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:claim').setLabel('Sahiplen').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pv:u:transfer').setLabel('Odayı Devret').setStyle(ButtonStyle.Secondary)
  );

  // Kullanım kılavuzu görseli üret
  const files = [];
  try {
    const img = await renderGuideImage();
    if (img) {
      files.push({ attachment: img, name: 'pv_guide.png' });
      embed.setImage('attachment://pv_guide.png');
    }
  } catch {}

  return { embed, rows: [adminRow, userRow1, userRow2, userRow3], files };
}

// Basit twemoji önbelleği (aynı emojiyi tekrar tekrar indirmemek için)
const __twemojiCache = new Map();

function emojiToCodePoint(emoji) {
  // Çoklu kod noktasını (surrogate pairs) '-' ile birleştirir
  return Array.from(emoji)
    .map(ch => ch.codePointAt(0).toString(16))
    .join('-')
    .toLowerCase();
}

async function loadTwemojiImage(emoji) {
  try {
    if (__twemojiCache.has(emoji)) return __twemojiCache.get(emoji);
    const code = emojiToCodePoint(emoji);
    // Birkaç farklı CDN dene (bazı ortamlarda ağ kısıtları olabilir)
    const urls = [
      `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${code}.png`,
      `https://twemoji.maxcdn.com/v/latest/72x72/${code}.png`,
      `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`
    ];
    const { loadImage } = require('canvas');
    let img = null;
    for (const u of urls) {
      try { img = await loadImage(u); break; } catch { img = null; }
    }
    if (!img) throw new Error('twemoji-load-failed');
    __twemojiCache.set(emoji, img);
    return img;
  } catch {
    return null; // ağ/emoji bulunamadı: metin fallback
  }
}

async function renderGuideImage() {
  try {
    const { createCanvas } = require('canvas');
    const items = [
      { icon: '📝', text: 'ODA İSMİ' },
      { icon: '👥', text: 'ODA LİMİTİ' },
      { icon: '🛡️', text: 'GİZLİLİK' },
      { icon: '⏳', text: 'BEKLEME\nODASI' },
      { icon: '#️⃣', text: 'METİN\nKANALI' },
      { icon: '✅', text: 'GÜVENİLİR' },
      { icon: '⚠️', text: 'GÜVENSİZ' },
      { icon: '🔗', text: 'DAVETİYE' },
      { icon: '🔌', text: 'KULLANICIYI\nKOPAR' },
      { icon: '🌐', text: 'BÖLGE' },
      { icon: '🚫', text: 'ENGELLE' },
      { icon: '✅', text: 'ENGELİ\nKALDIR' },
      { icon: '👑', text: 'SAHİPLEN' },
      { icon: '🔄', text: 'ODAYI\nDEVRET' },
      { icon: '🗑️', text: 'SİL' }
    ];
    const cols = 5, rows = 3;
    const btnW = 240, btnH = 64, gap = 18;
    const pad = 24;
    const width = pad*2 + cols*btnW + (cols-1)*gap;
    const height = pad*2 + rows*btnH + (rows-1)*gap;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Arkaplan
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, width, height);

    // Twemoji ikonlarını önceden yükle
    const iconImages = await Promise.all(items.map(i => loadTwemojiImage(i.icon)));

    // Buton çizimi
    ctx.textBaseline = 'middle';
    let i = 0;
    for (let r=0; r<rows; r++) {
      for (let c=0; c<cols; c++) {
        const x = pad + c*(btnW+gap);
        const y = pad + r*(btnH+gap);
        // buton
        ctx.fillStyle = '#1e1f22';
        roundRect(ctx, x, y, btnW, btnH, 12);
        const item = items[i++] || { icon: '', text: '' };
        const iconX = x + 16;
        const iconY = y + (btnH - 32)/2;
        // ikon (twemoji img varsa onu kullan, yoksa metin fallback)
        const iconImg = iconImages[i-1];
        if (iconImg) {
          ctx.drawImage(iconImg, iconX, iconY, 32, 32);
        } else {
          ctx.textAlign = 'left';
          ctx.font = '24px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(item.icon, iconX, y + btnH/2);
        }
        // metin
        ctx.textAlign = 'left';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#ffffff';
        const textX = x + 56;
        const lines = (item.text || '').split('\n');
        if (lines.length === 1) {
          ctx.fillText(lines[0], textX, y + btnH/2);
        } else {
          ctx.fillText(lines[0], textX, y + btnH/2 - 11);
          ctx.fillText(lines[1], textX, y + btnH/2 + 11);
        }
      }
    }
    return canvas.toBuffer('image/png');
  } catch (e) {
    return null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}
