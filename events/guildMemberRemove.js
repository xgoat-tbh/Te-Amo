const { Events } = require('discord.js');
const { updateMemberCounter } = require('./ready');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client, config) {
        // Update member counter channel
        await updateMemberCounter(member.guild);
    }
};
