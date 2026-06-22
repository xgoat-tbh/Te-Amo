const { PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'alias',
    description: 'Manage role aliases.',
    async execute(message, args, config, settings) {
        // Check authorization (ManageRoles or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        if (args[0] === 'create') {
            const aliasName = args[1]?.toLowerCase();
            const roleInput = args[2];

            if (!aliasName || !roleInput) {
                return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}alias create <alias_name> <@role>\``).catch(() => {});
            }

            // Extract role ID from mention or raw ID
            const roleId = roleInput.replace(/\D/g, '');
            const role = message.guild.roles.cache.get(roleId);

            if (!role) {
                return message.reply(`❌ Could not find the specified role in this server.`).catch(() => {});
            }

            try {
                dbSetup.createAlias(aliasName, roleId);
                return message.reply(`✅ Successfully mapped alias \`${settings.prefix || '?'}${aliasName}\` to role **${role.name}** (\`${roleId}\`).`).catch(() => {});
            } catch (err) {
                console.error('[Alias Create Error]:', err);
                return message.reply('❌ Failed to save role alias to the database.').catch(() => {});
            }
        }

        return message.reply(`❌ Subcommand not found. Use:\n• \`${settings.prefix || '?'}alias create <name> <@role>\``).catch(() => {});
    }
};
