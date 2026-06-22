const { Events, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const dbSetup = require('../database/dbSetup');
const { updateMemberCounter } = require('./ready');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        if (!interaction.isChatInputCommand()) return;

        // Verify user is an administrator
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You must have **Administrator** permissions to use settings/setup commands.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const { commandName, guildId } = interaction;

        if (commandName === 'settings') {
            const subcommand = interaction.options.getSubcommand();
            const currentSettings = dbSetup.getGuildSettings(guildId);

            let logChannelId = currentSettings.log_channel_id;
            let jailRoleId = currentSettings.jail_role_id;
            let authRoleId = currentSettings.auth_role_id;
            let memberCounterId = currentSettings.member_counter_channel_id;
            let prefix = currentSettings.prefix || '?';

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
            const logChannel = interaction.options.getChannel('log_channel');
            const jailRole = interaction.options.getRole('jail_role');
            const authRole = interaction.options.getRole('auth_role');
            const memberCounter = interaction.options.getChannel('member_counter');

            if (jailRole.id === interaction.guild.id || authRole.id === interaction.guild.id) {
                return interaction.reply({
                    content: '❌ You cannot set the `@everyone` role as the Jail or Permit role.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const prefix = dbSetup.getGuildSettings(guildId).prefix || '?';
            const memberCounterId = memberCounter ? memberCounter.id : null;

            // Save to database
            dbSetup.updateSetup(guildId, logChannel.id, jailRole.id, authRole.id, memberCounterId);

            // Dynamically auto-create/configure category, channels, and Jailed role overrides
            await dbSetup.ensureJailSystem(interaction.guild).catch(console.error);

            // Trigger immediate update of the counter channel if supplied
            if (interaction.guild) {
                await updateMemberCounter(interaction.guild);
            }

            // Construct capabilities setup embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('⚙️ Server Setup & Capabilities Overview')
                .setDescription('The bot configuration has been successfully updated. Below is the active configuration and capabilities summary.')
                .addFields(
                    {
                        name: '🛠️ CONFIGURATION PARAMETERS',
                        value: `• **Logging Channel**: <#${logChannel.id}>\n` +
                               `• **Jail Role**: <@&${jailRole.id}>\n` +
                               `• **Permit (Authorization) Role**: <@&${authRole.id}>\n` +
                               `• **Member Counter**: ${memberCounterId ? `<#${memberCounterId}>` : '*Not Configured*'}\n` +
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
                .setFooter({ text: 'Te-Amo Assistant Setup', iconURL: interaction.guild.iconURL() });

            return interaction.reply({
                embeds: [embed],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};
