const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Display all available commands or detailed information about a specific command.',
    usage: '?help [command_name]',
    async execute(message, args, config, settings) {
        const prefix = settings.prefix || '?';
        const commands = message.client.commands;

        // CASE 1: Detailed help lookup
        if (args.length > 0) {
            const searchName = args[0].toLowerCase();
            const command = commands.get(searchName) || 
                            commands.find(cmd => cmd.aliases && cmd.aliases.includes(searchName));

            if (!command) {
                return message.reply(`❌ Command \`${searchName}\` was not found.`).catch(() => {});
            }

            const cleanUsage = command.usage ? command.usage.replace(/^\?/, prefix) : `${prefix}${command.name}`;

            const embed = new EmbedBuilder()
                .setColor(0x00AEFF)
                .setTitle(`ℹ️ Command Info: \`${prefix}${command.name}\``)
                .addFields(
                    { name: '📋 Description', value: command.description || '*No description provided.*' },
                    { name: '📁 Category', value: command.category ? command.category.toUpperCase() : 'GENERAL', inline: true },
                    { name: '⚙️ Usage', value: `\`${cleanUsage}\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Te-Amo Assistant', iconURL: message.guild.iconURL() });

            if (command.aliases && command.aliases.length > 0) {
                embed.addFields({
                    name: '🔗 Aliases',
                    value: command.aliases.map(alias => `\`${prefix}${alias}\``).join(', '),
                    inline: true
                });
            }

            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // CASE 2: General help command list
        const categories = {};

        // Group commands by their category subfolder
        commands.forEach(command => {
            const cat = command.category || 'other';
            if (!categories[cat]) {
                categories[cat] = [];
            }
            categories[cat].push(command);
        });

        const embed = new EmbedBuilder()
            .setColor(0x00AEFF)
            .setTitle('📖 Te-Amo Command Guide')
            .setDescription(`Dynamic system commands guide. Use \`${prefix}help <command>\` for detailed usage.\nActive command prefix is: \`${prefix}\``)
            .setTimestamp()
            .setFooter({ text: 'Te-Amo Assistant', iconURL: message.guild.iconURL() });

        // Add fields for each category
        for (const [category, cmdList] of Object.entries(categories)) {
            const categoryTitle = category.toUpperCase();
            const listString = cmdList
                .map(cmd => `• **\`${prefix}${cmd.name}\`** - *${cmd.description || 'No description available'}*`)
                .join('\n');

            embed.addFields({
                name: `📁 ${categoryTitle} COMMANDS`,
                value: listString || '*No commands in this category*',
                inline: false
            });
        }

        embed.addFields({
            name: '⚙️ SLASH CONFIGURATION COMMANDS',
            value: '• `/settings` - Edit dynamic configurations (prefix, log channel, jail role, permit role, member counter)\n' +
                   '• `/setup system` - Interactive setup panel utilizing dropdown select menus and buttons to configure server systems\n' +
                   '• `/setup leveling` - Map Discord roles to the 10 leveling milestones dynamically stored in SQLite',
            inline: false
        });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
