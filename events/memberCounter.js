// Member Counter Rate-Limiting Helper
let lastUpdate = 0;
let timeoutId = null;
const UPDATE_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Updates the name of the designated counter voice channel with rate limit protection.
 * @param {import('discord.js').Guild} guild - The Discord guild
 * @param {object} config - The bot's configuration object
 */
async function updateCounter(guild, config) {
    const vcId = config.MEMBER_COUNT_VC_ID;
    if (!vcId || vcId.includes('YOUR_')) return;

    const totalMembers = guild.memberCount;
    const newName = `📊 Members: ${totalMembers.toLocaleString()}`;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate;

    // Check if cooldown has elapsed
    if (timeSinceLastUpdate >= UPDATE_COOLDOWN) {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        
        try {
            const channel = await guild.channels.fetch(vcId).catch(() => null);
            if (channel && channel.name !== newName) {
                await channel.setName(newName);
                lastUpdate = Date.now();
                console.log(`[MemberCounter] Channel name updated immediately to: "${newName}"`);
            }
        } catch (err) {
            console.error('[MemberCounter] Failed to update channel name:', err);
        }
    } else {
        // Cooldown active, queue/schedule the update for when the cooldown expires
        if (timeoutId) return; // Keep the existing scheduled task since it will use the latest count on execution

        const delay = UPDATE_COOLDOWN - timeSinceLastUpdate;
        console.log(`[MemberCounter] Renaming is rate-limited. Queuing update in ${Math.round(delay / 1000)} seconds.`);

        timeoutId = setTimeout(async () => {
            timeoutId = null;
            try {
                // Fetch fresh guild details to get the most accurate member count
                const freshGuild = await guild.fetch().catch(() => guild);
                const latestCount = freshGuild.memberCount;
                const latestName = `📊 Members: ${latestCount.toLocaleString()}`;
                
                const channel = await freshGuild.channels.fetch(vcId).catch(() => null);
                if (channel && channel.name !== latestName) {
                    await channel.setName(latestName);
                    lastUpdate = Date.now();
                    console.log(`[MemberCounter] Channel name updated (delayed queue) to: "${latestName}"`);
                }
            } catch (err) {
                console.error('[MemberCounter] Failed to execute queued channel rename:', err);
            }
        }, delay);
    }
}

module.exports = { updateCounter };
