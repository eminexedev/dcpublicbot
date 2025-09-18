const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'logConfig.json');

function getLogChannel(guildId) {
	if (!fs.existsSync(configPath)) return null;
	const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	return data[guildId] || null;
}

function setLogChannel(guildId, channelId) {
	let data = {};
	if (fs.existsSync(configPath)) {
		data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	}
	data[guildId] = channelId;
	fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

module.exports = { getLogChannel, setLogChannel };
