const fs = require('fs');
const path = require('path');

// Jail rol ayarlarını getir
function getJailRole(guildId) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    return config[guildId]?.jailRoleId || null;
  } catch (error) {
    console.error('Jail config okuma hatası:', error);
    return null;
  }
}

// Jail rol ayarlarını kaydet
function setJailRole(guildId, roleId, roleName, setBy) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    let config = {};
    
    // Mevcut config'i oku
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(data);
    }
    
    // Sunucu ayarını güncelle
    if (!config[guildId]) {
      config[guildId] = {};
    }
    
    config[guildId].jailRoleId = roleId;
    config[guildId].jailRoleName = roleName;
    config[guildId].setBy = setBy;
    config[guildId].setAt = Date.now();
    
    // Config'i kaydet
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Jail config kaydetme hatası:', error);
    return false;
  }
}

// Jail rol bilgilerini getir
function getJailRoleInfo(guildId) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    return config[guildId] || null;
  } catch (error) {
    console.error('Jail config bilgi okuma hatası:', error);
    return null;
  }
}

// Unjail rol ayarlarını getir
function getUnjailRole(guildId) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    return config[guildId]?.unjailRoleId || null;
  } catch (error) {
    console.error('Unjail config okuma hatası:', error);
    return null;
  }
}

// Unjail rol ayarlarını kaydet
function setUnjailRole(guildId, roleId, roleName, setBy) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    let config = {};
    
    // Mevcut config'i oku
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(data);
    }
    
    // Sunucu ayarını güncelle
    if (!config[guildId]) {
      config[guildId] = {};
    }
    
    config[guildId].unjailRoleId = roleId;
    config[guildId].unjailRoleName = roleName;
    config[guildId].unjailSetBy = setBy;
    config[guildId].unjailSetAt = Date.now();
    
    // Config'i kaydet
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Unjail config kaydetme hatası:', error);
    return false;
  }
}

// Jail log kanalını getir
function getJailLogChannel(guildId) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    return config[guildId]?.jailLogChannelId || null;
  } catch (error) {
    console.error('Jail log config okuma hatası:', error);
    return null;
  }
}

// Unjail log kanalını getir
function getUnjailLogChannel(guildId) {
  try {
    const configPath = path.join(__dirname, 'jailConfig.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    return config[guildId]?.unjailLogChannelId || null;
  } catch (error) {
    console.error('Unjail log config okuma hatası:', error);
    return null;
  }
}

module.exports = {
  getJailRole,
  setJailRole,
  getJailRoleInfo,
  getUnjailRole,
  setUnjailRole,
  getJailLogChannel,
  getUnjailLogChannel
};