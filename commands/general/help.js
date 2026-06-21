// Help Command
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Displays a list of available commands.',
    async execute(message, args, config) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🤖 Te-Amo Bot Commands')
            .setDescription('Here is a list of commands you can use with this bot:')
            .addFields(
                { name: '🔊 `!mv`', value: 'Moves everyone in your current voice channel into the default configured VC.' },
                { name: '👥 `!mv <@user(s)> to <voice_channel>`', value: 'Moves specified user(s) to a target voice channel. \n*Examples:*\n`!mv @Lockdown to Among Us 1`\n`!mv me to #Among Us 2`\n`!mv all to 1234567890` (moves everyone in your VC)' },
                { name: '⚙️ `!setup <option> <value>`', value: 'Dynamically configure bot settings without editing code.\n*Options:*\n`status` - Check current settings\n`bypassrole <id>` - Config Anti-Promo bypass role\n`countervc <id>` - Config Voice Channel for user counter\n`logchannel <id>` - Config log channel for security actions\n`pingschannel <id>` - Config global gaming pings channel\n`trackvc <vc_id> <targetCount> <roleId> <gameName>` - Register dynamic voice channel tracker\n`untrackvc <vc_id>` - Remove voice channel tracker' },
                { name: '❓ `!help`', value: 'Displays this command guide.' }
            )
            .setFooter({ text: 'Te-Amo Bot' })
            .setTimestamp();

        return message.reply({ embeds: [helpEmbed] }).catch(console.error);
    }
};
