const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'slap',
    description: 'Slap another member.',
    usage: '?slap @user',
    async execute(message, args, config, settings) {
        const targetMember = message.mentions.members.first() ||
                             (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) {
            return message.reply('❌ Please specify a member to slap.').catch(() => {});
        }

        const gifs = [
            'https://media.giphy.com/media/Zau0yrl17uzdK/giphy.gif',
            'https://media.giphy.com/media/lX03h4CTk21V856E1K/giphy.gif',
            'https://media.giphy.com/media/jLeyZM22pd98k/giphy.gif'
        ];
        const gif = gifs[Math.floor(Math.random() * gifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('💢 Slapped!')
            .setDescription(`⚡ **<@${message.author.id}>** slapped **<@${targetMember.id}>**! Ouch!`)
            .setImage(gif)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
