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

async function updateMemberCounter(guild) {
    try {
        const settings = dbSetup.getGuildSettings(guild.id);
        const counterChannelId = settings.member_counter_channel_id;
        if (counterChannelId) {
            const channel = guild.channels.cache.get(counterChannelId);
            if (channel) {
                await channel.setName(`📊 Members: ${guild.memberCount}`).catch(console.error);
            }
        }
    } catch (err) {
        console.error(`[Member Counter Error] Guild ${guild.name}:`, err);
    }
}

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
    updateMemberCounter,
    async execute(client, config) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        client.user.setActivity('amo.gg', { type: ActivityType.Playing });

        // Initial member counter update on boot
        for (const [guildId, guild] of client.guilds.cache) {
            await updateMemberCounter(guild);
        }

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
                    },
                    {
                        name: 'log_channel',
                        description: 'Update the logging channel',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'channel',
                                description: 'The new logging channel',
                                type: 7, // CHANNEL
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'jail_role',
                        description: 'Update the jail role',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'role',
                                description: 'The new jail role',
                                type: 8, // ROLE
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'auth_role',
                        description: 'Update the permit authorization role',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'role',
                                description: 'The new permit role',
                                type: 8, // ROLE
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'member_counter',
                        description: 'Update the member counter channel',
                        type: 1, // SUB_COMMAND
                        options: [
                            {
                                name: 'channel',
                                description: 'The new member counter channel',
                                type: 7, // CHANNEL
                                required: true
                            }
                        ]
                    }
                ]
            };

            const setupCommand = {
                name: 'setup',
                description: 'Interactive dashboard to configure logging, jail, and permit roles/channels'
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
                        const members = vc.members.filter(m => !m.user.bot);
                        for (const [memberId, member] of members) {
                            const vs = member.voice;
                            if (vs.selfMute || vs.selfDeaf || vs.serverMute || vs.serverDeaf) {
                                continue;
                            }

                            const userData = dbSetup.getUserLevel(member.user.id);
                            const currentLevel = userData.level || 0;
                            const currentXp = userData.xp || 0;

                            const xpGained = 10;
                            const newXp = currentXp + xpGained;

                            let nextXpNeeded = Math.floor(100 * Math.pow(currentLevel, 2.5));
                            if (currentLevel === 0) nextXpNeeded = 100;

                            let xpToSave = newXp;
                            let levelToSave = currentLevel;

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

                                await member.send({ embeds: [embed] }).catch(() => {
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
        }, 300000);
        console.log('[Leveling] voice XP checks configured to run every 5 minutes.');
    }
};
