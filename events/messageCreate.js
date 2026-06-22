const { Events, EmbedBuilder } = require('discord.js');
const dbSetup = require('../database/dbSetup');
const { updateMilestoneRoles } = require('./ready');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client, config) {
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const userId = message.author.id;
        const now = Date.now();

        // 1. Retrieve dynamic settings
        const settings = dbSetup.getGuildSettings(guildId);
        const prefix = settings.prefix || '?';

        // 2. Grinding Leveling Ecosystem (XP on message)
        const userData = dbSetup.getUserLevel(userId);
        const cooldown = 60000; // 60 seconds structural cooldown

        if (now - userData.last_text_xp >= cooldown) {
            const xpGained = Math.floor(Math.random() * 11) + 15; // 15-25 XP
            let xpToSave = (userData.xp || 0) + xpGained;
            let levelToSave = userData.level || 0;

            let nextXpNeeded = Math.floor(100 * Math.pow(levelToSave, 2.5));
            if (levelToSave === 0) nextXpNeeded = 100;

            let leveledUp = false;

            while (xpToSave >= nextXpNeeded) {
                xpToSave -= nextXpNeeded;
                levelToSave++;
                nextXpNeeded = Math.floor(100 * Math.pow(levelToSave, 2.5));
                if (levelToSave === 0) nextXpNeeded = 100;
                leveledUp = true;

                // Send level up notice
                const embed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle('🎉 Level Up!')
                    .setDescription(`Congratulations <@${userId}>! You've reached **Level ${levelToSave}**! 🚀`)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                const lvlMsg = await message.channel.send({ embeds: [embed] }).catch(() => null);
                if (lvlMsg) {
                    setTimeout(() => lvlMsg.delete().catch(() => {}), 10000);
                }
            }

            dbSetup.updateUserLevel(userId, xpToSave, levelToSave, now);

            if (leveledUp) {
                await updateMilestoneRoles(message.member, levelToSave);
            }
        }

        // 3. Command check
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // 4. Role Alias Protocol Check
        const aliasRecord = dbSetup.getAlias(commandName);
        if (aliasRecord) {
            // Check if user has either the setup auth role or the config.json permit role
            const permitRoleId = settings.auth_role_id || config.CAN_PROMOTE_ROLE_ID;
            const hasPermit = permitRoleId && message.member.roles.cache.has(permitRoleId);

            if (!hasPermit) {
                return message.reply('❌ You do not possess the designated authorization role to invoke role aliases.').catch(() => {});
            }

            // Resolve target user
            const targetMember = message.mentions.members.first() || 
                                 (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

            if (!targetMember) {
                return message.reply(`❌ Please specify a user to toggle this alias on: \`${prefix}${commandName} @user\``).catch(() => {});
            }

            const targetRoleId = aliasRecord.target_role_id;
            const role = message.guild.roles.cache.get(targetRoleId);
            if (!role) {
                return message.reply('❌ Target role associated with this alias was not found in the server.').catch(() => {});
            }

            // Toggle role
            try {
                const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);
                if (botMember.roles.highest.position <= role.position) {
                    return message.reply(`❌ Cannot toggle role: **${role.name}** is higher than or equal to the bot's highest role.`).catch(() => {});
                }

                if (targetMember.roles.cache.has(targetRoleId)) {
                    await targetMember.roles.remove(targetRoleId, `Role alias toggle by ${message.author.tag}`);
                    return message.reply(`✅ Removed role **${role.name}** from <@${targetMember.id}>.`);
                } else {
                    await targetMember.roles.add(targetRoleId, `Role alias toggle by ${message.author.tag}`);
                    return message.reply(`✅ Added role **${role.name}** to <@${targetMember.id}>.`);
                }
            } catch (err) {
                console.error(`[Alias Toggle Error] Alias: ${commandName}`, err);
                return message.reply('❌ Failed to toggle role due to an internal error or missing permissions.').catch(() => {});
            }
        }

        // 5. Standard Command Processing
        const command = client.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(message, args, config, settings);
        } catch (error) {
            console.error(`Error executing standard command "${prefix}${commandName}":`, error);
            message.reply('❌ There was an error trying to execute that command!').catch(() => {});
        }
    }
};
