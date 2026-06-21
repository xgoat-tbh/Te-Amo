// Anti-Promotion Security Module
const { PermissionFlagsBits } = require('discord.js');

// In-memory store for user offenses
const offenses = new Map();

/**
 * Scans a message for promotion links and handles progressive discipline.
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

        const userId = message.author.id;
        const userOffenses = offenses.get(userId) || 0;
        const newOffenseCount = userOffenses + 1;
        offenses.set(userId, newOffenseCount);

        if (newOffenseCount === 1) {
            // 1st Offense: DM warning
            try {
                await message.author.send(
                    `⚠️ **Warning**: Promotion links are not allowed in **${message.guild.name}**. Your message has been deleted.`
                );
            } catch (dmErr) {
                // If DM is closed, notify in the channel temporarily or just ignore
                const reply = await message.channel.send(
                    `⚠️ <@${userId}>, promotion links are not allowed. (Failed to send DM warning: DMs closed)`
                );
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            }
        } else {
            // 2nd+ Offense: 10-minute timeout
            offenses.set(userId, 0); // Reset offense count after timeout

            try {
                // Check if the bot can moderate the member
                if (!member.moderatable) {
                    await message.channel.send(`⚠️ Could not timeout <@${userId}> (insufficient permissions).`);
                    return;
                }

                // Apply a 10-minute timeout (10 * 60 * 1000 ms)
                await member.timeout(10 * 60 * 1000, 'Anti-Promotion: Repeated Offense');

                try {
                    await message.author.send(
                        `🚫 You have been muted/timed out for 10 minutes in **${message.guild.name}** for repeated promotion/link sharing.`
                    );
                } catch (dmErr) {
                    // Ignore DM errors on mute
                }

                await message.channel.send(
                    `🚫 <@${userId}> has been timed out for 10 minutes for repeated promotion link violations.`
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
