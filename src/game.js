import { randomInt, randomBytes } from 'node:crypto';
import { CATALOG, BY_ID, RARITIES } from './catalog.js';

export const CONFIG = {
  rollCooldownMs: 25_000,
  claimCooldownMs: 10 * 60_000,
  dailyCooldownMs: 24 * 60 * 60_000,
  spawnLifetimeMs: 90_000,
  tradeLifetimeMs: 15 * 60_000,
  rollCost: 20,
  shopLuckPrice: 600,
  shopLuckDurationMs: 30 * 60_000
};
const fail = message => ({ok:false,message});
const pass = (message,extra={})=>({ok:true,message,...extra});
const pick = arr => arr[randomInt(arr.length)];

export function clock(ms) {
  const s = Math.max(0,Math.ceil(ms/1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s/60),r=s%60;
  if(m<60) return `${m}m${r ? ` ${r}s` : ''}`;
  const h=Math.floor(m/60);
  return `${h}h${m%60 ? ` ${m%60}m` : ''}`;
}
export function chooseCharacter(guild, type = 'all', lucky = false, rng = Math.random) {
  const pending = new Set(Object.values(guild.spawns || {}).filter(s => !s.claimedBy && s.expiresAt > Date.now()).map(s => s.charId));
  const pool = CATALOG.filter(c => (type === 'all'||c.type === type) && !guild.claimed[c.id] && !pending.has(c.id));
  if (!pool.length) return null;
  const tierTotals = new Map();
  for (const c of pool) tierTotals.set(c.rarity,(tierTotals.get(c.rarity)||0)+1);
  const weights = Object.entries(RARITIES)
    .filter(([tier])=>tierTotals.has(tier))
    .map(([tier,v])=>({tier,weight:v.weight * (lucky && ['rare','epic','legendary','mythic'].includes(tier) ? 2.5:1)}));
  const sum=weights.reduce((n,x)=>n+x.weight,0);
  let r = rng()*sum;
  const tier=weights.find(x => (r -= x.weight) < 0)?.tier ?? weights.at(-1).tier;
  return pick(pool.filter(c=>c.rarity===tier));
}
export function performRoll(store, guildId, playerId, type='all', channelId='', now=Date.now()) {
  const g=store.guild(guildId), p=store.player(g,playerId);
  if(now-p.lastRoll < CONFIG.rollCooldownMs) return fail(`Roll cooldown: ${clock(CONFIG.rollCooldownMs-(now-p.lastRoll))}.`);
  if(p.coins<CONFIG.rollCost) return fail(`You need **${CONFIG.rollCost} MediaCoins** to roll. Use /daily.`);
  const char=chooseCharacter(g,type,p.luckUntil>now);
  if(!char) return fail('All characters in that category are currently owned in this server. Try another category or wait for players to sell.');
  const id=randomBytes(7).toString('hex');
  const spawn={id,charId:char.id,channelId,rolledBy:playerId,expiresAt:now+CONFIG.spawnLifetimeMs,claimedBy:null};
  g.spawns[id]=spawn;
  p.coins-=CONFIG.rollCost;
  p.lastRoll=now;
  p.rolls++;
  for(const [key,s] of Object.entries(g.spawns)) if(s.expiresAt < now - 3_600_000) delete g.spawns[key];
  store.save();
  return pass('A character appeared!',{spawn,char,balance:p.coins});
}
export function claimSpawn(store,guildId,playerId,spawnId,channelId,now=Date.now()) {
  const g=store.guild(guildId), p=store.player(g,playerId),s=g.spawns[spawnId];
  if(!s || s.channelId!==channelId) return fail('This roll is no longer available.');
  if(s.claimedBy) return fail('Someone already claimed this character.');
  if(s.expiresAt<=now) return fail('This roll expired.');
  if(now-p.lastClaim<CONFIG.claimCooldownMs) return fail(`You can claim again in ${clock(CONFIG.claimCooldownMs-(now-p.lastClaim))}.`);
  const char=BY_ID.get(s.charId);
  if(!char || g.claimed[char.id]) return fail('This character is already owned.');
  s.claimedBy=playerId;
  g.claimed[char.id]=playerId;
  p.collection.push(char.id);
  p.lastClaim=now;
  p.totalClaims++;
  p.xp += ({common:10,uncommon:20,rare:40,epic:70,legendary:120,mythic:240})[char.rarity];
  store.save();
  return pass(`You claimed **${char.name}**!`,{char,player:p});
}
export function daily(store,guildId,playerId,now=Date.now()) {
  const g=store.guild(guildId),p=store.player(g,playerId);
  if(now-p.lastDaily<CONFIG.dailyCooldownMs) return fail(`Your next daily is in ${clock(CONFIG.dailyCooldownMs-(now-p.lastDaily))}.`);
  p.dailyStreak = p.lastDaily && (now-p.lastDaily<=48*60*60_000) ? p.dailyStreak+1 : 1;
  const reward=300 + Math.min(7,p.dailyStreak)*25;
  p.coins+=reward; p.lastDaily=now;
  store.save();
  return pass(`+**${reward} MediaCoins**! Streak: **${p.dailyStreak} days**.`,{reward,balance:p.coins});
}
export function sell(store,guildId,playerId,charId) {
  const g=store.guild(guildId),p=store.player(g,playerId),c=BY_ID.get(charId);
  if(!c) return fail('Character not found.');
  if(g.claimed[charId]!==playerId) return fail('You do not own that character.');
  p.collection=p.collection.filter(id=>id!==charId);
  delete g.claimed[charId];
  if(p.favorite===charId) p.favorite=null;
  const earned=Math.floor(c.value*0.65);
  p.coins+=earned;store.save();
  return pass(`Sold **${c.name}** for **${earned} MediaCoins**. They can now be rolled again.`,{earned});
}
export function wish(store,guildId,playerId,charId,remove=false){
  const g=store.guild(guildId),p=store.player(g,playerId),c=BY_ID.get(charId);
  if(!c) return fail('Character not found.');
  if(remove){p.wishlist=p.wishlist.filter(id=>id!==charId);store.save();return pass(`Removed **${c.name}** from your wishlist.`);}
  if(p.wishlist.includes(charId)) return fail('This character is already on your wishlist.');
  if(p.wishlist.length>=20) return fail('Your wishlist is full (20 characters).');
  p.wishlist.push(charId);store.save();return pass(`Added **${c.name}** to your wishlist.`);
}
export function favorite(store,guildId,playerId,charId){
  const g=store.guild(guildId),p=store.player(g,playerId),c=BY_ID.get(charId);
  if(!c||g.claimed[charId]!==playerId) return fail('You must own the character to set them as your favorite.');
  p.favorite=charId;store.save();return pass(`**${c.name}** is now your featured character.`);
}
export function buyLuck(store,guildId,playerId,now=Date.now()){
  const g=store.guild(guildId),p=store.player(g,playerId);
  if(p.luckUntil>now) return fail(`Your luck boost lasts another ${clock(p.luckUntil-now)}.`);
  if(p.coins<CONFIG.shopLuckPrice) return fail(`A luck boost costs ${CONFIG.shopLuckPrice} MediaCoins.`);
  p.coins-=CONFIG.shopLuckPrice;p.luckUntil=now+CONFIG.shopLuckDurationMs;store.save();
  return pass('Lucky rolls activated for **30 minutes**! Rare and higher tiers are more likely.');
}
export function pay(store,guildId,fromId,toId,amount){
  if(fromId===toId) return fail('You cannot pay yourself.');
  if(!Number.isSafeInteger(amount)||amount<1||amount>100_000) return fail('Payments must be 1–100,000 MediaCoins.');
  const g=store.guild(guildId),from=store.player(g,fromId),to=store.player(g,toId);
  if(from.coins<amount) return fail('Insufficient MediaCoins.');
  from.coins-=amount;to.coins+=amount;store.save();return pass(`Sent **${amount.toLocaleString()} MediaCoins**.`,{balance:from.coins});
}
export function offerTrade(store,guildId,fromId,toId,giveId,wantId=null,now=Date.now()){
  const g=store.guild(guildId),from=store.player(g,fromId);
  if(fromId===toId) return fail('You cannot trade with yourself.');
  if(g.claimed[giveId]!==fromId) return fail('You must own the character you offer.');
  if(wantId && g.claimed[wantId]!==toId) return fail('The other player does not own the requested character.');
  if(giveId===wantId) return fail('You cannot trade a character for itself.');
  const pending=Object.values(g.trades).filter(t=>t.fromId===fromId&&t.expiresAt>now).length;
  if(pending>=3) return fail('You have 3 pending offers already.');
  const id=randomBytes(4).toString('hex');
  g.trades[id]={id,fromId,toId,giveId,wantId,expiresAt:now+CONFIG.tradeLifetimeMs};
  store.save();return pass(`Trade offered! ID: \`${id}\`. Expires in 15 minutes.`,{trade:g.trades[id]});
}
export function resolveTrade(store,guildId,actorId,id,accept,now=Date.now()){
  const g=store.guild(guildId),t=g.trades[id];
  if(!t) return fail('Trade not found. Check the offer ID.');
  if(actorId!==t.toId && !(actorId===t.fromId && !accept)) return fail('Only the recipient can accept; either party can decline/cancel.');
  if(t.expiresAt<=now){delete g.trades[id];store.save();return fail('This trade offer expired.');}
  if(!accept){delete g.trades[id];store.save();return pass('Trade cancelled.');}
  if(g.claimed[t.giveId]!==t.fromId || (t.wantId && g.claimed[t.wantId]!==t.toId)){
    delete g.trades[id];store.save();return fail('One character changed owners; trade cancelled.');
  }
  const a=store.player(g,t.fromId),b=store.player(g,t.toId);
  a.collection=a.collection.filter(x=>x!==t.giveId);
  b.collection.push(t.giveId);g.claimed[t.giveId]=t.toId;
  if(a.favorite===t.giveId)a.favorite=null;
  if(t.wantId){
    b.collection=b.collection.filter(x=>x!==t.wantId);
    a.collection.push(t.wantId);g.claimed[t.wantId]=t.fromId;
    if(b.favorite===t.wantId)b.favorite=null;
  }
  a.trades++;b.trades++;
  delete g.trades[id];store.save();
  return pass('Trade completed successfully!',{trade:t});
}
