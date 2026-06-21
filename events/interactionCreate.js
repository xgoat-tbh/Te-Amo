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
    MessageFlags,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const setupCommand = require('../commands/admin/setup');
const settingsCommand = require('../commands/admin/settings');
const { verifyPrison, createPrison, secureOtherChannels } = require('../utils/prisonHelper');
const db = require('../utils/db');

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

            // --- Ticket System Buttons ---
            if (customId === 'ticket_open_btn') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                // Check if user already has an active ticket channel
                const activeTicket = interaction.guild.channels.cache.find(c => 
                    c.name.startsWith('ticket-') && 
                    c.permissionOverwrites.cache.has(interaction.user.id)
                );

                if (activeTicket) {
                    return interaction.editReply({ content: `❌ You already have an active ticket open: <#${activeTicket.id}>.` }).catch(console.error);
                }

                // Get or create category
                let category = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets');
                if (!category) {
                    category = await interaction.guild.channels.create({
                        name: 'TICKETS',
                        type: ChannelType.GuildCategory,
                        reason: 'Te-Amo Support Ticket System'
                    }).catch(() => null);
                }

                const counter = db.incrementTicketCounter();
                const ticketNumber = String(counter).padStart(4, '0');

                // Determine staff roles to grant access (bypass role / admins)
                const overwrites = [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ];

                const bypassRoleId = config.CAN_PROMOTE_ROLE_ID;
                if (bypassRoleId && !bypassRoleId.includes('YOUR_')) {
                    overwrites.push({
                        id: bypassRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    });
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${ticketNumber}`,
                    type: ChannelType.GuildText,
                    parent: category ? category.id : null,
                    permissionOverwrites: overwrites,
                    reason: `Support Ticket created by ${interaction.user.tag}`
                }).catch(console.error);

                if (!ticketChannel) {
                    return interaction.editReply({ content: '❌ Failed to create support ticket channel. Check bot permissions.' }).catch(console.error);
                }

                // Send greeting in ticket channel
                const greeting = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`🎫 Ticket #${ticketNumber}`)
                    .setDescription(
                        `Welcome <@${interaction.user.id}>!\n` +
                        `Our staff team will assist you shortly. Please describe your inquiry in detail.\n\n` +
                        `Use the button below to **Close** this ticket when resolved.`
                    )
                    .setFooter({ text: 'Te-Amo Helpdesk', iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                const closeBtn = new ButtonBuilder()
                    .setCustomId('ticket_close_btn')
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(closeBtn);

                await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [greeting], components: [row] }).catch(console.error);

                await interaction.editReply({ content: `✅ Support ticket created successfully: <#${ticketChannel.id}>.` }).catch(console.error);
            }

            if (customId === 'ticket_close_btn') {
                await interaction.deferReply();

                // Find the user who opened the ticket
                const creatorOverwrite = interaction.channel.permissionOverwrites.cache.find(o => 
                    o.type === 1 && 
                    o.id !== interaction.client.user.id
                );

                if (creatorOverwrite) {
                    await interaction.channel.permissionOverwrites.edit(creatorOverwrite.id, {
                        SendMessages: false
                    }).catch(console.error);
                }

                const closedEmbed = new EmbedBuilder()
                    .setColor(0xFF9900)
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(
                        `This ticket has been **closed** by <@${interaction.user.id}>.\n` +
                        `Communication is now locked. Admin controls are available below:`
                    )
                    .setTimestamp();

                const reopenBtn = new ButtonBuilder()
                    .setCustomId('ticket_reopen_btn')
                    .setLabel('Reopen')
                    .setEmoji('🔓')
                    .setStyle(ButtonStyle.Primary);

                const transcriptBtn = new ButtonBuilder()
                    .setCustomId('ticket_transcript_btn')
                    .setLabel('Transcript')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Success);

                const deleteBtn = new ButtonBuilder()
                    .setCustomId('ticket_delete_btn')
                    .setLabel('Delete')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(reopenBtn, transcriptBtn, deleteBtn);

                await interaction.editReply({ embeds: [closedEmbed], components: [row] }).catch(console.error);
            }

            if (customId === 'ticket_reopen_btn') {
                await interaction.deferReply();

                const creatorOverwrite = interaction.channel.permissionOverwrites.cache.find(o => 
                    o.type === 1 && 
                    o.id !== interaction.client.user.id
                );

                if (creatorOverwrite) {
                    await interaction.channel.permissionOverwrites.edit(creatorOverwrite.id, {
                        SendMessages: true
                    }).catch(console.error);
                }

                // Delete close notification message
                await interaction.message.delete().catch(() => {});

                await interaction.editReply({ content: `🔓 Ticket reopened by <@${interaction.user.id}>.` }).catch(console.error);
            }

            if (customId === 'ticket_delete_btn') {
                await interaction.reply({ content: '🗑️ **This ticket channel will be deleted in 5 seconds...**' }).catch(console.error);
                setTimeout(async () => {
                    await interaction.channel.delete('Ticket deleted by staff.').catch(console.error);
                }, 5000);
            }

            if (customId === 'ticket_transcript_btn') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const channel = interaction.channel;
                const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
                if (!messages) {
                    return interaction.editReply({ content: '❌ Failed to fetch messages.' }).catch(console.error);
                }

                // Generate HTML content
                const msgsArray = Array.from(messages.values()).reverse();
                let html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Transcript - ${channel.name}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #36393f; color: #dcddde; margin: 0; padding: 20px; }
                        .ticket-header { border-bottom: 1px solid #4f545c; padding-bottom: 15px; margin-bottom: 20px; }
                        .ticket-title { font-size: 24px; color: #ffffff; font-weight: bold; }
                        .message-container { display: flex; margin-bottom: 16px; }
                        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; }
                        .message-content { display: flex; flex-direction: column; }
                        .user-header { display: flex; align-items: baseline; margin-bottom: 4px; }
                        .username { font-weight: 600; color: #ffffff; margin-right: 8px; font-size: 15px; }
                        .timestamp { font-size: 12px; color: #72767d; }
                        .text { font-size: 15px; line-height: 1.4; color: #dcddde; }
                    </style>
                </head>
                <body>
                    <div class="ticket-header">
                        <div class="ticket-title">Transcript for Support Channel #${channel.name}</div>
                        <div>Generated on: ${new Date().toUTCString()}</div>
                    </div>
                `;

                for (const msg of msgsArray) {
                    const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
                    html += `
                    <div class="message-container">
                        <img class="avatar" src="${avatarUrl}" alt="avatar">
                        <div class="message-content">
                            <div class="user-header">
                                <span class="username">${msg.author.username}</span>
                                <span class="timestamp">${msg.createdAt.toLocaleString()}</span>
                            </div>
                            <div class="text">${msg.content.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '(Attachment or Embed)'}</div>
                        </div>
                    </div>
                    `;
                }

                html += `</body></html>`;

                const transcriptsDir = path.join(__dirname, '..', 'transcripts');
                if (!fs.existsSync(transcriptsDir)) {
                    fs.mkdirSync(transcriptsDir, { recursive: true });
                }

                const filePath = path.join(transcriptsDir, `transcript-${channel.name}.html`);
                fs.writeFileSync(filePath, html, 'utf8');

                // Send transcript file to the ticket channel
                await channel.send({
                    content: '📝 **Ticket Transcript:**',
                    files: [filePath]
                }).catch(console.error);

                // Log the transcript to security logs channel
                const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
                if (logChannelId) {
                    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle('📝 SUPPORT TICKET CLOSED & ARCHIVED')
                            .addFields(
                                { name: 'Channel', value: `#${channel.name}` },
                                { name: 'Closed By', value: `<@${interaction.user.id}>` }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed], files: [filePath] }).catch(console.error);
                    }
                }

                await interaction.editReply({ content: '✅ Transcript generated and logged successfully.' }).catch(console.error);
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
