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
  const base = config[guildId] || {
    logChannelId: null,
    registrationLogChannelId: null,
    unregisteredLogChannelId: null,
    maleRoleId: null,
    femaleRoleId: null,
    memberRoleId: null,
    unregisteredRoleId: null,
    authorizedRoleIds: [],
    isConfigured: false
  };
  if (!base.registrationLogChannelId && base.logChannelId) {
    base.registrationLogChannelId = base.logChannelId;
  }
  return base;
}

// Sunucu için kayıt config'ini ayarla
function setRegistrationConfig(guildId, settings) {
  const config = loadRegistrationConfig();
  
  if (!config[guildId]) {
    config[guildId] = { authorizedRoleIds: [] };
  }
  
  // Mevcut ayarları güncelle
  Object.assign(config[guildId], settings);
  if (settings.authorizedRoleIds && !Array.isArray(settings.authorizedRoleIds)) {
    config[guildId].authorizedRoleIds = [String(settings.authorizedRoleIds)];
  }
  
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
  return setRegistrationConfig(guildId, { logChannelId: channelId, registrationLogChannelId: channelId });
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

function setUnregisteredLogChannel(guildId, channelId) {
  return setRegistrationConfig(guildId, { unregisteredLogChannelId: channelId });
}

function addAuthorizedRole(guildId, roleId) {
  const current = getRegistrationConfig(guildId);
  const list = Array.isArray(current.authorizedRoleIds) ? current.authorizedRoleIds.slice() : [];
  const roleIdStr = String(roleId);
  if (!list.includes(roleIdStr)) list.push(roleIdStr);
  return setRegistrationConfig(guildId, { authorizedRoleIds: list });
}

function setAuthorizedRoles(guildId, roleIds) {
  const normalized = Array.isArray(roleIds) ? roleIds.map(id => String(id)) : [String(roleIds)];
  return setRegistrationConfig(guildId, { authorizedRoleIds: normalized });
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
  setUnregisteredLogChannel,
  addAuthorizedRole,
  setAuthorizedRoles,
  isRegistrationConfigured,
  resetRegistrationConfig
};
