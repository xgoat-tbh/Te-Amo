const Database = require('better-sqlite3');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const dbPath = path.join(__dirname, '..', 'te-amo.db');
const db = new Database(dbPath);

// Enable WAL mode for performance
db.pragma('journal_mode = WAL');

// Execute schemas on start-up
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT '?',
    log_channel_id TEXT,
    jail_role_id TEXT,
    auth_role_id TEXT,
    member_counter_channel_id TEXT
  );

  CREATE TABLE IF NOT EXISTS jailed_users (
    user_id TEXT PRIMARY KEY,
    old_roles TEXT
  );

  CREATE TABLE IF NOT EXISTS role_aliases (
    alias_name TEXT PRIMARY KEY,
    target_role_id TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    last_text_xp INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS monitored_vcs (
    channel_id TEXT PRIMARY KEY,
    milestone INTEGER,
    role_id TEXT,
    message TEXT,
    guild_id TEXT
  );
`);

// --- MIGRATION CHECK FOR ALIAS DESCRIPTION & COUNTER COLUMN ---
try {
    db.exec('ALTER TABLE guild_settings ADD COLUMN member_counter_channel_id TEXT;');
} catch (e) {
    // ignore if column exists
}

try {
    db.exec('ALTER TABLE role_aliases ADD COLUMN description TEXT;');
} catch (e) {
    // ignore if column exists
}

// --- GUILD SETTINGS FUNCTIONS ---
function getGuildSettings(guildId) {
    const stmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
    let settings = stmt.get(guildId);
    if (!settings) {
        // Insert defaults
        const insertStmt = db.prepare('INSERT INTO guild_settings (guild_id, prefix) VALUES (?, ?)');
        insertStmt.run(guildId, '?');
        settings = {
            guild_id: guildId,
            prefix: '?',
            log_channel_id: null,
            jail_role_id: null,
            auth_role_id: null,
            member_counter_channel_id: null
        };
    }
    return settings;
}

function updatePrefix(guildId, prefix) {
    getGuildSettings(guildId);
    const stmt = db.prepare('UPDATE guild_settings SET prefix = ? WHERE guild_id = ?');
    return stmt.run(prefix, guildId);
}

function updateSetup(guildId, logChannelId, jailRoleId, authRoleId, memberCounterChannelId) {
    getGuildSettings(guildId);
    const stmt = db.prepare(`
        UPDATE guild_settings 
        SET log_channel_id = ?, jail_role_id = ?, auth_role_id = ?, member_counter_channel_id = ? 
        WHERE guild_id = ?
    `);
    return stmt.run(logChannelId, jailRoleId, authRoleId, memberCounterChannelId, guildId);
}

// --- USER LEVELS FUNCTIONS ---
function getUserLevel(userId) {
    const stmt = db.prepare('SELECT * FROM user_levels WHERE user_id = ?');
    let user = stmt.get(userId);
    if (!user) {
        const insertStmt = db.prepare('INSERT INTO user_levels (user_id, xp, level, last_text_xp) VALUES (?, 0, 0, 0)');
        insertStmt.run(userId);
        user = {
            user_id: userId,
            xp: 0,
            level: 0,
            last_text_xp: 0
        };
    }
    return user;
}

function updateUserLevel(userId, xp, level, lastTextXp) {
    getUserLevel(userId);
    const stmt = db.prepare('UPDATE user_levels SET xp = ?, level = ?, last_text_xp = ? WHERE user_id = ?');
    return stmt.run(xp, level, lastTextXp, userId);
}

function getTopUsers(limit = 10) {
    const stmt = db.prepare('SELECT * FROM user_levels ORDER BY level DESC, xp DESC LIMIT ?');
    return stmt.all(limit);
}

// --- JAILED USERS FUNCTIONS ---
function getJailedUser(userId) {
    const stmt = db.prepare('SELECT * FROM jailed_users WHERE user_id = ?');
    return stmt.get(userId);
}

function jailUser(userId, oldRolesArray) {
    const oldRolesJson = JSON.stringify(oldRolesArray);
    const stmt = db.prepare('INSERT OR REPLACE INTO jailed_users (user_id, old_roles) VALUES (?, ?)');
    return stmt.run(userId, oldRolesJson);
}

function unjailUser(userId) {
    const stmt = db.prepare('DELETE FROM jailed_users WHERE user_id = ?');
    return stmt.run(userId);
}

// --- ROLE ALIASES FUNCTIONS ---
function getAlias(aliasName) {
    const stmt = db.prepare('SELECT * FROM role_aliases WHERE alias_name = ?');
    return stmt.get(aliasName);
}

function getAliasByRole(roleId) {
    const stmt = db.prepare('SELECT * FROM role_aliases WHERE target_role_id = ?');
    return stmt.get(roleId);
}

function createAlias(aliasName, targetRoleId, description = '') {
    const stmt = db.prepare('INSERT OR REPLACE INTO role_aliases (alias_name, target_role_id, description) VALUES (?, ?, ?)');
    return stmt.run(aliasName, targetRoleId, description);
}

function getAllAliases() {
    const stmt = db.prepare('SELECT * FROM role_aliases');
    return stmt.all();
}

function removeAlias(aliasName) {
    const stmt = db.prepare('DELETE FROM role_aliases WHERE alias_name = ?');
    return stmt.run(aliasName);
}

// --- MONITORED VCS FUNCTIONS ---
function getMonitoredVcs(guildId) {
    const stmt = db.prepare('SELECT * FROM monitored_vcs WHERE guild_id = ?');
    return stmt.all(guildId);
}

function getMonitoredVc(channelId) {
    const stmt = db.prepare('SELECT * FROM monitored_vcs WHERE channel_id = ?');
    return stmt.get(channelId);
}

function addMonitoredVc(channelId, milestone, roleId, message, guildId) {
    const stmt = db.prepare('INSERT OR REPLACE INTO monitored_vcs (channel_id, milestone, role_id, message, guild_id) VALUES (?, ?, ?, ?, ?)');
    return stmt.run(channelId, milestone, roleId, message, guildId);
}

function removeMonitoredVc(channelId) {
    const stmt = db.prepare('DELETE FROM monitored_vcs WHERE channel_id = ?');
    return stmt.run(channelId);
}

// --- DYNAMIC AUTOMATIC JAIL SYSTEM INITIALIZER ---
async function ensureJailSystem(guild) {
    let settings = getGuildSettings(guild.id);
    let jailRoleId = settings.jail_role_id;
    let jailRole = jailRoleId ? guild.roles.cache.get(jailRoleId) : null;

    // 1. Resolve or create Jailed role
    if (!jailRole) {
        jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jailed');
        if (!jailRole) {
            jailRole = await guild.roles.create({
                name: 'Jailed',
                permissions: [],
                reason: 'Auto-created Jailed role by Te-Amo'
            });
        }
        // Save jail role ID in settings
        db.prepare('UPDATE guild_settings SET jail_role_id = ? WHERE guild_id = ?').run(jailRole.id, guild.id);
    }

    // 2. Resolve or create Category
    let category = guild.channels.cache.find(c => c.name === 'JAIL' && c.type === ChannelType.GuildCategory);
    if (!category) {
        category = await guild.channels.create({
            name: 'JAIL',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: jailRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak
                    ]
                }
            ]
        });
    }

    // 3. Resolve or create prison-text
    let prisonText = guild.channels.cache.find(c => c.name === 'prison-text' && c.parentId === category.id && c.type === ChannelType.GuildText);
    if (!prisonText) {
        prisonText = await guild.channels.create({
            name: 'prison-text',
            type: ChannelType.GuildText,
            parent: category.id
        });
    }

    // 4. Resolve or create prison voice
    let prisonVoice = guild.channels.cache.find(c => c.name === 'prison' && c.parentId === category.id && c.type === ChannelType.GuildVoice);
    if (!prisonVoice) {
        prisonVoice = await guild.channels.create({
            name: 'prison',
            type: ChannelType.GuildVoice,
            parent: category.id
        });
    }

    // 5. Hide other channels in the guild from the Jailed role
    for (const [id, channel] of guild.channels.cache) {
        // Skip JAIL category and channels inside it
        if (channel.id === category.id || channel.parentId === category.id) {
            continue;
        }

        try {
            await channel.permissionOverwrites.create(jailRole, {
                [PermissionFlagsBits.ViewChannel]: false
            });
        } catch (err) {
            // Ignore permission overwrite errors on channels we cannot modify
        }
    }

    return { jailRole, category, prisonText, prisonVoice };
}

module.exports = {
    db,
    getGuildSettings,
    updatePrefix,
    updateSetup,
    getUserLevel,
    updateUserLevel,
    getTopUsers,
    getJailedUser,
    jailUser,
    unjailUser,
    getAlias,
    getAliasByRole,
    createAlias,
    getAllAliases,
    removeAlias,
    getMonitoredVcs,
    getMonitoredVc,
    addMonitoredVc,
    removeMonitoredVc,
    ensureJailSystem
};
