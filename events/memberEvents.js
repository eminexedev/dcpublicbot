const { Events, AttachmentBuilder } = require('discord.js');
const { createWelcomeImage } = require('./welcomeImage');

// Hoş geldin
async function onMemberJoin(member) {
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
