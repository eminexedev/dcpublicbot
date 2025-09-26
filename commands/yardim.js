const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function getUserCommandsEmbed() {
	return new EmbedBuilder()
		.setTitle('Yardım Menüsü - Kullanıcı Komutları')
		.setColor('#5865F2')
		.setDescription('Kullanıcıların erişebileceği komutlar:')
		.addFields(
			{ name: '/cekilis', value: '`/cekilis odul:Ödül sure:10 kazanan:1`\nGelişmiş çekiliş başlatır. Katılım butonludur, süre sonunda kazananlar otomatik seçilir.' },
			{ name: '/emoji', value: '`/emoji isim:[isim] gorsel:[dosya]`\nSunucuya yeni emoji ekler. Sadece yetkililer kullanabilir.' },
			{ name: '/prefix', value: '`/prefix`\nSunucu için komut prefixini ayarlayın.' },
			{ name: 'Gelen/Giden Karşılama', value: 'Sunucuya giren ve çıkan üyeler için otomatik karşılama/güle güle görseli gönderilir.' },
			{ name: 'Otomatik Log Sistemi', value: 'Bot sunucuya katıldığında otomatik olarak `bot-log` kanalı oluşturur ve tüm logları oraya gönderir.' }
		)
		.setTimestamp();
}

function getModCommandsEmbed() {
	return new EmbedBuilder()
		.setTitle('Yardım Menüsü - Moderasyon Komutları')
		.setColor('#ED4245')
		.setDescription('Yalnızca yetkililerin kullanabileceği komutlar:')
		.addFields(
			{ name: '/ban', value: '`/ban kullanici:@kullanici sebep:[sebep]`\nBelirtilen kullanıcıyı sunucudan banlar.' },
			{ name: '/kick', value: '`/kick kullanici:@kullanici sebep:[sebep]`\nBelirtilen kullanıcıyı sunucudan atar.' },
			{ name: '/mute', value: '`/mute kullanici:@kullanici sure:10 sebep:[sebep]`\nBelirtilen kullanıcıyı belirtilen dakika kadar susturur.' },
			{ name: '/rollerisil', value: '`/rollerisil`\nSunucudaki tüm rolleri siler (korumalı roller hariç, detaylı bilgi verir). **Dikkatli kullanın!**' },
			{ name: '/sunucusablon', value: '`/sunucusablon link:ŞablonLinki`\nBelirtilen Discord şablonunu sunucuya uygular. Rolleri ve kanalları otomatik oluşturur.' },
			{ name: '/lock', value: '`/lock`\nBulunduğunuz metin kanalını kilitler (yazmaya kapatır).' },
			{ name: '/emoji', value: '`/emoji isim:[isim] gorsel:[dosya]`\nSunucuya yeni emoji ekler. Sadece yetkililer kullanabilir.' },
			{ name: '/logkanal', value: '`/logkanal kanal:#kanal`\nBan, mute ve kick işlemlerinin loglanacağı kanalı ayarlar.' },
			{ name: '/davetlog', value: '`/davetlog kanal:#kanal`\nDavet loglarının gönderileceği kanalı ayarlar.' },
			{ name: '/istatistikkanal', value: '`/istatistikkanal tip:uye/aktif kanalturu:text/voice`\nÜye veya aktif kullanıcı sayısını gösterecek kanal oluşturur.' },
			{ name: '/prefix', value: '`/prefix`\nSunucu için komut prefixini ayarlayın.' }
		)
		.setTimestamp();
}

function getHelpButtons(active) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('help_user')
			.setLabel('Kullanıcı Komutları')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(active === 'user'),
		new ButtonBuilder()
			.setCustomId('help_mod')
			.setLabel('Moderasyon Komutları')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(active === 'mod')
	);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('yardım')
		.setDescription('Botun tüm komutlarını ve açıklamalarını gösterir.'),
	async execute(interactionOrMessage, args) {
		// Slash komut
		if (interactionOrMessage.isChatInputCommand && interactionOrMessage.isChatInputCommand()) {
			return interactionOrMessage.reply({
				embeds: [getUserCommandsEmbed()],
				components: [getHelpButtons('user')],
				flags: 64
			});
		}
		// Prefix komut
		if (interactionOrMessage.content) {
			return interactionOrMessage.reply({
				embeds: [getUserCommandsEmbed()],
				components: [getHelpButtons('user')]
			});
		}
		return;
	},
	async handleButton(interaction) {
		if (interaction.customId === 'help_user') {
			await interaction.update({
				embeds: [getUserCommandsEmbed()],
				components: [getHelpButtons('user')],
				ephemeral: true
			});
		} else if (interaction.customId === 'help_mod') {
			await interaction.update({
				embeds: [getModCommandsEmbed()],
				components: [getHelpButtons('mod')],
				ephemeral: true
			});
		}
	}
};
