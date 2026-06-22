const { Events } = require('discord.js');
const dbSetup = require('../database/dbSetup');

// Global memory Map for cooldown tracking: channelId -> timestamp
const alertCooldowns = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client, config) {
        const newChannelId = newState.channelId;
        if (!newChannelId) return;

        // Skip if same channel (e.g. mute/unmute action)
        if (oldState.channelId === newChannelId) return;

        // Retrieve monitored VC trigger from SQLite database dynamically
        const trigger = dbSetup.getMonitoredVc(newChannelId);
        if (!trigger) return;

        const vc = newState.channel;
        if (!vc) return;

        // Anti-Exploit: Ignore bots when evaluating lobby size
        const humanCount = vc.members.filter(m => !m.user.bot).size;

        // If count hits the milestone trigger exactly
        if (humanCount === trigger.milestone) {
            const now = Date.now();
            const cooldownTime = 15 * 60 * 1000; // 15 minutes anti-abuse lockout

            // Anti-Abuse Lockout Cooldown check
            if (alertCooldowns.has(newChannelId)) {
                const lastAlert = alertCooldowns.get(newChannelId);
                if (now - lastAlert < cooldownTime) {
                    // Trolls attempting to hop in/out are locked out
                    return;
                }
            }

            // Set lockout timestamp
            alertCooldowns.set(newChannelId, now);

            // Fetch target pings channel ID from settings or global config
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
