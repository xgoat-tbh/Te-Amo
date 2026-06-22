const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../database/dbSetup');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel, client, config) {
        if (!channel.guild) return;

        // Fetch server settings
        const settings = dbSetup.getGuildSettings(channel.guild.id);
        const jailRoleId = settings.jail_role_id;
        if (!jailRoleId) return;

        const jailRole = channel.guild.roles.cache.get(jailRoleId);
        if (!jailRole) return;

        try {
            // Find JAIL category
            const jailCategory = channel.guild.channels.cache.find(c => 
                c.name === 'JAIL' && 
                c.type === ChannelType.GuildCategory
            );

            // If the channel is not the JAIL category and not inside it, hide it from the Jailed role
            if (channel.id !== jailCategory?.id && channel.parentId !== jailCategory?.id) {
                await channel.permissionOverwrites.create(jailRole, {
                    [PermissionFlagsBits.ViewChannel]: false
                });
            }
        } catch (err) {
            console.error(`[Channel Create Override Error] Channel: ${channel.name}`, err);
        }
    }
};
