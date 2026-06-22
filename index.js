const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const dbSetup = require('./database/dbSetup'); // Runs schema setup on import

// Initialize client with correct gateway intents and partials
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.User,
        Partials.GuildMember,
        Partials.Channel,
        Partials.Message
    ]
});

client.commands = new Collection();

// Recursive Command Loader
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const categories = fs.readdirSync(commandsPath);
    for (const category of categories) {
        const categoryPath = path.join(commandsPath, category);
        if (fs.statSync(categoryPath).isDirectory()) {
            const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(categoryPath, file);
                const command = require(filePath);
                if ('name' in command && 'execute' in command) {
                    // Set category on the command object for categorization in ?help
                    command.category = category;
                    client.commands.set(command.name, command);
                } else {
                    console.warn(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
                }
            }
        }
    }
}

// Event Loader
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client, config));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client, config));
        }
    }
}

// Global unhandled exception logging to keep the bot alive
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Login the bot
client.login(config.BOT_TOKEN);
