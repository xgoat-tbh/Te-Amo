const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'unjail',
    description: 'Restore a jailed member\'s original roles and remove the Jailed role.',
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
            return message.reply('❌ Please specify a valid member to unjail.').catch(() => {});
        }

        // Query jailed database record
        const jailedRecord = dbSetup.getJailedUser(targetMember.id);
        if (!jailedRecord) {
            // Check if they at least have the Jailed role and strip it
            const jailRoleId = settings.jail_role_id || config.JAILED_ROLE_ID;
            if (jailRoleId && targetMember.roles.cache.has(jailRoleId)) {
                try {
                    await targetMember.roles.remove(jailRoleId, `Unjailed (manual recovery) by ${message.author.tag}`);
                    return message.reply('⚠️ Member had Jailed role but no database backup. Stripped Jailed role.').catch(() => {});
                } catch (roleErr) {
                    console.error(roleErr);
                }
            }
            return message.reply('❌ This member is not marked as jailed in the database.').catch(() => {});
        }

        let oldRolesArray = [];
        try {
            oldRolesArray = JSON.parse(jailedRecord.old_roles);
        } catch (parseErr) {
            console.error('[Unjail JSON Parse Error]:', parseErr);
        }

        // Filter out roles that were deleted from the guild to prevent Discord API errors
        const validRoles = oldRolesArray.filter(roleId => message.guild.roles.cache.has(roleId));

        try {
            // Restore roles and strip Jailed role (Jailed role is not in validRoles array)
            await targetMember.roles.set(validRoles, `Unjailed by ${message.author.tag}`);

            // Delete database record
            dbSetup.unjailUser(targetMember.id);

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('🔓 Member Unjailed')
                .setDescription(`Successfully unjailed <@${targetMember.id}>. Roles restored.`)
                .setTimestamp();

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Log action
            const logChannelId = settings.log_channel_id;
            if (logChannelId) {
                const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x00FF88)
                        .setTitle('🛡️ Member Unjailed')
                        .addFields(
                            { name: 'Target User', value: `<@${targetMember.id}> (\`${targetMember.id}\`)` },
                            { name: 'Moderator', value: `<@${message.author.id}>` },
                            { name: 'Restored Roles', value: validRoles.map(id => `<@&${id}>`).join(', ') || 'None' }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Unjail Command Error]:', err);
            return message.reply('❌ Failed to unjail the member. Please check my role hierarchy and permissions.').catch(() => {});
        }
    }
};
