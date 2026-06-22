const { EmbedBuilder } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'shift',
    description: 'Prepare the bot to shift/migrate to a new server. Resets current configurations (levels are preserved). Owner-only.',
    usage: '?shift',
    async execute(message, args, config, settings) {
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('❌ Only the **Server Owner** can execute the shift command.').catch(() => {});
        }

        const initialEmbed = new EmbedBuilder()
            .setColor(0x00AEFF)
            .setTitle('✈️ Bot Migration Wizard')
            .setDescription('Please provide the **Discord Invite Link** of the new server you wish to shift the bot to (within 60 seconds).\n\n' +
                             '*Example: `https://discord.gg/invitecode` or just `invitecode`*')
            .setTimestamp();

        const askMsg = await message.channel.send({ embeds: [initialEmbed] }).catch(() => null);
        if (!askMsg) return;

        const collector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            max: 1,
            time: 60000
        });

        collector.on('collect', async (m) => {
            const input = m.content.trim();
            // Extract invite code
            const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord\.com\/invite\/)?([a-zA-Z0-9-]+)/i;
            const match = input.match(inviteRegex);
            const inviteCode = match ? match[1] : input;

            try {
                // Fetch invite details
                const invite = await message.client.fetchInvite(inviteCode).catch(() => null);
                if (!invite) {
                    return message.reply('❌ Invalid or expired invite link. Migration cancelled.').catch(() => {});
                }

                const targetGuildName = invite.guild.name;
                const targetGuildId = invite.guild.id;

                // Wipe current guild config
                dbSetup.db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(message.guild.id);
                dbSetup.db.prepare('DELETE FROM monitored_vcs WHERE guild_id = ?').run(message.guild.id);
                dbSetup.db.prepare('DELETE FROM role_aliases').run(); // Wipe aliases (global in schema)

                const isAlreadyInGuild = message.client.guilds.cache.has(targetGuildId);
                const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${message.client.user.id}&permissions=8&scope=bot%20applications.commands`;

                const finalEmbed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle('🚀 Migration Configured & Initiated')
                    .setDescription(`The bot has cleared all configurations for **${message.guild.name}**.\n\n` +
                                     `**Target Server**: **${targetGuildName}** (ID: \`${targetGuildId}\`)\n\n` +
                                     (isAlreadyInGuild 
                                         ? '✅ The bot is **already present** in the target server!' 
                                         : `⚠️ The bot is not in the target server yet. Click [here](${botInviteUrl}) to authorize and add the bot to the server.`) +
                                     `\n\n**Next Steps**:\n` +
                                     `1. Add the bot to the new server (if not already added).\n` +
                                     `2. Go to the new server and run the **/setup** slash command to configure channels, roles, and counters interactively.`)
                    .setTimestamp();

                await message.channel.send({ embeds: [finalEmbed] }).catch(() => {});
            } catch (err) {
                console.error('[Shift Command Error]:', err);
                return message.reply('❌ Failed to execute migration due to an unexpected error.').catch(() => {});
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                message.reply('⏳ Invite prompt timed out. Migration aborted.').catch(() => {});
            }
        });
    }
};
