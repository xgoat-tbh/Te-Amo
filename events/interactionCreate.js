// Interaction Create Event
const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const setupCommand = require('../commands/admin/setup');
const settingsCommand = require('../commands/admin/settings');
const { verifyPrison, createPrison, secureOtherChannels } = require('../utils/prisonHelper');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Helper to save configuration
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing config.json:', error);
        return false;
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        // Enforce Admin permission for all setup & settings dashboard components
        const isSetupComponent = interaction.customId && interaction.customId.startsWith('setup_');
        const isSettingsComponent = interaction.customId && interaction.customId.startsWith('settings_');

        if ((isSetupComponent || isSettingsComponent) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Error: Only server administrators can use these settings!', flags: MessageFlags.Ephemeral });
        }

        // Initialize active setup message map in client
        if (!client.setupMessages) {
            client.setupMessages = new Map();
        }

        // If this interaction is on the main setup dashboard, store the message reference
        const isMainSetupDashboard = interaction.message && 
            interaction.customId && 
            interaction.customId.startsWith('setup_') && 
            !['setup_prison_role_link', 'setup_prison_channel_link', 'setup_untrackvc_select', 'setup_editvc_select'].includes(interaction.customId);

        if (isMainSetupDashboard) {
            client.setupMessages.set(interaction.guild.id, interaction.message);
        }

        // 1. Dropdown Select Menu Handling
        if (interaction.isAnySelectMenu()) {
            const customId = interaction.customId;
            const value = interaction.values[0];

            let updatedSetup = false;
            let updatedSettings = false;

            // Setup Options
            if (customId === 'setup_bypassrole') {
                config.CAN_PROMOTE_ROLE_ID = value;
                updatedSetup = true;
            } else if (customId === 'setup_countervc') {
                config.MEMBER_COUNT_VC_ID = value;
                updatedSetup = true;
            } else if (customId === 'setup_pingschannel') {
                config.GAMING_PINGS_CHANNEL_ID = value;
                updatedSetup = true;
            } else if (customId === 'setup_logchannel') {
                config.SECURE_ADMIN_LOG_CHANNEL_ID = value;
                updatedSetup = true;
            } else if (customId === 'setup_prison_role_link') {
                config.JAILED_ROLE_ID = value;
                if (saveConfig(config)) {
                    await interaction.update({ content: `✅ Linked Jailed Role to <@&${value}>.`, components: [] }).catch(console.error);
                    
                    if (config.PRISON_CHANNEL_ID && !config.PRISON_CHANNEL_ID.includes('YOUR_')) {
                        await secureOtherChannels(interaction.guild, value, config.PRISON_CHANNEL_ID).catch(console.error);
                    }

                    const mainDashboardMsg = client.setupMessages?.get(interaction.guild.id);
                    if (mainDashboardMsg && mainDashboardMsg.editable) {
                        const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                        await mainDashboardMsg.edit(newDashboard).catch(console.error);
                    }
                }
                return;
            } else if (customId === 'setup_prison_channel_link') {
                config.PRISON_CHANNEL_ID = value;
                if (saveConfig(config)) {
                    await interaction.update({ content: `✅ Linked Prison Voice Channel to <#${value}>.`, components: [] }).catch(console.error);

                    if (config.JAILED_ROLE_ID && !config.JAILED_ROLE_ID.includes('YOUR_')) {
                        await secureOtherChannels(interaction.guild, config.JAILED_ROLE_ID, value).catch(console.error);
                    }

                    const mainDashboardMsg = client.setupMessages?.get(interaction.guild.id);
                    if (mainDashboardMsg && mainDashboardMsg.editable) {
                        const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                        await mainDashboardMsg.edit(newDashboard).catch(console.error);
                    }
                }
                return;
            } else if (customId === 'setup_untrackvc_select') {
                if (config.monitored_channels && config.monitored_channels[value]) {
                    delete config.monitored_channels[value];
                    if (saveConfig(config)) {
                        await interaction.update({ content: `✅ Voice Channel <#${value}> is no longer being monitored.`, components: [] }).catch(console.error);
                        const mainDashboardMsg = client.setupMessages?.get(interaction.guild.id);
                        if (mainDashboardMsg && mainDashboardMsg.editable) {
                            const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                            await mainDashboardMsg.edit(newDashboard).catch(console.error);
                        }
                        return;
                    }
                }
            } else if (customId === 'setup_editvc_select') {
                // Edit VC selected: Open Modal with current details pre-populated
                const currentData = config.monitored_channels[value];
                if (!currentData) {
                    return interaction.reply({ content: '❌ Selected voice channel data not found.', flags: MessageFlags.Ephemeral });
                }

                const modal = new ModalBuilder()
                    .setCustomId('setup_editvc_modal')
                    .setTitle('✏️ Edit Monitored VC');

                const vcIdInput = new TextInputBuilder()
                    .setCustomId('edit_vc_id')
                    .setLabel('Voice Channel ID (Read-only)')
                    .setValue(value)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const targetCountInput = new TextInputBuilder()
                    .setCustomId('edit_target_count')
                    .setLabel('Target Player Count')
                    .setValue(String(currentData.targetCount))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const roleIdInput = new TextInputBuilder()
                    .setCustomId('edit_role_id')
                    .setLabel('Role ID to Ping')
                    .setValue(currentData.roleId)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const gameNameInput = new TextInputBuilder()
                    .setCustomId('edit_game_name')
                    .setLabel('Game Name')
                    .setValue(currentData.gameName)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(vcIdInput),
                    new ActionRowBuilder().addComponents(targetCountInput),
                    new ActionRowBuilder().addComponents(roleIdInput),
                    new ActionRowBuilder().addComponents(gameNameInput)
                );

                await interaction.showModal(modal).catch(console.error);
                return;
            }

            // Settings Options
            if (customId === 'settings_antinuke_action') {
                config.ANTI_NUKE_ACTION = value;
                updatedSettings = true;
            } else if (customId === 'settings_antinuke_threshold') {
                config.ANTI_NUKE_THRESHOLD = parseInt(value);
                updatedSettings = true;
            } else if (customId === 'settings_antipromo_strikes') {
                config.ANTI_PROMO_STRIKES_LIMIT = parseInt(value);
                updatedSettings = true;
            }

            // Save and Refresh setup dashboard
            if (updatedSetup && saveConfig(config)) {
                const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                await interaction.update(newDashboard).catch(console.error);
            }

            // Save and Refresh settings dashboard
            if (updatedSettings && saveConfig(config)) {
                const newSettings = settingsCommand.getSettingsDashboard(interaction.guild, config);
                await interaction.update(newSettings).catch(console.error);
            }
        }

        // 2. Button Action Handling
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // --- Setup Buttons ---
            if (customId === 'setup_trackvc_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('setup_trackvc_modal')
                    .setTitle('➕ Track a Voice Channel');

                const vcIdInput = new TextInputBuilder()
                    .setCustomId('track_vc_id')
                    .setLabel('Voice Channel ID')
                    .setPlaceholder('Enter the 18-digit Voice Channel ID')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const targetCountInput = new TextInputBuilder()
                    .setCustomId('track_target_count')
                    .setLabel('Target Player Count')
                    .setPlaceholder('e.g., 2')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const roleIdInput = new TextInputBuilder()
                    .setCustomId('track_role_id')
                    .setLabel('Role ID to Ping')
                    .setPlaceholder('Enter the 18-digit Role ID to ping')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const gameNameInput = new TextInputBuilder()
                    .setCustomId('track_game_name')
                    .setLabel('Game Name')
                    .setPlaceholder('e.g., Among Us')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(vcIdInput),
                    new ActionRowBuilder().addComponents(targetCountInput),
                    new ActionRowBuilder().addComponents(roleIdInput),
                    new ActionRowBuilder().addComponents(gameNameInput)
                );

                await interaction.showModal(modal).catch(console.error);
            }

            if (customId === 'setup_editvc_btn') {
                const channels = Object.keys(config.monitored_channels || {});
                if (channels.length === 0) {
                    return interaction.reply({ content: '❌ No voice channels are currently being tracked to edit.', flags: MessageFlags.Ephemeral });
                }

                const options = await Promise.all(channels.map(async (vcId) => {
                    const ch = await interaction.guild.channels.fetch(vcId).catch(() => null);
                    const name = ch ? ch.name : 'Unknown Channel';
                    const game = config.monitored_channels[vcId].gameName || 'Game';
                    return {
                        label: `${name.substring(0, 20)} (${game.substring(0, 20)})`,
                        description: `ID: ${vcId}`,
                        value: vcId
                    };
                }));

                const editSelect = new StringSelectMenuBuilder()
                    .setCustomId('setup_editvc_select')
                    .setPlaceholder('Select a Voice Channel to edit details')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(editSelect);
                await interaction.reply({ content: '✏️ Choose a Voice Channel to edit:', components: [row], flags: MessageFlags.Ephemeral }).catch(console.error);
            }

            if (customId === 'setup_untrackvc_btn') {
                const channels = Object.keys(config.monitored_channels || {});
                if (channels.length === 0) {
                    return interaction.reply({ content: '❌ No voice channels are currently being tracked.', flags: MessageFlags.Ephemeral });
                }

                const options = await Promise.all(channels.map(async (vcId) => {
                    const ch = await interaction.guild.channels.fetch(vcId).catch(() => null);
                    const name = ch ? ch.name : 'Unknown Channel';
                    const game = config.monitored_channels[vcId].gameName || 'Game';
                    return {
                        label: `${name.substring(0, 20)} (${game.substring(0, 20)})`,
                        description: `ID: ${vcId}`,
                        value: vcId
                    };
                }));

                const untrackSelect = new StringSelectMenuBuilder()
                    .setCustomId('setup_untrackvc_select')
                    .setPlaceholder('Select a Voice Channel to untrack')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(untrackSelect);
                await interaction.reply({ content: '🗑️ Choose a tracked Voice Channel to remove from monitoring:', components: [row], flags: MessageFlags.Ephemeral }).catch(console.error);
            }

            if (customId === 'setup_prison_btn') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                
                // Verify if prison role and channel exist
                const { role, channel } = await verifyPrison(interaction.guild, config);

                if (role && channel) {
                    // Already exist: Prompt links (Filtered to Voice Channels for jail VC)
                    const roleSelect = new RoleSelectMenuBuilder()
                        .setCustomId('setup_prison_role_link')
                        .setPlaceholder('🏛️ Select Existing Jailed Role');
                    
                    const channelSelect = new ChannelSelectMenuBuilder()
                        .setCustomId('setup_prison_channel_link')
                        .setPlaceholder('🏛️ Select Existing Prison Voice Channel')
                        .setChannelTypes([ChannelType.GuildVoice]); // Filtered to Voice!

                    const row1 = new ActionRowBuilder().addComponents(roleSelect);
                    const row2 = new ActionRowBuilder().addComponents(channelSelect);

                    // Auto-link them in configuration if they are found but not configured
                    let autoLinked = false;
                    if (!config.JAILED_ROLE_ID || config.JAILED_ROLE_ID !== role.id) {
                        config.JAILED_ROLE_ID = role.id;
                        autoLinked = true;
                    }
                    if (!config.PRISON_CHANNEL_ID || config.PRISON_CHANNEL_ID !== channel.id) {
                        config.PRISON_CHANNEL_ID = channel.id;
                        autoLinked = true;
                    }

                    if (autoLinked) {
                        saveConfig(config);
                        if (interaction.message && interaction.message.editable) {
                            const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                            await interaction.message.edit(newDashboard).catch(console.error);
                        }
                    }

                    // Secure all other channels immediately
                    await secureOtherChannels(interaction.guild, role.id, channel.id).catch(console.error);

                    await interaction.editReply({
                        content: '🏛️ **Jail role/channel already exists in the server!**\nThey have been auto-configured in the setup. If you want to link different ones, choose below:',
                        components: [row1, row2]
                    }).catch(console.error);

                } else {
                    // Do not exist: Create them dynamically
                    try {
                        const newPrison = await createPrison(interaction.guild);
                        config.JAILED_ROLE_ID = newPrison.roleId;
                        config.PRISON_CHANNEL_ID = newPrison.channelId;

                        if (saveConfig(config)) {
                            // Update dashboard
                            if (interaction.message && interaction.message.editable) {
                                const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                                await interaction.message.edit(newDashboard).catch(console.error);
                            }
                            await interaction.editReply({ content: '🏛️ **Jail Category, prison Voice Channel, and Jailed role have been created and linked successfully!**' }).catch(console.error);
                        }
                    } catch (err) {
                        console.error('Failed to create prison elements:', err);
                        await interaction.editReply({ content: '❌ Failed to create prison channel or role. Check permissions.' }).catch(console.error);
                    }
                }
            }

            if (customId === 'setup_done_btn') {
                const finishedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0x2F3136)
                    .setDescription('🔒 **Setup Complete. Components Locked.**');
                
                await interaction.update({ embeds: [finishedEmbed], components: [] }).catch(console.error);
            }

            // --- Settings Buttons ---
            if (customId === 'settings_done_btn') {
                const finishedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0x2F3136)
                    .setDescription('🔒 **Security Config Locked. Changes Saved.**');

                await interaction.update({ embeds: [finishedEmbed], components: [] }).catch(console.error);
            }

            if (customId === 'settings_antinuke_timeframe_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('settings_antinuke_timeframe_modal')
                    .setTitle('⏱️ Set Actions Timeframe Window');

                const timeframeInput = new TextInputBuilder()
                    .setCustomId('timeframe_sec')
                    .setLabel('Timeframe Window (in seconds)')
                    .setPlaceholder('e.g., 60')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(timeframeInput));
                await interaction.showModal(modal).catch(console.error);
            }

            if (customId === 'settings_antipromo_timeout_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('settings_antipromo_timeout_modal')
                    .setTitle('⏳ Set Anti-Promo Timeout Duration');

                const timeoutInput = new TextInputBuilder()
                    .setCustomId('timeout_mins')
                    .setLabel('Mute/Timeout Duration (in minutes)')
                    .setPlaceholder('e.g., 10')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(timeoutInput));
                await interaction.showModal(modal).catch(console.error);
            }


        }

        // 3. Modal Form Submission Handling
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            // Handle: Track Voice Channel Modal submission
            if (customId === 'setup_trackvc_modal') {
                const rawVcId = interaction.fields.getTextInputValue('track_vc_id');
                const rawTargetCount = interaction.fields.getTextInputValue('track_target_count');
                const rawRoleId = interaction.fields.getTextInputValue('track_role_id');
                const gameName = interaction.fields.getTextInputValue('track_game_name').trim();

                const vcId = rawVcId.replace(/\D/g, '');
                const roleId = rawRoleId.replace(/\D/g, '');
                const targetCount = parseInt(rawTargetCount);

                if (!vcId || isNaN(targetCount) || !roleId || !gameName) {
                    return interaction.reply({ content: '❌ Invalid form submission. Check input values.', flags: MessageFlags.Ephemeral });
                }

                if (!config.monitored_channels) {
                    config.monitored_channels = {};
                }

                config.monitored_channels[vcId] = { gameName, roleId, targetCount };

                await interaction.deferUpdate().catch(console.error);
                if (saveConfig(config)) {
                    const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                    await interaction.editReply(newDashboard).catch(console.error);
                    await interaction.followUp({ content: `✅ Monitored Channel added: <#${vcId}> for **${gameName}**!`, flags: MessageFlags.Ephemeral }).catch(console.error);
                }
            }

            // Handle: Edit Voice Channel Modal submission
            if (customId === 'setup_editvc_modal') {
                const rawVcId = interaction.fields.getTextInputValue('edit_vc_id');
                const rawTargetCount = interaction.fields.getTextInputValue('edit_target_count');
                const rawRoleId = interaction.fields.getTextInputValue('edit_role_id');
                const gameName = interaction.fields.getTextInputValue('edit_game_name').trim();

                const vcId = rawVcId.replace(/\D/g, '');
                const roleId = rawRoleId.replace(/\D/g, '');
                const targetCount = parseInt(rawTargetCount);

                if (!vcId || isNaN(targetCount) || !roleId || !gameName) {
                    return interaction.reply({ content: '❌ Invalid form submission. Check input values.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferUpdate().catch(console.error);
                if (config.monitored_channels && config.monitored_channels[vcId]) {
                    config.monitored_channels[vcId] = { gameName, roleId, targetCount };
                    if (saveConfig(config)) {
                        await interaction.editReply({ content: `✅ Voice Channel <#${vcId}> details updated successfully!`, components: [] }).catch(console.error);
                        
                        const mainDashboardMsg = client.setupMessages?.get(interaction.guild.id);
                        if (mainDashboardMsg && mainDashboardMsg.editable) {
                            const newDashboard = setupCommand.getSetupDashboard(interaction.guild, config);
                            await mainDashboardMsg.edit(newDashboard).catch(console.error);
                        }
                    }
                }
            }

            // Handle: Anti-Nuke Timeframe Modal submission
            if (customId === 'settings_antinuke_timeframe_modal') {
                const rawTime = interaction.fields.getTextInputValue('timeframe_sec');
                const seconds = parseInt(rawTime);

                if (isNaN(seconds) || seconds <= 0) {
                    return interaction.reply({ content: '❌ Error: Timeframe must be a positive number of seconds.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferUpdate().catch(console.error);
                config.ANTI_NUKE_TIMEFRAME_MS = seconds * 1000;
                if (saveConfig(config)) {
                    const newSettings = settingsCommand.getSettingsDashboard(interaction.guild, config);
                    await interaction.editReply(newSettings).catch(console.error);
                }
            }

            // Handle: Anti-Promo Timeout Duration Modal submission
            if (customId === 'settings_antipromo_timeout_modal') {
                const rawMins = interaction.fields.getTextInputValue('timeout_mins');
                const minutes = parseInt(rawMins);

                if (isNaN(minutes) || minutes <= 0) {
                    return interaction.reply({ content: '❌ Error: Timeout duration must be a positive number of minutes.', flags: MessageFlags.Ephemeral });
                }

                await interaction.deferUpdate().catch(console.error);
                config.ANTI_PROMO_TIMEOUT_DURATION_MINS = minutes;
                if (saveConfig(config)) {
                    const newSettings = settingsCommand.getSettingsDashboard(interaction.guild, config);
                    await interaction.editReply(newSettings).catch(console.error);
                }
            }
        }
    }
};
