const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([mhd])$/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    if (value <= 0) return null;
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

module.exports = {
    name: 'mute',
    description: 'Mute (Timeout) a member for a specified duration.',
    usage: '?mute @user <duration> [reason]',
    async execute(message, args, config, settings) {
        // Check authorization (Default: ModerateMembers/Admin/Permit Role, or custom override)
        const defaultCheck = (m) => 
            m.permissions.has(PermissionFlagsBits.ModerateMembers) ||
            m.permissions.has(PermissionFlagsBits.Administrator);

        const isAuthorized = dbSetup.isAuthorizedForCommand(message.guild.id, 'mute', message.member, defaultCheck);

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a valid member to mute.').catch(() => {});
        }

        const durationStr = args[1];
        if (!durationStr) {
            return message.reply('❌ Please specify a duration (e.g., `10m`, `2h`, `1d`).').catch(() => {});
        }

        const durationMs = parseDuration(durationStr);
        if (!durationMs) {
            return message.reply('❌ Invalid duration format! Use `10m` (minutes), `2h` (hours), or `1d` (days).').catch(() => {});
        }

        // Maximum timeout duration is 28 days in Discord API
        if (durationMs > 28 * 24 * 60 * 60 * 1000) {
            return message.reply('❌ Timeout duration cannot exceed 28 days.').catch(() => {});
        }

        const reason = args.slice(2).join(' ') || 'No reason provided';

        try {
            await targetMember.timeout(durationMs, reason);

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('🔇 Member Muted')
                .setDescription(`Successfully muted <@${targetMember.id}> for **${durationStr}**.`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp();

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Log action
            const logChannelId = settings.log_channel_id;
            if (logChannelId) {
                const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xFFAA00)
                        .setTitle('🛡️ Member Muted (Timeout)')
                        .addFields(
                            { name: 'Target User', value: `<@${targetMember.id}> (\`${targetMember.id}\`)` },
                            { name: 'Moderator', value: `<@${message.author.id}>` },
                            { name: 'Duration', value: durationStr },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Mute Command Error]:', err);
            return message.reply('❌ Failed to mute the member. Please check my permissions.').catch(() => {});
        }
    }
};
