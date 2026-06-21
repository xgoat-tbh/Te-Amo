// Setup Command (Interactive Dashboard)
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

/**
 * Generates the interactive setup dashboard components and embeds.
 * @param {import('discord.js').Guild} guild - The Discord guild object
 * @param {object} config - The bot's current configuration object
 * @returns {object} - The message payload containing embeds and components
 */
function getSetupDashboard(guild, config) {
    const monitoredCount = Object.keys(config.monitored_channels || {}).length;

    // Determine completion status of each configuration option
    const hasBypassRole = config.CAN_PROMOTE_ROLE_ID && !config.CAN_PROMOTE_ROLE_ID.includes('YOUR_');
    const hasCounterVc = config.MEMBER_COUNT_VC_ID && !config.MEMBER_COUNT_VC_ID.includes('YOUR_');
    const hasPingsChannel = config.GAMING_PINGS_CHANNEL_ID && !config.GAMING_PINGS_CHANNEL_ID.includes('YOUR_');
    const hasLogChannel = config.SECURE_ADMIN_LOG_CHANNEL_ID && !config.SECURE_ADMIN_LOG_CHANNEL_ID.includes('YOUR_');
    const hasPrison = config.JAILED_ROLE_ID && config.PRISON_CHANNEL_ID &&
                      !config.JAILED_ROLE_ID.includes('YOUR_') && !config.PRISON_CHANNEL_ID.includes('YOUR_');

    // Build the status embed with indicators
    const statusEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Te-Amo Setup Dashboard')
        .setDescription('Configure bot settings interactively using the dropdowns and buttons below. Completion statuses are logged in real-time:')
        .addFields(
            { 
                name: `${hasBypassRole ? '✅' : '❌'} Anti-Promo Bypass Role`, 
                value: hasBypassRole ? `<@&${config.CAN_PROMOTE_ROLE_ID}>` : '*Not configured*', 
                inline: true 
            },
            { 
                name: `${hasCounterVc ? '✅' : '❌'} Member Counter VC`, 
                value: hasCounterVc ? `<#${config.MEMBER_COUNT_VC_ID}>` : '*Not configured*', 
                inline: true 
            },
            { 
                name: `${hasPingsChannel ? '✅' : '❌'} Global Gaming Pings`, 
                value: hasPingsChannel ? `<#${config.GAMING_PINGS_CHANNEL_ID}>` : '*Not configured*', 
                inline: true 
            },
            { 
                name: `${hasLogChannel ? '✅' : '❌'} Security Logs Channel`, 
                value: hasLogChannel ? `<#${config.SECURE_ADMIN_LOG_CHANNEL_ID}>` : '*Not configured*', 
                inline: true 
            },
            { 
                name: `${hasPrison ? '✅' : '❌'} Prison / Jail System`, 
                value: hasPrison ? `Role: <@&${config.JAILED_ROLE_ID}>\nChannel: <#${config.PRISON_CHANNEL_ID}>` : '*Not configured*', 
                inline: true 
            },
            { 
                name: '🔊 Monitored Voice VCs', 
                value: `\`${monitoredCount} channel(s) active\``, 
                inline: true 
            }
        )
        .setFooter({ text: 'Te-Amo Setup Tracker', iconURL: guild.iconURL() })
        .setTimestamp();

    // Row 1: Bypass Role dropdown
    const roleRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('setup_bypassrole')
            .setPlaceholder('🛡️ Select Anti-Promo Bypass Role')
            .setMinValues(1)
            .setMaxValues(1)
    );

    // Row 2: Counter VC dropdown (Filtered to Voice)
    const counterRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_countervc')
            .setPlaceholder('📊 Select Member Counter Voice VC')
            .setChannelTypes([ChannelType.GuildVoice])
            .setMinValues(1)
            .setMaxValues(1)
    );

    // Row 3: Global Gaming Pings text channel (Filtered to Text)
    const pingsRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_pingschannel')
            .setPlaceholder('💬 Select Global Gaming Pings Text Channel')
            .setChannelTypes([ChannelType.GuildText])
            .setMinValues(1)
            .setMaxValues(1)
    );

    // Row 4: Security Log text channel (Filtered to Text)
    const logsRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_logchannel')
            .setPlaceholder('📝 Select Security Logs Text Channel')
            .setChannelTypes([ChannelType.GuildText])
            .setMinValues(1)
            .setMaxValues(1)
    );

    // Row 5: Action Buttons (Track VC, Edit VC, Untrack VC, Setup Prison, Done)
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup_trackvc_btn')
            .setLabel('➕ Track')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('setup_editvc_btn')
            .setLabel('✏️ Edit')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(monitoredCount === 0),
        new ButtonBuilder()
            .setCustomId('setup_untrackvc_btn')
            .setLabel('➖ Untrack')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(monitoredCount === 0),
        new ButtonBuilder()
            .setCustomId('setup_prison_btn')
            .setLabel('🏛️ Setup Prison')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('setup_done_btn')
            .setLabel('🔒 Done')
            .setStyle(ButtonStyle.Success)
    );

    return { embeds: [statusEmbed], components: [roleRow, counterRow, pingsRow, logsRow, buttonRow] };
}

module.exports = {
    name: 'setup',
    description: 'Dynamic visual configuration dashboard for server administrators.',
    async execute(message, args, config) {
        // Enforce Admin permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Error: Only server administrators can use this command!').catch(console.error);
        }

        const dashboard = getSetupDashboard(message.guild, config);
        const setupMsg = await message.reply(dashboard).catch(console.error);
        if (setupMsg) {
            if (!message.client.setupMessages) {
                message.client.setupMessages = new Map();
            }
            message.client.setupMessages.set(message.guild.id, setupMsg);
        }
        return setupMsg;
    },
    getSetupDashboard
};
