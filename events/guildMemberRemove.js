// Guild Member Remove Event
const { Events } = require('discord.js');
const { updateCounter } = require('./memberCounter');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client, config) {
        console.log(`[Events] Member left: ${member.user.tag}. Updating member counter...`);
        await updateCounter(member.guild, config);
    }
};
