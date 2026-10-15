# MediaTok Economy Bot

A standalone Discord.js character-collecting economy bot inspired by collection games but themed around **MediaTok**: anime, manga, light novels, webnovels, movies, TV shows, video games, and books. It contains a curated starter roster of 136 characters with no NSFW/lolicon entries. No external media API key is required.

## Setup on Windows

1. Click **Code → Download ZIP** on this GitHub repository, extract it, and open the extracted project folder.
2. Install **Node.js 20.11 or newer** from https://nodejs.org.
3. Create a **new bot application** at https://discord.com/developers/applications and copy its bot token.
4. In the project folder, make a copy of `.env.example` and name the copy `.env`. Set:
   - `TOKEN`: your new Discord bot token
   - `CLIENT_ID`: Application ID from the Developer Portal
   - `GUILD_ID`: your Discord server ID (enable Developer Mode in Discord and right-click your server to copy ID).
5. In the Developer Portal, use the **Installation** section to invite your bot with the `bot` and `applications.commands` scopes. Give it permission to view channels, send messages, and embed links.
6. Double-click `START-BOT.bat`, or open CMD in the project folder and run:

```cmd
npm install
npm start
```

7. In Discord, run **/economyhelp**, **/daily**, and **/roll**.

**IMPORTANT:** Do not publish your real `.env` or bot token to GitHub. Bot data is stored in `data/store.json`; make regular backups. Many free hosts delete local files on redeployment; choose persistent storage or restore a backup. Your existing moderation bot is not modified.

## All 15 slash commands

| Command | Use |
| --- | --- |
| `/roll [medium]` | Roll in any category (20 MediaCoins, 25-second cooldown) |
| `/claim [roll_id]` | Claim the latest active character in a channel |
| `/daily` | Daily reward and streak |
| `/balance [user]` | See MediaCoins |
| `/collection [user] [medium] [page]` | Browse your characters |
| `/wishlist add/remove/show` | Manage your wishlist |
| `/sell` | Sell an owned character for 65% of value |
| `/favorite` | Feature a character on your profile |
| `/trade offer/accept/decline` | Gift or swap characters |
| `/pay` | Send another player MediaCoins |
| `/leaderboard` | Rank by balance, characters, or XP |
| `/profile` | See your collection profile |
| `/catalog search/stats` | Browse the roster |
| `/shop view/buy-luck` | Buy a temporary rarity boost |
| `/economyhelp` | See game rules |

Rolls remain claimable for 90 seconds. Claims have a 10-minute personal cooldown. Ownership and leaderboards are isolated by Discord server. Trades expire after 15 minutes. There are no real-money purchases or payouts.

## Developing

Use `npm test` to run the game logic tests and `npm run check` for JavaScript syntax checks.

**No character images are bundled** with the starter roster; future artwork integration should use permitted image sources and appropriate safety filtering.
