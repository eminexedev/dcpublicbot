const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

async function sendMsg(interaction, content) {
  if (interaction.isChatInputCommand) {
    if (!interaction.deferred && !interaction.replied) {
      return await interaction.reply({ content, ephemeral: true });
    }
    return await interaction.followUp({ content, ephemeral: true });
  } else if (interaction.channel) {
    return await interaction.channel.send(content);
  }
}

async function deleteExistingRoles(guild, interaction) {
  await guild.roles.fetch();
  const roles = guild.roles.cache.filter(r => r.name !== '@everyone');
  const botMember = guild.members.me;
  const botRole = botMember ? botMember.roles.highest : null;

  const deletableRoles = [];
  const undeletableRoles = [];

  for (const role of roles.values()) {
    let reason = '';
    if (role.managed) {
      reason = 'Discord tarafından yönetilen (managed/integration) rol';
    } else if (botRole && role.position > botRole.position) {
      reason = 'Botun rolü bu rolden aşağıda';
    } else if (!role.editable) {
      reason = 'Botun rolü bu rolü düzenleyemiyor';
    }

    if (reason) {
      undeletableRoles.push({ name: role.name, id: role.id, reason });
    } else {
      deletableRoles.push(role);
    }
  }

  if (deletableRoles.length === 0) {
    if (undeletableRoles.length > 0) {
      const undeletableArr = undeletableRoles.map(r => `${r.name} (ID: ${r.id}) - ${r.reason}`);
      await sendMsg(interaction, `❌ Silinemeyen roller:\n${undeletableArr.join('\n')}`);
    } else {
      await sendMsg(interaction, 'Tüm roller temizlendi!');
    }
    return;
  }

  await sendMsg(interaction, `${deletableRoles.length} rol siliniyor...`);

  for (const role of deletableRoles) {
    try {
      await role.delete('Toplu silme işlemi');
      console.log(`${role.name} silindi`);
      await new Promise(r => setTimeout(r, 1000)); // Rate limit için 1 sn bekle
    } catch (err) {
      if (err.message && err.message.includes('Unknown Role')) {
        // Discord'da rol zaten silinmiş, kullanıcıya tekrar bildirme
        console.warn(`Rol zaten silinmiş: ${role.name} (ID: ${role.id})`);
      } else {
        console.error(`Rol silme hatası (${role.name} - ID: ${role.id}):`, err);
        await sendMsg(interaction, `❌ ${role.name} silinemedi: ${err.message}`);
      }
    }
  }

  if (undeletableRoles.length > 0) {
    const undeletableArr = undeletableRoles.map(r => `${r.name} (ID: ${r.id}) - ${r.reason}`);
    await sendMsg(interaction, `⚠ Bazı roller silinemedi:\n${undeletableArr.join('\n')}`);
  }

  await sendMsg(interaction, '✅ İşlem tamamlandı.');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rollerisil')
    .setDescription('Sunucudaki tüm silinebilir rolleri siler (sadece sunucu sahibi kullanabilir)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return await sendMsg(interaction, 'Bu komut sadece sunucularda kullanılabilir!');
      }

      const guild = await interaction.guild.fetch();
      const userId = interaction.user?.id || interaction.author?.id;

      if (guild.ownerId !== userId) {
        return await sendMsg(interaction, '❌ Bu komutu sadece sunucu sahibi kullanabilir!');
      }

      await sendMsg(interaction, 'Roller siliniyor...');
      await deleteExistingRoles(guild, interaction);
    } catch (err) {
      console.error('Roller silinirken hata:', err);
      await sendMsg(interaction, `❌ Roller silinemedi: ${err.message}`);
    }
  }
};
