// Move Command
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'mv',
    description: 'Moves members concurrently to a target Voice Channel.',
    async execute(message, args, config) {
        const member = message.member;
        if (!member) return;

        const fullArgString = args.join(' ').trim();

        // Helper: Parse ID by stripping all non-digits
        const parseId = (str) => {
            if (!str) return null;
            const clean = str.replace(/\D/g, '');
            return clean || null;
        };

        // Case A: Just "!mv" (original behavior)
        if (fullArgString === '') {
            const userVoiceChannel = member.voice.channel;
            if (!userVoiceChannel) {
                return message.reply('Error: You must be in a voice channel to use this command!').catch(console.error);
            }

            // Fallback: Get the first VC ID configured in monitored_channels
            const monitoredChannels = Object.keys(config.monitored_channels || {});
            const targetVcId = monitoredChannels[0];

            if (!targetVcId || targetVcId.includes('YOUR_')) {
                return message.reply('Error: Target Voice Channel is not configured yet. Configure a channel in `config.json` first.').catch(console.error);
            }

            if (userVoiceChannel.id === targetVcId) {
                return message.reply('You are already in the target Voice Channel!').catch(console.error);
            }

            const membersToMove = Array.from(userVoiceChannel.members.values());
            if (membersToMove.length === 0) {
                return message.reply('No members found in your voice channel to move.').catch(console.error);
            }

            const replyMsg = await message.reply(`Moving ${membersToMove.length} member(s) to the voice channel...`).catch(console.error);

            // Move concurrently using Promise.all
            const movePromises = membersToMove.map(async (m) => {
                try {
                    await m.voice.setChannel(targetVcId);
                    return { success: true };
                } catch (err) {
                    return { success: false, error: err };
                }
            });

            const results = await Promise.all(movePromises);
            const successfulMoves = results.filter(r => r.success).length;

            if (replyMsg) {
                await replyMsg.edit(`Successfully moved ${successfulMoves}/${membersToMove.length} member(s).`).catch(console.error);
            }
            return;
        }

        // Case B: "!mv <users> to <channel>"
        const toIndex = fullArgString.toLowerCase().indexOf(' to ');
        if (toIndex === -1) {
            return message.reply('Usage:\n`!mv` (moves everyone in your VC to the default VC)\n`!mv @user to <voice channel>` (moves specified users)').catch(console.error);
        }

        const leftSide = fullArgString.substring(0, toIndex).trim();
        const rightSide = fullArgString.substring(toIndex + 4).trim();

        if (!leftSide || !rightSide) {
            return message.reply('Syntax error. Format must be `!mv <users> to <channel>`.').catch(console.error);
        }

        // 1. Resolve Target Channel
        let targetChannel = null;
        const channelIdCandidate = parseId(rightSide);

        // Try to fetch by ID/mention first
        if (channelIdCandidate) {
            targetChannel = await message.guild.channels.fetch(channelIdCandidate).catch(() => null);
        }

        // Try to find by name match (case-insensitive) if not resolved by ID
        if (!targetChannel || !targetChannel.isVoiceBased()) {
            const channels = await message.guild.channels.fetch().catch(() => null);
            if (channels) {
                targetChannel = channels.find(c => c && c.isVoiceBased() && c.name.toLowerCase() === rightSide.toLowerCase());
            }
        }

        if (!targetChannel || !targetChannel.isVoiceBased()) {
            return message.reply(`Error: Could not find a voice channel named or with ID matching "${rightSide}".`).catch(console.error);
        }

        // 2. Resolve Members to Move
        let membersToMove = [];

        if (leftSide.toLowerCase() === 'all' || leftSide.toLowerCase() === 'everyone' || leftSide === '@everyone' || leftSide === '@here') {
            const userVoiceChannel = member.voice.channel;
            if (!userVoiceChannel) {
                return message.reply('Error: You must be in a voice channel to use "all".').catch(console.error);
            }
            membersToMove = Array.from(userVoiceChannel.members.values());
        } else if (leftSide.toLowerCase() === 'me') {
            if (!member.voice.channel) {
                return message.reply('Error: You must be in a voice channel to be moved.').catch(console.error);
            }
            membersToMove = [member];
        } else {
            // Check for user mentions in message
            if (message.mentions.members.size > 0) {
                membersToMove = Array.from(message.mentions.members.values()).filter(m => leftSide.includes(m.id));
            }

            // Fallback: search by nickname/username in the guild
            if (membersToMove.length === 0) {
                const guildMembers = await message.guild.members.fetch().catch(() => null);
                if (guildMembers) {
                    const searchName = leftSide.toLowerCase();
                    const matchedMember = guildMembers.find(m => 
                        m.user.username.toLowerCase() === searchName || 
                        (m.nickname && m.nickname.toLowerCase() === searchName)
                    );
                    if (matchedMember) {
                        membersToMove = [matchedMember];
                    }
                }
            }
        }

        // Filter active voice members
        const activeVoiceMembers = membersToMove.filter(m => m.voice && m.voice.channelId);

        if (activeVoiceMembers.length === 0) {
            return message.reply('Error: No active voice members found to move. Make sure they are in a voice channel.').catch(console.error);
        }

        const replyMsg = await message.reply(`Moving ${activeVoiceMembers.length} member(s) to <#${targetChannel.id}>...`).catch(console.error);

        // Move concurrently using Promise.all
        const movePromises = activeVoiceMembers.map(async (m) => {
            try {
                await m.voice.setChannel(targetChannel.id);
                return { success: true };
            } catch (err) {
                return { success: false, error: err };
            }
        });

        const results = await Promise.all(movePromises);
        const successfulMoves = results.filter(r => r.success).length;

        if (replyMsg) {
            await replyMsg.edit(`Successfully moved ${successfulMoves}/${activeVoiceMembers.length} member(s) to <#${targetChannel.id}>.`).catch(console.error);
        }
    }
};
