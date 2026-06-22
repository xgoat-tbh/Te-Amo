const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const dbSetup = require('../../database/dbSetup');

module.exports = {
    name: 'confession',
    description: 'Submit an anonymous or public confession via DMs.',
    usage: '?confession',
    async execute(message, args, config, settings) {
        // 1. Instantly delete the trigger message to protect privacy
        await message.delete().catch(() => {});

        const user = message.author;
        const guild = message.guild;

        // Retrieve confession channel
        const currentSettings = dbSetup.getGuildSettings(guild.id);
        const confessionChannelId = currentSettings.confession_channel_id;

        if (!confessionChannelId) {
            const tempMsg = await message.channel.send(`❌ <@${user.id}>, the confessions system is not configured on this server yet! Ask an admin to run \`/setup channels\`.`).catch(() => null);
            if (tempMsg) {
                setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
            }
            return;
        }

        try {
            // 2. Try to DM the user
            const dmChannel = await user.createDM();

            const dmEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('🎭 Amo India Confession Portal')
                .setDescription('You have initiated a confession process. Please choose whether you want this confession to be posted **Anonymously** or **Known** (showing your identity).')
                .setTimestamp()
                .setFooter({ text: 'Amo India Confessions' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confess_anon')
                    .setLabel('🎭 Anonymous')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('confess_known')
                    .setLabel('👁️ Known')
                    .setStyle(ButtonStyle.Primary)
            );

            const promptMsg = await dmChannel.send({ embeds: [dmEmbed], components: [row] });

            // 3. Await button click
            const buttonInteraction = await promptMsg.awaitMessageComponent({
                filter: (i) => i.user.id === user.id,
                componentType: ComponentType.Button,
                time: 60000
            }).catch(() => null);

            if (!buttonInteraction) {
                return dmChannel.send('⏳ Confession prompt timed out. Process aborted.');
            }

            const isAnonymous = buttonInteraction.customId === 'confess_anon';

            // Update DM prompt message
            await buttonInteraction.update({
                content: `✍️ **Type your confession below:**\n*(Selected Mode: ${isAnonymous ? '🎭 Anonymous' : '👁️ Known'} | You have 2 minutes)*`,
                embeds: [],
                components: []
            });

            // 4. Await their confession text
            const collected = await dmChannel.awaitMessages({
                filter: (m) => m.author.id === user.id,
                max: 1,
                time: 120000
            }).catch(() => null);

            const confessionMsg = collected ? collected.first() : null;
            if (!confessionMsg || !confessionMsg.content) {
                return dmChannel.send('⏳ Confession text prompt timed out or was empty. Process aborted.');
            }

            const confessionText = confessionMsg.content;

            // Fetch destination channel in guild
            const targetChannel = guild.channels.cache.get(confessionChannelId);
            if (!targetChannel || !targetChannel.isTextBased()) {
                return dmChannel.send('❌ Failed to deliver confession: the configured confessions channel is invalid or deleted.');
            }

            // 5. Send confession embed to channel
            const confessionEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('🎭 New Confession')
                .setTimestamp()
                .setFooter({ text: 'Amo India Confessions' });

            if (isAnonymous) {
                confessionEmbed.setDescription(confessionText);
            } else {
                confessionEmbed.setDescription(`**Confession by**: <@${user.id}> (\`${user.tag}\`)\n\n${confessionText}`);
            }

            await targetChannel.send({ embeds: [confessionEmbed] });
            return dmChannel.send('✅ **Your confession has been successfully delivered and posted.**');

        } catch (err) {
            // If DMs are closed, catch block handles it
            console.error('[Confession DM Error]:', err);
            const tempMsg = await message.channel.send(`❌ <@${user.id}>, I cannot DM you! Please enable **Server Direct Messages** to submit confessions.`).catch(() => null);
            if (tempMsg) {
                setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
            }
        }
    }
};
