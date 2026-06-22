const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Ban a member from the server.',
    usage: '?ban @user [reason]',
    async execute(message, args, config, settings) {
        // Check authorization (BanMembers permission or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.BanMembers) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a valid member to ban.').catch(() => {});
        }

        if (!targetMember.bannable) {
            return message.reply('❌ I cannot ban this member. They may have a higher role or administrative permissions.').catch(() => {});
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            await targetMember.ban({ reason });

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🔨 Member Banned')
                .setDescription(`Successfully banned <@${targetMember.id}>.`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp();

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Log action
            const logChannelId = settings.log_channel_id;
            if (logChannelId) {
                const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🛡️ Member Banned')
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
            console.error('[Ban Command Error]:', err);
            return message.reply('❌ Failed to ban the member. Please check my permissions.').catch(() => {});
        }
    }
};
