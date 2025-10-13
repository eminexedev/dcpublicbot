const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getLogChannel, getPrivateVoiceConfig } = require('../config');

// Varsayılan tetikleyiciler, config yoksa kullanılır
const DEFAULT_TRIGGERS = ['özel oda oluştur'];

// Kullanıcıya özel oda ad şablonu
const NAME_TEMPLATE = (member) => `${member.displayName} Channel`;

// Bu oturumda oluşturulan özel kanallar ve cooldown takibi
const createdChannels = new Set();
const userCooldown = new Set();

function normalize(str) { return (str || '').toString().trim().toLowerCase(); }

async function ensureTriggerChannel(guild) {
  try {
    const cfg = getPrivateVoiceConfig(guild.id);
    // Sistem aktif değilse veya log kanalı ayarlı değilse tetikleyici oluşturma
    const logId = getLogChannel(guild.id);
    if (!cfg?.enabled || !logId) return;
    const names = Array.isArray(cfg.triggerNames) && cfg.triggerNames.length>0 ? cfg.triggerNames : DEFAULT_TRIGGERS;
    const defaultName = names[0];
    const exists = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildVoice && normalize(c.name) === normalize(defaultName)
    );
    if (exists) return; // Zaten var

    await guild.channels.create({
      name: defaultName,
      type: ChannelType.GuildVoice,
      reason: 'Özel oda sistemi tetikleyici kanalı oluşturuldu.'
    });
  } catch (err) {
    console.warn(`[PRIVATE VOICE] Tetikleyici kanal oluşturulamadı (${guild.name}):`, err?.message || err);
  }
}

module.exports = (client) => {
  if (!client.privateVoice) client.privateVoice = { created: new Set(), owners: new Map() };
  // Client ready olduğunda her guild için tetikleyici kanalı kontrol et/oluştur
  client.once('clientReady', async () => {
    for (const [, guild] of client.guilds.cache) {
      await ensureTriggerChannel(guild);
    }
  });

  // Kullanıcı tetikleyici kanala girince özel oda oluştur
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const joined = (!!newState.channelId && newState.channelId !== oldState.channelId);
      if (!joined || !newState.channel) return;

  const chName = normalize(newState.channel.name);
  const cfg = getPrivateVoiceConfig(newState.guild.id);
  // Sistem aktif değilse veya log kanalı ayarlı değilse kullanılmasın
  const logId = getLogChannel(newState.guild.id);
  if (!cfg?.enabled || !logId) return;
  const triggers = (cfg.triggerNames && cfg.triggerNames.length ? cfg.triggerNames : DEFAULT_TRIGGERS).map(s=>normalize(s));
  if (!triggers.includes(chName)) return;

      const guild = newState.guild;
      const member = newState.member;
      if (!guild || !member) return;

      // Spam/çifte oluşturmayı engelle (3 sn cooldown)
      if (userCooldown.has(member.id)) return;
      userCooldown.add(member.id);
      setTimeout(() => userCooldown.delete(member.id), 3000);

  const parentId = cfg.categoryId || newState.channel.parentId || null;
  const channelName = (cfg.nameTemplate || '{user} Channel').replace('{user}', member.displayName).replace('{tag}', member.user.tag).replace('{id}', member.id);

      // Aynı isimde aynı kategoride kanal varsa tekrar oluşturma, oraya taşı
      const existing = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildVoice && normalize(c.name) === normalize(channelName) && c.parentId === parentId
      );
      if (existing) {
        await member.voice.setChannel(existing).catch(() => {});
        return;
      }

      // İzinler
      const overwrites = [
        { id: guild.roles.everyone, allow: [] },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ];

      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: parentId ?? undefined,
        permissionOverwrites: overwrites,
        userLimit: cfg.userLimit || undefined,
        bitrate: cfg.bitrate ? cfg.bitrate*1000 : undefined,
        reason: `Özel oda oluşturma: ${member.user.tag}`
      });

      createdChannels.add(newChannel.id);
      client.privateVoice.created.add(newChannel.id);
      client.privateVoice.owners.set(newChannel.id, member.id);

      // Kullanıcıyı yeni kanala taşı
      await member.voice.setChannel(newChannel).catch(() => {});

      // Logla
      const logChannelId = getLogChannel(guild.id);
      if (logChannelId) {
        const logCh = guild.channels.cache.get(logChannelId);
        if (logCh) {
          const embed = new EmbedBuilder()
            .setTitle('🔊 Özel Oda Oluşturuldu')
            .setColor(0x5865F2)
            .addFields(
              { name: 'Kullanıcı', value: `${member.user} (${member.id})`, inline: false },
              { name: 'Kanal', value: `${newChannel} (${newChannel.id})`, inline: false },
              { name: 'Kategori', value: parentId ? `<#${parentId}>` : 'Yok', inline: true },
              { name: 'Tarih', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
            )
            .setTimestamp();
          await logCh.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[PRIVATE VOICE][CREATE] Hata:', err);
    }
  });

  // Boş kalan oluşturulmuş özel odaları sil ve logla
  client.on('voiceStateUpdate', async (oldState) => {
    try {
      const channel = oldState.channel;
      if (!channel) return;
      if (!createdChannels.has(channel.id)) return; // Sadece bu oturumda oluşturulanlar
      if (channel.members.size > 0) return;

      const cfg = getPrivateVoiceConfig(oldState.guild.id);
      if (cfg && cfg.autoDelete === false) return; // Otomatik silme kapalıysa silme

      await channel.delete('Özel oda boş kaldığı için otomatik silindi.').catch(() => {});
      createdChannels.delete(channel.id);
      if (oldState.client?.privateVoice) {
        oldState.client.privateVoice.created.delete(channel.id);
        oldState.client.privateVoice.owners.delete(channel.id);
      }

      const guild = oldState.guild;
      const logChannelId = getLogChannel(guild.id);
      if (logChannelId) {
        const logCh = guild.channels.cache.get(logChannelId);
        if (logCh) {
          const embed = new EmbedBuilder()
            .setTitle('🗑️ Özel Oda Silindi')
            .setColor(0xED4245)
            .setDescription('Boş kalan özel oda otomatik olarak silindi.')
            .addFields(
              { name: 'Kanal ID', value: channel.id, inline: true },
              { name: 'Tarih', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
            )
            .setTimestamp();
          await logCh.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[PRIVATE VOICE][DELETE] Hata:', err);
    }
  });
};
