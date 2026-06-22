const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'kiss',
    description: 'Kiss another member.',
    usage: '?kiss @user',
    async execute(message, args, config, settings) {
        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a member to kiss.').catch(() => {});
        }

        const gifs = [
            'https://media.giphy.com/media/G3va31UPm3qdq/giphy.gif',
            'https://media.giphy.com/media/FqSPe9997XM5O/giphy.gif',
            'https://media.giphy.com/media/1n7c1ALHKnCPM9M702/giphy.gif'
        ];
        const gif = gifs[Math.floor(Math.random() * gifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('💋 Sweet Kiss!')
            .setDescription(`💖 **<@${message.author.id}>** kissed **<@${targetMember.id}>**!`)
            .setImage(gif)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
