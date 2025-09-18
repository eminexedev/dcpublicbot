const fs = require('fs');
const path = require('path');

const inviteConfigPath = path.join(__dirname, 'inviteConfig.json');

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

module.exports = { getInviteLogChannel, setInviteLogChannel };