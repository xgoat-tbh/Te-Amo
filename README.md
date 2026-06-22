# Amo India Discord Bot - Modular SQLite Edition

A production-ready, highly modular, and secure Discord bot built with `discord.js` v14. Using `better-sqlite3` for local state storage, it implements a leveling system, specialized moderation and jail structures, role alias protocols, dynamic help guides, confessions, suggestions, fun commands, and advanced voice channel movement utilities.

---

## Directory Structure

```
/Amo-India
├── /database
│   └── dbSetup.js           <-- SQLite table schemas, migrations, and CRUD functions
├── /commands
│   ├── /moderation
│   │   ├── kick.js          <-- Kick command
│   │   ├── ban.js           <-- Ban command
│   │   ├── mute.js          <-- Mute / Timeout command (smart duration)
│   │   ├── jail.js          <-- Jail command (persists on leave/rejoin)
│   │   └── unjail.js        <-- Unjail command
│   ├── /voice
│   │   └── mv.js            <-- Advanced voice channel movement relocator
│   ├── /admin
│   │   ├── reset.js         <-- Purge database completely (Owner-only)
│   │   ├── shift.js         <-- Migrate bot to new server via invite (Owner-only)
│   │   ├── trackvc.js       <-- Monitor VC player milestone pings
│   │   └── untrackvc.js     <-- Disable VC milestone monitoring
│   ├── /fun
│   │   ├── 8ball.js         <-- Magic 8-ball question RNG
│   │   ├── coinflip.js      <-- Coinflip RNG
│   │   ├── hug.js           <-- Target hug anime GIF embed
│   │   ├── kiss.js          <-- Target kiss anime GIF embed
│   │   └── slap.js          <-- Target slap anime GIF embed
│   └── /utility
│       ├── rank.js          <-- Display level, XP, and rank progress bar
│       ├── leaderboard.js   <-- Display top 10 users ranked by level/XP
│       ├── alias.js         <-- Manage role phrase aliases with custom descriptions
│       ├── embed.js         <-- Discohook JSON payload embed sender
│       ├── confession.js    <-- DM-based interactive confessions
│       ├── suggest.js       <-- Suggestion box and approval/rejection manager
│       └── help.js          <-- Dynamic categorizer & detailed command helper
├── /events
│   ├── ready.js             <-- Slash registrations, voice XP checks, counter sync
│   ├── messageCreate.js     <-- Prefix handler, text XP checks, role alias matches
│   ├── interactionCreate.js <-- Slash setups (interactive dropdown panel) and settings routing
│   ├── voiceStateUpdate.js  <-- Game VC milestone pings and anti-abuse maps
│   ├── guildMemberAdd.js    <-- Rejoin anti-jail check and member count updates
│   ├── guildMemberRemove.js <-- Member count updates
│   └── channelCreate.js     <-- Override permissions on new channels for Jailed role
├── config.json              <-- Static configurations & monitored voice maps
├── te-amo.db                <-- SQLite relational database file
├── index.js                 <-- Client bootstrap & recursive command loading
└── package.json
```

---

## Key Features

### 1. SQLite Relational Database Storage
Uses `better-sqlite3` for local, lightweight database operations. Contains these tables:
- `guild_settings`: Guild prefixes, logging channel, jail role, permit role, member counter channel, confession channel, suggestion channel, and 10 milestone role levels.
- `jailed_users`: Traced user IDs of jailed members to prevent jail evasion on rejoin.
- `role_aliases`: Text shortcuts mapped directly to role IDs with custom descriptions.
- `user_levels`: Level and XP records along with structural message cooldowns.
- `monitored_vcs`: Active VC voice milestones, target pings, and roles.
- `suggestions`: Log of submitted suggestions, message IDs, author IDs, and status.

### 2. Hardcore Leveling Ecosystem
- **Mathematical Grind**: Progression is calculated using the exponential formula:
  $$XP = 100 \times \text{Level}^{2.5}$$
