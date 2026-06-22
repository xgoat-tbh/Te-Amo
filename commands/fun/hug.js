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

        let gif = '';
        try {
            const response = await fetch('https://nekos.best/api/v2/hug', {
                headers: { 'User-Agent': 'AmoIndiaBot (dev@amo.india)' }
            });
            const data = await response.json();
            gif = data.results[0].url;
        } catch (err) {
            console.error('[Hug API Error]:', err);
            const gifs = [
                'https://i.giphy.com/u9BzJtV10GUeI.gif',
                'https://i.giphy.com/lrr9rHuoJOE0w.gif',
                'https://i.giphy.com/4c0oKhDxBK1SU.gif',
                'https://i.giphy.com/od553F16IO8vK.gif',
                'https://i.giphy.com/rSDFStL6SxsAg.gif',
                'https://i.giphy.com/17mNCcKU1mJlEro7SM.gif',
                'https://i.giphy.com/Vz58J8shFW6BvqnIME.gif'
            ];
            gif = gifs[Math.floor(Math.random() * gifs.length)];
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🫂 Warm Hug!')
            .setDescription(`❤️ **<@${message.author.id}>** hugged **<@${targetMember.id}>**!`)
            .setImage(gif)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
