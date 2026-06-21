// Anti-Promotion Security Module
const { PermissionFlagsBits } = require('discord.js');

// In-memory store for user offenses
const offenses = new Map();

/**
 * Scans a message for promotion links and handles progressive discipline.
 * Supports dynamic warning strikes and timeout durations.
 * @param {import('discord.js').Message} message - The Discord message object
 * @param {object} config - The bot's configuration object
 */
async function handleMessage(message, config) {
    if (!message.guild || message.author.bot) return;

    // Scan for http://, https://, discord.gg/, or discord.com/invite
    const linkRegex = /(https?:\/\/|discord\.gg|discord\.com\/invite)/i;
    if (!linkRegex.test(message.content)) return;

    const member = message.member;
    if (!member) return;

    // Bypass: check if user has the bypass role
    const bypassRoleId = config.CAN_PROMOTE_ROLE_ID;
    if (bypassRoleId && member.roles.cache.has(bypassRoleId)) {
        return;
    }

    // Bypass: if user has Administrator permission, don't moderate them
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return;
    }

    try {
        // Delete the promotion message
        if (message.deletable) {
            await message.delete();
        }

        const strikesLimit = config.ANTI_PROMO_STRIKES_LIMIT || 2;
        const timeoutDurationMins = config.ANTI_PROMO_TIMEOUT_DURATION_MINS || 10;

        const userId = message.author.id;
        const userOffenses = offenses.get(userId) || 0;
        const newOffenseCount = userOffenses + 1;
        offenses.set(userId, newOffenseCount);

        if (newOffenseCount < strikesLimit) {
            // Strike count is below limit: send a DM warning
            try {
                await message.author.send(
                    `⚠️ **Warning**: Promotion/invite links are not allowed in **${message.guild.name}**. Your message has been deleted. (Strike ${newOffenseCount}/${strikesLimit})`
                );
            } catch (dmErr) {
                // If DM fails, send a temporary warning in the text channel
                const reply = await message.channel.send(
                    `⚠️ <@${userId}>, promotion links are not allowed here. (Strike ${newOffenseCount}/${strikesLimit})`
                );
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            }
        } else {
            // Strike count exceeded limit: apply a timeout
            offenses.set(userId, 0); // Reset user strikes after applying punishment

            try {
                if (!member.moderatable) {
                    await message.channel.send(`⚠️ Could not timeout <@${userId}> (insufficient permissions).`);
                    return;
                }

                // Apply a dynamic timeout duration
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
            } catch (muteErr) {
                console.error(`Failed to timeout user ${userId}:`, muteErr);
            }
        }
    } catch (err) {
        console.error('Error in antiPromo module:', err);
    }
}

module.exports = { handleMessage };
