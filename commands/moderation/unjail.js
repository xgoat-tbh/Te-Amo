const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'unjail',
    description: 'Restore a jailed member\'s original roles and remove the Jailed role.',
    usage: '?unjail @user',
    async execute(message, args, config, settings) {
        // Check authorization (Default: ModerateMembers/ManageRoles/Admin/Permit Role, or custom override)
        const defaultCheck = (m) => 
            m.permissions.has(PermissionFlagsBits.ModerateMembers) ||
            m.permissions.has(PermissionFlagsBits.ManageRoles) ||
            m.permissions.has(PermissionFlagsBits.Administrator);

        const isAuthorized = dbSetup.isAuthorizedForCommand(message.guild.id, 'unjail', message.member, defaultCheck);

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

        const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id).catch(() => null);
        if (!botMember) {
            return message.reply('❌ Could not fetch bot member information.').catch(() => {});
        }

        const jailRoleId = settings.jail_role_id || config.JAILED_ROLE_ID;

        // Filter out roles that were deleted from the guild, managed integration roles, or roles higher than the bot
        const rolesToAdd = oldRolesArray.filter(roleId => {
            const role = message.guild.roles.cache.get(roleId);
            return role && !role.managed && role.position < botMember.roles.highest.position;
        });

        try {
            // 1. Remove Jailed role first
            if (jailRoleId && targetMember.roles.cache.has(jailRoleId)) {
                await targetMember.roles.remove(jailRoleId, `Unjailed by ${message.author.tag}`);
            }

            // 2. Restore manageable roles
            if (rolesToAdd.length > 0) {
                await targetMember.roles.add(rolesToAdd, `Unjailed by ${message.author.tag}`);
            }

            // 3. Delete database record
            dbSetup.unjailUser(targetMember.id);

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🔓 Member Unjailed | Amo India')
                .setDescription(`Successfully unjailed <@${targetMember.id}>. Roles restored.`)
                .setTimestamp()
                .setFooter({ text: 'Amo India Moderation' });

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Log action
            const logChannelId = settings.log_channel_id;
            if (logChannelId) {
                const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('🛡️ Member Unjailed | Amo India')
                        .addFields(
                            { name: 'Target User', value: `<@${targetMember.id}> (\`${targetMember.id}\`)` },
                            { name: 'Moderator', value: `<@${message.author.id}>` },
                            { name: 'Restored Roles', value: rolesToAdd.map(id => `<@&${id}>`).join(', ') || 'None' }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Amo India Moderation' });
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Unjail Command Error]:', err);
            return message.reply('❌ Failed to unjail the member. Please check my role hierarchy and permissions.').catch(() => {});
        }
    }
};
