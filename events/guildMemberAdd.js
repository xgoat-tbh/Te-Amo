// Guild Member Add Event
const { Events } = require('discord.js');
const { updateCounter } = require('./memberCounter');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client, config) {
        console.log(`[Events] Member joined: ${member.user.tag}. Updating member counter...`);
        await updateCounter(member.guild, config);
    }
};
