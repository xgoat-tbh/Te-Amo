// Anti-Nuke Security Module
const { AuditLogEvent, EmbedBuilder } = require('discord.js');

// Store admin actions: adminId -> Array of timestamps
const adminActions = new Map();

/**
 * Handles incoming audit log entries to protect the guild from administrative abuses (mass deletions, kicks, bans).
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

            // Bypasses owner (cannot modify roles of server owner)
            if (guild.ownerId === executorId) {
                console.warn(`[Anti-Nuke] Owner ${executorId} exceeded threshold. Bypassing role removal.`);
                return;
            }

            // Filter out system roles, everyone role, and bot roles that are not editable
            const rolesToRemove = executorMember.roles.cache.filter(role => role.id !== guild.id && role.editable);

            if (rolesToRemove.size > 0) {
                // Strip all roles from the rogue admin
                await executorMember.roles.remove(rolesToRemove, 'Anti-Nuke Lockdown: Action threshold exceeded');
            }

            // Log event in the designated admin log channel
            const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
            if (logChannelId) {
                const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    const alertEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🚨 ANTI-NUKE SECURITY TRIGGERED')
                        .setDescription(`Suspicious admin activity detected. The user roles have been removed to secure the server.`)
                        .addFields(
                            { name: 'Admin Account', value: `<@${executorId}> (\`${executorId}\`)` },
                            { name: 'Action Reason', value: `Performed ${validTimestamps.length} channel deletions, kicks, or bans within ${timeframe / 1000}s (Limit: ${threshold}).` },
                            { name: 'Stripped Roles', value: rolesToRemove.map(r => r.name).join(', ') || 'No removable roles' }
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
