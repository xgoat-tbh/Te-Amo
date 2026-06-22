const { PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

function resolveVoiceChannel(guild, input) {
    const cleanedId = input.replace(/\D/g, '');
    if (cleanedId) {
        const channel = guild.channels.cache.get(cleanedId);
        if (channel && channel.isVoiceBased()) {
            return channel;
        }
    }
    const lowerInput = input.toLowerCase();
    return guild.channels.cache.find(c => 
        c.isVoiceBased() && c.name.toLowerCase().includes(lowerInput)
    );
}

module.exports = {
    name: 'untrackvc',
    description: 'Remove a voice channel from milestone pings monitoring.',
    usage: '?untrackvc <vc_channel>',
    async execute(message, args, config, settings) {
        // Check authorization (ManageGuild/Administrator or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                             message.member.permissions.has(PermissionFlagsBits.Administrator) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const channelInput = args[0];
        if (!channelInput) {
            return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}untrackvc <vc_channel>\``).catch(() => {});
        }

        const vc = resolveVoiceChannel(message.guild, channelInput);
        if (!vc) {
            return message.reply(`❌ Could not resolve voice channel for: \`${channelInput}\``).catch(() => {});
        }

        const record = dbSetup.getMonitoredVc(vc.id);
        if (!record) {
            return message.reply(`❌ Voice channel <#${vc.id}> is not currently configured for tracking.`).catch(() => {});
        }

        try {
            dbSetup.removeMonitoredVc(vc.id);
            return message.reply(`✅ Successfully untracked voice channel <#${vc.id}>. Milestone pings are disabled for this channel.`).catch(() => {});
        } catch (err) {
            console.error(err);
            return message.reply('❌ Failed to remove voice channel tracking configuration from database.').catch(() => {});
        }
    }
};
