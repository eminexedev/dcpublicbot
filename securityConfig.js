const fs = require('fs');
const path = require('path');

// Güvenlik koruma config dosyası
const configFile = path.join(__dirname, 'data', 'securityConfig.json');

// Varsayılan güvenlik ayarları
const defaultConfig = {
  enabled: true,
  violationThreshold: 3,   // 24 saatte kaç ban/kick sonrası tetiklenir
  timeWindow: 24 * 60 * 60 * 1000, // 24 saat (milisaniye)
  punishmentType: 'both',  // 'jail' veya 'roleRemove' veya 'both'
  logChannelId: null,      // Güvenlik loglarının gönderileceği kanal
  whitelistRoles: [],      // Bu rollerdeki kişiler sisteme takılmaz
  whitelistUsers: []       // Bu kullanıcılar sisteme takılmaz
};

// Config dosyasını oku
function getSecurityConfig(guildId) {
  try {
    if (!fs.existsSync(path.dirname(configFile))) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
    }
    
    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, JSON.stringify({}, null, 2));
      return { ...defaultConfig };
    }
    
    const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    return data[guildId] || { ...defaultConfig };
  } catch (error) {
    console.error('Güvenlik config okuma hatası:', error);
    return { ...defaultConfig };
  }
}

// Config dosyasını kaydet
function setSecurityConfig(guildId, config) {
  try {
    if (!fs.existsSync(path.dirname(configFile))) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
    }
    
    let data = {};
    if (fs.existsSync(configFile)) {
      data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
    
    data[guildId] = { ...defaultConfig, ...config };
    fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Güvenlik config kaydetme hatası:', error);
    return false;
  }
}

// Güvenlik ihlali kayıt sistemi
const violationFile = path.join(__dirname, 'data', 'securityViolations.json');

// İhlal kaydı oku
function getViolations(guildId) {
  try {
    if (!fs.existsSync(path.dirname(violationFile))) {
      fs.mkdirSync(path.dirname(violationFile), { recursive: true });
    }
    
    if (!fs.existsSync(violationFile)) {
      fs.writeFileSync(violationFile, JSON.stringify({}, null, 2));
      return {};
    }
    
    const data = JSON.parse(fs.readFileSync(violationFile, 'utf-8'));
    return data[guildId] || {};
  } catch (error) {
    console.error('İhlal verisi okuma hatası:', error);
    return {};
  }
}

// İhlal kaydı ekle
function addViolation(guildId, userId, violationType, targetUserId, reason) {
  try {
    if (!fs.existsSync(path.dirname(violationFile))) {
      fs.mkdirSync(path.dirname(violationFile), { recursive: true });
    }
    
    let data = {};
    if (fs.existsSync(violationFile)) {
      data = JSON.parse(fs.readFileSync(violationFile, 'utf-8'));
    }
    
    if (!data[guildId]) {
      data[guildId] = {};
    }
    
    if (!data[guildId][userId]) {
      data[guildId][userId] = [];
    }
    
    const violation = {
      type: violationType, // 'ban' veya 'kick'
      targetUserId: targetUserId,
      reason: reason || 'Sebep belirtilmemiş',
      timestamp: Date.now(),
      processed: false
    };
    
    data[guildId][userId].push(violation);
    
    // Eski kayıtları temizle (24 saatten eski)
    const config = getSecurityConfig(guildId);
    const cutoffTime = Date.now() - config.timeWindow;
    data[guildId][userId] = data[guildId][userId].filter(v => v.timestamp > cutoffTime);
    
    fs.writeFileSync(violationFile, JSON.stringify(data, null, 2));
    
    // Son 24 saatteki ihlal sayısını döndür
    return data[guildId][userId].length;
  } catch (error) {
    console.error('İhlal kaydı ekleme hatası:', error);
    return 0;
  }
}

// Kullanıcının son 24 saatteki ihlal sayısını getir
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

// Kullanıcının ihlal geçmişini temizle
function clearUserViolations(guildId, userId) {
  try {
    let data = {};
    if (fs.existsSync(violationFile)) {
      data = JSON.parse(fs.readFileSync(violationFile, 'utf-8'));
    }
    
    if (data[guildId] && data[guildId][userId]) {
      delete data[guildId][userId];
      fs.writeFileSync(violationFile, JSON.stringify(data, null, 2));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('İhlal temizleme hatası:', error);
    return false;
  }
}

module.exports = {
  getSecurityConfig,
  setSecurityConfig,
  addViolation,
  getUserViolationCount,
  clearUserViolations,
  getViolations
};