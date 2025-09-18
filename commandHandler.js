const fs = require('fs');
const path = require('path');
const { Collection, Events } = require('discord.js');

module.exports = (client) => {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    // Slash komut adı ile ekle
    client.commands.set(command.data.name, command);
    // Dosya adının uzantısız ve küçük harfli haliyle de ekle (prefix komutlar için)
    const prefixName = path.parse(file).name.toLowerCase();
    if (!client.commands.has(prefixName)) {
      client.commands.set(prefixName, command);
    }
  }

  // const { getPrefix } = require('../prefixConfig');
  const { getPrefix } = require('./prefixConfig');
  // getPrefix fonksiyonunuz şöyle olmalı:
  // function getPrefix(guildId) {
  //   try {
  //     const config = require('./prefixConfig.json');
  //     return config[guildId]?.prefix || '.';
  //   } catch {
  //     return '.';
  //   }
  // }

  // Log kanalını almak için örnek fonksiyon (her sunucu için)
  function getLogChannelId(guildId) {
    try {
      const config = require('./prefixConfig.json');
      return config[guildId]?.logChannelId;
    } catch {
      return null;
    }
  }

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      // Sunucuya özel prefix kontrolü
      if (interaction.guild) {
        const prefix = getPrefix(interaction.guild.id);
        if (prefix && prefix !== '/') {
          return interaction.reply({ content: `Bu sunucuda komutları \
\`${prefix}komut\` şeklinde kullanmalısın.`, flags: 64 });
        }
      }
      try {
        // Sadece interaction gönder
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Bir hata oluştu.', flags: 64 });
      }
    }
    // Çekiliş butonları
    if (interaction.isButton() && interaction.customId === 'join_giveaway') {
      const cekilis = client.commands.get('cekilis');
      if (cekilis && cekilis.handleButton) {
        await cekilis.handleButton(interaction);
      }
    }
    // Yardım menüsü butonları
    if (interaction.isButton() && (interaction.customId === 'help_user' || interaction.customId === 'help_mod')) {
      const yardim = client.commands.get('yardim');
      if (yardim && yardim.handleButton) {
        await yardim.handleButton(interaction);
      }
    }
    // Prefix seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId === 'prefix_select') ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId === 'prefix_select')
    ) {
      const prefix = client.commands.get('prefix');
      if (prefix && prefix.handleSelect) {
        await prefix.handleSelect(interaction);
      }
    }
  });

  // Prefixli komutlar için mesajları dinle
  client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    const prefix = getPrefix(message.guild ? message.guild.id : null) || '.';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      // message ve args gönder
      await command.execute(message, args);
    } catch (error) {
      console.error(error);
      await message.reply('Bir hata oluştu.');
    }
  });

  // Mesaj silindiğinde logla
  client.on(Events.MessageDelete, async message => {
    if (!message.guild) return;
    // Mesaj eksikse fetch et
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        // fetch başarısız olursa devam et
      }
    }
    if (message.author?.bot) return;
    const logChannelId = getLogChannelId(message.guild.id);
    if (!logChannelId) return;
    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    logChannel.send({
      embeds: [{
        title: 'Mesaj Silindi',
        color: 0xED4245,
        fields: [
          { name: 'Kullanıcı', value: message.author ? `${message.author} (${message.author.id})` : 'Bilinmiyor', inline: true },
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Mesaj', value: message.content ? message.content : '(Bilinmiyor veya embed/boş mesaj)' }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Mesaj düzenlendiğinde logla
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!oldMessage.guild) return;
    // Eski veya yeni mesaj eksikse fetch et
    if (oldMessage.partial) {
      try { await oldMessage.fetch(); } catch {}
    }
    if (newMessage.partial) {
      try { await newMessage.fetch(); } catch {}
    }
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const logChannelId = getLogChannelId(oldMessage.guild.id);
    if (!logChannelId) return;
    const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    logChannel.send({
      embeds: [{
        title: 'Mesaj Düzenlendi',
        color: 0xFEE75C,
        fields: [
          { name: 'Kullanıcı', value: oldMessage.author ? `${oldMessage.author} (${oldMessage.author.id})` : 'Bilinmiyor', inline: true },
          { name: 'Kanal', value: `<#${oldMessage.channel.id}>`, inline: true },
          { name: 'Eski Mesaj', value: oldMessage.content ? oldMessage.content : '(Bilinmiyor veya embed/boş mesaj)' },
          { name: 'Yeni Mesaj', value: newMessage.content ? newMessage.content : '(Bilinmiyor veya embed/boş mesaj)' }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Kullanıcı banlandığında logla
  client.on(Events.GuildBanAdd, async ban => {
    const logChannelId = getLogChannelId(ban.guild.id);
    if (!logChannelId) return;
    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    logChannel.send({
      embeds: [{
        title: 'Kullanıcı Banlandı',
        color: 0xED4245,
        fields: [
          { name: 'Kullanıcı', value: `${ban.user} (${ban.user.id})`, inline: true }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Kullanıcı banı kaldırıldığında logla
  client.on(Events.GuildBanRemove, async ban => {
    const logChannelId = getLogChannelId(ban.guild.id);
    if (!logChannelId) return;
    const logChannel = ban.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    logChannel.send({
      embeds: [{
        title: 'Ban Kaldırıldı',
        color: 0x57F287,
        fields: [
          { name: 'Kullanıcı', value: `${ban.user} (${ban.user.id})`, inline: true }
        ],
        timestamp: new Date()
      }]
    });
  });

  // Kullanıcı sunucudan atıldığında (kick) logla
  client.on(Events.GuildMemberRemove, async member => {
    // Kick mi yoksa ayrılma mı anlamak için audit log kontrolü yapılabilir
    const logChannelId = getLogChannelId(member.guild.id);
    if (!logChannelId) return;
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Audit log ile kick tespiti
    const fetchedLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 });
    const kickLog = fetchedLogs.entries.first();
    if (kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) {
      logChannel.send({
        embeds: [{
          title: 'Kullanıcı Kicklendi',
          color: 0xED4245,
          fields: [
            { name: 'Kullanıcı', value: `${member.user} (${member.user.id})`, inline: true },
            { name: 'Yetkili', value: `${kickLog.executor} (${kickLog.executor.id})`, inline: true },
            { name: 'Sebep', value: kickLog.reason || 'Belirtilmedi' }
          ],
          timestamp: new Date()
        }]
      });
    }
  });

  // Timeout (susturma) logu
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const logChannelId = getLogChannelId(newMember.guild.id);
    if (!logChannelId) return;
    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Timeout başlatıldıysa
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
      logChannel.send({
        embeds: [{
          title: 'Kullanıcı Susturuldu (Timeout)',
          color: 0xFEE75C,
          fields: [
            { name: 'Kullanıcı', value: `${newMember.user} (${newMember.user.id})`, inline: true },
            { name: 'Süre', value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime()/1000)}:R>` }
          ],
          timestamp: new Date()
        }]
      });
    }
    // Timeout kaldırıldıysa
    if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
      logChannel.send({
        embeds: [{
          title: 'Kullanıcının Susturması Kaldırıldı',
          color: 0x57F287,
          fields: [
            { name: 'Kullanıcı', value: `${newMember.user} (${newMember.user.id})`, inline: true }
          ],
          timestamp: new Date()
        }]
      });
    }
  });
}
