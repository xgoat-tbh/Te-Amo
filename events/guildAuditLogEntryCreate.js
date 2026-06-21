// Guild Audit Log Entry Create Event
const { Events } = require('discord.js');
const antiNuke = require('../security/antiNuke');

module.exports = {
    name: Events.GuildAuditLogEntryCreate,
    async execute(auditEntry, guild, client, config) {
        // Delegate audit log monitoring to antiNuke module
        await antiNuke.handleAuditLog(auditEntry, guild, config);
    }
};
