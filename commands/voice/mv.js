const { PermissionFlagsBits } = require('discord.js');

function resolveChannel(guild, input) {
    // 1. If it's a mention or raw ID, extract digits
    const cleanedId = input.replace(/\D/g, '');
    if (cleanedId) {
        const channel = guild.channels.cache.get(cleanedId);
        if (channel && channel.isVoiceBased()) {
            return channel;
        }
    }
    // 2. Otherwise search by partial name
    const lowerInput = input.toLowerCase();
    return guild.channels.cache.find(c => 
        c.isVoiceBased() && c.name.toLowerCase().includes(lowerInput)
    );
}

module.exports = {
    name: 'mv',
    description: 'Move members between voice channels.',
    usage: '?mv, ?mv @user to <Channel>, or ?mv all to <Channel>',
    async execute(message, args, config, settings) {
        // Check authorization (MoveMembers permission or Setup permit role)
        const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
        const isAuthorized = message.member.permissions.has(PermissionFlagsBits.MoveMembers) ||
                             (permitRoleId && message.member.roles.cache.has(permitRoleId));

        if (!isAuthorized) {
            return message.reply('❌ You do not have the required permissions to use this command.').catch(() => {});
        }

        const memberVoice = message.member.voice;
        if (!memberVoice.channel) {
            return message.reply('❌ You must be in a voice channel to use this command.').catch(() => {});
        }

        const callerChannel = memberVoice.channel;

        // CASE 1: ?mv (No args) -> Move everyone in caller's voice channel to default VC
        if (args.length === 0) {
            const defaultVcId = config.DEFAULT_VC_ID;
            if (!defaultVcId) {
                return message.reply('❌ Default Voice Channel is not configured in config.json.').catch(() => {});
            }

            const defaultChannel = message.guild.channels.cache.get(defaultVcId);
            if (!defaultChannel || !defaultChannel.isVoiceBased()) {
                return message.reply('❌ Configured Default Voice Channel is invalid or not voice-based.').catch(() => {});
            }

            const membersToMove = callerChannel.members;
            if (membersToMove.size === 0) {
                return message.reply('❌ No members in your channel to move.').catch(() => {});
            }

            let movedCount = 0;
            for (const [memberId, member] of membersToMove) {
                try {
                    await member.voice.setChannel(defaultChannel);
                    movedCount++;
                } catch (err) {
                    console.error(`Failed to move member ${member.user.tag}:`, err);
                }
            }

            return message.reply(`✅ Moved **${movedCount}** member(s) to <#${defaultChannel.id}>.`).catch(() => {});
        }

        const argString = args.join(' ');

        // CASE 2: ?mv all to <Channel>
        const matchAll = argString.match(/^all\s+to\s+(.+)$/i);
        if (matchAll) {
            const channelInput = matchAll[1];
            const targetChannel = resolveChannel(message.guild, channelInput);

            if (!targetChannel) {
                return message.reply(`❌ Could not resolve target voice channel for: \`${channelInput}\``).catch(() => {});
            }

            const membersToMove = callerChannel.members;
            let movedCount = 0;
            for (const [memberId, member] of membersToMove) {
                try {
                    await member.voice.setChannel(targetChannel);
                    movedCount++;
                } catch (err) {
                    console.error(err);
                }
            }

            return message.reply(`✅ Moved **${movedCount}** member(s) to <#${targetChannel.id}>.`).catch(() => {});
        }

        // CASE 3: ?mv @User to <Channel> (or User partial matching)
        const matchUser = argString.match(/^(.+?)\s+to\s+(.+)$/i);
        if (matchUser) {
            const userInput = matchUser[1];
            const channelInput = matchUser[2];

            // Resolve Target Member
            // Strip non-digits from mention if applicable
            const userIdClean = userInput.replace(/\D/g, '');
            let targetMember = null;
            
            if (userIdClean) {
                targetMember = await message.guild.members.fetch(userIdClean).catch(() => null);
            }

            if (!targetMember) {
                const lowerUser = userInput.toLowerCase();
                targetMember = message.guild.members.cache.find(m => 
                    m.user.username.toLowerCase().includes(lowerUser) || 
                    m.displayName.toLowerCase().includes(lowerUser)
                );
            }

            if (!targetMember) {
                return message.reply(`❌ Could not find user: \`${userInput}\``).catch(() => {});
            }

            if (!targetMember.voice.channel) {
                return message.reply(`❌ <@${targetMember.id}> is not currently in any voice channel.`).catch(() => {});
            }

            // Resolve target channel
            const targetChannel = resolveChannel(message.guild, channelInput);
            if (!targetChannel) {
                return message.reply(`❌ Could not resolve target voice channel for: \`${channelInput}\``).catch(() => {});
            }

            try {
                await targetMember.voice.setChannel(targetChannel);
                return message.reply(`✅ Moved <@${targetMember.id}> to <#${targetChannel.id}>.`).catch(() => {});
            } catch (err) {
                console.error(err);
                return message.reply('❌ Failed to move member. Check role/permission hierarchy.').catch(() => {});
            }
        }

        return message.reply(`❌ Invalid command format. Use:\n` +
                             `• \`${settings.prefix || '?'}mv\` (moves your VC to default)\n` +
                             `• \`${settings.prefix || '?'}mv @user to <Channel>\`\n` +
                             `• \`${settings.prefix || '?'}mv all to <Channel>\``).catch(() => {});
    }
};
