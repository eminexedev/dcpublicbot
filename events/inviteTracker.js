const { getInviteLogChannel } = require('../config');
const { PermissionFlagsBits } = require('discord.js');

// Sunucudaki tüm davetleri cache'de tutmak için
const invitesCache = new Map();

async function cacheGuildInvites(guild) {
  // Gerekli izin yoksa (ManageGuild) tam liste çekilemeyebilir
  if (!guild.members.me) return;
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
    // Yine de dene ama hata alırsak sessizce geç
    const partial = await guild.invites.fetch().catch(() => null);
    if (partial) invitesCache.set(guild.id, partial);
    return;
  }
  const invites = await guild.invites.fetch().catch(() => null);
  if (invites) invitesCache.set(guild.id, invites);
}

async function handleMemberJoin(member) {
  const guild = member.guild;
  const logChannelId = getInviteLogChannel(guild.id);
  if (!logChannelId) return;
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const oldInvites = invitesCache.get(guild.id);
  let newInvites = await guild.invites.fetch().catch(() => null);
  if (!oldInvites || !newInvites) {
    if (newInvites) invitesCache.set(guild.id, newInvites);
    logChannel.send({ content: `• ${member} (\`${member.id}\`) sunucuya katıldı!\nDavet Eden: Bilinmiyor` });
    return;
  }

  let usedInvite = null;
  for (const [code, invite] of newInvites) {
    const old = oldInvites.get(code);
    if (old && invite.uses > old.uses) {
      usedInvite = invite;
      break;
    }
  }

  if (!usedInvite) {
    for (const [code, oldInvite] of oldInvites) {
      if (!newInvites.has(code)) {
        usedInvite = oldInvite;
        break;
      }
    }
  }

  if (!usedInvite) {
    await new Promise(res => setTimeout(res, 1200));
    const newerInvites = await guild.invites.fetch().catch(() => null);
    if (newerInvites) {
      newInvites = newerInvites;
      for (const [code, invite] of newerInvites) {
        const old = oldInvites.get(code);
        if (old && invite.uses > old.uses) {
          usedInvite = invite;
          break;
        }
      }
      if (!usedInvite) {
        for (const [code, oldInvite] of oldInvites) {
          if (!newerInvites.has(code)) {
            usedInvite = oldInvite;
            break;
          }
        }
      }
    }
  }

  // Cache'i en son güncelle (eski snapshot ile karşılaştırmayı etkilenmeden yapabilmek için)
  if (newInvites) invitesCache.set(guild.id, newInvites);

  const isVanity = guild.vanityURLCode ? true : false;
  // Hesap oluşturulma tarihi
  const createdAt = `<t:${Math.floor(member.user.createdTimestamp/1000)}:f> (<t:${Math.floor(member.user.createdTimestamp/1000)}:R>)`;
  // Anlık üye sayısı
  const memberCount = guild.memberCount.toLocaleString('tr-TR');

  let logMsg = ` ───────────────────────────── \n `;
  logMsg += `• ${member} (\`${member.id}\`) sunucuya katıldı!\n`;
  logMsg += `**Hesap Oluşturulma:** ${createdAt}\n`;
  logMsg += `**Davet Eden:** ${usedInvite && usedInvite.inviter ? `${usedInvite.inviter} (\`${usedInvite.inviterId}\`)` : (isVanity ? 'VANITY / Özel URL' : 'Bilinmiyor')}\n`;
  logMsg += `**Güvenilirlik:** ${member.user.createdTimestamp < Date.now() - 1000*60*60*24*30 ? '✅' : '❌'}\n`;
  logMsg += `**Anlık Üye Sayımız:** ${memberCount}`;
  logChannel.send({ content: logMsg });
}

async function handleMemberLeave(member) {
  const guild = member.guild;
  const logChannelId = getInviteLogChannel(guild.id);
  if (!logChannelId) return;
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const invites = invitesCache.get(guild.id);
  let lastInviter = 'Bilinmiyor';
  if (invites) {
    // En çok uses olan daveti bul
    let maxUses = 0;
    let inviter = null;
    for (const invite of invites.values()) {
      if (invite.uses > maxUses && invite.inviter) {
        maxUses = invite.uses;
        inviter = invite.inviter;
      }
    }
    if (inviter) lastInviter = `${inviter} (\`${inviter.id}\`)`;
  }

  let logMsg = `• ${member.user.tag} (\`${member.id}\`) sunucudan ayrıldı!\n`;
  logMsg += `Davet Eden: ${lastInviter}`;
  logChannel.send({ content: logMsg });
}

function setupInviteTracking(client) {
  // Bot hazır olduğunda tüm guild'lerin davetlerini cache'le
  client.once('ready', () => {
    client.guilds.cache.forEach(guild => cacheGuildInvites(guild));
  });
  client.on('guildCreate', (guild) => {
    setTimeout(() => cacheGuildInvites(guild), 3000); // Biraz gecikme ile (invites oluşsun)
  });
  client.on('inviteCreate', invite => cacheGuildInvites(invite.guild));
  client.on('inviteDelete', invite => cacheGuildInvites(invite.guild));
  client.on('guildMemberAdd', handleMemberJoin);
  client.on('guildMemberRemove', handleMemberLeave);
}

module.exports = { setupInviteTracking };
