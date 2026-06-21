# Te-Amo Discord Bot - Modular Edition

A production-ready, highly secure, and modular Discord bot built with `discord.js` v14.

## Project Structure

```
/Te-Amo
├── /commands
│   ├── /admin
│   │   ├── settings.js        <-- Security settings dashboard
│   │   └── setup.js           <-- Configuration dashboard
│   ├── /general
│   │   └── help.js
│   └── /voice
│       └── mv.js
├── /events
│   ├── ready.js               <-- Sets RPC status to "playing amo.gg"
│   ├── messageCreate.js
│   ├── voiceStateUpdate.js
│   ├── guildMemberAdd.js
│   ├── guildMemberRemove.js
│   ├── guildAuditLogEntryCreate.js
│   ├── interactionCreate.js   <-- Dashboard interactions (Warning fix: MessageFlags.Ephemeral)
│   └── memberCounter.js       <-- Rate-limiting helper
├── /security
│   ├── antiNuke.js            <-- Configurable punishments (Jail VC, Ban, Kick, Strip Roles)
│   └── antiPromo.js           <-- Dynamic warning strikes and mutes
├── /utils
│   └── gameMessages.js        <-- Randomized game alerts database
│   └── prisonHelper.js        <-- Prison VC creation & mapping module
├── config.json
├── package.json
└── README.md
```

## Features

1. **Rich Presence Status**: Automatically displays a custom status of **"Playing amo.gg"** for the bot.
2. **Dynamic Multi-Game VC Ping Tracker**: Monitors Voice Channels listed in the `monitored_channels` config block.
   - All alerts are routed to a **single global gaming text channel** (`GAMING_PINGS_CHANNEL_ID`).
   - Automatically ignores pings for excluded voice channels (e.g. channels containing `pc games`, `browser games`, or `activity games` in their names).
   - Generates a **randomized gaming alert message** from a database of 10 custom, game-specific messages.
   - Posts a visually appealing alert combining:
     - The role ping: `<@&ROLE_ID>`
     - Emojis, custom text, and Voice Channel mention: `🎮 🔴 > [Random Message] > <#VC_ID>`
     - Direct voice channel URL link to render Discord's native **"Join Voice"** button card.
     - A custom Discord Embed showcasing lobby details and join prompts.
3. **Advanced Move Command (`!mv`)**: Moves members concurrently using `Promise.all` with robust regex parsing:
   - `!mv` - Moves everyone in caller's voice channel to the default monitored VC.
   - `!mv @User to <Channel>` - Moves specified users to a target voice channel.
   - `!mv all to <Channel>` - Moves everyone in caller's voice channel to a target voice channel.
4. **Live User Counter**: Dynamically renames a voice channel (e.g. `📊 Members: 1,024`) as members join/leave the guild. Integrates a smart 10-minute rate-limiting queue to bypass Discord's rename limits.
5. **Auto-Moderation (Anti-Promotion)**: Identifies invite and URL links. Admin users are bypassed via permissions or the `CAN_PROMOTE_ROLE_ID`. Supports customizable warning strikes and mute/timeout durations with role hierarchy protection.
6. **Ironclad Anti-Nuke System**: Monitors audit logs for mass channel deletions, member kicks, and bans. Rogue admins exceeding the rate threshold are immediately punished according to server configurations:
   - **`Jail Rogue Admin` (Recommended)**: Strips all roles from the rogue admin, applies the `Jailed` role, locks them in the Prison Voice Channel, and sends instant DM notifications to all server moderators informing them of the lockdown.
   - `Strip Roles`: Strips all roles from the rogue admin.
   - `Ban Rogue Admin`: Bans rogue admin immediately from the guild.
   - `Kick Rogue Admin`: Kicks rogue admin from the guild.
   - `Log Only`: Sends log warning without enforcing punishment.
   - **Robust Hierarchy Protection**: If the target admin has a higher/equal role than the bot, the bot logs a critical hierarchy failure in the security log channel and sends urgent warning DMs to all other administrators.

---

## Configuration & Dashboards (Admin Only)

Configure settings dynamically using interactive dashboards directly inside your Discord server.

### 1. Setup Dashboard (`!setup`)
Run `!setup` in any text channel to configure target channels and roles:
- Use dropdown menus to set the anti-promo bypass role, member counter VC, global gaming pings channel, and security log channel.
- **➕ Track**: Adds a monitored VC through a modal form.
- **✏️ Edit**: Pre-populates a modal form with current VC details for easy editing.
- **➖ Untrack**: Removes a monitored VC via a dropdown selection list.
- **🏛️ Setup Prison**: Verifies if jail roles and channels already exist. If they do, they are linked in the setup status. If they do not, the bot automatically creates:
  - A `Jailed` role with no default guild permissions.
  - A Category named `JAIL` hidden from `@everyone` but readable by `Jailed`.
  - A **Voice Channel** named `prison` inside the category. Jailed members are restricted to only this Voice Channel.
- **🔒 Done**: Locks and disables the setup dashboard components.

### 2. Security Dashboard (`!settings`)
Run `!settings` in any text channel to configure security parameters:
- **Anti-Nuke Punishment Action**: Choose between Jail, Strip Roles, Ban, Kick, or Log Only.
- **Anti-Nuke Threshold**: Choose the action limit (2, 3, 5, or 10 actions/min).
- **Anti-Promo strikes limit**: Choose strikes before timeout (1, 2, or 3 strikes).
- Click **⏱️ Set Action Timeframe** to input the Anti-Nuke timeframe in seconds.
- Click **⏳ Set Mute Duration** to input the Anti-Promo timeout duration in minutes.
- Click **🔒 Done** to lock the settings dashboard.

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
