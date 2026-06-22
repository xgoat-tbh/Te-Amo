const { Events, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../database/dbSetup');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        if (!interaction.isChatInputCommand()) return;

        // Verify user is an administrator
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You must have **Administrator** permissions to use administrative settings commands.',
                ephemeral: true
            });
        }

        const { commandName, guildId } = interaction;

        if (commandName === 'settings') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'prefix') {
                const newPrefix = interaction.options.getString('new_prefix');
                dbSetup.updatePrefix(guildId, newPrefix);
                return interaction.reply({
                    content: `✅ The command prefix has been successfully updated to: \`${newPrefix}\``,
                    ephemeral: true
                });
            }
        }

        if (commandName === 'setup') {
            const logChannel = interaction.options.getChannel('log_channel');
            const jailRole = interaction.options.getRole('jail_role');
            const authRole = interaction.options.getRole('auth_role');

            dbSetup.updateSetup(guildId, logChannel.id, jailRole.id, authRole.id);

            return interaction.reply({
                content: `⚙️ **Guild Configuration Setup Completed**:\n` +
                         `• **Logging Room**: <#${logChannel.id}>\n` +
                         `• **Jail Role**: <@&${jailRole.id}>\n` +
                         `• **Command Authorization (Permit) Role**: <@&${authRole.id}>`,
                ephemeral: true
            });
        }
    }
};
