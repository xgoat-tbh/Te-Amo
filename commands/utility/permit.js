const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'permit',
    description: 'Grant or revoke access for specific commands to roles or users.',
    usage: '?permit grant <@role/@user> <commandName>\n?permit revoke <@role/@user> <commandName>\n?permit list [commandName]',
    async execute(message, args, config, settings) {
        // Only Server Owner, Administrators, or Permit Role can configure permissions
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.author.id === message.guild.ownerId ||
                             message.member.permissions.has(PermissionFlagsBits.Administrator) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ Only server administrators or authorized roles can manage command permissions.').catch(() => {});
        }

        const subcommand = args[0]?.toLowerCase();
        if (!subcommand || !['grant', 'revoke', 'list'].includes(subcommand)) {
            return message.reply(`❌ Invalid format. Use:\n` +
                                 `• \`${settings.prefix || '?'}permit grant <@role/@user> <commandName>\`\n` +
                                 `• \`${settings.prefix || '?'}permit revoke <@role/@user> <commandName>\`\n` +
                                 `• \`${settings.prefix || '?'}permit list [commandName]\``).catch(() => {});
        }

        const guildId = message.guild.id;

        // CASE 1: LIST PERMISSIONS
        if (subcommand === 'list') {
            const filterCmd = args[1]?.toLowerCase();
            
            let query = '';
            let params = [];
            if (filterCmd) {
                query = 'SELECT * FROM command_permissions WHERE guild_id = ? AND command_name = ?';
                params = [guildId, filterCmd];
            } else {
                query = 'SELECT * FROM command_permissions WHERE guild_id = ?';
                params = [guildId];
            }

            const records = dbSetup.db.prepare(query).all(...params);
            if (records.length === 0) {
                return message.reply(filterCmd 
                    ? `ℹ️ There are no custom permissions configured for the command \`${filterCmd}\`.` 
                    : 'ℹ️ There are no custom command permissions configured in this server.'
                ).catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle(filterCmd ? `🛡️ Command Permissions: ${filterCmd}` : '🛡️ Custom Command Permissions')
                .setTimestamp()
                .setFooter({ text: 'Amo India Administration', iconURL: message.guild.iconURL() });

            let desc = '';
            records.forEach(rec => {
                const target = rec.target_type === 'role' ? `<@&${rec.target_id}>` : `<@${rec.target_id}>`;
                desc += `• Command **\`${rec.command_name}\`** permitted to ${target} (${rec.target_type})\n`;
            });

            embed.setDescription(desc);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // For grant and revoke, we need a target role/user and a command name
        const targetInput = args[1];
        const commandInput = args[2]?.toLowerCase();

        if (!targetInput || !commandInput) {
            return message.reply(`❌ Missing arguments. Usage:\n` +
                                 `• \`${settings.prefix || '?'}permit ${subcommand} <@role/@user> <commandName>\``).catch(() => {});
        }

        // Validate command exists in client.commands
        const targetCommand = message.client.commands.get(commandInput) || 
                              message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandInput));

        if (!targetCommand) {
            return message.reply(`❌ The command \`${commandInput}\` does not exist.`).catch(() => {});
        }

        // Prevent modifying permissions for the 'permit' command itself to avoid locking out admins
        if (targetCommand.name === 'permit' || targetCommand.name === 'setup' || targetCommand.name === 'settings') {
            return message.reply('❌ You cannot modify permissions for configuration or permission management commands.').catch(() => {});
        }

        // Resolve Target User or Role
        let targetId = '';
        let targetType = '';
        let displayName = '';

        // 1. Check if user mention
        const userMentionMatch = targetInput.match(/^<@!?(\d+)>$/);
        // 2. Check if role mention
        const roleMentionMatch = targetInput.match(/^<@&(\d+)>$/);

        if (userMentionMatch) {
            targetId = userMentionMatch[1];
            targetType = 'user';
            const member = await message.guild.members.fetch(targetId).catch(() => null);
            displayName = member ? member.user.tag : `<@${targetId}>`;
        } else if (roleMentionMatch) {
            targetId = roleMentionMatch[1];
            targetType = 'role';
            const role = message.guild.roles.cache.get(targetId);
            displayName = role ? role.name : `<@&${targetId}>`;
        } else {
            // Try raw ID lookup
            const cleanedId = targetInput.replace(/\D/g, '');
            if (cleanedId) {
                // Try role first
                const role = message.guild.roles.cache.get(cleanedId);
                if (role) {
                    targetId = cleanedId;
                    targetType = 'role';
                    displayName = role.name;
                } else {
                    // Try user
                    const member = await message.guild.members.fetch(cleanedId).catch(() => null);
                    if (member) {
                        targetId = cleanedId;
                        targetType = 'user';
                        displayName = member.user.tag;
                    }
                }
            }
        }

        if (!targetId) {
            return message.reply(`❌ Could not resolve \`${targetInput}\` to a valid user or role mention/ID.`).catch(() => {});
        }

        // CASE 2: GRANT PERMISSION
        if (subcommand === 'grant') {
            dbSetup.grantCommandPermission(guildId, targetCommand.name, targetId, targetType);
            
            const embed = new EmbedBuilder()
                .setColor(0x57F287) // Green for success
                .setTitle('✅ Permission Granted')
                .setDescription(`Successfully granted access to command **\`${targetCommand.name}\`** to ${targetType} **${displayName}** (<@${targetType === 'role' ? '&' : ''}${targetId}>).`)
                .setTimestamp()
                .setFooter({ text: 'Amo India Administration', iconURL: message.guild.iconURL() });

            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // CASE 3: REVOKE PERMISSION
        if (subcommand === 'revoke') {
            dbSetup.revokeCommandPermission(guildId, targetCommand.name, targetId);

            const embed = new EmbedBuilder()
                .setColor(0xED4245) // Red for revoke/error
                .setTitle('❌ Permission Revoked')
                .setDescription(`Successfully revoked access to command **\`${targetCommand.name}\`** from ${targetType} **${displayName}** (<@${targetType === 'role' ? '&' : ''}${targetId}>).`)
                .setTimestamp()
                .setFooter({ text: 'Amo India Administration', iconURL: message.guild.iconURL() });

            return message.reply({ embeds: [embed] }).catch(() => {});
        }
    }
};
