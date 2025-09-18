const fs = require('fs');
const path = require('path');

const prefixConfigPath = path.join(__dirname, 'prefixConfig.json');

function getPrefix(guildId) {
  if (!guildId) return '.';
  if (!fs.existsSync(prefixConfigPath)) return '.';
  const data = JSON.parse(fs.readFileSync(prefixConfigPath, 'utf8'));
  return data[guildId]?.prefix || '.';
}

function setPrefix(guildId, prefix) {
  let data = {};
  if (fs.existsSync(prefixConfigPath)) {
    data = JSON.parse(fs.readFileSync(prefixConfigPath, 'utf8'));
  }
  data[guildId] = { prefix };
  fs.writeFileSync(prefixConfigPath, JSON.stringify(data, null, 2));
}

module.exports = { getPrefix, setPrefix };