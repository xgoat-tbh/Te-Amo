const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'coinflip',
    description: 'Flip a coin.',
    usage: '?coinflip',
    async execute(message, args, config, settings) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('🪙 Coin Flip')
            .setDescription(`The coin landed on **${result}**!`)
            .setTimestamp()
            .setFooter({ text: 'Amo India Fun', iconURL: message.guild.iconURL() });

        return message.reply({ embeds: [embed] }).catch(() => {});
    }
};
