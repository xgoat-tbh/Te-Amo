const { EmbedBuilder } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'rank',
    description: 'Display your current level, XP, and rank progress.',
    async execute(message, args, config, settings) {
        // Resolve target user
        let targetUser = message.author;
        if (args.length > 0) {
            const mention = message.mentions.users.first();
            if (mention) {
                targetUser = mention;
            } else {
                const search = args.join(' ').toLowerCase();
                const fetchedMember = message.guild.members.cache.find(m => 
                    m.user.id === search || 
                    m.user.username.toLowerCase().includes(search) || 
                    m.displayName.toLowerCase().includes(search)
                );
                if (fetchedMember) {
                    targetUser = fetchedMember.user;
                }
            }
        }

        const userData = dbSetup.getUserLevel(targetUser.id);
        const level = userData.level || 0;
        const xp = userData.xp || 0;

        // Calculate next level threshold: XP = 100 * Level^2.5
        let nextXpNeeded = Math.floor(100 * Math.pow(level, 2.5));
        if (level === 0) nextXpNeeded = 100;

        // Calculate server rank via SQL count
        const rankStmt = dbSetup.db.prepare(`
            SELECT COUNT(*) + 1 AS rank 
            FROM user_levels 
            WHERE level > ? OR (level = ? AND xp > ?)
        `);
        const rank = rankStmt.get(level, level, xp).rank;

        // Calculate progress bar
        const barLength = 10;
        const percentage = Math.min(100, Math.round((xp / nextXpNeeded) * 100));
        const filled = Math.min(barLength, Math.round((xp / nextXpNeeded) * barLength));
        const empty = barLength - filled;
        const progressBar = '🟩'.repeat(filled) + '⬜'.repeat(empty);

        const embed = new EmbedBuilder()
            .setColor(0x00FFAA)
            .setTitle(`📈 Rank Card - ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '✨ Level', value: `\`${level}\``, inline: true },
                { name: '🏆 Server Rank', value: `#\`${rank}\``, inline: true },
                { name: '📊 XP Progress', value: `\`${xp} / ${nextXpNeeded} XP\` (${percentage}%)`, inline: false },
                { name: 'Progress Bar', value: `${progressBar}`, inline: false }
            )
            .setFooter({ text: 'Te-Amo Leveling Loop', iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
