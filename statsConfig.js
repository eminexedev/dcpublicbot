const fs = require('fs');
const path = require('path');

const statsConfigPath = path.join(__dirname, 'statsConfig.json');

function getStatsChannels(guildId) {
  if (!fs.existsSync(statsConfigPath)) return {};
  const data = JSON.parse(fs.readFileSync(statsConfigPath, 'utf8'));
  return data[guildId] || {};
}

function setStatsChannel(guildId, type, channelId) {
  let data = {};
  if (fs.existsSync(statsConfigPath)) {
    data = JSON.parse(fs.readFileSync(statsConfigPath, 'utf8'));
  }
  if (!data[guildId]) data[guildId] = {};
  data[guildId][type] = channelId;
  fs.writeFileSync(statsConfigPath, JSON.stringify(data, null, 2));
}

module.exports = { getStatsChannels, setStatsChannel };
