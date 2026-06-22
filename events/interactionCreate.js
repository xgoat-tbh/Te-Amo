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

function getCoreSetupDashboard(guild, session) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('⚙️ Amo India Core Setup Wizard')
        .setDescription('Configure your server logging, jail, and permit roles using the dropdown menus below.\n\n' +
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
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Amo India Setup Dashboard', iconURL: guild.iconURL() });

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

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup_core_confirm')
            .setLabel('Save Configuration')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('setup_core_cancel')
            .setLabel('Cancel Setup')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [logRow, jailRow, authRow, buttonRow] };
}

function getChannelsSetupDashboard(guild, session) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('⚙️ Amo India Features Setup Wizard')
        .setDescription('Configure your server member counter, confession, and suggestion channels using the dropdown menus below.\n\n' +
                         'All selections are ephemeral and will only be saved when you click **Save Configuration**.')
        .addFields(
            { 
                name: '📊 Member Counter', 
                value: session.memberCounterId ? `<#${session.memberCounterId}>` : '*Not Selected (Optional)*', 
                inline: true 
            },
            { 
                name: '🎭 Confession Channel', 
                value: session.confessionId ? `<#${session.confessionId}>` : '*Not Selected (Optional)*', 
                inline: true 
            },
            { 
                name: '💡 Suggestion Channel', 
                value: session.suggestionId ? `<#${session.suggestionId}>` : '*Not Selected (Optional)*', 
                inline: true 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Amo India Setup Dashboard', iconURL: guild.iconURL() });

    const counterRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_member_counter')
            .setPlaceholder('Select Member Counter VC 📊 (Optional)')
            .addChannelTypes(ChannelType.GuildVoice)
    );

    const confessionRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_confession_channel')
            .setPlaceholder('Select Confession Channel 🎭 (Optional)')
            .addChannelTypes(ChannelType.GuildText)
    );

    const suggestionRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_suggestion_channel')
            .setPlaceholder('Select Suggestion Channel 💡 (Optional)')
            .addChannelTypes(ChannelType.GuildText)
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup_channels_confirm')
            .setLabel('Save Configuration')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('setup_channels_cancel')
            .setLabel('Cancel Setup')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [counterRow, confessionRow, suggestionRow, buttonRow] };
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
                        content: '❌ You must have **Administrator** permissions to use setup components.',
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
                    } else if (interaction.customId === 'setup_confession_channel') {
                        session.confessionId = selectedValue;
                    } else if (interaction.customId === 'setup_suggestion_channel') {
                        session.suggestionId = selectedValue;
                    }

                    // Update correct dashboard embed
                    const dashboard = session.type === 'core' 
                        ? getCoreSetupDashboard(interaction.guild, session)
                        : getChannelsSetupDashboard(interaction.guild, session);

                    return interaction.update(dashboard);
                }

                // Handle Buttons
                if (interaction.isButton()) {
                    if (interaction.customId === 'setup_core_cancel' || interaction.customId === 'setup_channels_cancel') {
                        activeSetups.delete(guildId);
                        return interaction.update({
                            content: '❌ Setup cancelled. You can initiate a new setup with `/setup`.',
                            embeds: [],
                            components: []
                        });
                    }

                    if (interaction.customId === 'setup_core_confirm') {
                        if (!session.logChannelId || !session.jailRoleId || !session.authRoleId) {
                            return interaction.reply({
                                content: '❌ Please select a Logging Channel, Jail Role, and Permit Role before saving.',
                                flags: [MessageFlags.Ephemeral]
                            });
                        }

                        // Save to database
                        dbSetup.updateCoreSetup(guildId, session.logChannelId, session.jailRoleId, session.authRoleId);

                        // Dynamically configure category, Jailed role, and channel overrides
                        await interaction.deferUpdate();
                        await dbSetup.ensureJailSystem(interaction.guild).catch(console.error);

                        const settingsData = dbSetup.getGuildSettings(guildId);
                        const prefix = settingsData.prefix || '?';

                        const finalEmbed = new EmbedBuilder()
                            .setColor(0x57F287) // Success Green
                            .setTitle('✅ Core Config Saved | Amo India')
                            .setDescription('Your core bot settings have been updated successfully.')
                            .addFields(
                                { name: '📁 Logging Room', value: `<#${session.logChannelId}>`, inline: true },
                                { name: '🔒 Jail Role', value: `<@&${session.jailRoleId}>`, inline: true },
                                { name: '⚙️ Permit Role', value: `<@&${session.authRoleId}>`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'Amo India Core Setup', iconURL: interaction.guild.iconURL() });

                        activeSetups.delete(guildId);

                        return interaction.editReply({
                            content: null,
                            embeds: [finalEmbed],
                            components: []
                        });
                    }

                    if (interaction.customId === 'setup_channels_confirm') {
                        // Save channels setup (all are optional)
                        dbSetup.updateChannelsSetup(guildId, session.memberCounterId, session.confessionId, session.suggestionId);

                        await interaction.deferUpdate();

                        // Sync member counter channel
                        if (session.memberCounterId && interaction.guild) {
                            await updateMemberCounter(interaction.guild).catch(() => {});
                        }

                        const finalEmbed = new EmbedBuilder()
                            .setColor(0x57F287) // Success Green
                            .setTitle('✅ Feature Channels Saved | Amo India')
                            .setDescription('Your feature channel allocations have been saved successfully.')
                            .addFields(
                                { name: '📊 Member Counter', value: session.memberCounterId ? `<#${session.memberCounterId}>` : '*Not Configured*', inline: true },
                                { name: '🎭 Confession Channel', value: session.confessionId ? `<#${session.confessionId}>` : '*Not Configured*', inline: true },
                                { name: '💡 Suggestion Channel', value: session.suggestionId ? `<#${session.suggestionId}>` : '*Not Configured*', inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'Amo India Channel Setup', iconURL: interaction.guild.iconURL() });

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
                dbSetup.updateCoreSetup(guildId, logChannelId, jailRoleId, authRoleId);
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
                dbSetup.updateCoreSetup(guildId, logChannelId, jailRoleId, authRoleId);
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
                dbSetup.updateCoreSetup(guildId, logChannelId, jailRoleId, authRoleId);
                return interaction.reply({
                    content: `✅ Authorization permit role has been updated to: <@&${authRoleId}>`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (subcommand === 'member_counter') {
                const newChannel = interaction.options.getChannel('channel');
                memberCounterId = newChannel.id;
                dbSetup.updateChannelsSetup(guildId, memberCounterId, currentSettings.confession_channel_id, currentSettings.suggestion_channel_id);
                await updateMemberCounter(interaction.guild);
                return interaction.reply({
                    content: `✅ Member counter channel has been updated to: <#${memberCounterId}>`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        if (commandName === 'setup') {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'core') {
                if (activeSetups.has(guildId)) {
                    return interaction.reply({
                        content: '⚠️ A setup session is already in progress. Please use the existing dashboard message to configure the bot.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const session = {
                    type: 'core',
                    logChannelId: null,
                    jailRoleId: null,
                    authRoleId: null,
                    interactionUserId: interaction.user.id
                };
                activeSetups.set(guildId, session);

                const dashboard = getCoreSetupDashboard(interaction.guild, session);
                return interaction.reply({ ...dashboard, flags: [MessageFlags.Ephemeral] });
            }

            if (subcommand === 'channels') {
                if (activeSetups.has(guildId)) {
                    return interaction.reply({
                        content: '⚠️ A setup session is already in progress. Please use the existing dashboard message to configure the bot.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const session = {
                    type: 'channels',
                    memberCounterId: null,
                    confessionId: null,
                    suggestionId: null,
                    interactionUserId: interaction.user.id
                };
                activeSetups.set(guildId, session);

                const dashboard = getChannelsSetupDashboard(interaction.guild, session);
                return interaction.reply({ ...dashboard, flags: [MessageFlags.Ephemeral] });
            }

            if (subcommand === 'leveling') {
                const roleMap = {
                    level_1: interaction.options.getRole('level_1').id,
                    level_5: interaction.options.getRole('level_5').id,
                    level_10: interaction.options.getRole('level_10').id,
                    level_15: interaction.options.getRole('level_15').id,
                    level_20: interaction.options.getRole('level_20').id,
                    level_30: interaction.options.getRole('level_30').id,
                    level_40: interaction.options.getRole('level_40').id,
                    level_50: interaction.options.getRole('level_50').id,
                    level_75: interaction.options.getRole('level_75').id,
                    level_100: interaction.options.getRole('level_100').id
                };

                for (const [key, value] of Object.entries(roleMap)) {
                    if (value === guildId) {
                        return interaction.reply({
                            content: `❌ You cannot configure the \`@everyone\` role for milestone: **${key.replace('_', ' ')}**.`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                }

                try {
                    dbSetup.updateLevelRoles(guildId, roleMap);
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor(0x57F287) // Green
                        .setTitle('🏆 Leveling Milestone Roles Configured | Amo India')
                        .setDescription('The leveling milestone roles have been successfully updated and saved in the SQLite database.')
                        .addFields(
                            { name: 'Level 1 (Commoner)', value: `<@&${roleMap.level_1}>`, inline: true },
                            { name: 'Level 5 (Elite)', value: `<@&${roleMap.level_5}>`, inline: true },
                            { name: 'Level 10 (Professional)', value: `<@&${roleMap.level_10}>`, inline: true },
                            { name: 'Level 15 (Master)', value: `<@&${roleMap.level_15}>`, inline: true },
                            { name: 'Level 20 (Veteran)', value: `<@&${roleMap.level_20}>`, inline: true },
                            { name: 'Level 30 (Legend)', value: `<@&${roleMap.level_30}>`, inline: true },
                            { name: 'Level 40 (Mythic)', value: `<@&${roleMap.level_40}>`, inline: true },
                            { name: 'Level 50 (Zenith)', value: `<@&${roleMap.level_50}>`, inline: true },
                            { name: 'Level 75 (Ascendant)', value: `<@&${roleMap.level_75}>`, inline: true },
                            { name: 'Level 100 (Grandmaster)', value: `<@&${roleMap.level_100}>`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Amo India Leveling Setup', iconURL: interaction.guild.iconURL() });

                    return interaction.reply({
                        embeds: [successEmbed],
                        flags: [MessageFlags.Ephemeral]
                    });
                } catch (err) {
                    console.error('[Leveling Setup SQLite Error]:', err);
                    return interaction.reply({
                        content: '❌ Failed to save leveling roles to the database.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
            }
        }
    }
};
