// Settings Command (Interactive Security Dashboard)
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

/**
 * Maps Anti-Nuke actions to human-readable strings.
 */
const actionMap = {
    'jail': '🏛️ Jail Rogue Admin',
    'strip_roles': '🛡️ Strip Roles (Lockdown)',
    'ban': '🚫 Ban Rogue Admin',
    'kick': '🚪 Kick Rogue Admin',
    'log': '📝 Log Only (Alert)'
};

/**
 * Generates the interactive security settings dashboard.
 * @param {import('discord.js').Guild} guild - The Discord guild object
 * @param {object} config - The bot's current configuration object
 * @returns {object} - The message payload containing embeds and components
 */
function getSettingsDashboard(guild, config) {
    const antiNukeActionStr = actionMap[config.ANTI_NUKE_ACTION] || actionMap['jail'];
    const antiPromoTimeout = config.ANTI_PROMO_TIMEOUT_DURATION_MINS || 10;
    const antiPromoStrikes = config.ANTI_PROMO_STRIKES_LIMIT || 2;
    const antiNukeThreshold = config.ANTI_NUKE_THRESHOLD || 3;
    const antiNukeTimeframe = (config.ANTI_NUKE_TIMEFRAME_MS || 60000) / 1000;

    const settingsEmbed = new EmbedBuilder()
        .setColor(0xED4245) // Danger red for security settings
        .setTitle('🛡️ Te-Amo Security & Settings Dashboard')
        .setDescription('Configure auto-moderation parameters and Anti-Nuke responses interactively:')
        .addFields(
            { name: '🔥 Anti-Nuke Action', value: `\`${antiNukeActionStr}\``, inline: true },
            { name: '🛑 Anti-Nuke Limit', value: `\`${antiNukeThreshold} actions / ${antiNukeTimeframe}s\``, inline: true },
            { name: '🛡️ Anti-Promo Strikes', value: `\`${antiPromoStrikes} strike(s)\``, inline: true },
            { name: '⏳ Anti-Promo Mute', value: `\`${antiPromoTimeout} minutes\``, inline: true }
        )
        .setFooter({ text: 'Te-Amo Security Dashboard', iconURL: guild.iconURL() })
        .setTimestamp();

    // Row 1: Anti-Nuke Action dropdown
    const actionSelect = new StringSelectMenuBuilder()
        .setCustomId('settings_antinuke_action')
        .setPlaceholder('🔥 Configure Anti-Nuke Punishment')
        .addOptions([
            { label: 'Jail rogue Admin (Recommended)', description: 'Strips roles, applies Jailed role, and DMs mods', value: 'jail', default: config.ANTI_NUKE_ACTION === 'jail' },
            { label: 'Strip Roles Only', description: 'Strips all roles from the admin in infraction', value: 'strip_roles', default: config.ANTI_NUKE_ACTION === 'strip_roles' },
            { label: 'Ban Rogue Admin', description: 'Immediately bans the admin account from the guild', value: 'ban', default: config.ANTI_NUKE_ACTION === 'ban' },
            { label: 'Kick Rogue Admin', description: 'Kicks the rogue administrator from the guild', value: 'kick', default: config.ANTI_NUKE_ACTION === 'kick' },
            { label: 'Log Only', description: 'Triggers alert message in logs but takes no action', value: 'log', default: config.ANTI_NUKE_ACTION === 'log' }
        ]);
    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    // Row 2: Anti-Nuke Threshold dropdown
    const thresholdSelect = new StringSelectMenuBuilder()
        .setCustomId('settings_antinuke_threshold')
        .setPlaceholder('🛑 Set Anti-Nuke Action Threshold')
        .addOptions([
            { label: '2 Actions limit', description: 'Extremely strict', value: '2', default: String(antiNukeThreshold) === '2' },
            { label: '3 Actions limit (Default)', description: 'Balanced protection', value: '3', default: String(antiNukeThreshold) === '3' },
            { label: '5 Actions limit', description: 'Moderate threshold', value: '5', default: String(antiNukeThreshold) === '5' },
            { label: '10 Actions limit', description: 'Permissive setting', value: '10', default: String(antiNukeThreshold) === '10' }
        ]);
    const thresholdRow = new ActionRowBuilder().addComponents(thresholdSelect);

    // Row 3: Anti-Promo Strikes dropdown
    const strikesSelect = new StringSelectMenuBuilder()
        .setCustomId('settings_antipromo_strikes')
        .setPlaceholder('🛡️ Set Anti-Promo Strikes Limit')
        .addOptions([
            { label: '1 Strike (Immediate mute)', description: 'No warnings allowed', value: '1', default: String(antiPromoStrikes) === '1' },
            { label: '2 Strikes (Default)', description: 'Warning then timeout', value: '2', default: String(antiPromoStrikes) === '2' },
            { label: '3 Strikes', description: 'Generous link limit', value: '3', default: String(antiPromoStrikes) === '3' }
        ]);
    const strikesRow = new ActionRowBuilder().addComponents(strikesSelect);

    // Row 4: Buttons (Custom timeframe, Custom mute duration, Done)
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('settings_antinuke_timeframe_btn')
            .setLabel('⏱️ Set Action Timeframe')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('settings_antipromo_timeout_btn')
            .setLabel('⏳ Set Mute Duration')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('settings_done_btn')
            .setLabel('🔒 Done')
            .setStyle(ButtonStyle.Success)
    );

    return { embeds: [settingsEmbed], components: [actionRow, thresholdRow, strikesRow, buttonRow] };
}

module.exports = {
    name: 'settings',
    description: 'Interactive dashboard for security actions and auto-moderation settings.',
    async execute(message, args, config) {
        // Enforce Admin permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Error: Only server administrators can use this command!').catch(console.error);
        }

        const dashboard = getSettingsDashboard(message.guild, config);
        return message.reply(dashboard).catch(console.error);
    },
    getSettingsDashboard
};
