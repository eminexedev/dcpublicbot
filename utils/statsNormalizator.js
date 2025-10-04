const fs = require('fs');
const path = require('path');
const statsPath = path.join(__dirname, '../statsData.json');

function loadRaw() {
  if (!fs.existsSync(statsPath)) return {};
  try { return JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch { return {}; }
}

function saveRaw(data) {
  fs.writeFileSync(statsPath, JSON.stringify(data, null, 2));
}

function ensureGuild(guildStats) {
  if (!guildStats.channels) guildStats.channels = {};
  if (!guildStats.users) guildStats.users = {};
  if (!guildStats.voiceChannels) guildStats.voiceChannels = {};
  if (!guildStats.voiceUsers) guildStats.voiceUsers = {};
  if (!guildStats.afkVoiceUsers) guildStats.afkVoiceUsers = {};
  if (!guildStats.userVoiceData) guildStats.userVoiceData = {};
  if (!guildStats.voiceSessions) guildStats.voiceSessions = {};
  if (!guildStats.history) guildStats.history = { daily: [], weekly: [], monthly: [] };
  return guildStats;
}

function sanitizeNumber(n) {
  return (typeof n === 'number' && isFinite(n) && n >= 0) ? Math.floor(n) : 0;
}

function normalize() {
  const stats = loadRaw();
  for (const guildId of Object.keys(stats)) {
    stats[guildId] = ensureGuild(stats[guildId]);
    // Sayısal alanlar
    for (const objKey of ['channels','users','voiceChannels','voiceUsers','afkVoiceUsers']) {
      const obj = stats[guildId][objKey];
      for (const key of Object.keys(obj)) {
        obj[key] = sanitizeNumber(obj[key]);
      }
    }
    // userVoiceData içindeki süreler
    for (const userId of Object.keys(stats[guildId].userVoiceData)) {
      for (const chId of Object.keys(stats[guildId].userVoiceData[userId])) {
        stats[guildId].userVoiceData[userId][chId] = sanitizeNumber(stats[guildId].userVoiceData[userId][chId]);
      }
    }
    // voiceSessions: sadece bitmemiş oturumların startTime kontrolü (dokunmuyoruz ama tip güvenliği adına)
    for (const userId of Object.keys(stats[guildId].voiceSessions)) {
      stats[guildId].voiceSessions[userId] = stats[guildId].voiceSessions[userId].filter(s => s && s.startTime);
    }
  }
  saveRaw(stats);
  return stats;
}

module.exports = { normalize };
