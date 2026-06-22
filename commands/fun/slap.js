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

        let gif = '';
        try {
            const response = await fetch('https://nekos.best/api/v2/slap', {
                headers: { 'User-Agent': 'AmoIndiaBot (dev@amo.india)' }
            });
            const data = await response.json();
            gif = data.results[0].url;
        } catch (err) {
            console.error('[Slap API Error]:', err);
            const gifs = [
                'https://i.giphy.com/Zau0yrl17uzdK.gif',
                'https://i.giphy.com/lX03h4CTk21V856E1K.gif',
                'https://i.giphy.com/jLeyZM22pd98k.gif',
                'https://i.giphy.com/LiRoVOHjMaQxO.gif',
                'https://i.giphy.com/rCftUAVPLExZC.gif',
                'https://i.giphy.com/Pe5653155694M.gif',
                'https://i.giphy.com/109044238.gif'
            ];
            gif = gifs[Math.floor(Math.random() * gifs.length)];
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('💢 Slapped!')
            .setDescription(`⚡ **<@${message.author.id}>** slapped **<@${targetMember.id}>**! Ouch!`)
            .setImage(gif)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
