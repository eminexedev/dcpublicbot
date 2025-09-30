const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setLogChannel } = require('../config');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('logkanal')
		.setDescription('Moderasyon loglarının gönderileceği kanalı ayarlar.')
		.addChannelOption(option =>
			option.setName('kanal')
				.setDescription('Log kanalı')
				.setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	
	category: 'config',
	description: 'Moderasyon loglarının gönderileceği kanalı ayarlar. Kullanım: .logkanal #kanal',
	usage: '.logkanal #kanal',
	permissions: [PermissionFlagsBits.Administrator],
	
	async execute(ctx, args) {
		let channel;

		if (ctx.isCommand && ctx.isCommand()) {
			// Slash komut
			channel = ctx.options.getChannel('kanal');
		} else {
			// Prefix komut
			if (!args[0]) {
				return ctx.reply({
					content: 'Bir kanal belirtmelisin.',
					ephemeral: true
				});
			}

			// Kanal mention veya ID'yi parse et
			const channelMatch = args[0].match(/^<#(\d+)>$|^(\d+)$/);
			if (!channelMatch) {
				return ctx.reply({
					content: 'Geçerli bir kanal etiketlemelisin.',
					ephemeral: true
				});
			}

			const channelId = channelMatch[1] || channelMatch[2];
			channel = ctx.guild.channels.cache.get(channelId);
		}
		
		if (!channel) {
			return ctx.reply({
				content: 'Kanal bulunamadı.',
				ephemeral: true
			});
		}

		if (!channel.isTextBased()) {
			return ctx.reply({
				content: 'Lütfen bir yazı kanalı seçin.',
				ephemeral: true
			});
		}

		// Config'e kaydet
		setLogChannel(ctx.guild.id, channel.id);

		const embed = new EmbedBuilder()
			.setColor('#00FF00')
			.setTitle('✅ Log Kanalı Ayarlandı')
			.setDescription(`Moderasyon logları artık ${channel} kanalına gönderilecek.`)
			.addFields({
				name: '📍 Ayarlanan Kanal',
				value: `${channel} (\`${channel.id}\`)`,
				inline: true
			})
			.setFooter({ 
				text: `${ctx.guild.name} • Log sistemi aktif`, 
				iconURL: ctx.guild.iconURL({ dynamic: true }) || undefined 
			})
			.setTimestamp();

		return ctx.reply({ embeds: [embed] });
	}
};
