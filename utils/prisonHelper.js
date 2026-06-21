// Prison/Jail Setup Helper
const { ChannelType, PermissionsBitField } = require('discord.js');

/**
 * Checks if a "Jailed" role and "prison" text channel already exist in the guild.
 * @param {import('discord.js').Guild} guild - The Discord guild object
 * @param {object} config - The bot's current configuration object
 * @returns {Promise<{role: import('discord.js').Role|null, channel: import('discord.js').GuildChannel|null}>}
 */
async function verifyPrison(guild, config) {
    let role = null;
    let channel = null;

    // 1. Try to find by IDs stored in configuration
    if (config.JAILED_ROLE_ID) {
        role = await guild.roles.fetch(config.JAILED_ROLE_ID).catch(() => null);
    }
    if (config.PRISON_CHANNEL_ID) {
        channel = await guild.channels.fetch(config.PRISON_CHANNEL_ID).catch(() => null);
    }

    // 2. Try to search by name as a fallback
    if (!role) {
        const roles = await guild.roles.fetch().catch(() => null);
        if (roles) {
            role = roles.find(r => r.name.toLowerCase() === 'jailed') || null;
        }
    }
    if (!channel) {
        const channels = await guild.channels.fetch().catch(() => null);
        if (channels) {
            // Find category named "JAIL"
            const category = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'jail');
            if (category) {
                // Find channel inside "JAIL" category
                channel = channels.find(ch => ch.parentId === category.id && (ch.name.toLowerCase() === 'prison' || ch.name.toLowerCase() === 'jail')) || null;
            } else {
                // Or just find any channel named "prison" or "jail"
                channel = channels.find(ch => ch.type === ChannelType.GuildText && (ch.name.toLowerCase() === 'prison' || ch.name.toLowerCase() === 'jail')) || null;
            }
        }
    }

    return { role, channel };
}

/**
 * Creates a "Jailed" role, "JAIL" category, and "prison" text channel with secure permissions.
 * @param {import('discord.js').Guild} guild - The Discord guild object
 * @returns {Promise<{roleId: string, channelId: string}>}
 */
async function createPrison(guild) {
    // 1. Create the "Jailed" role with no guild-wide permissions
    const jailedRole = await guild.roles.create({
        name: 'Jailed',
        permissions: [],
        reason: 'Anti-Nuke Prison System Setup'
    });

    // 2. Create the "JAIL" category channel with strict permissions
    const jailCategory = await guild.channels.create({
        name: 'JAIL',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel] // Hide for everyone
            },
            {
                id: jailedRole.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                ] // Show only for Jailed role
            }
        ],
        reason: 'Anti-Nuke Prison System Setup'
    });

    // 3. Create the "prison" text channel inside the category
    const prisonChannel = await guild.channels.create({
        name: 'prison',
        type: ChannelType.GuildText,
        parent: jailCategory.id,
        reason: 'Anti-Nuke Prison System Setup'
    });

    return { roleId: jailedRole.id, channelId: prisonChannel.id };
}

module.exports = { verifyPrison, createPrison };
