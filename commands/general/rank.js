const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    name: 'rank',
    description: 'Check your level, XP, and rank progress.',
    async execute(message, args, config) {
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

        const userData = db.getUser(targetUser.id);
        const level = userData.level || 0;
        const xp = userData.xp || 0;
        const xpNeeded = 5 * (level * level) + 50 * level + 100;

        // Calculate progress bar
        const progressChunks = 10;
        const filledChunks = Math.min(progressChunks, Math.round((xp / xpNeeded) * progressChunks));
        const emptyChunks = progressChunks - filledChunks;
        const progressBar = '🟦'.repeat(filledChunks) + '⬛'.repeat(emptyChunks);

        // Fetch leaderboard ranking for context
        const allUsers = db.getAllUsers();
        const sorted = Object.entries(allUsers)
            .map(([id, data]) => ({ id, xp: data.xp || 0, level: data.level || 0 }))
            .sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return b.xp - a.xp;
            });
        
        const rankIndex = sorted.findIndex(u => u.id === targetUser.id) + 1;
        const rankingStr = rankIndex > 0 ? `#${rankIndex}` : 'N/A';

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📊 Rank Info for ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Level', value: `✨ \`${level}\``, inline: true },
                { name: 'Server Rank', value: `🏆 \`${rankingStr}\``, inline: true },
                { name: 'XP Progress', value: `📈 \`${xp} / ${xpNeeded} XP\``, inline: false },
                { name: 'Progress Bar', value: `${progressBar} \`${Math.round((xp / xpNeeded) * 100)}%\``, inline: false }
            )
            .setFooter({ text: 'Te-Amo Leveling System', iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.reply({ embeds: [embed] }).catch(console.error);
    }
};
