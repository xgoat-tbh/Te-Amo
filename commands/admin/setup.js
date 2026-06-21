// Setup Command
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

// Helper to save configuration
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing config.json:', error);
        return false;
    }
}

module.exports = {
    name: 'setup',
    description: 'Dynamic configuration command for administrators.',
    async execute(message, args, config) {
        // Enforce Admin permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Error: Only server administrators can use this command!').catch(console.error);
        }

        const subCommand = args[0] ? args[0].toLowerCase() : null;

        if (!subCommand) {
            return message.reply(
                '⚙️ **Setup Usage:**\n' +
                '- `!setup status`: Show current config\n' +
                '- `!setup bypassrole <role_id/mention>`: Config anti-promo bypass role\n' +
                '- `!setup countervc <vc_id/mention>`: Config voice member counter VC\n' +
                '- `!setup logchannel <channel_id/mention>`: Config secure admin log channel\n' +
                '- `!setup pingschannel <channel_id/mention>`: Config global gaming pings text channel\n' +
                '- `!setup trackvc <vc_id> <targetCount> <roleId> <gameName>`: Register dynamic voice channel tracker\n' +
                '- `!setup untrackvc <vc_id>`: Remove voice channel tracker'
            ).catch(console.error);
        }

        const parseId = (str) => {
            if (!str) return null;
            return str.replace(/\D/g, '') || null;
        };

        // 1. Status Check
        if (subCommand === 'status') {
            const monitoredCount = Object.keys(config.monitored_channels || {}).length;
            
            const statusEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📊 Bot Configuration Status')
                .addFields(
                    { name: 'Anti-Promo Bypass Role', value: config.CAN_PROMOTE_ROLE_ID && !config.CAN_PROMOTE_ROLE_ID.includes('YOUR_') ? `<@&${config.CAN_PROMOTE_ROLE_ID}> (\`${config.CAN_PROMOTE_ROLE_ID}\`)` : '🔴 Not configured' },
                    { name: 'Member Counter Voice VC', value: config.MEMBER_COUNT_VC_ID && !config.MEMBER_COUNT_VC_ID.includes('YOUR_') ? `<#${config.MEMBER_COUNT_VC_ID}> (\`${config.MEMBER_COUNT_VC_ID}\`)` : '🔴 Not configured' },
                    { name: 'Secure Log Channel', value: config.SECURE_ADMIN_LOG_CHANNEL_ID && !config.SECURE_ADMIN_LOG_CHANNEL_ID.includes('YOUR_') ? `<#${config.SECURE_ADMIN_LOG_CHANNEL_ID}> (\`${config.SECURE_ADMIN_LOG_CHANNEL_ID}\`)` : '🔴 Not configured' },
                    { name: 'Global Gaming Pings Channel', value: config.GAMING_PINGS_CHANNEL_ID && !config.GAMING_PINGS_CHANNEL_ID.includes('YOUR_') ? `<#${config.GAMING_PINGS_CHANNEL_ID}> (\`${config.GAMING_PINGS_CHANNEL_ID}\`)` : '🔴 Not configured' },
                    { name: 'Anti-Nuke Threshold', value: `\`${config.ANTI_NUKE_THRESHOLD} actions / ${config.ANTI_NUKE_TIMEFRAME_MS / 1000}s\`` },
                    { name: 'Monitored Voice Channels', value: `\`${monitoredCount}\` channel(s) currently being monitored.` }
                )
                .setTimestamp();

            return message.reply({ embeds: [statusEmbed] }).catch(console.error);
        }

        // 2. Bypass Role Update
        if (subCommand === 'bypassrole') {
            const roleId = parseId(args[1]);
            if (!roleId) return message.reply('Please provide a valid Role ID or role mention.').catch(console.error);

            config.CAN_PROMOTE_ROLE_ID = roleId;
            if (saveConfig(config)) {
                return message.reply(`✅ Successfully updated Anti-Promo bypass role to <@&${roleId}>!`).catch(console.error);
            }
        }

        // 3. Counter VC Update
        if (subCommand === 'countervc') {
            const vcId = parseId(args[1]);
            if (!vcId) return message.reply('Please provide a valid Voice Channel ID or channel mention.').catch(console.error);

            config.MEMBER_COUNT_VC_ID = vcId;
            if (saveConfig(config)) {
                return message.reply(`✅ Successfully updated User Counter VC to <#${vcId}>!`).catch(console.error);
            }
        }

        // 4. Security Log Channel Update
        if (subCommand === 'logchannel') {
            const channelId = parseId(args[1]);
            if (!channelId) return message.reply('Please provide a valid Text Channel ID or channel mention.').catch(console.error);

            config.SECURE_ADMIN_LOG_CHANNEL_ID = channelId;
            if (saveConfig(config)) {
                return message.reply(`✅ Successfully updated Security Log Channel to <#${channelId}>!`).catch(console.error);
            }
        }

        // 5. Global Gaming Pings Channel Update
        if (subCommand === 'pingschannel') {
            const channelId = parseId(args[1]);
            if (!channelId) return message.reply('Please provide a valid Text Channel ID or channel mention.').catch(console.error);

            config.GAMING_PINGS_CHANNEL_ID = channelId;
            if (saveConfig(config)) {
                return message.reply(`✅ Successfully updated Global Gaming Pings Channel to <#${channelId}>!`).catch(console.error);
            }
        }

        // 6. Track VC mapping
        if (subCommand === 'trackvc') {
            // Args: vc_id, targetCount, roleId, gameName
            const targetVcId = parseId(args[1]);
            const targetCount = parseInt(args[2]);
            const roleId = parseId(args[3]);
            const gameName = args.slice(4).join(' ');

            if (!targetVcId || isNaN(targetCount) || !roleId || !gameName) {
                return message.reply('Usage: `!setup trackvc <vc_id> <targetCount> <roleId> <gameName>`').catch(console.error);
            }

            if (!config.monitored_channels) {
                config.monitored_channels = {};
            }

            config.monitored_channels[targetVcId] = {
                gameName,
                roleId,
                targetCount
            };

            if (saveConfig(config)) {
                return message.reply(`✅ Successfully configured voice channel <#${targetVcId}> to track **${gameName}** (Trigger: ${targetCount} members, Ping: <@&${roleId}>).`).catch(console.error);
            }
        }

        // 7. Untrack VC mapping
        if (subCommand === 'untrackvc') {
            const targetVcId = parseId(args[1]);
            if (!targetVcId) return message.reply('Please provide a valid Voice Channel ID.').catch(console.error);

            if (!config.monitored_channels || !config.monitored_channels[targetVcId]) {
                return message.reply('That voice channel is not currently being tracked.').catch(console.error);
            }

            delete config.monitored_channels[targetVcId];
            if (saveConfig(config)) {
                return message.reply('✅ Successfully removed voice channel tracker mapping!').catch(console.error);
            }
        }

        return message.reply('❌ Invalid subcommand. Run `!setup` for commands guide.').catch(console.error);
    }
};
