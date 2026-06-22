const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'kick',
    description: 'Kick a member from the server.',
    usage: '?kick @user [reason]',
    async execute(message, args, config, settings) {
        // Check authorization (Default: KickMembers/Admin/Permit Role, or custom override)
        const defaultCheck = (m) => 
            m.permissions.has(PermissionFlagsBits.KickMembers) ||
            m.permissions.has(PermissionFlagsBits.Administrator);

        const isAuthorized = dbSetup.isAuthorizedForCommand(message.guild.id, 'kick', message.member, defaultCheck);

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a valid member to kick.').catch(() => {});
        }

        if (!targetMember.kickable) {
            return message.reply('❌ I cannot kick this member. They may have a higher role or administrative permissions.').catch(() => {});
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            await targetMember.kick(reason);

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('👢 Member Kicked')
                .setDescription(`Successfully kicked <@${targetMember.id}>.`)
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
                        .setTitle('🛡️ Member Kicked')
                        .addFields(
                            { name: 'Target User', value: `<@${targetMember.id}> (\`${targetMember.id}\`)` },
                            { name: 'Moderator', value: `<@${message.author.id}>` },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Kick Command Error]:', err);
            return message.reply('❌ Failed to kick the member. Please check my permissions.').catch(() => {});
        }
    }
};
