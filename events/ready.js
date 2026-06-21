// Ready Event
const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Set Rich Presence status to "playing amo.gg"
        client.user.setActivity('amo.gg', { type: ActivityType.Playing });
        console.log('[Presence] Bot activity status set to: "Playing amo.gg"');
    }
};
