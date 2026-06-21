const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.json');

// Initialize database with default structure if missing
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultData = {
            users: {},
            nuke: {
                actions: {}
            },
            tickets: {
                counter: 0
            }
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    }
}

// Read database
function readDB() {
    initDB();
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[DB] Error reading database.json:', err);
        return { users: {}, nuke: { actions: {} }, tickets: { counter: 0 } };
    }
}

// Write database
function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('[DB] Error writing database.json:', err);
        return false;
    }
}

// Helper to fetch or create user data
function getUser(userId) {
    const db = readDB();
    if (!db.users[userId]) {
        db.users[userId] = {
            xp: 0,
            level: 0,
            lastMessageTimestamp: 0,
            roles: [],
            isJailed: false,
            strikes: 0
        };
    }
    return db.users[userId];
}

// Save specific user data
function saveUser(userId, userData) {
    const db = readDB();
    db.users[userId] = { ...getUser(userId), ...userData };
    return writeDB(db);
}

// Get all users
function getAllUsers() {
    const db = readDB();
    return db.users;
}

// Get ticket counter
function getTicketCounter() {
    const db = readDB();
    return db.tickets.counter || 0;
}

// Increment ticket counter
function incrementTicketCounter() {
    const db = readDB();
    db.tickets.counter = (db.tickets.counter || 0) + 1;
    writeDB(db);
    return db.tickets.counter;
}

// Get anti-nuke action log state
function getNukeState() {
    const db = readDB();
    return db.nuke.actions || {};
}

// Save anti-nuke action log state
function saveNukeState(actions) {
    const db = readDB();
    db.nuke.actions = actions;
    return writeDB(db);
}

module.exports = {
    getUser,
    saveUser,
    getAllUsers,
    getTicketCounter,
    incrementTicketCounter,
    getNukeState,
    saveNukeState
};
