const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Display all available commands categorized by subfolder.',
    async execute(message, args, config, settings) {
        const prefix = settings.prefix || '?';
        const commands = message.client.commands;
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
            .setDescription(`Dynamic system commands guide. The active command prefix is: \`${prefix}\``)
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

        // Add slash commands summary to help
        embed.addFields({
            name: '⚙️ SLASH CONFIGURATION COMMANDS',
            value: '• `/settings prefix [new_prefix]` - Update server command prefix\n' +
                   '• `/setup` - Configure logging room, jail role, and authorization roles',
            inline: false
        });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
