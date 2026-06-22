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

        let gif = '';
        try {
            const response = await fetch('https://nekos.best/api/v2/kiss', {
                headers: { 'User-Agent': 'AmoIndiaBot (dev@amo.india)' }
            });
            const data = await response.json();
            gif = data.results[0].url;
        } catch (err) {
            console.error('[Kiss API Error]:', err);
            const gifs = [
                'https://i.giphy.com/G3va31UPm3qdq.gif',
                'https://i.giphy.com/FqSPe9997XM5O.gif',
                'https://i.giphy.com/1n7c1ALHKnCPM9M702.gif',
                'https://i.giphy.com/lTQFmS8LvAycM.gif',
                'https://i.giphy.com/wO89h8436lYkw.gif',
                'https://i.giphy.com/K4x1zlqhNVtRe.gif',
                'https://i.giphy.com/dn575usOdU4Wk.gif'
            ];
            gif = gifs[Math.floor(Math.random() * gifs.length)];
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('💋 Sweet Kiss!')
            .setDescription(`💖 **<@${message.author.id}>** kissed **<@${targetMember.id}>**!`)
            .setImage(gif)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
