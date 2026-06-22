const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'alias',
    description: 'Manage role aliases (create, edit, list, and delete).',
    usage: '?alias create <name> <@role> [description] OR ?alias edit <name> <@role> [description] OR ?alias list',
    async execute(message, args, config, settings) {
        // Check authorization (ManageRoles or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const subcommand = args[0]?.toLowerCase();

        // 1. CREATE ALIAS
        if (subcommand === 'create') {
            const aliasName = args[1]?.toLowerCase();
            const roleInput = args[2];
            const description = args.slice(3).join(' ') || 'No description provided';

            if (!aliasName || !roleInput) {
                return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}alias create <name> <@role> [description]\``).catch(() => {});
            }

            // Word 'alias' itself is forbidden
            if (aliasName === 'alias') {
                return message.reply('❌ You cannot name a role alias "alias" itself.').catch(() => {});
            }

            // Extract role ID
            const roleId = roleInput.replace(/\D/g, '');
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                return message.reply('❌ The specified role was not found in the server.').catch(() => {});
            }

            // Check duplicate alias name
            const existingName = dbSetup.getAlias(aliasName);
            if (existingName) {
                return message.reply(`❌ An alias named \`${settings.prefix || '?'}${aliasName}\` already exists! Use \`?alias edit\` to modify it.`).catch(() => {});
            }

            // Check duplicate role (1 role = single alias)
            const existingRole = dbSetup.getAliasByRole(roleId);
            if (existingRole) {
                return message.reply(`❌ The role **${role.name}** is already mapped to the alias \`${settings.prefix || '?'}${existingRole.alias_name}\`. A role can only have a single alias.`).catch(() => {});
            }

            try {
                dbSetup.createAlias(aliasName, roleId, description);
                return message.reply(`✅ Created alias \`${settings.prefix || '?'}${aliasName}\` for role **${role.name}**:\n*Description: ${description}*`).catch(() => {});
            } catch (err) {
                console.error(err);
                return message.reply('❌ Failed to save role alias to the database.').catch(() => {});
            }
        }

        // 2. EDIT ALIAS
        if (subcommand === 'edit') {
            const aliasName = args[1]?.toLowerCase();
            const roleInput = args[2];
            const description = args.slice(3).join(' ') || null;

            if (!aliasName || !roleInput) {
                return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}alias edit <name> <@role> [description]\``).catch(() => {});
            }

            const existingRecord = dbSetup.getAlias(aliasName);
            if (!existingRecord) {
                return message.reply(`❌ No role alias named \`${settings.prefix || '?'}${aliasName}\` exists to edit.`).catch(() => {});
            }

            const roleId = roleInput.replace(/\D/g, '');
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                return message.reply('❌ The specified role was not found in the server.').catch(() => {});
            }

            // Check if the target role already belongs to *another* alias
            const existingRole = dbSetup.getAliasByRole(roleId);
            if (existingRole && existingRole.alias_name !== aliasName) {
                return message.reply(`❌ The role **${role.name}** is already mapped to another alias \`${settings.prefix || '?'}${existingRole.alias_name}\`.`).catch(() => {});
            }

            const finalDesc = description !== null ? description : (existingRecord.description || 'No description provided');

            try {
                dbSetup.createAlias(aliasName, roleId, finalDesc);
                return message.reply(`✅ Successfully updated alias \`${settings.prefix || '?'}${aliasName}\` to role **${role.name}**:\n*Description: ${finalDesc}*`).catch(() => {});
            } catch (err) {
                console.error(err);
                return message.reply('❌ Failed to edit role alias in the database.').catch(() => {});
            }
        }

        // 3. LIST ALIASES
        if (subcommand === 'list') {
            const aliases = dbSetup.getAllAliases();
            if (aliases.length === 0) {
                return message.reply('ℹ️ There are no role aliases configured in this server.').catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('🎭 Configured Role Aliases')
                .setTimestamp()
                .setFooter({ text: 'Amo India Assistant', iconURL: message.guild.iconURL() });

            let desc = '';
            aliases.forEach(record => {
                desc += `• **\`${settings.prefix || '?'}${record.alias_name}\`** ➔ <@&${record.target_role_id}>\n` +
                        `  *Description: ${record.description || 'No description'}*\n\n`;
            });

            embed.setDescription(desc);
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // 4. DELETE ALIAS
        if (subcommand === 'delete') {
            const aliasName = args[1]?.toLowerCase();
            if (!aliasName) {
                return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}alias delete <name>\``).catch(() => {});
            }

            const record = dbSetup.getAlias(aliasName);
            if (!record) {
                return message.reply(`❌ No alias named \`${settings.prefix || '?'}${aliasName}\` was found.`).catch(() => {});
            }

            try {
                dbSetup.removeAlias(aliasName);
                return message.reply(`✅ Successfully deleted role alias \`${settings.prefix || '?'}${aliasName}\`.`).catch(() => {});
            } catch (err) {
                console.error(err);
                return message.reply('❌ Failed to delete the role alias from the database.').catch(() => {});
            }
        }

        return message.reply(`❌ Invalid alias subcommand. Use:\n` +
                             `• \`${settings.prefix || '?'}alias create <name> <@role> [description]\`\n` +
                             `• \`${settings.prefix || '?'}alias edit <name> <@role> [description]\`\n` +
                             `• \`${settings.prefix || '?'}alias list\`\n` +
                             `• \`${settings.prefix || '?'}alias delete <name>\``).catch(() => {});
    }
};
