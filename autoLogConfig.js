const fs = require('fs');
const path = require('path');

const autoLogConfigPath = path.join(__dirname, 'autoLogConfig.json');

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

module.exports = { getAutoLogChannel, setAutoLogChannel };