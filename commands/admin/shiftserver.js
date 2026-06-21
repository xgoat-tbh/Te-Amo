const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const setupCommand = require('./setup');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

module.exports = {
    name: 'shiftserver',
    description: 'Shift the bot to a new server (Owner only).',
    async execute(message, args, config) {
        // Enforce Server Owner restriction
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('❌ Only the Server Owner can shift this bot to a new server.').catch(console.error);
        }

        try {
            // Update active guild settings in config
            config.CAN_PROMOTE_ROLE_ID = "YOUR_CAN_PROMOTE_ROLE_ID_HERE";
            config.MEMBER_COUNT_VC_ID = "YOUR_MEMBER_COUNT_VC_ID_HERE";
            config.SECURE_ADMIN_LOG_CHANNEL_ID = "YOUR_SECURE_ADMIN_LOG_CHANNEL_ID_HERE";
            config.GAMING_PINGS_CHANNEL_ID = "YOUR_GAMING_PINGS_CHANNEL_ID_HERE";
            config.JAILED_ROLE_ID = "YOUR_JAILED_ROLE_ID_HERE";
            config.PRISON_CHANNEL_ID = "YOUR_PRISON_CHANNEL_ID_HERE";
            config.monitored_channels = {};

            // Save updated config
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🌐 Bot Shift Successful!')
                .setDescription(
                    `The bot has successfully shifted its active server configuration to **${message.guild.name}**!\n\n` +
                    `• **Leveling data** has been preserved and transferred.\n` +
                    `• **Guild configuration settings** have been reset to start fresh.\n\n` +
                    `You can now configure the bot for this server using the Setup Dashboard below:`
                )
                .setTimestamp();

            await message.channel.send({ embeds: [embed] }).catch(console.error);

            // Send new setup dashboard
            const dashboard = setupCommand.getSetupDashboard(message.guild, config);
            const setupMsg = await message.channel.send(dashboard).catch(console.error);
            
            // Store the active setup message in memory
            if (setupMsg) {
                if (!message.client.setupMessages) {
                    message.client.setupMessages = new Map();
                }
                message.client.setupMessages.set(message.guild.id, setupMsg);
            }

        } catch (err) {
            console.error('Error shifting server:', err);
            message.reply('❌ Failed to shift server. See bot console logs for details.').catch(console.error);
        }
    }
};
