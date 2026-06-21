const { EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    name: 'leaderboard',
    description: 'Show the top 10 members by level and XP.',
    async execute(message, args, config) {
        const allUsers = db.getAllUsers();
        
        const sorted = Object.entries(allUsers)
            .map(([id, data]) => ({ id, xp: data.xp || 0, level: data.level || 0 }))
            .sort((a, b) => {
                if (b.level !== a.level) return b.level - a.level;
                return b.xp - a.xp;
            });

        const top10 = sorted.slice(0, 10);
        if (top10.length === 0) {
            return message.reply('ℹ️ Leveling leaderboard is currently empty. Start chatting to gain XP!').catch(console.error);
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🏆 Te-Amo Leveling Leaderboard')
            .setDescription('Top active members in the server based on level and XP:')
            .setFooter({ text: 'Te-Amo Leveling System', iconURL: message.guild.iconURL() })
            .setTimestamp();

        const lines = [];
        for (let i = 0; i < top10.length; i++) {
            const entry = top10[i];
            let userTag = `User (\`${entry.id}\`)`;
            
            // Try resolving member
            const member = message.guild.members.cache.get(entry.id) || await message.guild.members.fetch(entry.id).catch(() => null);
            if (member) {
                userTag = member.user.username;
            }

            let medal = `\`#${i + 1}\``;
            if (i === 0) medal = '🥇';
            else if (i === 1) medal = '🥈';
            else if (i === 2) medal = '🥉';

            lines.push(`${medal} **${userTag}** - Level \`${entry.level}\` (\`${entry.xp}\` XP)`);
        }

        embed.setDescription(lines.join('\n'));
        return message.reply({ embeds: [embed] }).catch(console.error);
    }
};
