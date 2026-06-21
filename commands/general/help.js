// Help Command
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Displays a list of available commands.',
    async execute(message, args, config) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🤖 Te-Amo Bot Commands')
            .setDescription('Here is a list of commands available in this server:')
            .addFields(
                { 
                    name: '📊 General & Leveling', 
                    value: 
                        '• `!rank [user]` - View current level, XP, server ranking, and progress card.\n' +
                        '• `!leaderboard` - Show the top 10 most active members on the server.' 
                },
                { 
                    name: '🔊 Voice & Movement', 
                    value: 
                        '• `!mv` - Moves everyone in your voice channel to the default VC.\n' +
                        '• `!mv <user/me/all> to <vc_name/id/mention>` - Concurrently moves target users to the target voice channel.\n' +
                        '  *Examples:*\n' +
                        '  `!mv @user to Among Us 1`\n' +
                        '  `!mv me to #Gaming VC`\n' +
                        '  `!mv all to 1518107937808318497`'
                },
                { 
                    name: '⚙️ Administration & Security (Staff Only)', 
                    value: 
                        '• `!setup` - Launch the interactive setup panel (configure bypass roles, counters, logs, and prison voice/role settings).\n' +
                        '• `!settings` - Launch the visual security settings panel (Anti-Nuke threshold, timeout lengths, and action detail configurations).\n' +
                        '• `!shiftserver` - Shifts the bot active configuration to this server (resets channels/roles, preserves levels - Owner only).' 
                }
            )
            .setThumbnail(message.client.user.displayAvatarURL())
            .setFooter({ text: 'Te-Amo Bot Command Guide', iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.reply({ embeds: [helpEmbed] }).catch(console.error);
    }
};
