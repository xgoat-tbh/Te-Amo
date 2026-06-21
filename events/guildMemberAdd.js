// Guild Member Add Event (Role Restore / Anti-Jail Escape)
const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateCounter } = require('./memberCounter');
const db = require('../utils/db');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client, config) {
        console.log(`[Events] Member joined: ${member.user.tag}. Updating member counter...`);
        await updateCounter(member.guild, config).catch(console.error);

        const guild = member.guild;
        const userId = member.id;
        const userData = db.getUser(userId);

        const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
        if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            console.warn('[Jail-Restore] Warning: Bot lacks Manage Roles permission.');
            return;
        }

        // 1. Check for Anti-Jail Escape
        if (userData.isJailed) {
            const jailedRoleId = config.JAILED_ROLE_ID;
            if (jailedRoleId && !jailedRoleId.includes('YOUR_')) {
                const jailedRole = guild.roles.cache.get(jailedRoleId);
                if (jailedRole && botMember.roles.highest.position > jailedRole.position) {
                    await member.roles.add(jailedRole, 'Anti-Jail Escape: Re-applied jailed role on rejoin').catch(console.error);
                    console.log(`[Jail-Restore] User ${member.user.tag} tried to escape jail by rejoining. Re-applied Jailed role.`);

                    // Log escape attempt to admin log channel
                    const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
                    if (logChannelId) {
                        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                        if (logChannel && logChannel.isTextBased()) {
                            const alertEmbed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('🚨 ANTI-JAIL ESCAPE DETECTED')
                                .setDescription(`User <@${userId}> tried to escape jail by leaving and rejoining the server.`)
                                .addFields(
                                    { name: 'User', value: `${member.user.tag} (\`${userId}\`)` },
                                    { name: 'Action Taken', value: 'Re-applied Jailed Role immediately.' }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [alertEmbed] }).catch(console.error);
                        }
                    }
                    return; // Do not restore regular roles
                }
            }
        }

        // 2. Restore normal roles if any are backed up
        if (userData.roles && userData.roles.length > 0) {
            const rolesToRestore = [];
            for (const roleId of userData.roles) {
                const role = guild.roles.cache.get(roleId);
                // Only restore roles that still exist and are below the bot's highest role
                if (role && botMember.roles.highest.position > role.position && !role.managed && role.id !== guild.id) {
                    rolesToRestore.push(role);
                }
            }

            if (rolesToRestore.length > 0) {
                await member.roles.add(rolesToRestore, 'Roles Restored on Rejoin').catch(console.error);
                console.log(`[Role-Restore] Restored ${rolesToRestore.length} roles for ${member.user.tag}.`);
            }
        }
    }
};
