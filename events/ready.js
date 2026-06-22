const { Events, ActivityType, EmbedBuilder } = require('discord.js');
const dbSetup = require('../database/dbSetup');

const MILESTONES = [
    { level: 100, name: 'Grandmaster' },
    { level: 75, name: 'Ascendant' },
    { level: 50, name: 'Zenith' },
    { level: 40, name: 'Mythic' },
    { level: 30, name: 'Legend' },
    { level: 20, name: 'Veteran' },
    { level: 15, name: 'Master' },
    { level: 10, name: 'Professional' },
    { level: 5, name: 'Elite' },
    { level: 1, name: 'Commoner' }
];

async function updateMilestoneRoles(member, level) {
    try {
        const guild = member.guild;
        const botMember = guild.members.me || await guild.members.fetch(member.client.user.id).catch(() => null);
        if (!botMember || !botMember.permissions.has('ManageRoles')) return;

        const targetMilestone = MILESTONES.find(m => level >= m.level);
        const milestoneRoles = [];
        for (const milestone of MILESTONES) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === milestone.name.toLowerCase());
            if (role) {
                milestoneRoles.push({ milestone, role });
            }
        }

        if (milestoneRoles.length === 0) return;

        const targetRoleData = targetMilestone 
            ? milestoneRoles.find(mr => mr.milestone.name === targetMilestone.name)
            : null;

        for (const { role } of milestoneRoles) {
            if (targetRoleData && role.id === targetRoleData.role.id) {
                if (!member.roles.cache.has(role.id) && botMember.roles.highest.position > role.position) {
                    await member.roles.add(role, `Level ${level} Milestone`).catch(console.error);
                }
            } else {
                if (member.roles.cache.has(role.id) && botMember.roles.highest.position > role.position) {
                    await member.roles.remove(role, `Strip old milestone`).catch(console.error);
                }
            }
        }
    } catch (err) {
        console.error(`[Milestone Swapping Error] User ${member.user.tag}:`, err);
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    updateMilestoneRoles,
    async execute(client, config) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        client.user.setActivity('amo.gg', { type: ActivityType.Playing });

        // Register slash commands globally
        try {
            const settingsCommand = {
                name: 'settings',
                description: 'Configure bot settings',
                options: [
                    {
                        name: 'prefix',
                        description: 'Change the command prefix for standard commands',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'new_prefix',
                                description: 'The new prefix string',
                                type: 3, // STRING
                                required: true
                            }
                        ]
                    }
                ]
            };

            const setupCommand = {
                name: 'setup',
                description: 'Assign server log, jail, and permit roles',
                options: [
                    {
                        name: 'log_channel',
                        description: 'Channel to output admin logs',
                        type: 7, // CHANNEL
                        required: true
                    },
                    {
                        name: 'jail_role',
                        description: 'Role given to jailed users',
                        type: 8, // ROLE
                        required: true
                    },
                    {
                        name: 'auth_role',
                        description: 'Permit role authorized for mod actions/aliases',
                        type: 8, // ROLE
                        required: true
                    }
                ]
            };

            await client.application.commands.set([settingsCommand, setupCommand]);
            console.log('[Slash Config] Registered global /settings and /setup commands.');
        } catch (slashErr) {
            console.error('[Slash Config] Failed to register slash commands:', slashErr);
        }

        // Anti-AFK Voice Checking Loop (run every 5 minutes)
        setInterval(async () => {
            try {
                for (const [guildId, guild] of client.guilds.cache) {
                    const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased());
                    for (const [vcId, vc] of voiceChannels) {
                        // Check active users in voice channels
                        const members = vc.members.filter(m => !m.user.bot);
                        for (const [memberId, member] of members) {
                            const vs = member.voice;
                            // Disqualified if self-muted, self-deafened, server-muted, or server-deafened
                            if (vs.selfMute || vs.selfDeaf || vs.serverMute || vs.serverDeaf) {
                                continue;
                            }

                            const userData = dbSetup.getUserLevel(member.user.id);
                            const currentLevel = userData.level || 0;
                            const currentXp = userData.xp || 0;

                            const xpGained = 10;
                            const newXp = currentXp + xpGained;

                            // Calculate next level threshold: XP = 100 * level^2.5
                            // If level is 0, let's treat threshold as 100 XP
                            let nextXpNeeded = Math.floor(100 * Math.pow(currentLevel, 2.5));
                            if (currentLevel === 0) nextXpNeeded = 100;

                            let xpToSave = newXp;
                            let levelToSave = currentLevel;

                            // Loop check iteratively to handle multiple promotions
                            while (xpToSave >= nextXpNeeded) {
                                xpToSave -= nextXpNeeded;
                                levelToSave++;
                                nextXpNeeded = Math.floor(100 * Math.pow(levelToSave, 2.5));
                                if (levelToSave === 0) nextXpNeeded = 100;

                                // Level Up Notice
                                const embed = new EmbedBuilder()
                                    .setColor(0x00FF88)
                                    .setTitle('🎉 Level Up!')
                                    .setDescription(`Congratulations <@${member.user.id}>! You reached **Level ${levelToSave}** via voice!`)
                                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                                    .setTimestamp();

                                // DM or log
                                await member.send({ embeds: [embed] }).catch(() => {
                                    // Fallback to log or system channel if DM blocked
                                    const settings = dbSetup.getGuildSettings(guild.id);
                                    if (settings.log_channel_id) {
                                        const chan = guild.channels.cache.get(settings.log_channel_id);
                                        if (chan && chan.isTextBased()) {
                                            chan.send({ content: `<@${member.user.id}>`, embeds: [embed] }).catch(() => {});
                                        }
                                    }
                                });
                            }

                            dbSetup.updateUserLevel(member.user.id, xpToSave, levelToSave, userData.last_text_xp);
                            if (levelToSave > currentLevel) {
                                await updateMilestoneRoles(member, levelToSave);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('[Voice XP Loop Error]:', err);
            }
        }, 300000); // 5 minutes in milliseconds
        console.log('[Leveling] voice XP checks configured to run every 5 minutes.');
    }
};
