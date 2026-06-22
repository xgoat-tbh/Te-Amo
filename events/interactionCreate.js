const {
    Events,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const dbSetup = require('../database/dbSetup');
const { updateMemberCounter } = require('./ready');

const activeSetups = new Map();

function getSetupDashboard(guild, session) {
    const embed = new EmbedBuilder()
        .setColor(0x00AEFF)
        .setTitle('⚙️ Te-Amo Server Setup Wizard')
        .setDescription('Configure your server logging, jail, permit roles, and member counters using the dropdown menus below.\n\n' +
                         'All selections are ephemeral and will only be saved when you click **Save Configuration**.')
        .addFields(
            { 
                name: '📁 Logging Room', 
                value: session.logChannelId ? `<#${session.logChannelId}>` : '*Not Selected (Required)*', 
                inline: true 
            },
            { 
                name: '🔒 Jail Role', 
                value: session.jailRoleId ? `<@&${session.jailRoleId}>` : '*Not Selected (Required)*', 
                inline: true 
            },
            { 
                name: '⚙️ Permit Role', 
                value: session.authRoleId ? `<@&${session.authRoleId}>` : '*Not Selected (Required)*', 
                inline: true 
            },
            { 
                name: '📊 Member Counter', 
                value: session.memberCounterId ? `<#${session.memberCounterId}>` : '*Not Selected (Optional)*', 
                inline: true 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Te-Amo Setup Dashboard', iconURL: guild.iconURL() });

    const logRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_log_channel')
            .setPlaceholder('Select Logging Channel 📁')
            .addChannelTypes(ChannelType.GuildText)
    );

    const jailRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('setup_jail_role')
            .setPlaceholder('Select Jail Role 🔒')
    );

    const authRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('setup_auth_role')
            .setPlaceholder('Select Permit / Authorization Role ⚙️')
    );

    const counterRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_member_counter')
            .setPlaceholder('Select Member Counter VC 📊 (Optional)')
            .addChannelTypes(ChannelType.GuildVoice)
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup_confirm')
            .setLabel('Save Configuration')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('setup_cancel')
            .setLabel('Cancel Setup')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [logRow, jailRow, authRow, counterRow, buttonRow] };
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        const guildId = interaction.guildId;

        // Handle Setup components (Select menus and Buttons)
        if (interaction.isAnySelectMenu() || interaction.isButton()) {
            if (interaction.customId.startsWith('setup_')) {
                // Verify user is an administrator
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: '❌ You must have **Administrator** permissions to use settings/setup components.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const session = activeSetups.get(guildId);
                if (!session) {
                    return interaction.reply({
                        content: '❌ No active setup session found. Please run `/setup` again.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                if (session.interactionUserId !== interaction.user.id) {
                    return interaction.reply({
                        content: '❌ You are not authorized to interact with this setup session.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                // Handle Select Menu Changes
                if (interaction.isAnySelectMenu()) {
                    const selectedValue = interaction.values[0];

                    if (interaction.customId === 'setup_log_channel') {
                        session.logChannelId = selectedValue;
                    } else if (interaction.customId === 'setup_jail_role') {
                        if (selectedValue === guildId) {
                            return interaction.reply({
                                content: '❌ You cannot set the `@everyone` role as the Jail role.',
                                flags: [MessageFlags.Ephemeral]
                            });
                        }
                        session.jailRoleId = selectedValue;
                    } else if (interaction.customId === 'setup_auth_role') {
                        if (selectedValue === guildId) {
                            return interaction.reply({
                                content: '❌ You cannot set the `@everyone` role as the Permit role.',
                                flags: [MessageFlags.Ephemeral]
                            });
                        }
                        session.authRoleId = selectedValue;
                    } else if (interaction.customId === 'setup_member_counter') {
                        session.memberCounterId = selectedValue;
                    }

                    // Update dashboard embed
                    const dashboard = getSetupDashboard(interaction.guild, session);
                    return interaction.update(dashboard);
                }

                // Handle Buttons
                if (interaction.isButton()) {
                    if (interaction.customId === 'setup_cancel') {
                        activeSetups.delete(guildId);
                        return interaction.update({
                            content: '❌ Setup cancelled. You can initiate a new setup with `/setup`.',
                            embeds: [],
                            components: []
                        });
                    }

                    if (interaction.customId === 'setup_confirm') {
                        if (!session.logChannelId || !session.jailRoleId || !session.authRoleId) {
                            return interaction.reply({
                                content: '❌ Please select a Logging Channel, Jail Role, and Permit Role before saving.',
                                flags: [MessageFlags.Ephemeral]
                            });
                        }

                        // Save to database
                        dbSetup.updateSetup(guildId, session.logChannelId, session.jailRoleId, session.authRoleId, session.memberCounterId);

                        // Dynamically configure category, Jailed role, and channel overrides
                        await interaction.deferUpdate();
                        await dbSetup.ensureJailSystem(interaction.guild).catch(console.error);

                        // Sync member counter channel
                        if (interaction.guild) {
                            await updateMemberCounter(interaction.guild).catch(() => {});
                        }

                        const settingsData = dbSetup.getGuildSettings(guildId);
                        const prefix = settingsData.prefix || '?';

                        const finalEmbed = new EmbedBuilder()
                            .setColor(0x00FF88)
                            .setTitle('⚙️ Server Setup & Capabilities Overview')
                            .setDescription('The bot configuration has been successfully updated. Below is the active configuration and capabilities summary.')
                            .addFields(
                                {
                                    name: '🛠️ CONFIGURATION PARAMETERS',
                                    value: `• **Logging Channel**: <#${session.logChannelId}>\n` +
                                           `• **Jail Role**: <@&${session.jailRoleId}>\n` +
                                           `• **Permit (Authorization) Role**: <@&${session.authRoleId}>\n` +
                                           `• **Member Counter**: ${session.memberCounterId ? `<#${session.memberCounterId}>` : '*Not Configured*'}\n` +
                                           `• **Standard Prefix**: \`${prefix}\``,
                                    inline: false
                                },
                                {
                                    name: '🏆 LEVELING SYSTEM',
                                    value: `• **Grind Formula**: $XP = 100 \\times \\text{Level}^{2.5}$\n` +
                                           `• **Chat XP**: 15–25 XP per message (60-second cooldown)\n` +
                                           `• **Voice XP**: 10 XP per 5-minute interval (requires activity; self/server mute or deafen disqualifies)\n` +
                                           `• **Milestone Roles Swapping**: Iterative roles swapping from **Commoner** (Lv. 1) to **Grandmaster** (Lv. 100) to prevent sidebar bloating.`,
                                    inline: false
                                },
                                {
                                    name: '🛡️ SPECIALIZED MODERATION',
                                    value: `• **Moderation Commands**: \`${prefix}kick\`, \`${prefix}ban\`, \`${prefix}mute\` (supports smart duration parser e.g., \`10m\`, \`2h\`, \`1d\`)\n` +
                                           `• **Jail Control**: \`${prefix}jail\` (assigns the jail role, strips standard roles) and \`${prefix}unjail\` (removes jail role, restores standard roles, bypasses leave-escape).`,
                                    inline: false
                                },
                                {
                                    name: '🎭 UTILITIES & CUSTOM TOOLS',
                                    value: `• **Role Alias Protocol**: Custom triggers to toggle roles on members via permit authorization overrides (\`${prefix}alias create\`)\n` +
                                           `• **VC Movement Tool (\`${prefix}mv\`)**: Moves voice members individually or collectively using regex VC resolution\n` +
                                           `• **Voice Lobby Tracker**: Automated invite link triggers when VC user counts hit lobby milestones (with 15-minute anti-abuse map locks)\n` +
                                           `• **Discohook Embed Loader**: Parse and send complex templates from Discohook exports using \`${prefix}embed send\`.`,
                                    inline: false
                                }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'Te-Amo Assistant Setup Completed', iconURL: interaction.guild.iconURL() });

                        activeSetups.delete(guildId);

                        return interaction.editReply({
                            content: null,
                            embeds: [finalEmbed],
                            components: []
                        });
                    }
                }
            }
        }

        if (!interaction.isChatInputCommand()) return;

        // Verify user is an administrator
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You must have **Administrator** permissions to use settings/setup commands.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const { commandName } = interaction;

        if (commandName === 'settings') {
            const subcommand = interaction.options.getSubcommand();
            const currentSettings = dbSetup.getGuildSettings(guildId);

            let logChannelId = currentSettings.log_channel_id;
            let jailRoleId = currentSettings.jail_role_id;
            let authRoleId = currentSettings.auth_role_id;
            let memberCounterId = currentSettings.member_counter_channel_id;

            if (subcommand === 'prefix') {
                const newPrefix = interaction.options.getString('new_prefix');
                dbSetup.updatePrefix(guildId, newPrefix);
                return interaction.reply({
                    content: `✅ Prefix has been successfully updated to: \`${newPrefix}\``,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (subcommand === 'log_channel') {
                const newChannel = interaction.options.getChannel('channel');
                logChannelId = newChannel.id;
                dbSetup.updateSetup(guildId, logChannelId, jailRoleId, authRoleId, memberCounterId);
                return interaction.reply({
                    content: `✅ Logging channel has been updated to: <#${logChannelId}>`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (subcommand === 'jail_role') {
                const newRole = interaction.options.getRole('role');
                if (newRole.id === interaction.guild.id) {
                    return interaction.reply({
                        content: '❌ You cannot set the `@everyone` role as the Jail role.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                jailRoleId = newRole.id;
                dbSetup.updateSetup(guildId, logChannelId, jailRoleId, authRoleId, memberCounterId);
                await dbSetup.ensureJailSystem(interaction.guild).catch(console.error);
                return interaction.reply({
                    content: `✅ Jail role has been updated to: <@&${jailRoleId}> (and jail channels/overrides configured)`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (subcommand === 'auth_role') {
                const newRole = interaction.options.getRole('role');
                if (newRole.id === interaction.guild.id) {
                    return interaction.reply({
                        content: '❌ You cannot set the `@everyone` role as the Authorization permit role.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                authRoleId = newRole.id;
                dbSetup.updateSetup(guildId, logChannelId, jailRoleId, authRoleId, memberCounterId);
                return interaction.reply({
                    content: `✅ Authorization permit role has been updated to: <@&${authRoleId}>`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (subcommand === 'member_counter') {
                const newChannel = interaction.options.getChannel('channel');
                memberCounterId = newChannel.id;
                dbSetup.updateSetup(guildId, logChannelId, jailRoleId, authRoleId, memberCounterId);
                
                // Trigger immediate update
                await updateMemberCounter(interaction.guild);

                return interaction.reply({
                    content: `✅ Member counter channel has been updated to: <#${memberCounterId}>`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        if (commandName === 'setup') {
            // Check if there is already an active session
            if (activeSetups.has(guildId)) {
                return interaction.reply({
                    content: '⚠️ A setup session is already in progress. Please use the existing dashboard message to configure the bot.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const session = {
                logChannelId: null,
                jailRoleId: null,
                authRoleId: null,
                memberCounterId: null,
                interactionUserId: interaction.user.id
            };
            activeSetups.set(guildId, session);

            const dashboard = getSetupDashboard(interaction.guild, session);

            return interaction.reply({
                ...dashboard,
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};
