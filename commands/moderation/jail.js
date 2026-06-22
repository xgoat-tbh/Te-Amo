const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'jail',
    description: 'Strip all roles from a user and assign the Jailed role.',
    async execute(message, args, config, settings) {
        // Check authorization (ModerateMembers/ManageRoles or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                             message.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a valid member to jail.').catch(() => {});
        }

        const jailRoleId = settings.jail_role_id || config.JAILED_ROLE_ID;
        if (!jailRoleId) {
            return message.reply('❌ The **Jailed** role has not been configured yet. Use `/setup` to configure it.').catch(() => {});
        }

        const jailRole = message.guild.roles.cache.get(jailRoleId);
        if (!jailRole) {
            return message.reply('❌ The configured **Jailed** role was not found in this server.').catch(() => {});
        }

        // Prevent jailing administrators/bot itself/owners
        if (targetMember.user.id === message.guild.ownerId || targetMember.user.bot) {
            return message.reply('❌ You cannot jail this user.').catch(() => {});
        }

        // Check if user is already jailed
        const alreadyJailed = dbSetup.getJailedUser(targetMember.id);
        if (alreadyJailed) {
            return message.reply('❌ This member is already jailed!').catch(() => {});
        }

        // Fetch original roles, filter out @everyone
        const originalRoles = targetMember.roles.cache
            .filter(r => r.id !== message.guild.id)
            .map(r => r.id);

        try {
            // Save roles to SQLite database
            dbSetup.jailUser(targetMember.id, originalRoles);

            // Re-assign roles: strip all and add Jailed role
            await targetMember.roles.set([jailRoleId], `Jailed by ${message.author.tag}`);

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0x333333)
                .setTitle('🔒 Member Jailed')
                .setDescription(`Successfully jailed <@${targetMember.id}>.`)
                .setTimestamp();

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Log action
            const logChannelId = settings.log_channel_id;
            if (logChannelId) {
                const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x333333)
                        .setTitle('🛡️ Member Jailed')
                        .addFields(
                            { name: 'Target User', value: `<@${targetMember.id}> (\`${targetMember.id}\`)` },
                            { name: 'Moderator', value: `<@${message.author.id}>` },
                            { name: 'Backup Roles', value: originalRoles.map(id => `<@&${id}>`).join(', ') || 'None' }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Jail Command Error]:', err);
            return message.reply('❌ Failed to jail the member. Please check my role hierarchy and permissions.').catch(() => {});
        }
    }
};
