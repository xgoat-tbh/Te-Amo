const { EmbedBuilder } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb'],
    description: 'Display the top 10 ranked users in the server.',
    usage: '?leaderboard',
    async execute(message, args, config, settings) {
        const topUsers = dbSetup.getTopUsers(10);
        if (topUsers.length === 0) {
            return message.reply('ℹ️ No user leveling records found in this server yet.').catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(`🏆 Server Leaderboard - Top 10`)
            .setTimestamp()
            .setFooter({ text: 'Amo India Hardcore Grind', iconURL: message.guild.iconURL() });

        let description = '';

        for (let i = 0; i < topUsers.length; i++) {
            const userRow = topUsers[i];
            const member = await message.guild.members.fetch(userRow.user_id).catch(() => null);
            const name = member ? member.displayName : `<@${userRow.user_id}>`;
            
            // Format line
            const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
            description += `${rankIcon} **${name}** - Level **${userRow.level}** (XP: \`${userRow.xp}\`)\n`;
        }

        embed.setDescription(description);
        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
