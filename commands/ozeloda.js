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

      const cfg = getPrivateVoiceConfig(guild.id);
      const embed = new EmbedBuilder()
        .setTitle('🎛️ Özel Oda Kontrol Paneli')
        .setColor(0x5865F2)
        .setDescription('Aşağıdaki tuşlarla sistemi yönetebilirsiniz:')
        .addFields(
          { name: 'Durum', value: cfg.enabled ? 'Aktif' : 'Kapalı', inline: true },
          { name: 'Otomatik Sil', value: cfg.autoDelete ? 'Açık' : 'Kapalı', inline: true },
          { name: 'Tetikleyiciler', value: (cfg.triggerNames||[]).join(', ') || '—', inline: false }
        )
        .setTimestamp();

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pv:toggle').setLabel(cfg.enabled ? 'Kapat' : 'Aç').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pv:autodelete').setLabel(cfg.autoDelete ? 'Oto Sil: Kapalı' : 'Oto Sil: Açık').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('pv:refresh').setLabel('Yenile').setStyle(ButtonStyle.Primary)
      );
      // Kullanıcı kontrolleri
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

      const sent = await channel.send({ embeds: [embed], components: [adminRow, userRow1, userRow2] });
      setPrivateVoiceConfig(guild.id, { panelChannelId: channel.id, panelMessageId: sent.id });
      return reply({ content: `✅ Kontrol paneli gönderildi: ${channel}`, ephemeral: isSlash });
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

    const isAdminAction = ['toggle','autodelete','refresh'].includes(interaction.customId.split(':')[1]);
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

    const [, scope, action] = interaction.customId.split(':'); // pv:u:rename -> [pv, u, rename]
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
        if (action === 'limit:up' || action === 'limit:down') {
          const curr = voice.userLimit || 0;
          let next = curr;
          next = action.endsWith('up') ? (curr >= 99 ? 99 : (curr === 0 ? 2 : curr + 1)) : (curr <= 2 ? 0 : curr - 1);
          await voice.setUserLimit(next).catch(()=>{});
          return interaction.reply({ content: `✅ Kullanıcı limiti: ${next === 0 ? 'Sınırsız' : next}`, ephemeral: true });
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
    const cfg = getPrivateVoiceConfig(guildId);
    const embed = new EmbedBuilder()
      .setTitle('🎛️ Özel Oda Kontrol Paneli')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Durum', value: cfg.enabled ? 'Aktif' : 'Kapalı', inline: true },
        { name: 'Otomatik Sil', value: cfg.autoDelete ? 'Açık' : 'Kapalı', inline: true },
        { name: 'Tetikleyiciler', value: (cfg.triggerNames||[]).join(', ') || '—', inline: false }
      )
      .setTimestamp();
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
    try {
      await interaction.update({ embeds: [embed], components: [adminRow, userRow1, userRow2] });
    } catch {
      await interaction.reply({ embeds: [embed], components: [adminRow, userRow1, userRow2], ephemeral: true });
    }
  }
};
