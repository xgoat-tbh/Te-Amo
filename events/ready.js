// Ready Event
const { Events, ActivityType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Set Rich Presence status to "playing amo.gg"
        client.user.setActivity('amo.gg', { type: ActivityType.Playing });
        console.log('[Presence] Bot activity status set to: "Playing amo.gg"');

        // Setup a 60-second periodic voice XP loop
        setInterval(async () => {
            try {
                for (const [guildId, guild] of client.guilds.cache) {
                    // Find all voice channels
                    const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased());
                    for (const [vcId, vc] of voiceChannels) {
                        // Ignore empty channels or channels with only 1 user (prevents AFK farming)
                        // Filter out bots
                        const members = vc.members.filter(m => !m.user.bot);
                        if (members.size < 2) continue;

                        for (const [memberId, member] of members) {
                            // Skip if deafened (idle farming check)
                            if (member.voice.selfDeaf || member.voice.serverDeaf) continue;

                            const userId = member.user.id;
                            const userDB = db.getUser(userId);
                            const currentLevel = userDB.level || 0;
                            const currentXp = userDB.xp || 0;
                            
                            const xpGained = 10; // 10 XP per minute in voice
                            const newXp = currentXp + xpGained;
                            const xpNeeded = 5 * (currentLevel * currentLevel) + 50 * currentLevel + 100;

                            userDB.xp = newXp;

                            if (newXp >= xpNeeded) {
                                userDB.level = currentLevel + 1;
                                userDB.xp = newXp - xpNeeded; // carry over remainder

                                // Send Level Up Notification
                                const levelUpEmbed = new EmbedBuilder()
                                    .setColor(0x5865F2)
                                    .setTitle('🎉 Voice Level Up!')
                                    .setDescription(`Congratulations <@${userId}>! You've leveled up to **Level ${userDB.level}** through voice chat activity in **${guild.name}**! 🚀`)
                                    .setThumbnail(member.user.displayAvatarURL())
                                    .setTimestamp();

                                // Try to DM
                                try {
                                    await member.send({ embeds: [levelUpEmbed] });
                                } catch (dmErr) {
                                    // If DMs are closed, try to send to general or first writeable text channel
                                    const systemChannel = guild.systemChannel;
                                    if (systemChannel && systemChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
                                        const msg = await systemChannel.send({ embeds: [levelUpEmbed] }).catch(() => null);
                                        if (msg) setTimeout(() => msg.delete().catch(() => {}), 10000);
                                    }
                                }

                                // Level Role Reward logic
                                const roleRewardName = `Level ${userDB.level}`;
                                const rewardRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleRewardName.toLowerCase());
                                if (rewardRole) {
                                    const botMember = guild.members.me;
                                    if (botMember && botMember.permissions.has(PermissionFlagsBits.ManageRoles) && botMember.roles.highest.position > rewardRole.position) {
                                        await member.roles.add(rewardRole, `Level up reward for reaching Level ${userDB.level}`).catch(console.error);
                                    }
                                }
                            }

                            db.saveUser(userId, userDB);
                        }
                    }
                }
            } catch (err) {
                console.error('[Voice XP Loop] Error:', err);
            }
        }, 60000);
        console.log('[Leveling] Persistent Voice XP loop initialized.');
    }
};
