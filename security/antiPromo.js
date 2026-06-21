// Anti-Promotion Security Module
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

/**
 * Scans a message for promotion links and handles progressive discipline.
 * Returns true if a link was detected and handled, false otherwise.
 * @param {import('discord.js').Message} message - The Discord message object
 * @param {object} config - The bot's configuration object
 */
async function handleMessage(message, config) {
    if (!message.guild || message.author.bot) return false;

    // Scan for http://, https://, discord.gg/, or discord.com/invite
    const linkRegex = /(https?:\/\/|discord\.gg|discord\.com\/invite)/i;
    if (!linkRegex.test(message.content)) return false;

    const member = message.member;
    if (!member) return false;

    // Bypass: check if user has the bypass role
    const bypassRoleId = config.CAN_PROMOTE_ROLE_ID;
    if (bypassRoleId && member.roles.cache.has(bypassRoleId)) {
        return false;
    }

    // Bypass: if user has Administrator permission, don't moderate them
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return false;
    }

    const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id).catch(() => null);
    if (!botMember) return false;

    try {
        // 1. Delete message (requires Manage Messages permission)
        if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
            if (message.deletable) {
                await message.delete().catch(console.error);
            }
        } else {
            console.warn('[Anti-Promo] Warning: Bot lacks "Manage Messages" permission to delete link.');
            await message.channel.send('⚠️ Link filter triggered: Bot lacks "Manage Messages" permission to delete the promotion link. Please grant permissions.').then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            }).catch(() => {});
            return true;
        }

        const strikesLimit = config.ANTI_PROMO_STRIKES_LIMIT || 2;
        const timeoutDurationMins = config.ANTI_PROMO_TIMEOUT_DURATION_MINS || 10;

        const userId = message.author.id;
        const userData = db.getUser(userId);
        const newOffenseCount = (userData.strikes || 0) + 1;
        userData.strikes = newOffenseCount;
        db.saveUser(userId, userData);

        if (newOffenseCount < strikesLimit) {
            // Send warning
            try {
                await message.author.send(
                    `⚠️ **Warning**: Promotion/invite links are not allowed in **${message.guild.name}**. Your message has been deleted. (Strike ${newOffenseCount}/${strikesLimit})`
                );
            } catch (dmErr) {
                const reply = await message.channel.send(
                    `⚠️ <@${userId}>, promotion links are not allowed here. (Strike ${newOffenseCount}/${strikesLimit})`
                );
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            }
        } else {
            // Apply Timeout punishment
            userData.strikes = 0; // Reset strikes count in database
            db.saveUser(userId, userData);

            // Hierarchy Check: Check if bot can moderate this member
            if (botMember.roles.highest.position <= member.roles.highest.position) {
                await message.channel.send(`⚠️ Security Failure: Could not timeout <@${userId}> (User has a higher/equal role than the bot).`);
                return true;
            }

            // Permission Check: Check if bot has Moderate Members permission
            if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                await message.channel.send(`⚠️ Security Failure: Could not timeout <@${userId}> (Bot lacks "Moderate Members" permission).`);
                return true;
            }

            try {
                const timeoutMs = timeoutDurationMins * 60 * 1000;
                await member.timeout(timeoutMs, `Anti-Promotion: Exceeded limit of ${strikesLimit} strikes`);

                try {
                    await message.author.send(
                        `🚫 You have been timed out for ${timeoutDurationMins} minutes in **${message.guild.name}** for repeated link sharing.`
                    );
                } catch (dmErr) {
                    // Ignore DM errors
                }

                await message.channel.send(
                    `🚫 <@${userId}> has been timed out for ${timeoutDurationMins} minutes for repeated promotion link violations.`
                );

                // Log event in the designated admin log channel
                const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
                if (logChannelId) {
                    const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0xFF9900)
                            .setTitle('🛡️ ANTI-PROMO INVITE TIMEOUT')
                            .addFields(
                                { name: 'Member', value: `<@${userId}> (\`${userId}\`)` },
                                { name: 'Reason', value: `Repeated link sharing (${newOffenseCount} strikes).` },
                                { name: 'Action', value: `Timed out for ${timeoutDurationMins} minutes.` }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
                    }
                }
            } catch (muteErr) {
                console.error(`Failed to timeout user ${userId}:`, muteErr);
            }
        }
        return true;
    } catch (err) {
        console.error('Error in antiPromo module:', err);
        return true;
    }
}

module.exports = { handleMessage };
