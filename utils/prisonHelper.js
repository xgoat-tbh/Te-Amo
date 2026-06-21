// Prison/Jail Setup Helper
const { ChannelType, PermissionsBitField } = require('discord.js');

/**
 * Checks if a "Jailed" role and "prison" voice channel already exist in the guild.
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
                // Find voice channel inside "JAIL" category
                channel = channels.find(ch => ch.parentId === category.id && ch.type === ChannelType.GuildVoice && (ch.name.toLowerCase() === 'prison' || ch.name.toLowerCase() === 'jail')) || null;
            } else {
                // Or just find any Voice channel named "prison" or "jail"
                channel = channels.find(ch => ch.type === ChannelType.GuildVoice && (ch.name.toLowerCase() === 'prison' || ch.name.toLowerCase() === 'jail')) || null;
            }
        }
    }

    return { role, channel };
}

/**
 * Creates a "Jailed" role, "JAIL" category, and "prison" voice channel with secure permissions.
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

    // 2. Create the "JAIL" category channel with strict permissions (blocks everyone, allows Jailed role)
    const jailCategory = await guild.channels.create({
        name: 'JAIL',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel] // Hide category for everyone
            },
            {
                id: jailedRole.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.Connect,
                    PermissionsBitField.Flags.Speak
                ] // Show and allow VC access only for Jailed role
            }
        ],
        reason: 'Anti-Nuke Prison System Setup'
    });

    // 3. Create the "prison" Voice Channel inside the category
    const prisonVoiceChannel = await guild.channels.create({
        name: 'prison',
        type: ChannelType.GuildVoice,
        parent: jailCategory.id,
        reason: 'Anti-Nuke Prison System Setup'
    });

    // 4. Secure all other channels by denying ViewChannel to the Jailed role
    await secureOtherChannels(guild, jailedRole.id, prisonVoiceChannel.id).catch(console.error);

    return { roleId: jailedRole.id, channelId: prisonVoiceChannel.id };
}

/**
 * Restricts all channels in the guild (except the prison channel and jail category)
 * by denying the ViewChannel permission for the Jailed role.
 * @param {import('discord.js').Guild} guild - The Discord guild object
 * @param {string} jailedRoleId - The ID of the Jailed role
 * @param {string} prisonChannelId - The ID of the prison Voice Channel
 */
async function secureOtherChannels(guild, jailedRoleId, prisonChannelId) {
    if (!jailedRoleId || !prisonChannelId) return;

    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return;

    const prisonChannel = channels.get(prisonChannelId);
    const jailCategoryId = prisonChannel ? prisonChannel.parentId : null;

    const promises = [];
    for (const [id, ch] of channels) {
        if (id === prisonChannelId || id === jailCategoryId || (jailCategoryId && ch.parentId === jailCategoryId)) {
            continue;
        }

        // Check if overwrite is already denying ViewChannel to avoid redundant API calls
        const existingOverwrite = ch.permissionOverwrites.cache.get(jailedRoleId);
        if (existingOverwrite && existingOverwrite.deny.has(PermissionsBitField.Flags.ViewChannel)) {
            continue;
        }

        promises.push(
            ch.permissionOverwrites.create(jailedRoleId, {
                ViewChannel: false
            }, { reason: 'Anti-Nuke Prison System: Hide channel from jailed users' })
            .catch(err => console.error(`Failed to secure channel ${ch.name}:`, err.message))
        );
    }

    if (promises.length > 0) {
        await Promise.all(promises).catch(console.error);
    }
}

module.exports = { verifyPrison, createPrison, secureOtherChannels };
