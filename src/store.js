import fs from 'node:fs';
import path from 'node:path';

const defaultPath = path.resolve(process.env.DATABASE_PATH || 'data/store.json');

export class Store {
  constructor(filePath = defaultPath) {
    this.filePath = path.resolve(filePath);
    this.data = { version: 1, guilds: {} };
    if (fs.existsSync(this.filePath)) {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (parsed?.version !== 1 || typeof parsed.guilds !== 'object' || !parsed.guilds) {
        throw new Error('Unsupported or corrupt economy save format; restore your backup.');
      }
      this.data = parsed;
    }
  }
  guild(id) {
    if (!this.data.guilds[id]) this.data.guilds[id] = {players: {}, claimed: {}, spawns: {}, trades: {}};
    return this.data.guilds[id];
  }
  player(guild, id) {
    if (!guild.players[id]) guild.players[id] = {
      coins: 350, collection: [], wishlist: [], favorite: null,
      lastRoll: 0, lastClaim: 0, lastDaily: 0, dailyStreak: 0,
      luckUntil: 0, xp: 0, rolls: 0, totalClaims: 0, trades: 0
    };
    return guild.players[id];
  }
  save() {
    fs.mkdirSync(path.dirname(this.filePath), {recursive: true});
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), {mode: 0o600});
    fs.renameSync(tmp, this.filePath);
  }
}
