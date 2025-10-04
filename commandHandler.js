const fs = require('fs');
const path = require('path');
const { Collection, Events } = require('discord.js');

module.exports = (client) => {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${file}`);
      
      // Universal handler komutları için kontrol
      if (command && typeof command === 'object' && command.data && command.data.name) {
        // Sadece slash komut adı ile ekle (tek kayıt)
        client.commands.set(command.data.name, command);
        console.log(`✅ Komut yüklendi: ${command.data.name}`);
      } else if (command && typeof command === 'function') {
        // Eski tip komutlar (fonksiyon olarak export edilen)
        console.warn(`[WARNING] Eski format komut atlandı: ${file}`);
      } else {
        console.warn(`[WARNING] Komut yüklenemedi: ${file} - Geçersiz yapı`);
      }
    } catch (error) {
      console.error(`[ERROR] Komut yüklenirken hata (${file}):`, error.message);
    }
  }

  // const { getPrefix } = require('../prefixConfig');
  const { getPrefix } = require('./config');
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
      
      // SÜPER GÜÇLÜ SLASH KOMUT EXECUTION KONTROLÜ
      if (!client._slashExecutions) client._slashExecutions = new Set();
      if (!client._lastSlashExecutionTime) client._lastSlashExecutionTime = new Map();
      
      const slashKey = `${interaction.user.id}_${interaction.commandName}`;
      const now = Date.now();
      const lastExecution = client._lastSlashExecutionTime.get(slashKey);
      
      // Eğer son 2 saniye içinde aynı komut çalıştırıldıysa engelle
      if (lastExecution && (now - lastExecution) < 2000) {
        console.log(`🚫 [ANTI-SPAM] /${interaction.commandName} komutu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      
      if (client._slashExecutions.has(slashKey)) {
        console.log(`🚫 [ANTI-CLONE] /${interaction.commandName} komutu hala işleniyor: ${interaction.user.tag}`);
        return; // Zaten işleniyor
      }
      
      client._slashExecutions.add(slashKey);
      client._lastSlashExecutionTime.set(slashKey, now);
      
      // 5 saniye sonra temizle
      setTimeout(() => {
        client._slashExecutions.delete(slashKey);
      }, 5000);
      
      try {
        // Slash komut için ctx wrapper oluştur
        const ctx = {
          ...interaction,
          isCommand: () => true, // Bu slash komut
          author: interaction.user, // Prefix uyumluluğu için
          reply: async (content) => {
            if (interaction.replied || interaction.deferred) {
              return await interaction.followUp(content);
            } else {
              return await interaction.reply(content);
            }
          }
        };
        
        await command.execute(ctx, []);
      } catch (error) {
        console.error('[SLASH COMMAND ERROR]', error);
        const errorMsg = { content: 'Bir hata oluştu.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
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
      const yardim = client.commands.get('yardım');
      if (yardim && yardim.handleButton) {
        try {
          await yardim.handleButton(interaction);
        } catch (error) {
          console.error('[HELP BUTTON ERROR]', error);
        }
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
    // Mute seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('mute_')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('mute_'))
    ) {
      // SÜPER GÜÇLÜ SELECT MENU EXECUTION KONTROLÜ
      if (!client._selectMenuExecutions) client._selectMenuExecutions = new Set();
      if (!client._lastSelectExecutionTime) client._lastSelectExecutionTime = new Map();
      
      const selectKey = `${interaction.user.id}_${interaction.customId}`;
      const now = Date.now();
      const lastExecution = client._lastSelectExecutionTime.get(selectKey);
      
      // Eğer son 1 saniye içinde aynı select menu çalıştırıldıysa engelle
      if (lastExecution && (now - lastExecution) < 1000) {
        console.log(`🚫 [ANTI-SPAM] Select menu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      
      if (client._selectMenuExecutions.has(selectKey)) {
        console.log(`🚫 [ANTI-CLONE] Select menu hala işleniyor: ${interaction.user.tag}`);
        return; // Zaten işleniyor
      }
      
      client._selectMenuExecutions.add(selectKey);
      client._lastSelectExecutionTime.set(selectKey, now);
      
      // 5 saniye sonra temizle
      setTimeout(() => {
        client._selectMenuExecutions.delete(selectKey);
      }, 5000);
      
      const mute = client.commands.get('mute');
      if (mute && mute.handleSelectMenu) {
        await mute.handleSelectMenu(interaction);
      }
    }
    
    // Jail seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('jail_')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('jail_'))
    ) {
      // SÜPER GÜÇLÜ SELECT MENU EXECUTION KONTROLÜ
      if (!client._selectMenuExecutions) client._selectMenuExecutions = new Set();
      if (!client._lastSelectExecutionTime) client._lastSelectExecutionTime = new Map();
      
      const selectKey = `${interaction.user.id}_${interaction.customId}`;
      const now = Date.now();
      const lastExecution = client._lastSelectExecutionTime.get(selectKey);
      
      // Eğer son 1 saniye içinde aynı select menu çalıştırıldıysa engelle
      if (lastExecution && (now - lastExecution) < 1000) {
        console.log(`🚫 [ANTI-SPAM] Jail select menu çok hızlı çalıştırılıyor: ${interaction.user.tag}`);
        return;
      }
      
      if (client._selectMenuExecutions.has(selectKey)) {
        console.log(`🚫 [ANTI-CLONE] Jail select menu hala işleniyor: ${interaction.user.tag}`);
        return; // Zaten işleniyor
      }
      
      client._selectMenuExecutions.add(selectKey);
      client._lastSelectExecutionTime.set(selectKey, now);
      
      // 5 saniye sonra temizle
      setTimeout(() => {
        client._selectMenuExecutions.delete(selectKey);
      }, 5000);
      
      const jail = client.commands.get('jail');
      if (jail && jail.handleSelectMenu) {
        await jail.handleSelectMenu(interaction);
      }
    }
    // Kayıt seçim menüsü
    if (
      (interaction.isStringSelectMenu && interaction.customId && interaction.customId.startsWith('kayit_')) ||
      (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('kayit_'))
    ) {
      const kayit = client.commands.get('kayıt');
      if (kayit && kayit.handleSelectMenu) {
        await kayit.handleSelectMenu(interaction);
      }
    }
    // Modal işlemleri (kayıt modal'ı)
    if (interaction.isModalSubmit && interaction.customId && interaction.customId.startsWith('registration_')) {
      const kayit = client.commands.get('kayıt');
      if (kayit && kayit.handleModal) {
        await kayit.handleModal(interaction);
      }
    }
  });

  // Universal Handler ile prefix komut sistemi
  client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    
    const prefix = getPrefix(message.guild.id) || '.';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    // Komut arama: önce tam isim, sonra alternatif isimler
    let command = client.commands.get(commandName);
    if (!command) {
      // Alternatif komut isimleri için arama
      const alternativeNames = {
        'mesajsil': 'sil',
        'sil': 'sil',
        'clear': 'sil',
        'purge': 'sil'
      };
      const altName = alternativeNames[commandName];
      if (altName) {
        command = client.commands.get(altName);
      }
    }
    if (!command) return;
    
    // MODERATION KOMUTLARI İÇİN EK GÜVENLİK KONTROLÜ
    const moderationCommands = ['mute', 'unmute', 'ban', 'unban', 'kick', 'kayıt', 'kayit'];
    if (moderationCommands.includes(commandName)) {
      console.log(`🛡️ [SECURITY] Moderation komut girişimi: ${commandName} - User: ${message.author.tag} (${message.author.id})`);
      
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        return message.reply('❌ Üye bilgisi alınamadı.');
      }
      
      // Yetki kontrol listesi
      const requiredPerms = {
        'mute': 'MuteMembers',
        'unmute': 'MuteMembers', 
        'ban': 'BanMembers',
        'unban': 'BanMembers',
        'kick': 'KickMembers',
        'kayıt': 'ManageRoles',
        'kayit': 'ManageRoles'
      };
      
      const requiredPerm = requiredPerms[commandName];
      if (requiredPerm && !member.permissions.has(requiredPerm)) {
        console.log(`🚫 [SECURITY] YETKİSİZ ERİŞİM ENGELLENDİ: ${message.author.tag} ${commandName} komutunu kullanmaya çalıştı`);
        return message.reply('❌ **GÜVENLİK: YETKİSİZ ERİŞİM!** Bu moderation komutunu kullanma yetkiniz yok.');
      }
    }
    
    // SÜPER GÜÇLÜ ÇİFT EXECUTION KONTROLÜ
    const executionKey = `${message.author.id}_${commandName}`;
    if (!client._prefixExecutions) client._prefixExecutions = new Set();
    if (!client._lastExecutionTime) client._lastExecutionTime = new Map();
    
    const now = Date.now();
    const lastExecution = client._lastExecutionTime.get(executionKey);
    
    // Eğer son 3 saniye içinde aynı komut çalıştırıldıysa engelle
    if (lastExecution && (now - lastExecution) < 3000) {
      console.log(`🚫 [ANTI-SPAM] ${commandName} komutu çok hızlı çalıştırılıyor: ${message.author.tag}`);
      return;
    }
    
    if (client._prefixExecutions.has(executionKey)) {
      console.log(`🚫 [ANTI-CLONE] ${commandName} komutu hala işleniyor: ${message.author.tag}`);
      return; // Zaten işleniyor
    }
    
    client._prefixExecutions.add(executionKey);
    client._lastExecutionTime.set(executionKey, now);
    
    // 5 saniye sonra temizle
    setTimeout(() => {
      client._prefixExecutions.delete(executionKey);
    }, 5000);

    try {
      // Context ve args'ı gönder
      const ctx = {
        message: message,
        args: args,
        guild: message.guild,
        member: message.member,
        author: message.author,
        channel: message.channel,
        client: client,
        isCommand: () => false, // Bu prefix komut, slash değil
        reply: async (content) => {
          if (typeof content === 'string') {
            return await message.reply(content);
          } else {
            return await message.reply(content);
          }
        }
      };
      
      await command.execute(ctx, args);
    } catch (error) {
      console.error('[COMMAND ERROR]', error);
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
