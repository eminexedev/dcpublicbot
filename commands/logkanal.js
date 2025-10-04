const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
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
	
	async execute(ctx, args) {
		// ctx hem slash interaction hem de prefix message olabilir
		const isSlash = !!(ctx.isChatInputCommand && ctx.isChatInputCommand());
		const guild = ctx.guild || (ctx.message && ctx.message.guild);
		if (!guild) {
			if (isSlash) return ctx.reply({ content: 'Sunucu bağlamı bulunamadı.', ephemeral: true });
			return ctx.reply('Sunucu bağlamı bulunamadı.');
		}

		// Yetki kontrolü (prefix tarafında da uygulansın)
		const member = guild.members.cache.get((isSlash ? ctx.user.id : ctx.author.id));
		if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
			const msg = '❌ Bu komutu kullanmak için Yönetici yetkisine sahip olmalısın.';
			if (isSlash) return ctx.reply({ content: msg, ephemeral: true });
			return ctx.reply(msg);
		}

		let channel = null;
		if (isSlash) {
			channel = ctx.options.getChannel('kanal');
		} else {
			// Prefix kullanım: .logkanal #kanal veya .logkanal kanalID
			const raw = args && args[0];
			if (!raw) {
				return ctx.reply('Kullanım: `.logkanal #kanal` veya `.logkanal kanalID`');
			}
			const idMatch = raw.match(/^(?:<#)?(\d{17,20})>?$/);
			if (idMatch) {
				channel = guild.channels.cache.get(idMatch[1]);
			}
		}

		if (!channel) {
			const msg = '❌ Geçerli bir kanal belirtmelisin.';
			if (isSlash) return ctx.reply({ content: msg, ephemeral: true });
			return ctx.reply(msg);
		}

		// Text tabanlı kanal kontrolü (Forum & Announcement dahil)
		const isTextLike = channel.isTextBased && channel.isTextBased();
		if (!isTextLike || channel.type === ChannelType.GuildVoice) {
			const msg = '❌ Lütfen metin tabanlı (text/announcement/forum) bir kanal seç.';
			if (isSlash) return ctx.reply({ content: msg, ephemeral: true });
			return ctx.reply(msg);
		}

		try {
			setLogChannel(guild.id, channel.id);

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
					text: `${guild.name} • Log sistemi aktif`,
					iconURL: guild.iconURL()
				})
				.setTimestamp();

			if (isSlash) {
				return ctx.reply({ embeds: [successEmbed], ephemeral: true });
			} else {
				return ctx.reply({ embeds: [successEmbed] });
			}
		} catch (error) {
			console.error('Log kanalı ayarlama hatası:', error);
			const msg = '❌ Log kanalı ayarlanırken bir hata oluştu.';
			if (isSlash) return ctx.reply({ content: msg, ephemeral: true });
			return ctx.reply(msg);
		}
	}
};