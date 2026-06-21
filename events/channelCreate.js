// Channel Create Event
const { Events, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel, client) {
        if (!channel.guild) return;

        try {
            // Load fresh configuration
            if (!fs.existsSync(CONFIG_PATH)) return;
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

            const jailedRoleId = config.JAILED_ROLE_ID;
            const prisonChannelId = config.PRISON_CHANNEL_ID;

            if (!jailedRoleId || jailedRoleId.includes('YOUR_') || !prisonChannelId || prisonChannelId.includes('YOUR_')) {
                return;
            }

            // Find the jail category (parent of the prison channel) if any
            const prisonChannel = channel.guild.channels.cache.get(prisonChannelId);
            const jailCategoryId = prisonChannel ? prisonChannel.parentId : null;

            // Skip the prison channel itself, the jail category, and any channels inside the category
            if (channel.id === prisonChannelId || channel.id === jailCategoryId || (jailCategoryId && channel.parentId === jailCategoryId)) {
                return;
            }

            // Deny ViewChannel for the Jailed role in the new channel
            await channel.permissionOverwrites.create(jailedRoleId, {
                ViewChannel: false
            }, { reason: 'Anti-Nuke Prison System: Auto-hide newly created channel from jailed users' }).catch(() => null);

        } catch (error) {
            console.error('Error handling channelCreate event:', error);
        }
    }
};
