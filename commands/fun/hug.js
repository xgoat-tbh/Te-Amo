const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'hug',
    description: 'Hug another member.',
    usage: '?hug @user',
    async execute(message, args, config, settings) {
        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a member to hug.').catch(() => {});
        }

        const gifs = [
            'https://media.giphy.com/media/u9BzJtV10GUeI/giphy.gif',
            'https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif',
            'https://media.giphy.com/media/4c0oKhDxBK1SU/giphy.gif'
        ];
        const gif = gifs[Math.floor(Math.random() * gifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('🫂 Warm Hug!')
            .setDescription(`❤️ **<@${message.author.id}>** hugged **<@${targetMember.id}>**!`)
            .setImage(gif)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
