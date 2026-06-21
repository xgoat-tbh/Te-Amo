// Message Create Event
const { Events } = require('discord.js');
const antiPromo = require('../security/antiPromo');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client, config) {
        if (message.author.bot) return;

        // Run Auto-Moderation filter for promotion links
        await antiPromo.handleMessage(message, config);

        // Command parsing logic
        const prefix = '!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Get command from client commands collection
        const command = client.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(message, args, config);
        } catch (error) {
            console.error(`Error executing command "!${commandName}":`, error);
            message.reply('❌ There was an error trying to execute that command!').catch(console.error);
        }
    }
};
