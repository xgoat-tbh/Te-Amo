const Database = require('better-sqlite3');
const path = require('path');

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
    auth_role_id TEXT
  );

  CREATE TABLE IF NOT EXISTS jailed_users (
    user_id TEXT PRIMARY KEY,
    old_roles TEXT
  );

  CREATE TABLE IF NOT EXISTS role_aliases (
    alias_name TEXT PRIMARY KEY,
    target_role_id TEXT
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    last_text_xp INTEGER DEFAULT 0
  );
`);

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
            auth_role_id: null
        };
    }
    return settings;
}

function updatePrefix(guildId, prefix) {
    // Ensure row exists
    getGuildSettings(guildId);
    const stmt = db.prepare('UPDATE guild_settings SET prefix = ? WHERE guild_id = ?');
    return stmt.run(prefix, guildId);
}

function updateSetup(guildId, logChannelId, jailRoleId, authRoleId) {
    // Ensure row exists
    getGuildSettings(guildId);
    const stmt = db.prepare(`
        UPDATE guild_settings 
        SET log_channel_id = ?, jail_role_id = ?, auth_role_id = ? 
        WHERE guild_id = ?
    `);
    return stmt.run(logChannelId, jailRoleId, authRoleId, guildId);
}

// --- USER LEVELS FUNCTIONS ---
function getUserLevel(userId) {
    const stmt = db.prepare('SELECT * FROM user_levels WHERE user_id = ?');
    let user = stmt.get(userId);
    if (!user) {
        // Insert defaults
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
    // Ensure user row exists
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

function createAlias(aliasName, targetRoleId) {
    const stmt = db.prepare('INSERT OR REPLACE INTO role_aliases (alias_name, target_role_id) VALUES (?, ?)');
    return stmt.run(aliasName, targetRoleId);
}

module.exports = {
    db, // raw database handle in case needed
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
    createAlias
};
