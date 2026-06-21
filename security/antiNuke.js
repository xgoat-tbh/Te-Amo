// Anti-Nuke Security Module
const { AuditLogEvent, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store admin actions: adminId -> Array of timestamps
const adminActions = new Map();

/**
 * Handles incoming audit log entries to protect the guild from administrative abuses.
 * Supports dynamic punishments: strip roles, ban, kick, jail, or log-only.
 * @param {import('discord.js').GuildAuditLogsEntry} auditEntry - The audit log entry
 * @param {import('discord.js').Guild} guild - The guild where the event occurred
 * @param {object} config - The bot's configuration object
 */
async function handleAuditLog(auditEntry, guild, config) {
    const { action, executorId } = auditEntry;
    
    // Ignore actions made by the bot itself
    if (executorId === guild.client.user.id) return;
    
    // Target event actions for nuke detection
    const isChannelDelete = action === AuditLogEvent.ChannelDelete;
    const isMemberKick = action === AuditLogEvent.MemberKick;
    const isMemberBan = action === AuditLogEvent.MemberBanAdd;

    if (!isChannelDelete && !isMemberKick && !isMemberBan) return;

    const threshold = config.ANTI_NUKE_THRESHOLD || 3;
    const timeframe = config.ANTI_NUKE_TIMEFRAME_MS || 60000;
    const now = Date.now();

    // Initialize or fetch the admin's action history
    if (!adminActions.has(executorId)) {
        adminActions.set(executorId, []);
    }

    const timestamps = adminActions.get(executorId);
    
    // Track the new action timestamp
    timestamps.push(now);

    // Keep only timestamps within the sliding window timeframe
    const validTimestamps = timestamps.filter(t => now - t < timeframe);
    adminActions.set(executorId, validTimestamps);

    if (validTimestamps.length > threshold) {
        try {
            const executorMember = await guild.members.fetch(executorId).catch(() => null);
            if (!executorMember) return;

            // Bypasses owner (cannot modify roles/ban/kick server owner)
            if (guild.ownerId === executorId) {
                console.warn(`[Anti-Nuke] Owner ${executorId} exceeded threshold. Bypassing punishment.`);
                return;
            }

            let actionTakenStr = '';
            const punishment = config.ANTI_NUKE_ACTION || 'strip_roles';

            if (punishment === 'strip_roles') {
                const rolesToRemove = executorMember.roles.cache.filter(role => role.id !== guild.id && role.editable);
                if (rolesToRemove.size > 0) {
                    await executorMember.roles.remove(rolesToRemove, 'Anti-Nuke Lockdown: Action threshold exceeded');
                    actionTakenStr = `Stripped Roles: ${rolesToRemove.map(r => r.name).join(', ')}`;
                } else {
                    actionTakenStr = 'Strip Roles (Failed: No editable roles found)';
                }
            } else if (punishment === 'ban') {
                if (executorMember.bannable) {
                    await guild.members.ban(executorId, { reason: 'Anti-Nuke Lockdown: Action threshold exceeded' });
                    actionTakenStr = 'Banned from Server';
                } else {
                    actionTakenStr = 'Ban punishment failed (Bot has insufficient permissions to ban this admin)';
                }
            } else if (punishment === 'kick') {
                if (executorMember.kickable) {
                    await executorMember.kick('Anti-Nuke Lockdown: Action threshold exceeded');
                    actionTakenStr = 'Kicked from Server';
                } else {
                    actionTakenStr = 'Kick punishment failed (Bot has insufficient permissions to kick this admin)';
                }
            } else if (punishment === 'log') {
                actionTakenStr = 'None (Log Only mode)';
            } else if (punishment === 'jail') {
                // 1. Strip all administrative/assignable roles
                const rolesToRemove = executorMember.roles.cache.filter(role => role.id !== guild.id && role.editable);
                if (rolesToRemove.size > 0) {
                    await executorMember.roles.remove(rolesToRemove, 'Anti-Nuke Lockdown: Stripped roles before jail');
                }

                // 2. Add the configured Jailed Role
                const jailedRoleId = config.JAILED_ROLE_ID;
                if (jailedRoleId && !jailedRoleId.includes('YOUR_')) {
                    await executorMember.roles.add(jailedRoleId, 'Anti-Nuke Lockdown: Rogue admin jailed');
                    actionTakenStr = `Jailed (Roles Stripped + Jailed Role Applied)`;

                    // 3. DM all moderators/administrators to notify them of the jail event
                    const guildMembers = await guild.members.fetch().catch(() => null);
                    if (guildMembers) {
                        const adminsToDM = guildMembers.filter(m => 
                            m.permissions.has(PermissionFlagsBits.Administrator) && 
                            !m.user.bot && 
                            m.id !== executorId
                        );

                        for (const [id, mod] of adminsToDM) {
                            try {
                                await mod.send(
                                    `🚨 **SECURITY ALERT**: Admin **${executorMember.user.tag}** (\`${executorId}\`) has been automatically **JAILED** in server **${guild.name}** for exceeding anti-nuke action thresholds.\n` +
                                    `Their administrative roles have been stripped and the **Jailed** role has been applied. Please review the logs in the server immediately.`
                                );
                            } catch (dmErr) {
                                console.error(`Failed to DM moderator ${mod.user.tag}:`, dmErr);
                            }
                        }
                    }
                } else {
                    actionTakenStr = 'Jail punishment failed (Jailed Role ID is not configured)';
                }
            }

            // Log event in the designated admin log channel
            const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
            if (logChannelId) {
                const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    const alertEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🚨 ANTI-NUKE SECURITY LOCKDOWN')
                        .setDescription(`Suspicious administrative activity has triggered security lockdown protocols.`)
                        .addFields(
                            { name: 'Admin Account', value: `<@${executorId}> (\`${executorId}\`)` },
                            { name: 'Infraction Details', value: `Performed ${validTimestamps.length} channel deletions, kicks, or bans within ${timeframe / 1000}s (Limit: ${threshold}).` },
                            { name: 'Punishment Applied', value: `\`${actionTakenStr}\`` }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [alertEmbed] });
                }
            }

            // Clear historical records for this admin to prevent redundant event triggers
            adminActions.set(executorId, []);
        } catch (err) {
            console.error('Error enforcing anti-nuke response:', err);
        }
    }
}

module.exports = { handleAuditLog };
