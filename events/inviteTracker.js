const { getInviteLogChannel } = require('../config');

// Sunucudaki tüm davetleri cache'de tutmak için
const invitesCache = new Map();

async function cacheGuildInvites(guild) {
  const invites = await guild.invites.fetch().catch(() => null);
  if (invites) invitesCache.set(guild.id, invites);
}

async function handleMemberJoin(member) {
  const guild = member.guild;
  const logChannelId = getInviteLogChannel(guild.id);
  if (!logChannelId) return;
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  // Eski ve yeni davetleri karşılaştır
  const oldInvites = invitesCache.get(guild.id);
  const newInvites = await guild.invites.fetch().catch(() => null);
  if (!oldInvites || !newInvites) {
    logChannel.send({ content: `• ${member} (\`${member.id}\`) sunucuya katıldı!\nDavet Eden: Bilinmiyor (ilk cache veya hata)` });
    if (newInvites) invitesCache.set(guild.id, newInvites);
    return;
  }
  invitesCache.set(guild.id, newInvites);

  let usedInvite = null;
  for (const [code, invite] of newInvites) {
    const old = oldInvites.get(code);
    if (old && invite.uses > old.uses) {
      usedInvite = invite;
      break;
    }
  }

  // Hesap oluşturulma tarihi
  const createdAt = `<t:${Math.floor(member.user.createdTimestamp/1000)}:f> (<t:${Math.floor(member.user.createdTimestamp/1000)}:R>)`;
  // Anlık üye sayısı
  const memberCount = guild.memberCount.toLocaleString('tr-TR');

  let logMsg = ` ───────────────────────────── \n `;
  logMsg += `• ${member} (\`${member.id}\`) sunucuya katıldı!\n`;
  logMsg += `**Hesap Oluşturulma:** ${createdAt}\n`;
  logMsg += `**Davet Eden:** ${usedInvite && usedInvite.inviter ? `${usedInvite.inviter} (\`${usedInvite.inviterId}\`)` : 'Bilinmiyor'}\n`;
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

  // Son kullanılan daveti bul (invite cache mantığı gereği kesin tespit mümkün değildir, sadece log)
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
  client.on('clientReady', () => {
    client.guilds.cache.forEach(guild => cacheGuildInvites(guild));
  });
  client.on('inviteCreate', invite => cacheGuildInvites(invite.guild));
  client.on('inviteDelete', invite => cacheGuildInvites(invite.guild));
  client.on('guildMemberAdd', handleMemberJoin);
  client.on('guildMemberRemove', handleMemberLeave);
}

module.exports = { setupInviteTracking };
