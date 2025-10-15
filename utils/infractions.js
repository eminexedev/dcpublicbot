const fs = require('fs');
const path = require('path');

// Kayıt dosyası kök dizinde tutulur
const dbPath = path.join(__dirname, '..', 'infractions.json');

function loadDb() {
  try {
    if (!fs.existsSync(dbPath)) return {};
    const raw = fs.readFileSync(dbPath, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[infractions] loadDb parse hatası:', e.message);
    return {};
  }
}

function saveDb(db) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[infractions] saveDb yazma hatası:', e.message);
  }
}

function ensureGuildUser(db, guildId, userId) {
  if (!db[guildId]) db[guildId] = {};
  if (!Array.isArray(db[guildId][userId])) db[guildId][userId] = [];
  return db[guildId][userId];
}

// Esnek kayıt yapısı:
// { t: Date.now(), type: 'ban'|'unban'|'kick'|'mute'|'unmute'|'jail'|'unjail', reason?: string, executorId?: string, durationMin?: number }
function addInfraction(guildId, userId, record, capPerUser = 300) {
  if (!guildId || !userId || !record) return false;
  try {
    const db = loadDb();
    const list = ensureGuildUser(db, guildId, userId);
    const safe = { ...record };
    if (typeof safe.t !== 'number') safe.t = Date.now();
    if (!safe.type) safe.type = 'unknown';
    list.push(safe);
    if (list.length > capPerUser) {
      list.splice(0, list.length - capPerUser);
    }
    saveDb(db);
    return true;
  } catch (e) {
    console.error('[infractions] addInfraction hata:', e.message);
    return false;
  }
}

function getUserInfractions(guildId, userId) {
  try {
    const db = loadDb();
    const arr = (db[guildId] && Array.isArray(db[guildId][userId])) ? db[guildId][userId] : [];
    // Kopya döndür (mutasyon riskini azalt)
    return [...arr];
  } catch {
    return [];
  }
}

function getCountsByType(guildId, userId) {
  const entries = getUserInfractions(guildId, userId);
  const counts = entries.reduce((acc, r) => {
    const k = r.type || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return counts;
}

module.exports = {
  addInfraction,
  getUserInfractions,
  getCountsByType,
  _loadDb: loadDb, // test/diagnostic
  _saveDb: saveDb
};
