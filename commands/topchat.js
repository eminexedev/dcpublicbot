const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topchat')
        .setDescription('Sunucuda en aktif 10 üyeyi gösterir'),
    name: 'topchat',
    description: 'Sunucuda en aktif 10 üyeyi gösterir',
    
    async execute(ctx) {
        try {
            // statsData.json dosyasını oku
            let statsData = {};
            try {
                const data = fs.readFileSync('./statsData.json', 'utf8');
                statsData = JSON.parse(data);
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Hata')
                    .setDescription('İstatistik verileri bulunamadı!')
                    .setTimestamp();
                
                return ctx.reply({ embeds: [embed], ephemeral: true });
            }

            const guildId = ctx.guild.id;
            const guildStats = statsData[guildId];

            if (!guildStats || !guildStats.users) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Veri Bulunamadı')
                    .setDescription('Bu sunucu için henüz istatistik verisi bulunmuyor!')
                    .setTimestamp();
                
                return ctx.reply({ embeds: [embed], ephemeral: true });
            }

            // Kullanıcıları mesaj sayısına göre sırala
            const userStats = Object.entries(guildStats.users)
                .map(([userId, messageCount]) => ({
                    userId,
                    messageCount
                }))
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, 10); // İlk 10'u al

            if (userStats.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Veri Bulunamadı')
                    .setDescription('Henüz hiç mesaj istatistiği bulunmuyor!')
                    .setTimestamp();
                
                return ctx.reply({ embeds: [embed], ephemeral: true });
            }

            // Leaderboard embed'i oluştur
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏆 En Aktif Üyeler')
                .setDescription('Sunucuda en çok mesaj atan ilk 10 kişi\n\n✅ **Tüm mesajlar sayılır** (Bot komutları hariç)')
                .setTimestamp()

            let description = '';
            const medals = ['🥇', '🥈', '🥉'];

            for (let i = 0; i < userStats.length; i++) {
                const { userId, messageCount } = userStats[i];
                
                try {
                    const user = await ctx.guild.members.fetch(userId);
                    const medal = i < 3 ? medals[i] : `${i + 1}.`;
                    const displayName = user.displayName || user.user.username;
                    
                    description += `${medal} **${displayName}** - \`${messageCount.toLocaleString()}\` mesaj\n`;
                } catch (error) {
                    // Kullanıcı sunucudan ayrılmış olabilir
                    const medal = i < 3 ? medals[i] : `${i + 1}.`;
                    description += `${medal} **Ayrılmış Üye** - \`${messageCount.toLocaleString()}\` mesaj\n`;
                }
            }

            embed.setDescription(description);

            // Toplam istatistikleri ekle
            const totalMessages = Object.values(guildStats.users).reduce((sum, count) => sum + count, 0);
            const totalUsers = Object.keys(guildStats.users).length;

            embed.addFields([
                {
                    name: '📊 Genel İstatistikler',
                    value: `**Mesaj:** \`${totalMessages.toLocaleString()}\`\n**Aktif Üye:** \`${totalUsers}\``,
                    inline: false
                }
            ]);

            await ctx.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Top komutu hatası:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Komut çalıştırılırken bir hata oluştu!')
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed], ephemeral: true });
        }
    }
};