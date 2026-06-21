// Message Create Event
const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const antiPromo = require('../security/antiPromo');
const db = require('../utils/db');

// In-memory store for spam detection: userId -> Array of timestamps
const messageLogs = new Map();

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client, config) {
        if (!message.guild || message.author.bot) return;

        const member = message.member;
        if (!member) return;

        const userId = message.author.id;
        const now = Date.now();

        // --- SPAM / FLOOD PROTECTION ---
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        const bypassRoleId = config.CAN_PROMOTE_ROLE_ID;
        const isBypass = bypassRoleId && member.roles.cache.has(bypassRoleId);

        if (!isAdmin && !isBypass) {
            if (!messageLogs.has(userId)) {
                messageLogs.set(userId, []);
            }
            const timestamps = messageLogs.get(userId);
            timestamps.push(now);

            // Filter timestamps within the last 3 seconds
            const recentTimestamps = timestamps.filter(t => now - t < 3000);
            messageLogs.set(userId, recentTimestamps);

            if (recentTimestamps.length > 5) {
                // Delete message
                if (message.deletable) {
                    await message.delete().catch(() => {});
                }

                // Apply strike
                const userData = db.getUser(userId);
                const strikesLimit = config.ANTI_PROMO_STRIKES_LIMIT || 2;
                const newStrikes = (userData.strikes || 0) + 1;
                userData.strikes = newStrikes;
                db.saveUser(userId, userData);

                if (newStrikes < strikesLimit) {
                    // Send warning DM or reply
                    try {
                        await message.author.send(`⚠️ **Warning**: Please slow down! Chat flooding/spamming is not allowed in **${message.guild.name}**. (Strike ${newStrikes}/${strikesLimit})`);
                    } catch (err) {
                        const reply = await message.channel.send(`⚠️ <@${userId}>, slow down! Chat flooding is not allowed. (Strike ${newStrikes}/${strikesLimit})`);
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                } else {
                    // Reset strikes
                    userData.strikes = 0;
                    db.saveUser(userId, userData);

                    // Timeout member
                    const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);
                    if (botMember && botMember.permissions.has(PermissionFlagsBits.ModerateMembers) && botMember.roles.highest.position > member.roles.highest.position) {
                        const timeoutMins = config.ANTI_PROMO_TIMEOUT_DURATION_MINS || 10;
                        await member.timeout(timeoutMins * 60 * 1000, 'Chat spam / flooding violation').catch(console.error);

                        await message.channel.send(`🚫 <@${userId}> has been timed out for ${timeoutMins} minutes for spamming/chat flooding.`);

                        // Log to security channel
                        const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
                        if (logChannelId) {
                            const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
                            if (logChannel && logChannel.isTextBased()) {
                                const logEmbed = new EmbedBuilder()
                                    .setColor(0xFF9900)
                                    .setTitle('🛡️ SPAM FILTER TIMEOUT')
                                    .addFields(
                                        { name: 'Member', value: `<@${userId}> (\`${userId}\`)` },
                                        { name: 'Reason', value: `Sent ${recentTimestamps.length} messages in 3 seconds.` },
                                        { name: 'Action', value: `Timed out for ${timeoutMins} minutes.` }
                                    )
                                    .setTimestamp();
                                await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
                            }
                        }
                    }
                }
                return; // Stop processing message further (no commands or XP)
            }
        }

        // --- ANTI-PROMOTION invite link filter ---
        const promoHandled = await antiPromo.handleMessage(message, config);
        if (promoHandled) return;

        // --- LEVELING SYSTEM (XP on message) ---
        const userDB = db.getUser(userId);
        const cooldown = 60000; // 1 minute XP cooldown

        if (now - (userDB.lastMessageTimestamp || 0) > cooldown) {
            const xpGained = Math.floor(Math.random() * 11) + 15; // 15 to 25 XP
            const currentLevel = userDB.level || 0;
            const currentXp = userDB.xp || 0;
            
            const newXp = currentXp + xpGained;
            const xpNeeded = 5 * (currentLevel * currentLevel) + 50 * currentLevel + 100;

            userDB.xp = newXp;
            userDB.lastMessageTimestamp = now;

            if (newXp >= xpNeeded) {
                userDB.level = currentLevel + 1;
                userDB.xp = newXp - xpNeeded; // carry over remainder

                // Send clean, professional Level Up notification
                const levelUpEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🎉 Level Up!')
                    .setDescription(`Congratulations <@${userId}>! You've reached **Level ${userDB.level}**! 🚀`)
                    .setThumbnail(message.author.displayAvatarURL())
                    .setTimestamp();

                const lvlMsg = await message.channel.send({ embeds: [levelUpEmbed] }).catch(console.error);
                if (lvlMsg) {
                    setTimeout(() => lvlMsg.delete().catch(() => {}), 10000); // auto-delete after 10s
                }

                // Level Role Reward logic
                const roleRewardName = `Level ${userDB.level}`;
                const rewardRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleRewardName.toLowerCase());
                if (rewardRole) {
                    const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);
                    if (botMember && botMember.permissions.has(PermissionFlagsBits.ManageRoles) && botMember.roles.highest.position > rewardRole.position) {
                        await member.roles.add(rewardRole, `Level up reward for reaching Level ${userDB.level}`).catch(console.error);
                    }
                }
            }

            db.saveUser(userId, userDB);
        }

        // --- COMMAND HANDLING ---
        const prefix = '!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(message, args, config);
        } catch (error) {
            console.error(`Error executing command "!${commandName}":`, error);
            message.reply('❌ There was an error trying to execute that command!').catch(console.error);
        }
    }
};
