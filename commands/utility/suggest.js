const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'suggest',
    description: 'Submit a server suggestion or respond to an existing suggestion (moderators only).',
    usage: '?suggest <text> OR ?suggest respond <id> <approve/reject> <reason>',
    async execute(message, args, config, settings) {
        const subcommand = args[0]?.toLowerCase();

        // CASE 1: Moderator Response
        if (subcommand === 'respond') {
            // Check authorization
            const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
            const isAuthorized = message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                                 message.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                                 message.member.permissions.has(PermissionFlagsBits.Administrator) ||
                                 (permitRoleId && message.member.roles.cache.has(permitRoleId));

            if (!isAuthorized) {
                return message.reply('❌ You do not have the required permissions to respond to suggestions.').catch(() => {});
            }

            const suggestionIdStr = args[1];
            const action = args[2]?.toLowerCase();
            const reason = args.slice(3).join(' ');

            if (!suggestionIdStr || !action || !reason) {
                return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}suggest respond <id> <approve/reject> <reason>\``).catch(() => {});
            }

            if (action !== 'approve' && action !== 'reject') {
                return message.reply('❌ Action must be either `approve` or `reject`.').catch(() => {});
            }

            const suggestionId = parseInt(suggestionIdStr, 10);
            if (isNaN(suggestionId)) {
                return message.reply('❌ Invalid suggestion ID.').catch(() => {});
            }

            // Retrieve suggestion record
            const row = dbSetup.db.prepare('SELECT * FROM suggestions WHERE suggestion_id = ?').get(suggestionId);
            if (!row) {
                return message.reply(`❌ Suggestion **#${suggestionId}** was not found in the database.`).catch(() => {});
            }

            const suggestionChannelId = settings.suggestion_channel_id;
            if (!suggestionChannelId) {
                return message.reply('❌ No suggestion channel is configured for this server.').catch(() => {});
            }

            const targetChannel = message.guild.channels.cache.get(suggestionChannelId);
            if (!targetChannel) {
                return message.reply('❌ The suggestion channel could not be found.').catch(() => {});
            }

            try {
                // Fetch target message
                const targetMsg = await targetChannel.messages.fetch(row.message_id).catch(() => null);
                if (!targetMsg) {
                    return message.reply('❌ The suggestion message was deleted from the channel.').catch(() => {});
                }

                const oldEmbed = targetMsg.embeds[0];
                if (!oldEmbed) {
                    return message.reply('❌ Suggestion message embed not found.').catch(() => {});
                }

                const isApprove = action === 'approve';
                const statusText = isApprove ? 'Approved' : 'Rejected';
                const embedColor = isApprove ? 0x57F287 : 0xED4245; // Green/Red

                const newEmbed = EmbedBuilder.from(oldEmbed)
                    .setColor(embedColor)
                    .setTitle(`Suggestion #${suggestionId} | ${statusText}`)
                    .addFields({
                        name: `🛡️ Mod Response (by ${message.author.tag})`,
                        value: reason,
                        inline: false
                    });

                await targetMsg.edit({ embeds: [newEmbed] });

                // Update database
                dbSetup.db.prepare('UPDATE suggestions SET status = ? WHERE suggestion_id = ?').run(statusText, suggestionId);

                return message.reply(`✅ Suggestion **#${suggestionId}** has been successfully ${statusText.toLowerCase()}.`).catch(() => {});
            } catch (err) {
                console.error('[Suggestion Response Error]:', err);
                return message.reply('❌ Failed to update the suggestion. Please check my channel permissions.').catch(() => {});
            }
        }

        // CASE 2: Submit Suggestion
        const suggestionText = args.join(' ');
        if (!suggestionText) {
            return message.reply(`❌ Invalid format. Use: \`${settings.prefix || '?'}suggest <suggestion_text>\``).catch(() => {});
        }

        const suggestionChannelId = settings.suggestion_channel_id;
        if (!suggestionChannelId) {
            return message.reply('❌ Suggestions are not configured on this server yet! Ask an admin to run \`/setup channels\`.').catch(() => {});
        }

        const targetChannel = message.guild.channels.cache.get(suggestionChannelId);
        if (!targetChannel || !targetChannel.isTextBased()) {
            return message.reply('❌ The suggestion channel is invalid or deleted.').catch(() => {});
        }

        try {
            // Delete trigger message for clean channel look
            await message.delete().catch(() => {});

            // Save to database to retrieve auto-incremented suggestion_id
            const insertStmt = dbSetup.db.prepare('INSERT INTO suggestions (author_id, status) VALUES (?, ?)');
            const info = insertStmt.run(message.author.id, 'Pending');
            const suggestionId = info.lastInsertRowid;

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow (Pending Status)
                .setTitle(`Suggestion #${suggestionId} | Pending`)
                .setDescription(suggestionText)
                .setTimestamp()
                .setFooter({ text: `Amo India Suggestions | Submitted by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            const sentMsg = await targetChannel.send({ embeds: [embed] });

            // Add reaction indicators
            await sentMsg.react('⬆️').catch(() => {});
            await sentMsg.react('⬇️').catch(() => {});

            // Update database with actual message ID
            dbSetup.db.prepare('UPDATE suggestions SET message_id = ? WHERE suggestion_id = ?').run(sentMsg.id, suggestionId);

            // Send confirmation check to user channel
            const confirmMsg = await message.channel.send(`✅ Suggestion **#${suggestionId}** has been successfully submitted in <#${suggestionChannelId}>.`).catch(() => null);
            if (confirmMsg) {
                setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);
            }
        } catch (err) {
            console.error('[Suggestion Submission Error]:', err);
            return message.reply('❌ Failed to submit suggestion due to an internal error.').catch(() => {});
        }
    }
};
