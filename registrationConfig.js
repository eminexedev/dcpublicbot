const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'registrationConfig.json');

// Kayıt config'ini yükle
function loadRegistrationConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Kayıt config yüklenirken hata:', error);
    return {};
  }
}

// Kayıt config'ini kaydet
function saveRegistrationConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Kayıt config kaydedilirken hata:', error);
    return false;
  }
}

// Sunucu için kayıt config'ini al
function getRegistrationConfig(guildId) {
  const config = loadRegistrationConfig();
  return config[guildId] || {
    logChannelId: null,
    maleRoleId: null,
    femaleRoleId: null,
    memberRoleId: null,
    unregisteredRoleId: null,
    isConfigured: false
  };
}

// Sunucu için kayıt config'ini ayarla
function setRegistrationConfig(guildId, settings) {
  const config = loadRegistrationConfig();
  
  if (!config[guildId]) {
    config[guildId] = {};
  }
  
  // Mevcut ayarları güncelle
  Object.assign(config[guildId], settings);
  
  // Config tamamlanma durumunu kontrol et
  config[guildId].isConfigured = !!(
    config[guildId].logChannelId && 
    config[guildId].maleRoleId && 
    config[guildId].femaleRoleId &&
    config[guildId].memberRoleId &&
    config[guildId].unregisteredRoleId
  );
  
  const success = saveRegistrationConfig(config);
  return success ? config[guildId] : null;
}

// Log kanalını ayarla
function setLogChannel(guildId, channelId) {
  return setRegistrationConfig(guildId, { logChannelId: channelId });
}

// Erkek rolünü ayarla
function setMaleRole(guildId, roleId) {
  return setRegistrationConfig(guildId, { maleRoleId: roleId });
}

// Kadın rolünü ayarla
function setFemaleRole(guildId, roleId) {
  return setRegistrationConfig(guildId, { femaleRoleId: roleId });
}

// Üye rolünü ayarla
function setMemberRole(guildId, roleId) {
  return setRegistrationConfig(guildId, { memberRoleId: roleId });
}

// Kayıtsız rolünü ayarla
function setUnregisteredRole(guildId, roleId) {
  return setRegistrationConfig(guildId, { unregisteredRoleId: roleId });
}

// Kayıt sisteminin yapılandırılıp yapılandırılmadığını kontrol et
function isRegistrationConfigured(guildId) {
  const config = getRegistrationConfig(guildId);
  return config.isConfigured === true;
}

// Kayıt config'ini sıfırla
function resetRegistrationConfig(guildId) {
  const config = loadRegistrationConfig();
  if (config[guildId]) {
    delete config[guildId];
    return saveRegistrationConfig(config);
  }
  return true;
}

module.exports = {
  getRegistrationConfig,
  setRegistrationConfig,
  setLogChannel,
  setMaleRole,
  setFemaleRole,
  setMemberRole,
  setUnregisteredRole,
  isRegistrationConfigured,
  resetRegistrationConfig
};