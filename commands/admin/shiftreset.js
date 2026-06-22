const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbSetup = require('../../database/dbSetup');
const { updateMemberCounter } = require('../../events/ready');

module.exports = {
    name: 'shiftreset',
    description: 'Wipe current server config and run an interactive setup wizard to shift the bot to a new server.',
    usage: '?shiftreset',
    async execute(message, args, config, settings) {
        // Enforce Server Owner restriction only
        if (message.author.id !== message.guild.ownerId) {
            return message.reply('❌ Only the **Server Owner** can execute the shift-reset configuration wizard.').catch(() => {});
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFF3333)
            .setTitle('⚠ WARNING: Bot Reset & Migration')
            .setDescription('Running this command will **wipe all configuration settings**, VC tracking registries, and role aliases for this server.\n\n' +
                             '**Leveling data (ranks, XP) will be preserved** so they transfer to your new server successfully.\n\n' +
                             'Type **`confirm`** within 30 seconds to proceed with the reset and start the migration setup wizard.')
            .setTimestamp();

        const warnMsg = await message.channel.send({ embeds: [confirmEmbed] }).catch(() => null);
        if (!warnMsg) return;

        const confirmCollector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            max: 1,
            time: 30000
        });

        confirmCollector.on('collect', async (m) => {
            if (m.content.toLowerCase() !== 'confirm') {
                return message.reply('❌ Shift reset cancelled.').catch(() => {});
            }

            // 1. Wipe Database Configuration (Guild-specific configs)
            try {
                dbSetup.db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(message.guild.id);
                dbSetup.db.prepare('DELETE FROM monitored_vcs WHERE guild_id = ?').run(message.guild.id);
                dbSetup.db.prepare('DELETE FROM role_aliases').run(); // Role aliases are global in schema, wipe them too
                console.log(`[Shift Reset] Database configuration wiped for Guild: ${message.guild.id}`);
            } catch (dbErr) {
                console.error('[Shift Reset SQLite Error]:', dbErr);
                return message.reply('❌ Database error occurred during wipe. Migration halted.').catch(() => {});
            }

            // 2. Launch Interactive Embed Wizard
            const steps = [
                {
                    key: 'log_channel',
                    title: 'Step 1: Logging Channel 📁',
                    question: 'Please mention or enter the ID of the text channel where moderator/security action logs should be outputted.',
                    validate: (msg) => {
                        const id = msg.content.replace(/\D/g, '');
                        const chan = msg.guild.channels.cache.get(id);
                        return chan && chan.isTextBased() ? id : null;
                    },
                    error: '❌ Invalid text channel. Please mention a text channel or input a valid ID.'
                },
                {
                    key: 'jail_role',
                    title: 'Step 2: Jail Role 🔒',
                    question: 'Please mention or enter the ID of the role to assign to Jailed users.\n' +
                               '*(Note: The bot will automatically generate jail channels and configure channel permission locks for this role during setup)*',
                    validate: (msg) => {
                        const id = msg.content.replace(/\D/g, '');
                        if (id === msg.guild.id) return null; // block @everyone
                        const role = msg.guild.roles.cache.get(id);
                        return role ? id : null;
                    },
                    error: '❌ Invalid role. Please mention a role or input a role ID (cannot be @everyone).'
                },
                {
                    key: 'auth_role',
                    title: 'Step 3: Permit / Authorization Role ⚙️',
                    question: 'Please mention or enter the ID of the role authorized to run moderation commands (kick, ban, mute, jail, trackvc, aliases).',
                    validate: (msg) => {
                        const id = msg.content.replace(/\D/g, '');
                        if (id === msg.guild.id) return null; // block @everyone
                        const role = msg.guild.roles.cache.get(id);
                        return role ? id : null;
                    },
                    error: '❌ Invalid role. Please mention a role or input a role ID (cannot be @everyone).'
                },
                {
                    key: 'member_counter',
                    title: 'Step 4: Live Member Counter 📊',
                    question: 'Please mention or enter the ID of the Voice Channel to use for the live user count, or type **`skip`** to omit this feature.',
                    validate: (msg) => {
                        if (msg.content.toLowerCase() === 'skip') return 'skip';
                        const id = msg.content.replace(/\D/g, '');
                        const chan = msg.guild.channels.cache.get(id);
                        return chan && chan.isVoiceBased() ? id : null;
                    },
                    error: '❌ Invalid voice channel. Mention a voice channel, enter a voice channel ID, or type `skip`.'
                },
                {
                    key: 'gaming_pings',
                    title: 'Step 5: Gaming Pings Channel 🎮',
                    question: 'Please mention or enter the ID of the channel where VC milestone ping alerts should be posted, or type **`skip`** to omit this feature.',
                    validate: (msg) => {
                        if (msg.content.toLowerCase() === 'skip') return 'skip';
                        const id = msg.content.replace(/\D/g, '');
                        const chan = msg.guild.channels.cache.get(id);
                        return chan && chan.isTextBased() ? id : null;
                    },
                    error: '❌ Invalid text channel. Mention a text channel, enter a text channel ID, or type `skip`.'
                }
            ];

            let stepIndex = 0;
            const responses = {};

            const askNextStep = async () => {
                if (stepIndex >= steps.length) {
                    // Complete Setup configuration
                    const logId = responses['log_channel'];
                    const jailId = responses['jail_role'];
                    const authId = responses['auth_role'];
                    const counterId = responses['member_counter'] === 'skip' ? null : responses['member_counter'];
                    const pingsId = responses['gaming_pings'] === 'skip' ? null : responses['gaming_pings'];

                    // Save to SQLite
                    dbSetup.updateSetup(message.guild.id, logId, jailId, authId, counterId);

                    // If pingsId is configured, update in-memory client configuration
                    if (pingsId) {
                        config.GAMING_PINGS_CHANNEL_ID = pingsId;
                    }

                    // Dynamically configure category and Jailed role channel locks automatically
                    message.channel.send('⚙️ *Creating categories, jail channels, and configuring channel locks...*');
                    await dbSetup.ensureJailSystem(message.guild).catch(console.error);

                    // Sync member counter channel
                    await updateMemberCounter(message.guild).catch(() => {});

                    const setupDetails = dbSetup.getGuildSettings(message.guild.id);

                    const finalEmbed = new EmbedBuilder()
                        .setColor(0x00FF88)
                        .setTitle('✅ Setup & Shift Completed Successfully!')
                        .setDescription('The bot configuration has been successfully imported and applied to this server. Levels were preserved.')
                        .addFields(
                            { name: '📁 Logging Room', value: `<#${setupDetails.log_channel_id}>`, inline: true },
                            { name: '🔒 Jail Role', value: `<@&${setupDetails.jail_role_id}>`, inline: true },
                            { name: '⚙️ Permit Role', value: `<@&${setupDetails.auth_role_id}>`, inline: true },
                            { name: '📊 Member Counter', value: setupDetails.member_counter_channel_id ? `<#${setupDetails.member_counter_channel_id}>` : '*Disabled*', inline: true },
                            { name: '🎮 Gaming Pings', value: pingsId ? `<#${pingsId}>` : '*Disabled*', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Te-Amo Migration Wizard', iconURL: message.guild.iconURL() });

                    return message.channel.send({ embeds: [finalEmbed] });
                }

                const currentStep = steps[stepIndex];
                const stepEmbed = new EmbedBuilder()
                    .setColor(0x00AEFF)
                    .setTitle(currentStep.title)
                    .setDescription(currentStep.question)
                    .setTimestamp();

                const askMsg = await message.channel.send({ embeds: [stepEmbed] }).catch(() => null);
                if (!askMsg) return;

                const stepCollector = message.channel.createMessageCollector({
                    filter: (reply) => reply.author.id === message.author.id,
                    max: 1,
                    time: 60000
                });

                stepCollector.on('collect', async (reply) => {
                    const parsedValue = currentStep.validate(reply);
                    if (parsedValue) {
                        responses[currentStep.key] = parsedValue;
                        stepIndex++;
                        await askNextStep();
                    } else {
                        await message.channel.send(currentStep.error);
                        await askNextStep();
                    }
                });

                stepCollector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        message.channel.send('⏳ Setup wizard timed out. Migration cancelled.');
                    }
                });
            };

            // Start first step
            await askNextStep();
        });

        confirmCollector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                message.reply('⏳ Confirmation timed out. Shift reset aborted.').catch(() => {});
            }
        });
    }
};
