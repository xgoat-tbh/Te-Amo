const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'help',
    description: 'Display all available commands or detailed information about a specific command.',
    usage: '?help [command_name]',
    async execute(message, args, config, settings) {
        const prefix = settings.prefix || '?';
        const commands = message.client.commands;

        // Check if user has moderation/permit authorization
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isMod = message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                      message.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                      message.member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                      message.member.permissions.has(PermissionFlagsBits.Administrator) ||
                      (permitRoleId && message.member.roles.cache.has(permitRoleId));

        // CASE 1: Detailed help lookup
        if (args.length > 0) {
            const searchName = args[0].toLowerCase();
            const command = commands.get(searchName) || 
                            commands.find(cmd => cmd.aliases && cmd.aliases.includes(searchName));

            if (!command) {
                return message.reply(`❌ Command \`${searchName}\` was not found.`).catch(() => {});
            }

            // Hide commands from unauthorized users based on default/custom permissions
            const hasAccess = dbSetup.isAuthorizedForCommand(
                message.guild.id, 
                command.name, 
                message.member, 
                (m) => {
                    const isRestricted = ['admin', 'moderation'].includes(command.category?.toLowerCase());
                    return isRestricted ? isMod : true;
                }
            );

            if (!hasAccess) {
                return message.reply(`❌ Command \`${searchName}\` was not found.`).catch(() => {});
            }

            const cleanUsage = command.usage ? command.usage.replace(/^\?/, prefix) : `${prefix}${command.name}`;

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Vibrant yellow
                .setTitle(`ℹ️ Command Info: \`${prefix}${command.name}\``)
                .addFields(
                    { name: '📋 Description', value: command.description || '*No description provided.*' },
                    { name: '📁 Category', value: command.category ? command.category.toUpperCase() : 'GENERAL', inline: true },
                    { name: '⚙️ Usage', value: `\`${cleanUsage}\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Amo India Assistant', iconURL: message.guild.iconURL() });

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

        // Group commands by their category subfolder, respecting permissions
        commands.forEach(command => {
            const cat = command.category || 'other';
            
            // Check permissions dynamically
            const hasAccess = dbSetup.isAuthorizedForCommand(
                message.guild.id, 
                command.name, 
                message.member, 
                (m) => {
                    const isRestricted = ['admin', 'moderation'].includes(cat.toLowerCase());
                    return isRestricted ? isMod : true;
                }
            );

            if (!hasAccess) {
                return;
            }

            if (!categories[cat]) {
                categories[cat] = [];
            }
            categories[cat].push(command);
        });

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C) // Vibrant yellow
            .setTitle('📖 Amo India Command Guide')
            .setDescription(`Dynamic system commands guide. Use \`${prefix}help <command>\` for detailed usage.\nActive command prefix is: \`${prefix}\``)
            .setTimestamp()
            .setFooter({ text: 'Amo India Assistant', iconURL: message.guild.iconURL() });

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

        // Add slash commands summary to help ONLY if they are a mod
        if (isMod) {
            embed.addFields({
                name: '⚙️ SLASH CONFIGURATION COMMANDS',
                value: '• `/settings` - Edit dynamic configurations (prefix, log channel, jail role, permit role, member counter)\n' +
                       '• `/setup core` - Interactive dashboard utilizing select menus and buttons to configure log channel, jail role, and permit role\n' +
                       '• `/setup channels` - Interactive dashboard utilizing select menus and buttons to configure counter, confession, and suggestion channels\n' +
                       '• `/setup leveling` - Map Discord roles to the 10 leveling milestones dynamically stored in SQLite',
                inline: false
            });
        }

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
