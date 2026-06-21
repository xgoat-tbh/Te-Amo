// Te-Amo Bot - Main Entry Point
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Helper to load dynamic configuration
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (error) {
        console.error('[Error] Failed to load config.json:', error);
    }
    return {};
}

const config = loadConfig();

// Initialize Discord Client with all required Gateway Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Collection to store commands dynamically
client.commands = new Collection();

// Dynamically load command files from subfolders
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                if (command.name && command.execute) {
                    client.commands.set(command.name, command);
                    console.log(`[Load] Loaded command "!${command.name}" from ${folder}/${file}`);
                }
            }
        }
    }
}

// Dynamically load event handler files
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    // Read and filter only event files, skipping helper modules like 'memberCounter.js'
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && file !== 'memberCounter.js');
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => {
                const freshConfig = loadConfig();
                event.execute(...args, client, freshConfig);
            });
        } else {
            client.on(event.name, (...args) => {
                const freshConfig = loadConfig();
                event.execute(...args, client, freshConfig);
            });
        }
        console.log(`[Load] Registered event: "${event.name}" from events/${file}`);
    }
}

// Login to Discord
const token = config.BOT_TOKEN;
if (!token || token.includes('YOUR_')) {
    console.error('[Error] Bot Token is not configured. Please set the BOT_TOKEN in config.json before starting the bot.');
    process.exit(1);
}

client.login(token).catch((err) => {
    console.error('[Error] Failed to log in to Discord. Check your Bot Token in config.json.', err);
});
