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
	description: 'Moderasyon loglarının gönderileceği kanalı ayarlar.',
	usage: '/logkanal #kanal',
	permissions: [PermissionFlagsBits.Administrator],
	
	async execute(interaction) {
		const channel = interaction.options.getChannel('kanal');

		if (!channel || !channel.isTextBased()) {
			return interaction.reply({
				content: '❌ Lütfen geçerli bir metin kanalı belirtin.',
				ephemeral: true
			});
		}

		try {
			// Log kanalını ayarla
			setLogChannel(interaction.guild.id, channel.id);
			
			const successEmbed = new EmbedBuilder()
				.setColor('#00FF00')
				.setTitle('✅ Log Kanalı Ayarlandı')
				.setDescription(`**${channel}** artık moderasyon logları için kullanılacak.`)
				.addFields(
					{
						name: '📝 Log İçeriği',
						value: '• Moderasyon işlemleri\n• Ban/Kick/Mute logları\n• Kanal kilitleme\n• Rol değişiklikleri',
						inline: true
					},
					{
						name: '🔧 Ayarlanan Kanal',
						value: `${channel}\n\`ID: ${channel.id}\``,
						inline: true
					}
				)
				.setFooter({ 
					text: `${interaction.guild.name} • Log sistemi aktif`, 
					iconURL: interaction.guild.iconURL() 
				})
				.setTimestamp();

			return interaction.reply({ embeds: [successEmbed], ephemeral: true });
		} catch (error) {
			console.error('Log kanalı ayarlama hatası:', error);
			return interaction.reply({
				content: '❌ Log kanalı ayarlanırken bir hata oluştu.',
				ephemeral: true
			});
		}
	}
};