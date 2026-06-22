const { Events } = require('discord.js');
const dbSetup = require('../database/dbSetup');

// Global memory Map for cooldown tracking: channelId -> timestamp
const alertCooldowns = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client, config) {
        // We only care if the member joined or switched to a voice channel
        const newChannelId = newState.channelId;
        if (!newChannelId) return;

        // Skip if same channel (e.g. mute/unmute action)
        if (oldState.channelId === newChannelId) return;

        // Retrieve monitored channels configuration
        const monitoredChannels = config.monitored_channels || {};
        const trigger = monitoredChannels[newChannelId];
        if (!trigger) return;

        const vc = newState.channel;
        if (!vc) return;

        // Count human members
        const humanCount = vc.members.filter(m => !m.user.bot).size;

        // If count hits the milestone trigger exactly
        if (humanCount === trigger.milestone) {
            const now = Date.now();
            const cooldownTime = 15 * 60 * 1000; // 15 minutes

            if (alertCooldowns.has(newChannelId)) {
                const lastAlert = alertCooldowns.get(newChannelId);
                if (now - lastAlert < cooldownTime) {
                    // Still in cooldown period
                    return;
                }
            }

            // Set cooldown lock
            alertCooldowns.set(newChannelId, now);

            // Fetch target ping channel ID (GAMING_PINGS_CHANNEL_ID or setup log channel)
            const guildId = newState.guild.id;
            const settings = dbSetup.getGuildSettings(guildId);
            const pingChannelId = config.GAMING_PINGS_CHANNEL_ID || settings.log_channel_id;

            if (!pingChannelId) return;

            const channel = newState.guild.channels.cache.get(pingChannelId);
            if (channel && channel.isTextBased()) {
                // Target Link Format exactly:
                // <@&ROLE_ID> Custom Message Text > <#VC_ID>\n[https://discord.com/channels/GUILD_ID/VC_ID](https://discord.com/channels/GUILD_ID/VC_ID)
                const alertMsg = `<@&${trigger.role_id}> ${trigger.message} > <#${newChannelId}>\n` +
                                 `[https://discord.com/channels/${guildId}/${newChannelId}](https://discord.com/channels/${guildId}/${newChannelId})`;

                channel.send({ content: alertMsg }).catch(err => {
                    console.error('[Voice VC Trigger] Failed to send alert message:', err);
                });
            }
        }
    }
};