- **Chat Engagement**: 15–25 XP granted randomly per message. Includes a strict 60-second cooldown tracked in the database (`last_text_xp`) to prevent spam farming.
- **Active Voice Check**: Loops every 5 minutes and awards 10 XP to users in VCs. Members who are self-muted, self-deafened, server-muted, or server-deafened are disqualified.
- **Milestone Role Swapping**: Automatic milestones corresponding to:
  * Level 1: Commoner | Level 5: Elite | Level 10: Professional | Level 15: Master | Level 20: Veteran | Level 30: Legend | Level 40: Mythic | Level 50: Zenith | Level 75: Ascendant | Level 100: Grandmaster
  * Strips lower milestone roles on level-up to prevent profile bloating.
- **Level Commands**: `?rank [@user]` (detailed progress bar, current XP/needed XP, and leaderboard rank) and `?leaderboard` (top 10 server rank list).

### 3. Specialized Moderation & Jail Systems
- **Commands**: `?kick @user [reason]`, `?ban @user [reason]`, `?mute @user <duration> [reason]` (native Discord mutes parsing durations like `10m`, `2h`, `1d`).
- **Secure Jail System**:
  - `?jail @user`: Adds the Jailed role, strips manageable roles, and backs up their status.
  - `?unjail @user`: Manually strips Jailed role and restores original manageable roles.
  - **Rejoin Protection**: Triggers on `guildMemberAdd` to re-apply the jail status if a user leaves and rejoins.
  - **New Channel Lockdown**: Triggers on `channelCreate` to automatically block the Jailed role from viewing newly created channels.

### 4. Interactive Slash Configuration & Setup
- `/setup core`: Triggers an interactive setup panel featuring custom Discord dropdown menus and action buttons. Allows configuration of:
  - **Logging Channel** (Filtered to text channels)
  - **Jail Role** (Excludes `@everyone`)
  - **Permit/Authorization Role** (Excludes `@everyone`)
- `/setup channels`: Triggers an interactive panel to configure features channels:
  - **Member Counter Channel** (Filtered to voice channels)
  - **Confession Channel** (Filtered to text channels)
  - **Suggestion Channel** (Filtered to text channels)
- `/setup leveling`: Set the 10 role options for the leveling milestone tiers (Level 1, 5, 10, 15, 20, 30, 40, 50, 75, 100) dynamically stored in the SQLite database.
- `/settings`: Settings command to edit configuration values individually.

### 5. Advanced Features & Systems
- **Confession Portal (`?confession`)**: Instantly deletes the trigger message. DMs the user with interactive buttons to choose between Anonymous and Public modes, collects the confession text, and posts it to the configured confession channel.
- **Suggestion System (`?suggest`)**: Creates a pending suggestion card in the suggestions channel with upvote/downvote reactions. Moderators can run `?suggest respond <id> <approve/reject> <reason>` to update the status, which dynamically changes the embed color and appends mod notes.
- **Fun Package**: Includes interactive commands like `?8ball <question>`, `?coinflip`, `?hug @user`, `?kiss @user`, and `?slap @user` with anime GIF integrations.

### 6. Guild Migration & Database Purge Commands
- `?shift`: Owner-only migration utility. Asks the owner to supply a server invite link, resolves it to verify server existence, provides bot authorize URLs, and wipes the *current* guild settings and channel mappings from SQLite (preserving level progress).
- `?reset`: Owner-only purge utility. Prompts for absolute confirmation and wipes all SQLite tables completely.

### 7. Utilities & Movement
- **Voice Movements (`?mv`)**: Moves caller VC, user to channel, or all to channel using regex matches to resolve IDs, mentions, or partial names.
- **Lobby VC Tracker**: Fires text invite cards when VC user counts hit monitored milestones, with a 15-minute abuse rate limit.
- **Discohook Loader**: Sends embeds from complex Discohook JSON payloads.
- **Detailed Help**: Dynamic, permission-aware helper. Restricts list and lookup of administrative/moderation commands to authorized members only.

---

## Starting the Bot

Install dependencies:
```bash
npm install
```

Start the bot:
```bash
npm start
```
