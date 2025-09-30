const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'autoLogConfig.json');

// Config dosyası yoksa oluştur
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
}

// Config dosyasını yükle
function loadConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('AutoLog config yüklenirken hata:', error);
    return {};
  }
}

// Config dosyasını kaydet
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('AutoLog config kaydedilirken hata:', error);
    return false;
  }
}

// Auto log kanalını al
function getAutoLogChannel(guildId) {
  const config = loadConfig();
  return config[guildId] || null;
}

// Auto log kanalını ayarla
function setAutoLogChannel(guildId, channelId) {
  const config = loadConfig();
  config[guildId] = channelId;
  return saveConfig(config);
}

// Auto log kanalını kaldır
function removeAutoLogChannel(guildId) {
  const config = loadConfig();
  delete config[guildId];
  return saveConfig(config);
}

module.exports = {
  getAutoLogChannel,
  setAutoLogChannel,
  removeAutoLogChannel
};