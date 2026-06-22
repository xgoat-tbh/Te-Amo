const { EmbedBuilder } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'reset',
    description: 'Completely purge the entire database (wipes all configurations, user levels/XP, aliases, tracked VCs, and jailed users). Owner-only.',
    usage: '?reset',
    async execute(message, args, config, settings) {
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('❌ Only the **Server Owner** can execute the database reset.').catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 CRITICAL WARNING: Complete Bot Reset')
            .setDescription('Running this command will **permanently delete all data** associated with this bot across ALL tables, including:\n\n' +
                             '• Guild configurations & setup profiles\n' +
                             '• Member levels, XP, and leaderboards\n' +
                             '• All configured role aliases & descriptions\n' +
                             '• Voice channel tracking configurations\n' +
                             '• Active jailed user backups\n\n' +
                             'Type **`confirm`** within 30 seconds to proceed with the complete wipe. This action **CANNOT** be undone!')
            .setTimestamp();

        const warnMsg = await message.channel.send({ embeds: [embed] }).catch(() => null);
        if (!warnMsg) return;

        const collector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            max: 1,
            time: 30000
        });

        collector.on('collect', async (m) => {
            if (m.content.toLowerCase() !== 'confirm') {
                return message.reply('❌ Reset cancelled.').catch(() => {});
            }

            try {
                dbSetup.db.prepare('DELETE FROM guild_settings').run();
                dbSetup.db.prepare('DELETE FROM jailed_users').run();
                dbSetup.db.prepare('DELETE FROM role_aliases').run();
                dbSetup.db.prepare('DELETE FROM user_levels').run();
                dbSetup.db.prepare('DELETE FROM monitored_vcs').run();

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle('✅ Database Reset Successful')
                    .setDescription('The entire SQLite database has been purged. All settings, levels, tracking registries, and aliases have been wiped clean.')
                    .setTimestamp();

                await message.channel.send({ embeds: [successEmbed] }).catch(() => {});
            } catch (err) {
                console.error('[Reset Command Database Error]:', err);
                return message.reply('❌ An error occurred while resetting the database.').catch(() => {});
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                message.reply('⏳ Confirmation timed out. Reset aborted.').catch(() => {});
            }
        });
    }
};
