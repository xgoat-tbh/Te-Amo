const dbSetup = require('../database/dbSetup');

function calculateLevel(xp) {
    if (xp < 100) return 0;
    return Math.floor(Math.pow(xp / 100, 0.4));
}

async function checkAndApplyLevelRoles(member, totalXp) {
    try {
        const guild = member.guild;
        const botMember = guild.members.me || await guild.members.fetch(guild.client.user.id).catch(() => null);
        if (!botMember || !botMember.permissions.has('ManageRoles')) return;

        const currentLevel = calculateLevel(totalXp);
        const configuredRoles = dbSetup.getLevelRoles(guild.id);
        if (!configuredRoles) return; // No custom leveling roles configured yet

        const milestones = [
            { level: 100, roleId: configuredRoles.role_level_100 },
            { level: 75, roleId: configuredRoles.role_level_75 },
            { level: 50, roleId: configuredRoles.role_level_50 },
            { level: 40, roleId: configuredRoles.role_level_40 },
            { level: 30, roleId: configuredRoles.role_level_30 },
            { level: 20, roleId: configuredRoles.role_level_20 },
            { level: 15, roleId: configuredRoles.role_level_15 },
            { level: 10, roleId: configuredRoles.role_level_10 },
            { level: 5, roleId: configuredRoles.role_level_5 },
            { level: 1, roleId: configuredRoles.role_level_1 }
        ];

        // Find the highest milestone the user qualifies for
        const targetMilestone = milestones.find(m => currentLevel >= m.level && m.roleId);
        
        // Compile all configured milestone role IDs that exist in Discord
        const allConfiguredRoleIds = milestones
            .map(m => m.roleId)
            .filter(id => id && guild.roles.cache.has(id));

        // Target Role ID to assign (if any milestone is qualified)
        const targetRoleId = targetMilestone ? targetMilestone.roleId : null;

        // Perform updates in parallel/batch safely
        const rolesToAdd = [];
        const rolesToRemove = [];

        for (const roleId of allConfiguredRoleIds) {
            if (targetRoleId && roleId === targetRoleId) {
                if (!member.roles.cache.has(roleId)) {
                    const role = guild.roles.cache.get(roleId);
                    if (role && botMember.roles.highest.position > role.position) {
                        rolesToAdd.push(roleId);
                    }
                }
            } else {
                if (member.roles.cache.has(roleId)) {
                    const role = guild.roles.cache.get(roleId);
                    if (role && botMember.roles.highest.position > role.position) {
                        rolesToRemove.push(roleId);
                    }
                }
            }
        }

        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove, 'Strips old milestone roles to prevent profile stacking').catch(() => {});
        }
        if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, `Level up milestone: Level ${currentLevel}`).catch(() => {});
        }
    } catch (err) {
        console.error(`[Level Milestone Update Error] Member: ${member.user?.tag}`, err);
    }
}

module.exports = {
    calculateLevel,
    checkAndApplyLevelRoles
};
