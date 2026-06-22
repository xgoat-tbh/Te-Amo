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
    name: 'trackvc',
    description: 'Track a voice channel and configure milestone pings.',
    usage: '?trackvc <vc_channel> <player_milestone> <@role_to_ping> <ping_message>',
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
        const milestoneStr = args[1];
        const roleInput = args[2];
        const pingMessage = args.slice(3).join(' ');

        if (!channelInput || !milestoneStr || !roleInput || !pingMessage) {
            return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}trackvc <vc_channel> <milestone_count> <@role_to_ping> <message>\``).catch(() => {});
        }

        const vc = resolveVoiceChannel(message.guild, channelInput);
        if (!vc) {
            return message.reply(`❌ Could not resolve voice channel for: \`${channelInput}\``).catch(() => {});
        }

        const milestone = parseInt(milestoneStr, 10);
        if (isNaN(milestone) || milestone <= 0) {
            return message.reply('❌ Milestone count must be a positive integer.').catch(() => {});
        }

        const roleId = roleInput.replace(/\D/g, '');
        const role = message.guild.roles.cache.get(roleId);
        if (!role) {
            return message.reply('❌ Could not resolve role to ping.').catch(() => {});
        }

        try {
            dbSetup.addMonitoredVc(vc.id, milestone, roleId, pingMessage, message.guild.id);
            return message.reply(`✅ Monitored Voice Channel Registered:\n` +
                                 `• **Channel**: <#${vc.id}> (\`${vc.id}\`)\n` +
                                 `• **Milestone**: \`${milestone}\` users\n` +
                                 `• **Ping Role**: <@&${roleId}>\n` +
                                 `• **Alert Message**: *${pingMessage}*`).catch(() => {});
        } catch (err) {
            console.error(err);
            return message.reply('❌ Failed to save voice channel tracking configuration to database.').catch(() => {});
        }
    }
};
