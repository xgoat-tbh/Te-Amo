// Message Delete Event (Deletion Logs)
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client, config) {
        if (message.author?.bot || !message.guild) return;

        const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
        if (!logChannelId || logChannelId.includes('YOUR_')) return;

        const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C) // Sleek red for deletions
            .setTitle('🗑️ Message Deleted')
            .setAuthor({
                name: message.author.tag,
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .addFields(
                { name: 'User', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Deleted Content', value: message.content ? (message.content.substring(0, 1024) || '*Empty*') : '*Empty/Embed/File/Media*' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(console.error);
    }
};
