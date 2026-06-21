// Message Update Event (Edit Logs)
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client, config) {
        if (newMessage.author?.bot || !newMessage.guild) return;
        if (oldMessage.content === newMessage.content) return;

        const logChannelId = config.SECURE_ADMIN_LOG_CHANNEL_ID;
        if (!logChannelId || logChannelId.includes('YOUR_')) return;

        const logChannel = await newMessage.guild.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0x3498DB) // Sleek blue for edits
            .setTitle('📝 Message Edited')
            .setAuthor({
                name: newMessage.author.tag,
                iconURL: newMessage.author.displayAvatarURL({ dynamic: true })
            })
            .addFields(
                { name: 'User', value: `<@${newMessage.author.id}> (\`${newMessage.author.id}\`)`, inline: true },
                { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
                { name: 'Before', value: oldMessage.content ? (oldMessage.content.substring(0, 1024) || '*Empty*') : '*Empty/Embed/File*' },
                { name: 'After', value: newMessage.content ? (newMessage.content.substring(0, 1024) || '*Empty*') : '*Empty/Embed/File*' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(console.error);
    }
};
