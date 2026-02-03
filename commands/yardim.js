const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function getUserCommandsEmbed() {
	return new EmbedBuilder()
		.setTitle('Yardım Menüsü - Genel Komutlar')
		.setColor('#00D166')
		.setDescription('**Herkesin kullanabileceği komutlar:**')
		.addFields(
			{
				name: '📊 İstatistik Komutları',
				value: '`/istatistik` - Sunucu aktivite istatistiklerini gösterir\n' +
					   '`/stat` - Kısa istatistik özeti\n' +
					   '`/statembed` - Detaylı kullanıcı istatistiklerini embed ile gösterir\n' +
					   '`/topchat` - En çok mesaj atanları listeler\n' +
					   '`/rolliste` - Sunucudaki tüm rolleri listeler\n' +
					   '`/banlist` - Sunucudan banlanan kullanıcıları listeler',
				inline: false
			},
			{
				name: '🖼️ Kullanıcı Komutları',
				value: '`/avatar [@kullanıcı]` - Kullanıcının profil resmini gösterir\n' +
					   '• Kendi avatarınız: `/avatar` veya `!avatar`\n' +
					   '• Başka kullanıcı: `/avatar @kullanıcı` veya `!avatar @kullanıcı`\n' +
					   '• ID ile: `!avatar 123456789012345678`\n' +
					   '• Yüksek kalite indirme linkleri dahil\n' +
					   '`/nerede <@kullanıcı>` - Kullanıcı nerede? (ses/aktiflik)\n' +
					   '`/sleep` - Rahatsız etmeyin modunu aç/kapat',
				inline: false
			},
			{
				name: '🎉 Eğlence Komutları', 
				value: '`/cekilis <ödül> <süre> <kazanan_sayısı>` - Gelişmiş çekiliş başlatır\n' +
					   '• Butonlu katılım sistemi\n' +
					   '• Otomatik kazanan seçimi\n' +
					   '• Süre dolunca sonuç açıklaması',
				inline: false
			},
			{
				name: 'ℹ️ Sunucu ve Rol Bilgisi',
				value: '`/rolbilgi <@rol>` - Rol hakkında detaylı bilgi\n' +
					   '`/rollog <@kullanıcı>` - Kullanıcının rol ekleme/çıkarma geçmişi (yetki gerekir)',
				inline: false
			},
			{
				name: '❓ Yardım',
				value: '`/yardım` veya `!yardım` - Bu yardım menüsünü gösterir\n' +
					   '• Slash komutlar: `/komut_adı`\n' +
					   '• Prefix komutlar: `!komut_adı`',
				inline: false
			}
		)
		.setFooter({ 
			text: '💡 Yetkili komutları görmek için "Moderasyon Komutları" butonuna tıklayın!'
		})
		.setTimestamp();
}

