# Te-Amo Discord Bot - Modular Edition

A production-ready, highly secure, and modular Discord bot built with `discord.js` v14.

## Project Structure

```
/Te-Amo
├── /commands
│   ├── /admin
│   │   └── setup.js
│   ├── /general
│   │   └── help.js
│   └── /voice
│       └── mv.js
├── /events
│   ├── ready.js
│   ├── messageCreate.js
│   ├── voiceStateUpdate.js
│   ├── guildMemberAdd.js
│   ├── guildMemberRemove.js
│   ├── guildAuditLogEntryCreate.js
│   └── memberCounter.js       <-- Rate-limiting helper
├── /security
│   ├── antiNuke.js
│   └── antiPromo.js
├── /utils
│   └── gameMessages.js        <-- Randomized game alerts database
├── config.json
├── package.json
└── README.md
```

## Features

1. **Dynamic Multi-Game VC Ping Tracker**: Monitors Voice Channels listed in the `monitored_channels` config block.
   - All alerts are routed to a **single global gaming text channel** (`GAMING_PINGS_CHANNEL_ID`).
   - Automatically ignores pings for excluded voice channels (e.g. channels containing `pc games`, `browser games`, or `activity games` in their names).
   - Generates a **randomized gaming alert message** from a database of 10 custom, game-specific messages (e.g. for *Among Us*, *Monopoly*, *Skribble*, *BGMI*, *Codenames*, *Smashkarts*, *Stumble Guys*, *Call of Duty*, *Valorant*, or *Generic Games*).
   - Posts a visually appealing alert combining:
     - The role mention: `<@&ROLE_ID>`
     - Emojis, custom text, and Voice Channel mention: `🎮 🔴 > [Random Message] > <#VC_ID>`
     - Direct voice channel URL link to render Discord's native **"Join Voice"** button card.
     - A custom Discord Embed showcasing lobby details and join prompts.
2. **Advanced Move Command (`!mv`)**: Moves members concurrently using `Promise.all` with robust regex parsing:
   - `!mv` - Moves everyone in caller's voice channel to the default monitored VC.
   - `!mv @User to <Channel>` - Moves specified users to a target voice channel.
   - `!mv all to <Channel>` - Moves everyone in caller's voice channel to a target voice channel.
3. **Live User Counter**: Dynamically renames a voice channel (e.g. `📊 Members: 1,024`) as members join/leave the guild. Integrates a smart 10-minute rate-limiting queue to bypass Discord's rename limits.
4. **Auto-Moderation (Anti-Promotion)**: Identifies invite and URL links. Admin users are bypassed via permissions or the `CAN_PROMOTE_ROLE_ID`. Employs warning alerts followed by a 10-minute timeout for repeat offences.
5. **Ironclad Anti-Nuke System**: Monitors audit logs for mass channel deletions, member kicks, and bans. Admin accounts exceeding the rate threshold within the configured timeframe are immediately stripped of all roles to secure the guild.

## Configuration Guide (`config.json`)

Configure your server credentials in [config.json](file:///D:/Te-Amo/config.json):

```json
{
  "BOT_TOKEN": "YOUR_BOT_TOKEN_HERE",
  "CAN_PROMOTE_ROLE_ID": "YOUR_CAN_PROMOTE_ROLE_ID_HERE",
  "MEMBER_COUNT_VC_ID": "YOUR_MEMBER_COUNT_VC_ID_HERE",
  "SECURE_ADMIN_LOG_CHANNEL_ID": "YOUR_SECURE_ADMIN_LOG_CHANNEL_ID_HERE",
  "GAMING_PINGS_CHANNEL_ID": "YOUR_GAMING_PINGS_CHANNEL_ID_HERE",
  "ANTI_NUKE_THRESHOLD": 3,
  "ANTI_NUKE_TIMEFRAME_MS": 60000,
  "monitored_channels": {
    "VOICE_CHANNEL_ID": {
      "gameName": "Among Us",
      "roleId": "ROLE_ID_TO_PING",
      "targetCount": 2
    }
  }
}
```

### Setup Commands (Admin Only)

Configure settings dynamically using in-Discord prefix commands:

- `!setup status`: Show current config values.
- `!setup bypassrole <role_id_or_mention>`: Set bypass role ID for link filters.
- `!setup countervc <vc_id_or_mention>`: Set target voice channel ID for the member counter.
- `!setup logchannel <channel_id_or_mention>`: Set channel ID for security lockdown alerts.
- `!setup pingschannel <channel_id_or_mention>`: Set the global gaming pings text channel.
- `!setup trackvc <vc_id> <targetCount> <roleId> <gameName>`: Adds/updates a tracked voice channel.
- `!setup untrackvc <vc_id>`: Removes a voice channel from the tracker list.

## Starting the Bot

Install dependencies:
```bash
npm install
```

Start the bot:
```bash
npm start
```
