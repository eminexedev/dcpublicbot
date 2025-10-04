const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const { getStaffRoles, addStaffRole, removeStaffRole, isUserStaff } = require('../adminStaffConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topchat-yetkili')
        .setDescription('Yetkili rollerdeki en aktif 10 üyeyi gösterir')
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Yetkili rollerdeki en aktif üyeleri gösterir')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rol-ekle')
                .setDescription('Yetkili rol listesine rol ekler')
                .addRoleOption(option =>
                    option.setName('rol').setDescription('Eklenecek yetkili rol').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rol-kaldir')
                .setDescription('Yetkili rol listesinden rol kaldırır')
                .addRoleOption(option =>
                    option.setName('rol').setDescription('Kaldırılacak yetkili rol').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('roller')
                .setDescription('Kayıtlı yetkili rolleri gösterir')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    name: 'topchat-yetkili',
    description: 'Yetkili rollerdeki en aktif üyeleri gösterir ve yetkili rolleri yönetir',
    
    async execute(ctx, args) {
        try {
            // Slash komut kontrolü
            if (ctx.isCommand && ctx.isCommand()) {
                const subcommand = ctx.options?.getSubcommand() || 'liste';
                
                if (subcommand === 'liste') {
                    await this.showStaffLeaderboard(ctx);
                } else if (subcommand === 'rol-ekle') {
                    await this.addStaffRoleSlash(ctx);
                } else if (subcommand === 'rol-kaldir') {
                    await this.removeStaffRoleSlash(ctx);
                } else if (subcommand === 'roller') {
                    await this.showStaffRoles(ctx);
                }
            } else {
                // Prefix komut
                if (!args || args.length === 0) {
                    await this.showStaffLeaderboard(ctx);
                    return;
                }

                const action = args[0].toLowerCase();
                
                if (action === 'liste') {
                    await this.showStaffLeaderboard(ctx);
                } else if (action === 'rol-ekle') {
                    await this.addStaffRolePrefix(ctx, args);
                } else if (action === 'rol-kaldir' || action === 'rol-kaldır') {
                    await this.removeStaffRolePrefix(ctx, args);
                } else if (action === 'roller') {
                    await this.showStaffRoles(ctx);
                } else {
                    // Bilinmeyen komut
                    const embed = new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('❓ Kullanım')
                        .setDescription('**Kullanılabilir komutlar:**\n\n' +
                                       '`!topchat-yetkili` - Yetkili leaderboard\n' +
                                       '`!topchat-yetkili liste` - Yetkili leaderboard\n' +
                                       '`!topchat-yetkili rol-ekle @rol` - Yetkili rol ekle\n' +
                                       '`!topchat-yetkili rol-kaldir @rol` - Yetkili rol kaldır\n' +
                                       '`!topchat-yetkili roller` - Kayıtlı rolleri göster')
                        .setTimestamp();
                    
                    await ctx.reply({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('Topchat-yetkili komutu hatası:', error);
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Komut çalıştırılırken bir hata oluştu!')
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed], ephemeral: true });
        }
    },

    async showStaffLeaderboard(ctx) {
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

        // Yetkili rolleri al
        const staffRoles = getStaffRoles(guildId);
        
        if (staffRoles.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Yetkili Rol Bulunamadı')
                .setDescription('Henüz hiç yetkili rol ayarlanmamış!\n\n`/topchat-yetkili rol-ekle` komutu ile yetkili rol ekleyebilirsin.')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed], ephemeral: true });
        }

        // Yetkili üyeleri filtrele
        const staffStats = [];
        
        for (const [userId, messageCount] of Object.entries(guildStats.users)) {
            try {
                const member = await ctx.guild.members.fetch(userId);
                if (isUserStaff(member)) {
                    staffStats.push({ userId, messageCount, member });
                }
            } catch (error) {
                // Üye sunucudan ayrılmış olabilir, devam et
                continue;
            }
        }

        if (staffStats.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Yetkili Aktivite Bulunamadı')
                .setDescription('Yetkili rollere sahip üyelerin henüz mesaj istatistiği bulunmuyor!')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed], ephemeral: true });
        }

        // Sırala ve ilk 10'u al
        const topStaff = staffStats
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, 10);

        // Embed oluştur
        const embed = new EmbedBuilder()
            .setColor('#9d59d2')
            .setTitle('👑 En Aktif Yetkililer')
            .setDescription('Yetkili rollerdeki en çok mesaj atan ilk 10 kişi\n\n✅ **Tüm mesajlar sayılır** (Bot komutları hariç)')
            .setTimestamp()

        let description = '';
        const medals = ['👑', '🥈', '🥉'];

        for (let i = 0; i < topStaff.length; i++) {
            const { messageCount, member } = topStaff[i];
            const medal = i < 3 ? medals[i] : `${i + 1}.`;
            const displayName = member.displayName || member.user.username;
            
            description += `${medal} **${displayName}** - \`${messageCount.toLocaleString()}\` mesaj\n`;
        }

        embed.setDescription(embed.data.description + '\n\n' + description);

        // Toplam istatistikler
        const totalStaffMessages = staffStats.reduce((sum, staff) => sum + staff.messageCount, 0);
        const totalStaffCount = staffStats.length;

        embed.addFields([
            {
                name: '📊 Yetkili İstatistikleri',
                value: `**Toplam Yetkili Mesaj:** \`${totalStaffMessages.toLocaleString()}\`\n**Aktif Yetkili:** \`${totalStaffCount}\``,
                inline: false
            }
        ]);

        await ctx.reply({ embeds: [embed] });
    },

    async addStaffRoleSlash(ctx) {
        const role = ctx.options.getRole('rol');
        const guildId = ctx.guild.id;

        if (addStaffRole(guildId, role.id)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Yetkili Rol Eklendi')
                .setDescription(`**${role.name}** rolü yetkili roller listesine eklendi!`)
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Yetkili rol eklenirken bir hata oluştu!')
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed], ephemeral: true });
        }
    },

    async addStaffRolePrefix(ctx, args) {
        // Yetki kontrolü
        if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Yetkisiz')
                .setDescription('Bu komutu kullanmak için Administrator yetkisine ihtiyacınız var!')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed] });
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('❓ Kullanım')
                .setDescription('**Kullanım:** `!topchat-yetkili rol-ekle @rol`\n\n**Örnek:** `!topchat-yetkili rol-ekle @Moderator`')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed] });
        }

        // Rol mention'ını veya ID'sini parse et
        let role = null;
        const roleArg = args[1];

        // Mention kontrolü (<@&123456789>)
        const mentionMatch = roleArg.match(/^<@&(\d+)>$/);
        if (mentionMatch) {
            try {
                role = await ctx.guild.roles.fetch(mentionMatch[1]);
            } catch (error) {
                // Rol bulunamadı
            }
        } else if (/^\d+$/.test(roleArg)) {
            // Sadece ID
            try {
                role = await ctx.guild.roles.fetch(roleArg);
            } catch (error) {
                // Rol bulunamadı
            }
        } else {
            // İsim ile arama
            role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
        }

        if (!role) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Rol Bulunamadı')
                .setDescription('Belirtilen rol bulunamadı! Rolü etiketlediğinizden veya doğru ID verdiğinizden emin olun.')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed] });
        }

        const guildId = ctx.guild.id;

        if (addStaffRole(guildId, role.id)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Yetkili Rol Eklendi')
                .setDescription(`**${role.name}** rolü yetkili roller listesine eklendi!`)
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Yetkili rol eklenirken bir hata oluştu!')
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        }
    },

    async removeStaffRoleSlash(ctx) {
        const role = ctx.options.getRole('rol');
        const guildId = ctx.guild.id;

        if (removeStaffRole(guildId, role.id)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Yetkili Rol Kaldırıldı')
                .setDescription(`**${role.name}** rolü yetkili roller listesinden kaldırıldı!`)
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Yetkili rol kaldırılırken bir hata oluştu!')
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        }
    },

    async removeStaffRolePrefix(ctx, args) {
        // Yetki kontrolü
        if (!ctx.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Yetkisiz')
                .setDescription('Bu komutu kullanmak için Administrator yetkisine ihtiyacınız var!')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed] });
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('❓ Kullanım')
                .setDescription('**Kullanım:** `!topchat-yetkili rol-kaldir @rol`\n\n**Örnek:** `!topchat-yetkili rol-kaldir @Moderator`')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed] });
        }

        // Rol mention'ını veya ID'sini parse et
        let role = null;
        const roleArg = args[1];

        // Mention kontrolü (<@&123456789>)
        const mentionMatch = roleArg.match(/^<@&(\d+)>$/);
        if (mentionMatch) {
            try {
                role = await ctx.guild.roles.fetch(mentionMatch[1]);
            } catch (error) {
                // Rol bulunamadı
            }
        } else if (/^\d+$/.test(roleArg)) {
            // Sadece ID
            try {
                role = await ctx.guild.roles.fetch(roleArg);
            } catch (error) {
                // Rol bulunamadı
            }
        } else {
            // İsim ile arama
            role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
        }

        if (!role) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Rol Bulunamadı')
                .setDescription('Belirtilen rol bulunamadı! Rolü etiketlediğinizden veya doğru ID verdiğinizden emin olun.')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed] });
        }

        const guildId = ctx.guild.id;

        if (removeStaffRole(guildId, role.id)) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Yetkili Rol Kaldırıldı')
                .setDescription(`**${role.name}** rolü yetkili roller listesinden kaldırıldı!`)
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Hata')
                .setDescription('Yetkili rol kaldırılırken bir hata oluştu!')
                .setTimestamp();
            
            await ctx.reply({ embeds: [embed] });
        }
    },

    // Eski fonksiyonları kaldıralım, artık kullanılmayacak
    async addStaffRole(ctx) {
        // Bu fonksiyon artık kullanılmıyor - slash için addStaffRoleSlash kullanılıyor
    },

    async removeStaffRole(ctx) {
        // Bu fonksiyon artık kullanılmıyor - slash için removeStaffRoleSlash kullanılıyor
    },

    async showStaffRoles(ctx) {
        const guildId = ctx.guild.id;
        const staffRoles = getStaffRoles(guildId);

        if (staffRoles.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Yetkili Rol Bulunamadı')
                .setDescription('Henüz hiç yetkili rol ayarlanmamış!')
                .setTimestamp();
            
            return ctx.reply({ embeds: [embed], ephemeral: true });
        }

        let roleList = '';
        for (let i = 0; i < staffRoles.length; i++) {
            try {
                const role = await ctx.guild.roles.fetch(staffRoles[i]);
                if (role) {
                    roleList += `${i + 1}. **${role.name}** (${role.members.size} üye)\n`;
                }
            } catch (error) {
                roleList += `${i + 1}. **Silinmiş Rol** (ID: ${staffRoles[i]})\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#9d59d2')
            .setTitle('👑 Kayıtlı Yetkili Roller')
            .setDescription(roleList)
            .setTimestamp()
            .setFooter({ 
                text: `${staffRoles.length} yetkili rol kayıtlı`, 
                iconURL: ctx.guild.iconURL() 
            });

        await ctx.reply({ embeds: [embed] });
    }
};