// Te-Amo Discord Bot - Main Entry Point
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Self-healing default configuration template
const DEFAULT_CONFIG = {
  BOT_TOKEN: "YOUR_BOT_TOKEN_HERE",
  CAN_PROMOTE_ROLE_ID: "YOUR_CAN_PROMOTE_ROLE_ID_HERE",
  MEMBER_COUNT_VC_ID: "YOUR_MEMBER_COUNT_VC_ID_HERE",
  SECURE_ADMIN_LOG_CHANNEL_ID: "YOUR_SECURE_ADMIN_LOG_CHANNEL_ID_HERE",
  GAMING_PINGS_CHANNEL_ID: "YOUR_GAMING_PINGS_CHANNEL_ID_HERE",
  JAILED_ROLE_ID: "YOUR_JAILED_ROLE_ID_HERE",
  PRISON_CHANNEL_ID: "YOUR_PRISON_CHANNEL_ID_HERE",
  ANTI_NUKE_THRESHOLD: 3,
  ANTI_NUKE_TIMEFRAME_MS: 60000,
  ANTI_NUKE_ACTION: "jail",
  ANTI_PROMO_STRIKES_LIMIT: 2,
  ANTI_PROMO_TIMEOUT_DURATION_MINS: 10,
  monitored_channels: {}
};

// Helper to load dynamic configuration (with auto-recreation on delete/missing)
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        } else {
            // Re-create the configuration file if missing (self-healing setup persistence)
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
            console.log('[Config] config.json was missing. Created new template file.');
            return DEFAULT_CONFIG;
        }
    } catch (error) {
        console.error('[Error] Failed to load config.json:', error);
    }
    return DEFAULT_CONFIG;
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
    // Read and filter only event files, skipping helper modules like 'memberCounter.js' and 'memberCounterHelper.js'
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
