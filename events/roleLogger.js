const fs = require('fs');
const path = require('path');
const { AuditLogEvent } = require('discord.js');

const statsPath = path.join(__dirname, '../statsData.json');

function loadStats() {
  if (!fs.existsSync(statsPath)) return {};
  try { return JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch { return {}; }
}

function saveStats(data) {
  fs.writeFileSync(statsPath, JSON.stringify(data, null, 2));
}

function ensureGuild(stats, guildId) {
  if (!stats[guildId]) stats[guildId] = {};
  if (!stats[guildId].roleLogs || typeof stats[guildId].roleLogs !== 'object') stats[guildId].roleLogs = {};
  return stats[guildId];
}

function pushCapped(arr, item, cap = 300) {
  arr.push(item);
  if (arr.length > cap) arr.shift();
}

// Audit loglardan ilgili rol değişimini yapan yetkiliyi bulmaya çalışır
async function resolveExecutor(member, roleId, action) {
  try {
    const now = Date.now();
    // Bazı shard/gecikme durumları için kısa bir bekleme yardımcı olabilir
    await new Promise(r => setTimeout(r, 400));
    const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 6 });
    const entries = [...logs.entries.values()].filter(e => e.target && e.target.id === member.id && (now - e.createdTimestamp) < 15000);
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const ch of changes) {
        // Discord audit loglarında roller $add/$remove ile gelir
        if (action === 'add' && (ch.key === '$add' || ch.key === 'roles' || ch.key === 'add')) {
          const roles = Array.isArray(ch.new) ? ch.new : Array.isArray(ch.value) ? ch.value : [];
          if (roles.some(r => r.id === roleId)) return entry.executor?.id || null;
        }
        if (action === 'remove' && (ch.key === '$remove' || ch.key === 'roles' || ch.key === 'remove')) {
          const roles = Array.isArray(ch.new) ? ch.new : Array.isArray(ch.value) ? ch.value : [];
          if (roles.some(r => r.id === roleId)) return entry.executor?.id || null;
        }
      }
    }
  } catch (e) {
  }
  return null;
}

module.exports = (client) => {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      if (!newMember || !newMember.guild || (newMember.user && newMember.user.bot)) return;
      
      const oldRoles = oldMember.roles?.cache || new Map();
      const newRoles = newMember.roles?.cache || new Map();
      const added = [...newRoles.values()].filter(r => !oldRoles.has(r.id));
      const removed = [...oldRoles.values()].filter(r => !newRoles.has(r.id));

      if (added.length === 0 && removed.length === 0) return; // Rol dışı güncellemeler

      const stats = loadStats();
      const g = ensureGuild(stats, newMember.guild.id);
      if (!g.roleLogs[newMember.id]) g.roleLogs[newMember.id] = [];

      const timestamp = Date.now();

      // Eklenen roller
      for (const role of added) {
        let executorId = await resolveExecutor(newMember, role.id, 'add');
        pushCapped(g.roleLogs[newMember.id], {
          t: timestamp,
          action: 'add',
          roleId: role.id,
          executorId: executorId
        });
      }

      // Kaldırılan roller
      for (const role of removed) {
        let executorId = await resolveExecutor(newMember, role.id, 'remove');
        pushCapped(g.roleLogs[newMember.id], {
          t: timestamp,
          action: 'remove',
          roleId: role.id,
          executorId: executorId
        });
      }

      saveStats(stats);
    } catch (e) {
      console.warn('[roleLogger] Hata:', e.message);
    }
  });
};
