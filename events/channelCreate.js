const { Events } = require('discord.js');

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    // Sadece sunucu kanalları için çalış
    if (!channel.guild) return;
    
    // Mute rolünü bul
    const muteRole = channel.guild.roles.cache.find(role => role.name === 'Muted');
    if (!muteRole) return;
    
    try {
      // Kanal türüne göre mute izinlerini ayarla
      if (channel.isTextBased()) {
        await channel.permissionOverwrites.create(muteRole, {
          SendMessages: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          SendMessagesInThreads: false,
          UseApplicationCommands: false,
          SendTTSMessages: false,
          UseExternalEmojis: false,
          UseExternalStickers: false
        });
        console.log(`✅ Yeni metin kanalında mute izinleri ayarlandı: ${channel.name}`);
      } else if (channel.isVoiceBased()) {
        await channel.permissionOverwrites.create(muteRole, {
          Speak: false,
          Stream: false,
          UseVAD: false,
          UseApplicationCommands: false,
          UseSoundboard: false,
          UseExternalSounds: false
        });
        console.log(`✅ Yeni ses kanalında mute izinleri ayarlandı: ${channel.name}`);
      }
    } catch (error) {
      console.error(`❌ Yeni kanalda mute izinleri ayarlanamadı (${channel.name}):`, error.message);
    }
  }
};