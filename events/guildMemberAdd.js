const { Events } = require('discord.js');
const dbSetup = require('../database/dbSetup');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client, config) {
        // Anti-Jail Escape Check
        const jailedRecord = dbSetup.getJailedUser(member.id);
        if (jailedRecord) {
            const settings = dbSetup.getGuildSettings(member.guild.id);
            const jailRoleId = settings.jail_role_id || config.JAILED_ROLE_ID;
            if (jailRoleId) {
                try {
                    await member.roles.set([jailRoleId], 'Re-applying jail status on member join');
                } catch (err) {
                    console.error(`[Jail Restore On Join Failed] User: ${member.user.tag}`, err);
                }
            }
        }
    }
};
