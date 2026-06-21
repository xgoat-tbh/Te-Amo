// Guild Member Update Event (Role Backups)
const { Events } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client, config) {
        if (newMember.user.bot) return;

        const guild = newMember.guild;
        const jailedRoleId = config.JAILED_ROLE_ID;

        // Check if Jailed role was added or removed
        const hadJailed = jailedRoleId && !jailedRoleId.includes('YOUR_') && oldMember.roles.cache.has(jailedRoleId);
        const hasJailed = jailedRoleId && !jailedRoleId.includes('YOUR_') && newMember.roles.cache.has(jailedRoleId);

        const userData = db.getUser(newMember.id);

        if (!hadJailed && hasJailed) {
            // Member was just jailed!
            userData.isJailed = true;
            // Backup their old roles (from oldMember, before they got stripped)
            const oldRoleIds = oldMember.roles.cache.filter(r => r.id !== guild.id && r.id !== jailedRoleId).map(r => r.id);
            if (oldRoleIds.length > 0) {
                userData.roles = oldRoleIds;
            }
            db.saveUser(newMember.id, userData);
            console.log(`[Jail-Backup] User ${newMember.user.tag} marked as jailed. Roles backed up.`);
            return;
        }

        if (hadJailed && !hasJailed) {
            // Member was unjailed!
            userData.isJailed = false;
            db.saveUser(newMember.id, userData);
            console.log(`[Jail-Backup] User ${newMember.user.tag} marked as unjailed.`);
            return;
        }

        // Standard role changes (when NOT jailed)
        if (!hasJailed) {
            const roleIds = newMember.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
            userData.roles = roleIds;
            db.saveUser(newMember.id, userData);
        }
    }
};
