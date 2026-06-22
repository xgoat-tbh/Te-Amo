const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'jail',
    description: 'Strip all roles from a user, assign the Jailed role, and back up roles to SQLite.',
    usage: '?jail @user',
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

        let jailRole = null;
        try {
            const jailSystem = await dbSetup.ensureJailSystem(message.guild);
            jailRole = jailSystem.jailRole;
        } catch (err) {
            console.error('[Jail Command Auto Setup Failed]:', err);
        }

        if (!jailRole) {
            return message.reply('❌ The **Jailed** role and channels could not be resolved or created automatically.').catch(() => {});
        }

        const jailRoleId = jailRole.id;

        // Prevent jailing administrators/bot itself/owners
        if (targetMember.user.id === message.guild.ownerId || targetMember.user.bot) {
            return message.reply('❌ You cannot jail this user.').catch(() => {});
        }

        // Check if user is already jailed
        const alreadyJailed = dbSetup.getJailedUser(targetMember.id);
        if (alreadyJailed || targetMember.roles.cache.has(jailRoleId)) {
            return message.reply('❌ This member is already jailed!').catch(() => {});
        }

        // Fetch original roles to backup, excluding @everyone and managed integration roles
        const originalRoles = targetMember.roles.cache
            .filter(r => r.id !== message.guild.id && !r.managed)
            .map(r => r.id);

        try {
            const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id).catch(() => null);
            if (!botMember) {
                return message.reply('❌ Could not fetch bot member information.').catch(() => {});
            }

            // Check if bot can manage the jail role itself
            if (botMember.roles.highest.position <= jailRole.position) {
                return message.reply(`❌ Cannot jail: the **Jailed** role is higher than or equal to the bot's highest role.`).catch(() => {});
            }

            // 1. Assign Jailed role first
            await targetMember.roles.add(jailRoleId, `Jailed by ${message.author.tag}`);

            // Fetch target member again to verify role was added
            const updatedMember = await message.guild.members.fetch(targetMember.id).catch(() => null);
            if (!updatedMember || !updatedMember.roles.cache.has(jailRoleId)) {
                return message.reply('❌ Failed to assign the Jailed role. Aborting database save and role stripping.').catch(() => {});
            }

            // 2. Strip manageable roles (excluding Jailed role itself)
            const rolesToRemove = updatedMember.roles.cache.filter(role => 
                role.id !== message.guild.id && 
                role.id !== jailRoleId &&
                !role.managed && 
                role.position < botMember.roles.highest.position
            );

            if (rolesToRemove.size > 0) {
                await updatedMember.roles.remove(rolesToRemove, `Stripped for Jail by ${message.author.tag}`);
            }

            // 3. Save roles to SQLite database (only after Jailed role exists on the user)
            dbSetup.jailUser(targetMember.id, originalRoles);

            // Response embed
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('🔒 Member Jailed | Amo India')
                .setDescription(`Successfully jailed <@${targetMember.id}>. Manageable roles stripped.`)
                .setTimestamp()
                .setFooter({ text: 'Amo India Moderation' });

            await message.reply({ embeds: [embed] }).catch(() => {});

            // Log action
            const logChannelId = settings.log_channel_id;
            if (logChannelId) {
                const logChannel = message.guild.channels.cache.get(logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xFEE75C)
                        .setTitle('🛡️ Member Jailed | Amo India')
                        .addFields(
                            { name: 'Target User', value: `<@${targetMember.id}> (\`${targetMember.id}\`)` },
                            { name: 'Moderator', value: `<@${message.author.id}>` },
                            { name: 'Backup Roles', value: originalRoles.map(id => `<@&${id}>`).join(', ') || 'None' }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Amo India Moderation' });
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Jail Command Error]:', err);
            return message.reply('❌ Failed to jail the member. Please check my role hierarchy and permissions.').catch(() => {});
        }
    }
};
