// Voice State Update Event
const { Events, EmbedBuilder } = require('discord.js');
const { getRandomMessage } = require('../utils/gameMessages');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client, config) {
        const monitoredChannels = config.monitored_channels || {};

        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;

        // Verify if a user moved channels (joined, left, or switched)
        if (oldChannelId !== newChannelId) {
            const guild = newState.guild || oldState.guild;

            // Handle user joining a monitored channel
            if (newChannelId && monitoredChannels[newChannelId]) {
                await checkVoiceChannel(newChannelId, monitoredChannels[newChannelId], guild, config);
            }

            // Handle user leaving a monitored channel (in case count drops back to target)
            if (oldChannelId && monitoredChannels[oldChannelId]) {
                await checkVoiceChannel(oldChannelId, monitoredChannels[oldChannelId], guild, config);
            }

            // Custom Voice Connection Audit Logging
            const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
            if (logChannelId && !logChannelId.includes('YOUR_')) {
                const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    const member = newState.member || oldState.member;
                    const embed = new EmbedBuilder().setTimestamp();

                    if (!oldChannelId && newChannelId) {
                        // Joined VC
                        embed.setColor(0x2ECC71) // Sleek green
                             .setTitle('🔊 Voice Joined')
                             .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                             .setDescription(`<@${member.id}> joined voice channel <#${newChannelId}>`);
                        await logChannel.send({ embeds: [embed] }).catch(() => {});
                    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
                        // Moved VC
                        embed.setColor(0xF1C40F) // Sleek yellow
                             .setTitle('🔊 Voice Moved')
                             .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                             .setDescription(`<@${member.id}> moved from <#${oldChannelId}> to <#${newChannelId}>`);
                        await logChannel.send({ embeds: [embed] }).catch(() => {});
                    } else if (oldChannelId && !newChannelId) {
                        // Left VC
                        embed.setColor(0xE74C3C) // Sleek red
                             .setTitle('🔊 Voice Left')
                             .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                             .setDescription(`<@${member.id}> left voice channel <#${oldChannelId}>`);
                        await logChannel.send({ embeds: [embed] }).catch(() => {});
                    }
                }
            }
        }
    }
};

/**
 * Checks member count of a monitored voice channel and sends alert if target is reached.
 * @param {string} channelId - The ID of the voice channel
 * @param {object} channelConfig - The configuration object for this channel
 * @param {import('discord.js').Guild} guild - The Discord guild object
 * @param {object} config - The bot's global configuration object
 */
async function checkVoiceChannel(channelId, channelConfig, guild, config) {
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isVoiceBased()) return;

        const nameLower = channel.name.toLowerCase();

        // Security Exclusion: Ignore specific game categories (e.g. pc games, browser games, activity games)
        if (nameLower.includes('pc games') || 
            nameLower.includes('browser games') || 
            nameLower.includes('activity games')) {
            console.log(`[VoiceStateUpdate] Alert ignored for excluded voice channel type: "${channel.name}"`);
            return;
        }

        const memberCount = channel.members.size;
        
        // Trigger alert only when member count hits the target exactly
        if (memberCount === channelConfig.targetCount) {
            const globalPingsChannelId = config.GAMING_PINGS_CHANNEL_ID;
            if (!globalPingsChannelId || globalPingsChannelId.includes('YOUR_')) {
                console.warn('[VoiceStateUpdate] Skipped alert: GAMING_PINGS_CHANNEL_ID is not configured in config.json.');
                return;
            }

            const pingChannel = await guild.channels.fetch(globalPingsChannelId).catch(() => null);
            if (pingChannel && pingChannel.isTextBased()) {
                const roleId = channelConfig.roleId;
                const gameName = channelConfig.gameName || 'Game';

                // Retrieve a randomized game message from the database list of 10 messages
                const randomMsg = getRandomMessage(gameName);
                
                // Formatted role ping message containing game details and voice channel mentions
                // Plus the direct channel link to trigger the Discord native "Join Voice" card.
                const messageText = `<@&${roleId}> 🎮 🔴 > ${randomMsg} > <#${channelId}>\nhttps://discord.com/channels/${guild.id}/${channelId}`;

                // Create a premium, visually appealing Rich Embed card
                const embed = new EmbedBuilder()
                    .setColor(0x00FF7F) // Vibrant bright spring green
                    .setTitle(`🎮 Game Lobby Alert - ${gameName}!`)
                    .setDescription(`The voice lobby has hit the exact target count. Get in and play!`)
                    .addFields(
                        { name: '🔊 Voice Channel', value: `<#${channelId}>`, inline: true },
                        { name: '👥 Target Count', value: `\`${memberCount} / ${channelConfig.targetCount} players\``, inline: true },
                        { name: '🕹️ Game Name', value: `\`${gameName}\``, inline: true }
                    )
                    .setFooter({ text: 'Te-Amo Gaming Alerts', iconURL: guild.iconURL() })
                    .setTimestamp();

                await pingChannel.send({ content: messageText, embeds: [embed] });
                console.log(`[VoiceStateUpdate] Visual ping alert sent for "${channel.name}" to global channel #${pingChannel.name}`);
            }
        }
    } catch (err) {
        console.error(`Error processing voice state check for channel ${channelId}:`, err);
    }
}
