// Anti-Nuke Security Module
const { AuditLogEvent, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

/**
 * Handles incoming audit log entries to protect the guild from administrative abuses.
 * Supports dynamic punishments: strip roles, ban, kick, jail, or log-only.
 * Includes advanced hierarchy and permission safety checks to ensure robustness.
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

    // Fetch the admin's action history persistently
    const nukeState = db.getNukeState();
    if (!nukeState[executorId]) {
        nukeState[executorId] = [];
    }

    const timestamps = nukeState[executorId];
    
    // Track the new action timestamp
    timestamps.push(now);

    // Keep only timestamps within the sliding window timeframe
    const validTimestamps = timestamps.filter(t => now - t < timeframe);
    nukeState[executorId] = validTimestamps;
    db.saveNukeState(nukeState);

    if (validTimestamps.length > threshold) {
        try {
            const executorMember = await guild.members.fetch(executorId).catch(() => null);
            if (!executorMember) return;

            // Bypasses owner (cannot modify roles/ban/kick server owner)
            if (guild.ownerId === executorId) {
                console.warn(`[Anti-Nuke] Owner ${executorId} exceeded threshold. Bypassing punishment.`);
                return;
            }

            const botMember = guild.members.me || await guild.members.fetch(guild.client.user.id).catch(() => null);
            if (!botMember) return;

            const punishment = config.ANTI_NUKE_ACTION || 'jail';
            let actionTakenStr = '';
            let isPermError = false;
            let isHierarchyError = false;

            // Check if the bot can modify the target admin (Role Hierarchy restriction)
            if (botMember.roles.highest.position <= executorMember.roles.highest.position) {
                isHierarchyError = true;
            }

            if (!isHierarchyError) {
                if (punishment === 'strip_roles') {
                    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                        isPermError = true;
                    } else {
                        const rolesToRemove = executorMember.roles.cache.filter(role => role.id !== guild.id && role.editable);
                        if (rolesToRemove.size > 0) {
                            await executorMember.roles.remove(rolesToRemove, 'Anti-Nuke Lockdown: Action threshold exceeded');
                            actionTakenStr = `Stripped Roles: ${rolesToRemove.map(r => r.name).join(', ')}`;
                        } else {
                            actionTakenStr = 'Strip Roles (Failed: No editable roles found)';
                        }
                    }
                } else if (punishment === 'ban') {
                    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
                        isPermError = true;
                    } else if (executorMember.bannable) {
                        await guild.members.ban(executorId, { reason: 'Anti-Nuke Lockdown: Action threshold exceeded' });
                        actionTakenStr = 'Banned from Server';
                    } else {
                        actionTakenStr = 'Ban punishment failed (Target is not bannable)';
                    }
                } else if (punishment === 'kick') {
                    if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
                        isPermError = true;
                    } else if (executorMember.kickable) {
                        await executorMember.kick('Anti-Nuke Lockdown: Action threshold exceeded');
                        actionTakenStr = 'Kicked from Server';
                    } else {
                        actionTakenStr = 'Kick punishment failed (Target is not kickable)';
                    }
                } else if (punishment === 'log') {
                    actionTakenStr = 'None (Log Only mode)';
                } else if (punishment === 'jail') {
                    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                        isPermError = true;
                    } else {
                        const jailedRoleId = config.JAILED_ROLE_ID;
                        if (jailedRoleId && !jailedRoleId.includes('YOUR_')) {
                            // 1. Backup user's roles and set isJailed in the database
                            const oldRoleIds = executorMember.roles.cache.filter(role => role.id !== guild.id && role.id !== jailedRoleId).map(role => role.id);
                            const userData = db.getUser(executorId);
                            userData.roles = oldRoleIds;
                            userData.isJailed = true;
                            db.saveUser(executorId, userData);

                            // 2. Strip all administrative/assignable roles
                            const rolesToRemove = executorMember.roles.cache.filter(role => role.id !== guild.id && role.editable);
                            if (rolesToRemove.size > 0) {
                                await executorMember.roles.remove(rolesToRemove, 'Anti-Nuke Lockdown: Stripped roles before jail');
                            }

                            // 3. Add the Jailed Role
                            await executorMember.roles.add(jailedRoleId, 'Anti-Nuke Lockdown: Rogue admin jailed');
                            actionTakenStr = `Jailed (Original Roles Backed Up + Jailed Role Applied)`;
                        } else {
                            actionTakenStr = 'Jail punishment failed (Jailed Role ID is not configured)';
                        }
                    }
                }
            }

            // Handle errors
            if (isHierarchyError) {
                actionTakenStr = '⚠️ CRITICAL: Action failed due to Role Hierarchy (Target admin has a higher or equal role position than the bot).';
            } else if (isPermError) {
                actionTakenStr = `⚠️ CRITICAL: Action failed due to Insufficient Bot Permissions (Bot lacks required permissions for the configured action: ${punishment}).`;
            }

            // Send emergency DMs to all administrators/moderators
            const guildMembers = await guild.members.fetch().catch(() => null);
            if (guildMembers) {
                const adminsToDM = guildMembers.filter(m => 
                    m.permissions.has(PermissionFlagsBits.Administrator) && 
                    !m.user.bot && 
                    m.id !== executorId
                );

                const alertHeader = isHierarchyError || isPermError ? '🚨 **CRITICAL SECURITY FAILURE** 🚨' : '🚨 **SECURITY ALERT** 🚨';
                const actionDetails = isHierarchyError || isPermError 
                    ? `The bot attempted to punish them but **FAILED**.\n**Reason**: ${actionTakenStr}\n**URGENT**: Please intervene manually immediately to secure the server!`
                    : `The bot has successfully taken action.\n**Punishment Applied**: \`${actionTakenStr}\``;

                for (const [id, mod] of adminsToDM) {
                    try {
                        await mod.send(
                            `${alertHeader}\n` +
                            `Admin **${executorMember.user.tag}** (\`${executorId}\`) has triggered the **Anti-Nuke system** in server **${guild.name}** for performing too many administrative actions (${validTimestamps.length} actions in ${timeframe / 1000}s).\n\n` +
                            `${actionDetails}`
                        );
                    } catch (dmErr) {
                        console.error(`Failed to DM moderator ${mod.user.tag}:`, dmErr);
                    }
                }
            }

            // Log event in the designated admin log channel
            const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
            if (logChannelId) {
                const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    const isFailure = isHierarchyError || isPermError;
                    
                    const alertEmbed = new EmbedBuilder()
                        .setColor(isFailure ? 0xFF9900 : 0xFF0000) // Orange for hierarchy/permission failure, red for success nuke alert
                        .setTitle(isFailure ? '⚠️ ANTI-NUKE PROTECTION BYPASSED' : '🚨 ANTI-NUKE SECURITY LOCKDOWN')
                        .setDescription(isFailure 
                            ? `Suspicious activity detected, but the bot was unable to enforce the punishment automatically.` 
                            : `Suspicious administrative activity has triggered security lockdown protocols.`
                        )
                        .addFields(
                            { name: 'Admin Account', value: `<@${executorId}> (\`${executorId}\`)` },
                            { name: 'Infraction Details', value: `Performed ${validTimestamps.length} channel deletions, kicks, or bans within ${timeframe / 1000}s (Limit: ${threshold}).` },
                            { name: 'Status / Action Taken', value: `\`${actionTakenStr}\`` }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [alertEmbed] });
                }
            }

            // Clear historical records for this admin persistently to prevent redundant event triggers
            const currentNukeState = db.getNukeState();
            currentNukeState[executorId] = [];
            db.saveNukeState(currentNukeState);
        } catch (err) {
            console.error('Error enforcing anti-nuke response:', err);
        }
    }
}

module.exports = { handleAuditLog };
