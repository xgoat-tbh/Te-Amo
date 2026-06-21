const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ticketsend',
    description: 'Send the interactive support ticket panel.',
    async execute(message, args, config) {
        // Enforce Admin permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Error: Only server administrators can send the ticket panel.').catch(console.error);
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎫 Te-Amo Server Support')
            .setDescription(
                'Need to contact the server staff or administrative team?\n\n' +
                'Click the button below to open a **private support ticket**. ' +
                'A private channel will be created dynamically for you to chat with our staff team.'
            )
            .setThumbnail(message.guild.iconURL())
            .setFooter({ text: 'Te-Amo Helpdesk', iconURL: message.guild.iconURL() })
            .setTimestamp();

        const btn = new ButtonBuilder()
            .setCustomId('ticket_open_btn')
            .setLabel('Create Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(btn);

        // Delete trigger message
        if (message.deletable) {
            await message.delete().catch(() => {});
        }

        return message.channel.send({ embeds: [embed], components: [row] }).catch(console.error);
    }
};
