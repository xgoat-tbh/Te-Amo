const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'embed',
    description: 'Send custom Discohook embeds using raw JSON payloads.',
    usage: '?embed send <#channel> <json_payload>',
    async execute(message, args, config, settings) {
        // Check authorization (ManageMessages/ManageGuild or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const channelMention = args[0];
        const jsonString = args.slice(1).join(' ');

        if (!channelMention || !jsonString) {
            return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}embed send <#channel> <json_payload>\``).catch(() => {});
        }

        if (jsonString.length > 4000) {
            return message.reply('❌ JSON payload exceeds the safety limit of 4000 characters.').catch(() => {});
        }

        const channelId = channelMention.replace(/\D/g, '');
        const targetChannel = message.guild.channels.cache.get(channelId);

        if (!targetChannel || !targetChannel.isTextBased()) {
            return message.reply('❌ Please specify a valid text channel to send the embed to.').catch(() => {});
        }

        try {
            const payload = JSON.parse(jsonString);

            // Clean up any discord.js unsupported properties that Discohook exports
            // discord.js send accepts: { content, embeds, components, files } etc.
            const sendOptions = {};
            if (payload.content !== undefined) sendOptions.content = payload.content;
            if (payload.embeds !== undefined) sendOptions.embeds = payload.embeds;
            if (payload.components !== undefined) sendOptions.components = payload.components;
            if (payload.files !== undefined) sendOptions.files = payload.files;

            if (Object.keys(sendOptions).length === 0) {
                throw new Error('JSON payload must contain at least a "content" or "embeds" field.');
            }

            await targetChannel.send(sendOptions);
            return message.reply('✅ Custom embed payload successfully delivered.').catch(() => {});
        } catch (err) {
            // Silently swallow format errors, warning the author cleanly
            return message.reply(`⚠️ **Syntax Validation Failed**: The JSON payload is invalid or could not be sent.\n` +
                                 `*Details: \`${err.message}\`*`).catch(() => {});
        }
    }
};
