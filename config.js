const fs = require('fs');
const path = require('path');

// Config dosyaları için paths
const banConfigPath = path.join(__dirname, 'banConfig.json');
const logConfigPath = path.join(__dirname, 'logConfig.json');
const autoLogConfigPath = path.join(__dirname, 'autoLogConfig.json');
const inviteConfigPath = path.join(__dirname, 'inviteConfig.json');
const prefixConfigPath = path.join(__dirname, 'prefixConfig.json');
const jailConfigPath = path.join(__dirname, 'jailConfig.json');

// ========================
// BAN CONFIG FUNCTIONS
// ========================

// Ban log kanalını al
function getBanLogChannel(guildId) {
  if (!fs.existsSync(banConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(banConfigPath, 'utf8'));
  return data[guildId]?.logChannelId || null;
}

// Ban log kanalını ayarla
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

// Genel log kanalını al
function getLogChannel(guildId) {
  if (!fs.existsSync(logConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
  return data[guildId] || null;
}

// Genel log kanalını ayarla
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

// Otomatik log kanalını al
function getAutoLogChannel(guildId) {
  if (!fs.existsSync(autoLogConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(autoLogConfigPath, 'utf8'));
  return data[guildId] || null;
}

// Otomatik log kanalını ayarla
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

// Davet log kanalını al
function getInviteLogChannel(guildId) {
  if (!fs.existsSync(inviteConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(inviteConfigPath, 'utf8'));
  return data[guildId] || null;
}

// Davet log kanalını ayarla
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

// Jail rolünü al
function getJailRole(guildId) {
  if (!fs.existsSync(jailConfigPath)) return null;
  const data = JSON.parse(fs.readFileSync(jailConfigPath, 'utf8'));
  return data[guildId]?.jailRoleId || null;
}

// Jail rolünü ayarla
function setJailRole(guildId, roleId) {
  let data = {};
  if (fs.existsSync(jailConfigPath)) {
    data = JSON.parse(fs.readFileSync(jailConfigPath, 'utf8'));
  }
  if (!data[guildId]) {
    data[guildId] = {};
  }
  data[guildId].jailRoleId = roleId;
  fs.writeFileSync(jailConfigPath, JSON.stringify(data, null, 2));
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
  
  // Utility Functions
  findAnyLogChannel,
  getAllConfigStatus
};

// ========================
// PREFIX CONFIG FUNCTIONS
// ========================

// Prefix'i al (varsayılan: '.')
function getPrefix(guildId) {
  if (!guildId) return '.';
  if (!fs.existsSync(prefixConfigPath)) return '.';
  try {
    const data = JSON.parse(fs.readFileSync(prefixConfigPath, 'utf8'));
    return data[guildId]?.prefix || '.';
  } catch (error) {
    console.error('Prefix okuma hatası:', error);
    return '.';
  }
}

// Prefix'i ayarla
function setPrefix(guildId, prefix) {
  let data = {};
  if (fs.existsSync(prefixConfigPath)) {
    try {
      data = JSON.parse(fs.readFileSync(prefixConfigPath, 'utf8'));
    } catch (error) {
      console.error('Prefix dosyası okuma hatası:', error);
      data = {};
    }
  }
  
  // Mevcut diğer ayarları koru, sadece prefix'i güncelle
  if (!data[guildId]) {
    data[guildId] = {};
  }
  data[guildId].prefix = prefix;
  
  try {
    fs.writeFileSync(prefixConfigPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Prefix yazma hatası:', error);
  }
}

// Prefix fonksiyonlarını export'a ekle
module.exports.getPrefix = getPrefix;
module.exports.setPrefix = setPrefix;