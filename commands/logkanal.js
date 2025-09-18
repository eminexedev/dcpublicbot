const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const configPath = './prefixConfig.json';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logkanal')
		.setDescription('Moderasyon loglarının gönderileceği kanalı ayarlar.')
		.addChannelOption(option =>
			option.setName('kanal')
				.setDescription('Log kanalı')
				.setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interactionOrMessage, args) {
		// Slash komut
		if (interactionOrMessage.isChatInputCommand && interactionOrMessage.isChatInputCommand()) {
			const channel = interactionOrMessage.options.getChannel('kanal');
			const guildId = interactionOrMessage.guild.id;
			let config = {};
			try {
				config = require(configPath);
			} catch {}
			config[guildId] = config[guildId] || {};
			config[guildId].logChannelId = channel.id;
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
			return interactionOrMessage.reply({ content: `Log kanalı <#${channel.id}> olarak ayarlandı.`, ephemeral: true });
		}
		// Prefix komut
		if (interactionOrMessage.content) {
			const channelMention = args[0];
			if (!channelMention) return interactionOrMessage.reply('Bir kanal belirtmelisin.');
			const channelId = channelMention.replace(/[<#>]/g, '');
			const channel = interactionOrMessage.guild.channels.cache.get(channelId);
			if (!channel) return interactionOrMessage.reply('Kanal bulunamadı.');
			const guildId = interactionOrMessage.guild.id;
			let config = {};
			try {
				config = require(configPath);
			} catch {}
			config[guildId] = config[guildId] || {};
			config[guildId].logChannelId = channel.id;
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
			return interactionOrMessage.reply(`Log kanalı <#${channel.id}> olarak ayarlandı.`);
		}
	}
};