function getModCommandsEmbed() {
	return new EmbedBuilder()
		.setTitle('Moderasyon Komutları')
		.setColor('#ED4245')
		.setDescription('**Sadece yetkililerin kullanabileceği komutlar:**')
		.addFields(
			{
				name: '⚡ Temel Moderasyon',
				value: '`/ban <kullanıcı>` - İnteraktif sebep seçimi ile banlar\n' +
					   '`/unban <kullanıcı_id> [sebep]` - Kullanıcının banını kaldırır\n' +
					   '`/kick <kullanıcı> [sebep]` - Kullanıcıyı sunucudan atar\n' +
					   '`/mute <kullanıcı>` - İnteraktif menü ile kullanıcıyı susturur\n' +
					   '`/vmute <kullanıcı>` - Kullanıcıyı bulunduğu ses kanalında susturur\n' +
					   '`/unmute <kullanıcı> [sebep]` - Kullanıcının susturmasını kaldırır\n' +
					   '`/sil <sayı>` - Belirtilen sayıda mesajı siler (1-100)\n\n' +
					   '**🔇 Mute Sistemi:**\n' +
					   '• `!mute @user` → Dropdown menü açılır\n' +
					   '• Sebep seçenekleri: Küfür (5dk), ADK (30dk), Kışkırtma (5dk), Tehdit (20dk)',
				inline: false
			},
			{
				name: '📝 Kayıt Sistemi',
				value: '`/kayıt <kullanıcı>` - İnteraktif kayıt sistemi (cinsiyet + yaş)\n' +
					   '`/topkayıt` - Kayıt istatistiklerini gösterir (erkek/kadın/en çok kayıt yapanlar)\n' +
					   '`/kayıt-ayar log-kanal <#kanal>` - Kayıt log kanalını ayarlar\n' +
					   '`/kayıt-ayar erkek-rol <@rol>` - Erkek rolünü ayarlar\n' +
					   '`/kayıt-ayar kadın-rol <@rol>` - Kadın rolünü ayarlar\n' +
					   '`/kayıt-ayar üye-rol <@rol>` - Üye rolünü ayarlar\n' +
					   '`/kayıt-ayar kayıtsız-rol <@rol>` - Kayıtsız rolünü ayarlar\n' +
					   '`/kayıt-ayar durum` - Kayıt sistemi yapılandırma durumu\n' +
					   '`/kayıt-ayar sıfırla` - Tüm kayıt ayarlarını sıfırlar\n' +
					   '• Yeni üyeler otomatik kayıtsız rol alır',
				inline: false
			},
			{
				name: '🔒 Kanal Yönetimi',
				value: '`/lock` - Kanalı kilitler (yazma yasaklar)\n' +
					   '`/unlock` - Kanal kilidini açar\n' +
					   '• Sadece bulunduğunuz kanalda etkilidir\n' +
					   '• @everyone rolünün yazma yetkisini düzenler',
				inline: false
			},
			{
				name: '👥 Rol Yönetimi', 
				value: '`/rolver <kullanıcı> <rol> [sebep]` - Kullanıcıya rol verir\n' +
					   '`/rolal <kullanıcı> <rol> [sebep]` - Kullanıcıdan rol alır\n' +
					   '`/rollerisil` - Sunucudaki tüm rolleri siler ⚠️\n' +
					   '`/rollog <@kullanıcı>` - Kullanıcının rol değişim geçmişini listeler\n' +
					   '• Güvenlik kontrolü ve onay sistemi vardır',
				inline: false
			},
			{
				name: '⚙️ Sunucu Ayarları',
				value: '`/prefix [yeni_prefix]` - Komut prefix\'ini ayarlar/gösterir\n' +
					   '`/logkanal <#kanal>` - Log kanalını ayarlar\n' +
					   '`/davetlog <#kanal>` - Davet log kanalını ayarlar\n' +
					   '`/istatistikkanal <tip> <kanal_türü>` - İstatistik kanalı oluşturur\n' +
					   '`/emoji <isim> <dosya>` - Sunucuya emoji ekler',
				inline: false
			},
			{
				name: '📋 Ban Yönetimi',
				value: '`/banlogkanal <#kanal>` - Ban loglarının gönderileceği kanalı ayarlar\n' +
					   '`/banlogdurum` - Ban log sisteminin durumunu gösterir\n' +
					   '`/banlogkanal` - Mevcut ban log kanalını gösterir\n' +
					   '• Otomatik ban kayıtları ve bildirimler',
				inline: false
			},
			{
				name: '🏗️ Sunucu Şablonu',
				value: '`/sunucusablon <şablon_linki>` - Discord şablonunu uygular\n' +
					   '`/sunucubilgilendirme` - Sunucu hakkında detaylı bilgi\n' +
					   '`/şablon-oluştur <isim> [açıklama]` - Mevcut sunucu yapısından şablon oluşturur\n' +
					   '`/şablonlar [şablon-id]` - Kayıtlı şablonları listeler ve detaylarını gösterir\n' +
					   '`/discord-şablonları <listele|sil|sync>` - Discord şablonlarını yönetir\n' +
					   '• Otomatik kanal ve rol oluşturma\n' +
					   '• Discord şablon API entegrasyonu\n' +
					   '• Şablon senkronizasyonu ve güncelleme\n' +
					   '• Gelişmiş şablon analizi ve kaydetme',
				inline: false
			},
			{
				name: '🛡️ Güvenlik Sistemi',
				value: '`/güvenlik-sistemi durum` - Güvenlik sistemi durumunu gösterir\n' +
					   '`/güvenlik-sistemi aç/kapat` - Sistemi aktif/pasif yapar\n' +
					   '`/güvenlik-sistemi ayar` - Eşik, ceza türü, log kanalı ayarları\n' +
					   '`/güvenlik-sistemi muaf-rol <rol> <ekle/kaldır>` - Muaf rol yönetimi\n' +
					   '`/güvenlik-sistemi ihlal-temizle <kullanıcı>` - İhlal geçmişi temizle\n' +
					   '• 24 saatte 3+ ban/kick yapan yetkileri otomatik jail\n' +
					   '• Sağ tık ban/kick dahil tüm moderasyon izleme\n' +
					   '• Whitelist sistemi ve muafiyet yönetimi\n' +
					   '• Detaylı ihlal takibi ve raporlama',
				inline: false
			}
		)
		.setFooter({ 
			text: '⚠️ Dikkat: Bazı komutlar geri alınamaz değişiklikler yapar!'
		})
		.setTimestamp();
}

function getHelpButtons(active) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('help_user')
			.setLabel('🎮 Genel Komutlar')
			.setStyle(ButtonStyle.Success)
			.setDisabled(active === 'user'),
		new ButtonBuilder()
			.setCustomId('help_mod')
			.setLabel('🛡️ Moderasyon Komutları')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(active === 'mod')
	);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('yardım')
		.setDescription('Botun tüm komutlarını ve açıklamalarını gösterir.'),
	async execute(ctx, args) {
		// Slash komut kontrolü
		if (ctx.isCommand && ctx.isCommand()) {
			return ctx.reply({
				embeds: [getUserCommandsEmbed()],
				components: [getHelpButtons('user')],
				ephemeral: true
			});
		}
		// Prefix komut
		else {
			return ctx.reply({
				embeds: [getUserCommandsEmbed()],
				components: [getHelpButtons('user')]
			});
		}
	},
	async handleButton(interaction) {
		try {
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
		} catch (err) {
			// Interaction expired veya başka bir hata
			if (err.code === 10062) {
				if (interaction.replied || interaction.deferred) return;
				try {
					await interaction.reply({
						content: 'Bu butonun süresi dolmuş. Lütfen tekrar `/yardım` komutunu kullanın.',
						ephemeral: true
					});
				} catch {}
			} else {
				console.error(err);
			}
		}
	}
};
