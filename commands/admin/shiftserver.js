const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const setupCommand = require('./setup');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

module.exports = {
    name: 'shiftserver',
    description: 'Shift the bot configuration to a new server using an invite link (Owner only).',
    async execute(message, args, config) {
        // Enforce Server Owner restriction
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('❌ Only the Server Owner can shift this bot to a new server.').catch(console.error);
        }

        const processInvite = async (inviteStr, responseMessage) => {
            try {
                // Fetch the invite details
                const invite = await message.client.fetchInvite(inviteStr).catch(() => null);
                if (!invite || !invite.guild) {
                    return responseMessage.reply('❌ Invalid invite link or code. Please provide a valid invite link.').catch(console.error);
                }

                const targetGuildId = invite.guild.id;
                const targetGuildName = invite.guild.name;

                // Check if the bot is already in the target guild
                const targetGuild = message.client.guilds.cache.get(targetGuildId);
                if (!targetGuild) {
                    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${message.client.user.id}&permissions=8&scope=bot`;
                    const embed = new EmbedBuilder()
                        .setColor(0xFF9900)
                        .setTitle('🔌 Bot Invite Required')
                        .setDescription(
                            `The bot is not currently in **${targetGuildName}**.\n\n` +
                            `1. Click here to [Invite Bot to Server](${inviteUrl})\n` +
                            `2. Once the bot has joined, run \`!shiftserver\` again and provide the invite link to activate it.`
                        )
                        .setTimestamp();
                    return responseMessage.reply({ embeds: [embed] }).catch(console.error);
                }

                // Shifting config
                config.CAN_PROMOTE_ROLE_ID = "YOUR_CAN_PROMOTE_ROLE_ID_HERE";
                config.MEMBER_COUNT_VC_ID = "YOUR_MEMBER_COUNT_VC_ID_HERE";
                config.SECURE_ADMIN_LOG_CHANNEL_ID = "YOUR_SECURE_ADMIN_LOG_CHANNEL_ID_HERE";
                config.GAMING_PINGS_CHANNEL_ID = "YOUR_GAMING_PINGS_CHANNEL_ID_HERE";
                config.JAILED_ROLE_ID = "YOUR_JAILED_ROLE_ID_HERE";
                config.PRISON_CHANNEL_ID = "YOUR_PRISON_CHANNEL_ID_HERE";
                config.monitored_channels = {};

                // Save config
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

                // Welcome embed in new server
                const newServerEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🌐 Bot Shift Successful!')
                    .setDescription(
                        `The bot has successfully shifted its active server configuration to **${targetGuild.name}**!\n\n` +
                        `• **Leveling data** has been preserved and transferred.\n` +
                        `• **Guild configuration settings** have been reset to start fresh.\n\n` +
                        `You can now configure the bot for this server using the Setup Dashboard below:`
                    )
                    .setTimestamp();

                // Find a writeable text channel in the new server
                const targetChannel = targetGuild.systemChannel || targetGuild.channels.cache.find(c => 
                    c.isTextBased() && 
                    c.permissionsFor(targetGuild.members.me).has(PermissionFlagsBits.SendMessages)
                );

                if (targetChannel) {
                    await targetChannel.send({ embeds: [newServerEmbed] }).catch(console.error);
                    const dashboard = setupCommand.getSetupDashboard(targetGuild, config);
                    const setupMsg = await targetChannel.send(dashboard).catch(console.error);

                    // Save setup message in client memory
                    if (setupMsg) {
                        if (!message.client.setupMessages) {
                            message.client.setupMessages = new Map();
                        }
                        message.client.setupMessages.set(targetGuildId, setupMsg);
                    }
                }

                // Success reply in old server
                return responseMessage.reply(`✅ **Successfully shifted bot to ${targetGuild.name}!**\nI have initialized the configuration dashboard in <#${targetChannel?.id || 'the system channel'}> of the new server.`).catch(console.error);

            } catch (err) {
                console.error('[ShiftServer] Error during shifting process:', err);
                return responseMessage.reply('❌ An error occurred during the server shift. Check bot console logs.').catch(console.error);
            }
        };

        // If invite link is provided in command directly
        if (args.length > 0) {
            return processInvite(args[0], message);
        }

        // If no link, prompt the owner
        const promptMsg = await message.reply('🌐 **Server Shift Initialized**\nPlease send the Discord invite link of the server you want to shift the bot to (you have 60 seconds):').catch(console.error);
        if (!promptMsg) return;

        const filter = m => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async m => {
            // Try deleting prompt and owner's reply to keep channel tidy
            if (m.deletable) await m.delete().catch(() => {});
            if (promptMsg.deletable) await promptMsg.delete().catch(() => {});

            await processInvite(m.content.trim(), message);
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                promptMsg.edit('❌ **Server Shift Timeout**: No invite link was provided within 60 seconds.').catch(console.error);
            }
        });
    }
};
