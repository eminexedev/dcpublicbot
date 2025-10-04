const { Events, AttachmentBuilder } = require('discord.js');
const { createWelcomeImage } = require('./welcomeImage');
const { getRegistrationConfig } = require('../registrationConfig');

// Hoş geldin
async function onMemberJoin(member) {
  // Kayıt sistemi kontrolü ve kayıtsız rol verme
  try {
    const registrationConfig = getRegistrationConfig(member.guild.id);
    
    if (registrationConfig.isConfigured && registrationConfig.unregisteredRoleId) {
      const unregisteredRole = member.guild.roles.cache.get(registrationConfig.unregisteredRoleId);
      
      if (unregisteredRole) {
        // Kayıtsız rolü ver
        try {
          await member.roles.add(unregisteredRole);
          console.log(`✅ ${member.user.tag} kullanıcısına kayıtsız rolü verildi.`);
        } catch (error) {
          console.error(`❌ Kayıtsız rolü verilemedi ${member.user.tag}:`, error);
        }
        
        // İsmi "kayıtsız" yap
        try {
          await member.setNickname('kayıtsız');
          console.log(`✅ ${member.user.tag} kullanıcısının ismi "kayıtsız" olarak değiştirildi.`);
        } catch (error) {
          console.error(`❌ İsim değiştirilemedi ${member.user.tag}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Kayıtsız üye sistemi hatası:', error);
  }

  // Hoş geldin mesajı
  const channel = member.guild.systemChannel;
  if (!channel) return;
  const buffer = await createWelcomeImage(member.user.tag, member.guild.memberCount, member.user.displayAvatarURL({ extension: 'png' }), 'giris');
  const attachment = new AttachmentBuilder(buffer, { name: 'hosgeldin.png' });
  channel.send({ content: `Hoş geldin, ${member}!`, files: [attachment] });
}

// Güle güle
async function onMemberLeave(member) {
  const channel = member.guild.systemChannel;
  if (!channel) return;
  const buffer = await createWelcomeImage(member.user.tag, member.guild.memberCount, member.user.displayAvatarURL({ extension: 'png' }), 'cikis');
  const attachment = new AttachmentBuilder(buffer, { name: 'gulegule.png' });
  channel.send({ content: `${member.user.tag} sunucudan ayrıldı.`, files: [attachment] });
}

module.exports = { onMemberJoin, onMemberLeave };
