const fs = require('fs');
const path = require('path');

const banConfigPath = path.join(__dirname, 'banConfig.json');
const logConfigPath = path.join(__dirname, 'logConfig.json');
const autoLogConfigPath = path.join(__dirname, 'autoLogConfig.json');
const inviteConfigPath = path.join(__dirname, 'inviteConfig.json');
const prefixConfigPath = path.join(__dirname, 'prefixConfig.json');
const jailConfigPath = path.join(__dirname, 'jailConfig.json');


// Güvenlik konfigürasyon dosyaları
const securityDir = path.join(__dirname, 'data');
const securityConfigFile = path.join(securityDir, 'securityConfig.json');
const securityViolationFile = path.join(securityDir, 'securityViolations.json');

// ========================
// BAN CONFIG FUNCTIONS
// ========================

function getBanLogChannel(guildId) {
  if (!fs.existsSync(banConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(banConfigPath, 'utf8'));
  return data[guildId]?.logChannelId || null;
}

function setBanLogChannel(guildId, channelId) {
  let data = {};
  if (fs.existsSync(banConfigPath)) {
    data = JSON.parse(fs.readFileSync(banConfigPath, 'utf8'));
  }
  if (!data[guildId]) {
    data[guildId] = {};
  }
  data[guildId].logChannelId = channelId;
  fs.writeFileSync(banConfigPath, JSON.stringify(data, null, 2));
}

// ========================
// LOG CONFIG FUNCTIONS
// ========================

function getLogChannel(guildId) {
  if (!fs.existsSync(logConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
  return data[guildId] || null;
}

function setLogChannel(guildId, channelId) {
  let data = {};
  if (fs.existsSync(logConfigPath)) {
    data = JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
  }
  data[guildId] = channelId;
  fs.writeFileSync(logConfigPath, JSON.stringify(data, null, 2));
}

// ========================
// AUTO LOG CONFIG FUNCTIONS
// ========================

function getAutoLogChannel(guildId) {
  if (!fs.existsSync(autoLogConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(autoLogConfigPath, 'utf8'));
  return data[guildId] || null;
}

function setAutoLogChannel(guildId, channelId) {
  let data = {};
  if (fs.existsSync(autoLogConfigPath)) {
    data = JSON.parse(fs.readFileSync(autoLogConfigPath, 'utf8'));
  }
  data[guildId] = channelId;
  fs.writeFileSync(autoLogConfigPath, JSON.stringify(data, null, 2));
}

// ========================
// INVITE CONFIG FUNCTIONS
// ========================

function getInviteLogChannel(guildId) {
  if (!fs.existsSync(inviteConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(inviteConfigPath, 'utf8'));
  return data[guildId] || null;
}

function setInviteLogChannel(guildId, channelId) {
  let data = {};
  if (fs.existsSync(inviteConfigPath)) {
    data = JSON.parse(fs.readFileSync(inviteConfigPath, 'utf8'));
  }
  data[guildId] = channelId;
  fs.writeFileSync(inviteConfigPath, JSON.stringify(data, null, 2));
}

// ========================
// UNIVERSAL LOG FINDER
// ========================

// Herhangi bir log kanalı bul (öncelik sırasına göre)
function findAnyLogChannel(guildId, preferredType = null) {
  let logChannelId = null;
  
  // Eğer spesifik bir tip istenmişse önce onu kontrol et
  if (preferredType === 'ban') {
    logChannelId = getBanLogChannel(guildId);
  } else if (preferredType === 'invite') {
    logChannelId = getInviteLogChannel(guildId);
  }
  
  // Spesifik kanal bulunamazsa genel kanalları kontrol et
  if (!logChannelId) {
    // 1. Genel log kanalı (logkanal komutuyla ayarlanan)
    logChannelId = getLogChannel(guildId);
    
    // 2. prefixConfig.json'dan kontrol et
    if (!logChannelId) {
      try {
        const prefixConfig = JSON.parse(fs.readFileSync('./prefixConfig.json', 'utf8'));
        if (prefixConfig[guildId] && prefixConfig[guildId].logChannelId) {
          logChannelId = prefixConfig[guildId].logChannelId;
        }
      } catch (error) {
        // Dosya bulunamazsa veya okunamazsa devam et
      }
    }
    
    // 3. Otomatik log kanalı (son çare)
    if (!logChannelId) {
      logChannelId = getAutoLogChannel(guildId);
    }
  }
  
  return logChannelId;
}

// ========================
// JAIL CONFIG FUNCTIONS
// ========================

function getJailRole(guildId) {
  if (!fs.existsSync(jailConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(jailConfigPath, 'utf8'));
  return data[guildId]?.jailRoleId || null;
}

function setJailRole(guildId, roleId, roleName, setBy) {
  let data = {};
  if (fs.existsSync(jailConfigPath)) {
    data = JSON.parse(fs.readFileSync(jailConfigPath, 'utf8'));
  }
  if (!data[guildId]) {
    data[guildId] = {};
  }
  data[guildId].jailRoleId = roleId;
  if (roleName) data[guildId].jailRoleName = roleName;
  if (setBy) data[guildId].setBy = setBy;
  if (roleName || setBy) data[guildId].setAt = Date.now();
  fs.writeFileSync(jailConfigPath, JSON.stringify(data, null, 2));
}

function getJailRoleInfo(guildId) {
  try {
    if (!fs.existsSync(jailConfigPath)) {
      return null;
    }
    const data = fs.readFileSync(jailConfigPath, 'utf8');
    const config = JSON.parse(data);
    return config[guildId] || null;
  } catch (error) {
    console.error('Jail config bilgi okuma hatası:', error);
    return null;
  }
}

function getUnjailRole(guildId) {
  try {
    if (!fs.existsSync(jailConfigPath)) {
      return null;
    }
    const data = fs.readFileSync(jailConfigPath, 'utf8');
    const config = JSON.parse(data);
    return config[guildId]?.unjailRoleId || null;
  } catch (error) {
    console.error('Unjail config okuma hatası:', error);
    return null;
  }
}

function setUnjailRole(guildId, roleId, roleName, setBy) {
  try {
    let config = {};
    if (fs.existsSync(jailConfigPath)) {
      const data = fs.readFileSync(jailConfigPath, 'utf8');
      config = JSON.parse(data);
    }
    if (!config[guildId]) {
      config[guildId] = {};
    }
    config[guildId].unjailRoleId = roleId;
    config[guildId].unjailRoleName = roleName;
    config[guildId].unjailSetBy = setBy;
    config[guildId].unjailSetAt = Date.now();
    fs.writeFileSync(jailConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Unjail config kaydetme hatası:', error);
    return false;
  }
}

function getJailLogChannel(guildId) {
  try {
    if (!fs.existsSync(jailConfigPath)) {
      return null;
    }
    const data = fs.readFileSync(jailConfigPath, 'utf8');
    const config = JSON.parse(data);
    return config[guildId]?.jailLogChannelId || null;
  } catch (error) {
    console.error('Jail log config okuma hatası:', error);
    return null;
  }
}

function getUnjailLogChannel(guildId) {
  try {
    if (!fs.existsSync(jailConfigPath)) {
      return null;
    }
    const data = fs.readFileSync(jailConfigPath, 'utf8');
    const config = JSON.parse(data);
    return config[guildId]?.unjailLogChannelId || null;
  } catch (error) {
    console.error('Unjail log config okuma hatası:', error);
    return null;
  }
}

function setJailLogChannel(guildId, channelId) {
  try {
    let config = {};
    if (fs.existsSync(jailConfigPath)) {
      const data = fs.readFileSync(jailConfigPath, 'utf8');
      config = JSON.parse(data);
    }
    if (!config[guildId]) config[guildId] = {};
    config[guildId].jailLogChannelId = channelId;
    fs.writeFileSync(jailConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Jail log kanal kaydetme hatası:', e);
    return false;
  }
}

function setUnjailLogChannel(guildId, channelId) {
  try {
    let config = {};
    if (fs.existsSync(jailConfigPath)) {
      const data = fs.readFileSync(jailConfigPath, 'utf8');
      config = JSON.parse(data);
    }
    if (!config[guildId]) config[guildId] = {};
    config[guildId].unjailLogChannelId = channelId;
    fs.writeFileSync(jailConfigPath, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Unjail log kanal kaydetme hatası:', e);
    return false;
  }
}

// ========================
// SECURITY CONFIG FUNCTIONS 
// ========================

const defaultSecurityConfig = {
  enabled: true,
  violationThreshold: 3,
  timeWindow: 24 * 60 * 60 * 1000,
  punishmentType: 'both',
  logChannelId: null,
  whitelistRoles: [],
  whitelistUsers: []
};

// Eski/Yeni alan adları arasında uyumluluk sağlamak için yardımcılar
function toCanonicalSecurityConfig(input) {
  // Giriş hem dosyadan okunan ham veri hem de komutlardan gelen obje olabilir
  const cfg = input || {};
  // Yeni isimler öncelikli, yoksa eski isimlerden türet
  const violationThreshold = isFinite(cfg.violationThreshold) ? cfg.violationThreshold
    : (isFinite(cfg.banThreshold) ? cfg.banThreshold : defaultSecurityConfig.violationThreshold);
  const punishmentType = cfg.punishmentType || (cfg.punishment || defaultSecurityConfig.punishmentType);
  const logChannelId = cfg.logChannelId || (cfg.logChannel || null);
  // Liste alanları
  const whitelistRoles = Array.isArray(cfg.whitelistRoles) ? cfg.whitelistRoles
    : (Array.isArray(cfg.whitelistedRoles) ? cfg.whitelistedRoles : []);
  const whitelistUsers = Array.isArray(cfg.whitelistUsers) ? cfg.whitelistUsers
    : (Array.isArray(cfg.exemptUsers) ? cfg.exemptUsers : []);

  return {
    enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : defaultSecurityConfig.enabled,
    violationThreshold,
    timeWindow: isFinite(cfg.timeWindow) ? cfg.timeWindow : defaultSecurityConfig.timeWindow,
    punishmentType,
    logChannelId,
    whitelistRoles,
    whitelistUsers
  };
}

function toApiSecurityConfig(canonical) {
  return {
    ...canonical,
    banThreshold: canonical.violationThreshold,
    punishment: canonical.punishmentType,
    logChannel: canonical.logChannelId,
    whitelistedRoles: canonical.whitelistRoles,
    exemptUsers: canonical.whitelistUsers
  };
}

function ensureSecurityDir() {
  if (!fs.existsSync(securityDir)) {
    fs.mkdirSync(securityDir, { recursive: true });
  }
}

function getSecurityConfig(guildId) {
  try {
    ensureSecurityDir();
    if (!fs.existsSync(securityConfigFile)) {
      fs.writeFileSync(securityConfigFile, JSON.stringify({}, null, 2));
      const canonical = { ...defaultSecurityConfig };
      return toApiSecurityConfig(canonical);
    }
    const data = JSON.parse(fs.readFileSync(securityConfigFile, 'utf-8'));
    const raw = data[guildId];
    const canonical = toCanonicalSecurityConfig(raw || defaultSecurityConfig);
    return toApiSecurityConfig(canonical);
  } catch (error) {
    console.error('Güvenlik config okuma hatası:', error);
    return toApiSecurityConfig({ ...defaultSecurityConfig });
  }
}

function setSecurityConfig(guildId, config) {
  try {
    ensureSecurityDir();
    let data = {};
    if (fs.existsSync(securityConfigFile)) {
      data = JSON.parse(fs.readFileSync(securityConfigFile, 'utf-8'));
    }
    const canonical = toCanonicalSecurityConfig({ ...defaultSecurityConfig, ...config });
    data[guildId] = canonical; 
    fs.writeFileSync(securityConfigFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Güvenlik config kaydetme hatası:', error);
    return false;
  }
}

function getViolations(guildId) {
  try {
    ensureSecurityDir();
    if (!fs.existsSync(securityViolationFile)) {
      fs.writeFileSync(securityViolationFile, JSON.stringify({}, null, 2));
      return {};
    }
    const data = JSON.parse(fs.readFileSync(securityViolationFile, 'utf-8'));
    return data[guildId] || {};
  } catch (error) {
    console.error('İhlal verisi okuma hatası:', error);
    return {};
  }
}

function addViolation(guildId, userId, violationType, targetUserId, reason) {
  try {
    ensureSecurityDir();
    let data = {};
    if (fs.existsSync(securityViolationFile)) {
      data = JSON.parse(fs.readFileSync(securityViolationFile, 'utf-8'));
    }
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][userId]) data[guildId][userId] = [];

    const violation = {
      type: violationType,
      targetUserId,
      reason: reason || 'Sebep belirtilmemiş',
      timestamp: Date.now(),
      processed: false
    };

    data[guildId][userId].push(violation);

  const config = getSecurityConfig(guildId);
    const cutoffTime = Date.now() - config.timeWindow;
    data[guildId][userId] = data[guildId][userId].filter(v => v.timestamp > cutoffTime);

    fs.writeFileSync(securityViolationFile, JSON.stringify(data, null, 2));
    return data[guildId][userId].length;
  } catch (error) {
    console.error('İhlal kaydı ekleme hatası:', error);
    return 0;
  }
}

function getUserViolationCount(guildId, userId) {
  try {
  const data = getViolations(guildId);
  if (!data[userId]) return 0;
  const config = getSecurityConfig(guildId);
    const cutoffTime = Date.now() - config.timeWindow;
    return data[userId].filter(v => v.timestamp > cutoffTime).length;
  } catch (error) {
    console.error('İhlal sayısı getirme hatası:', error);
    return 0;
  }
}

function clearUserViolations(guildId, userId) {
  try {
    ensureSecurityDir();
    let data = {};
    if (fs.existsSync(securityViolationFile)) {
      data = JSON.parse(fs.readFileSync(securityViolationFile, 'utf-8'));
    }
    if (data[guildId] && data[guildId][userId]) {
      delete data[guildId][userId];
      fs.writeFileSync(securityViolationFile, JSON.stringify(data, null, 2));
      return true;
    }
    return false;
  } catch (error) {
    console.error('İhlal temizleme hatası:', error);
    return false;
  }
}

// ========================
// CONFIG STATUS CHECKER
// ========================

// Tüm config durumlarını kontrol et
function getAllConfigStatus(guildId) {
  return {
    banLog: getBanLogChannel(guildId),
    generalLog: getLogChannel(guildId), 
    autoLog: getAutoLogChannel(guildId),
    inviteLog: getInviteLogChannel(guildId),
    jailRole: getJailRole(guildId),
    prefixLog: (() => {
      try {
        const prefixConfig = JSON.parse(fs.readFileSync('./prefixConfig.json', 'utf8'));
        return prefixConfig[guildId]?.logChannelId || null;
      } catch {
        return null;
      }
    })()
  };
}

// ========================
// EXPORTS
// ========================

module.exports = {
  // Ban Config
  getBanLogChannel,
  setBanLogChannel,
  
  // General Log Config  
  getLogChannel,
  setLogChannel,
  
  // Auto Log Config
  getAutoLogChannel,
  setAutoLogChannel,
  
  // Invite Config
  getInviteLogChannel,
  setInviteLogChannel,
  
  // Jail Config
  getJailRole,
  setJailRole,
  getJailRoleInfo,
  getUnjailRole,
  setUnjailRole,
  getJailLogChannel,
  getUnjailLogChannel,
  setJailLogChannel,
  setUnjailLogChannel,
  
  // Utility Functions
  findAnyLogChannel,
  getAllConfigStatus,

  // Security Config
  getSecurityConfig,
  setSecurityConfig,
  addViolation,
  getUserViolationCount,
  clearUserViolations,
  getViolations
};

// ========================
// PREFIX CONFIG FUNCTIONS
// ========================

let _prefixCache = null;
function loadPrefixCache() {
  if (!fs.existsSync(prefixConfigPath)) {
    _prefixCache = {};
    return;
  }
  try {
    _prefixCache = JSON.parse(fs.readFileSync(prefixConfigPath, 'utf8')) || {};
  } catch (e) {
    console.error('Prefix cache yükleme hatası:', e);
    _prefixCache = {};
  }
}
function ensurePrefixCache() {
  if (_prefixCache === null) loadPrefixCache();
}
function getPrefix(guildId) {
  if (!guildId) return '.';
  ensurePrefixCache();
  return _prefixCache[guildId]?.prefix || '.';
}

// Prefix
function setPrefix(guildId, prefix) {
  if (!guildId) return;
  ensurePrefixCache();
  if (!_prefixCache[guildId]) _prefixCache[guildId] = {};
  _prefixCache[guildId].prefix = prefix;
  try {
    fs.writeFileSync(prefixConfigPath, JSON.stringify(_prefixCache, null, 2));
  } catch (error) {
    console.error('Prefix yazma hatası:', error);
  }
}

module.exports.getPrefix = getPrefix;
module.exports.setPrefix = setPrefix;