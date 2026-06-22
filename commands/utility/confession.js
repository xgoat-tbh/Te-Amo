const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'confession',
    description: 'Submit an anonymous or public confession via a popup modal.',
    usage: '?confession',
    async execute(message, args, config, settings) {
        // 1. Instantly delete the trigger message to protect privacy
        await message.delete().catch(() => {});

        const guild = message.guild;
        const user = message.author;

        // 2. Check if confession channel is configured
        const currentSettings = dbSetup.getGuildSettings(guild.id);
        const confessionChannelId = currentSettings.confession_channel_id;

        if (!confessionChannelId) {
            const tempMsg = await message.channel.send(
                `❌ <@${user.id}>, the confessions system is not configured yet! Ask an admin to run \`/setup channels\`.`
            ).catch(() => null);
            if (tempMsg) setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
            return;
        }

        // 3. Send a temporary prompt with Anonymous / Known buttons
        //    The customId encodes the caller's user ID so only they can click it
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎭 Amo India Confession Portal')
            .setDescription(
                `<@${user.id}>, choose how you'd like to submit your confession.\n\n` +
                `A **text box will pop up** for you to type privately.\n\n` +
                `> 🎭 **Anonymous** — name is hidden\n` +
                `> 👁️ **Known** — your name appears`
            )
            .setFooter({ text: 'Amo India Confessions • This prompt expires in 2 minutes' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confession_anon_${user.id}_${guild.id}`)
                .setLabel('🎭 Anonymous')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`confession_known_${user.id}_${guild.id}`)
                .setLabel('👁️ Known')
                .setStyle(ButtonStyle.Primary)
        );

        let promptMsg;
        try {
            promptMsg = await user.send({
                embeds: [embed],
                components: [row]
            });
            
            // 4. Auto-delete the prompt after 2 minutes if unused
            if (promptMsg) {
                setTimeout(() => promptMsg.delete().catch(() => {}), 120000);
            }
        } catch (err) {
            const tempMsg = await message.channel.send(
                `❌ <@${user.id}>, I could not send you a DM. Please enable DMs from server members in your privacy settings!`
            ).catch(() => null);
            if (tempMsg) setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
        }
    }
};
