import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags
} from 'discord.js';
import {CATALOG,BY_ID,TYPES,RARITIES,findCharacter,characterOptions} from './catalog.js';
import {
 CONFIG,clock,performRoll,claimSpawn,daily,sell,wish,favorite,
 buyLuck,pay,offerTrade,resolveTrade
} from './game.js';

const EF=MessageFlags.Ephemeral;
const BRAND=0x8264D6;
const SITE='https://mediatok.org';
const categories=Object.entries(TYPES).map(([value,name])=>({name,value}));
const cOpt=(opt,name='character',description='Character to select')=>opt.addStringOption(o=>o.setName(name).setDescription(description).setRequired(true).setAutocomplete(true));
const base=(name,description)=>new SlashCommandBuilder().setName(name).setDescription(description);
export const commands=[
 base('roll','Roll a character from any MediaTok medium (20 coins).')
  .addStringOption(o=>o.setName('medium').setDescription('Limit to one media category').addChoices({name:'All Media',value:'all'},...categories)),
 base('claim','Claim the latest unclaimed roll in this channel.')
  .addStringOption(o=>o.setName('roll_id').setDescription('Optional roll ID; omit for the latest available roll')),
 base('daily','Claim your daily MediaCoins and increase your streak.'),
 base('balance','See your MediaCoins and luck boost.')
  .addUserOption(o=>o.setName('user').setDescription('Whose balance?')),
 base('collection','Browse a member’s collection.')
  .addUserOption(o=>o.setName('user').setDescription('Whose collection?'))
  .addStringOption(o=>o.setName('medium').setDescription('Filter category').addChoices(...categories))
  .addIntegerOption(o=>o.setName('page').setDescription('Page number').setMinValue(1)),
 base('wishlist','Manage your 20-slot character wishlist.')
  .addSubcommand(s=>s.setName('add').setDescription('Add character to wishlist.').addStringOption(o=>o.setName('character').setDescription('Character').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s=>s.setName('remove').setDescription('Remove character from wishlist.').addStringOption(o=>o.setName('character').setDescription('Character').setRequired(true).setAutocomplete(true)))
  .addSubcommand(s=>s.setName('show').setDescription('Show your wishlist.')),
 base('sell','Sell your character for 65% of catalog value.')
  .addStringOption(o=>o.setName('character').setDescription('Character you own').setRequired(true).setAutocomplete(true)),
 base('favorite','Feature a character on your MediaTok profile.')
  .addStringOption(o=>o.setName('character').setDescription('Character you own').setRequired(true).setAutocomplete(true)),
 base('trade','Offer, accept, or decline character trades.')
  .addSubcommand(s=>s.setName('offer').setDescription('Offer a character to another member.')
   .addUserOption(o=>o.setName('user').setDescription('Trade recipient').setRequired(true))
   .addStringOption(o=>o.setName('give').setDescription('Your character').setRequired(true).setAutocomplete(true))
   .addStringOption(o=>o.setName('want').setDescription('Optional character in return').setAutocomplete(true)))
  .addSubcommand(s=>s.setName('accept').setDescription('Accept an incoming offer.')
   .addStringOption(o=>o.setName('id').setDescription('Offer ID').setRequired(true)))
  .addSubcommand(s=>s.setName('decline').setDescription('Decline or cancel an offer.')
   .addStringOption(o=>o.setName('id').setDescription('Offer ID').setRequired(true))),
 base('pay','Send MediaCoins to someone in this server.')
  .addUserOption(o=>o.setName('user').setDescription('Recipient').setRequired(true))
  .addIntegerOption(o=>o.setName('amount').setDescription('MediaCoins to send (max 100,000)').setMinValue(1).setMaxValue(100000).setRequired(true)),
 base('leaderboard','See the richest or biggest collectors.')
  .addStringOption(o=>o.setName('sort').setDescription('Leaderboard metric')
   .addChoices({name:'MediaCoins',value:'coins'},{name:'Characters',value:'collection'},{name:'XP',value:'xp'})),
 base('profile','View a MediaTok collection profile.')
  .addUserOption(o=>o.setName('user').setDescription('Member to view')),
 base('catalog','Find characters in the starter catalog.')
  .addSubcommand(s=>s.setName('search').setDescription('Search names, titles, or media types.')
   .addStringOption(o=>o.setName('query').setDescription('What are you looking for?').setRequired(true)))
  .addSubcommand(s=>s.setName('stats').setDescription('Show all catalog media categories.')),
 base('shop','Spend MediaCoins on special boosts.')
  .addSubcommand(s=>s.setName('view').setDescription('Show available upgrades.'))
  .addSubcommand(s=>s.setName('buy-luck').setDescription('Buy 30 minutes of boosted rarity rolls for 600 coins.')),
 base('economyhelp','Show MediaTok bot commands, rules, and rates.')
];

function embed(title,description,color=BRAND) {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setFooter({text:'MediaTok • Multi-media collecting • mediatok.org'}).setTimestamp();
}
function money(n){return `${n.toLocaleString('en-US')} 🪙`;}
function charLine(c){return `${RARITIES[c.rarity].emoji} **${c.name}** · ${c.series} · ${TYPES[c.type]}`;}
function reply(i,result){return i.reply({content:result.message,flags:EF});}
function findId(value){return BY_ID.has(value)?value:findCharacter(value)?.id;}
function guildRequired(i){return i.guildId != null;}
function getRollFromChannel(g,channelId,now){return Object.values(g.spawns).filter(s=>s.channelId===channelId&&!s.claimedBy&&s.expiresAt>now).sort((a,b)=>b.expiresAt-a.expiresAt)[0];}
function claimComponents(spawnId,disabled=false){return [new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId(`claim:${spawnId}`).setLabel(disabled?'Claimed':'Claim character').setStyle(disabled?ButtonStyle.Secondary:ButtonStyle.Success).setEmoji('💜').setDisabled(disabled)
)];}

export async function autocomplete(i,store){
 const opt=i.options.getFocused(true),name=opt.name;
 const g=store.guild(i.guildId??'dm'),p=store.player(g,i.user.id);
 let excluded=new Set();
 let ids=null;
 if(['sell','favorite'].includes(i.commandName) || (i.commandName==='trade'&&name==='give')) ids=new Set(p.collection);
 if(i.commandName==='trade'&&name==='want') {
   const target=i.options.getUser('user');
   ids=new Set(target?store.player(g,target.id).collection:[]);
 }
 if(i.commandName==='wishlist' && i.options.getSubcommand(false)==='remove') ids=new Set(p.wishlist);
 const matches=characterOptions(String(opt.value??''),excluded).filter(x=>!ids||ids.has(x.value));
 await i.respond(matches).catch(()=>{});
}

export async function onClaimButton(i,store){
 if(!guildRequired(i))return i.reply({content:'Use this command in a server.',flags:EF});
 const result=claimSpawn(store,i.guildId,i.user.id,i.customId.slice(6),i.channelId);
 if(!result.ok)return reply(i,result);
 const g=store.guild(i.guildId);
 const wished=Object.entries(g.players)
   .filter(([id,p])=>id!==i.user.id&&p.wishlist.includes(result.char.id))
   .length;
 await i.update({embeds:[embed('💜 Character claimed',`${charLine(result.char)}\n\nClaimed by <@${i.user.id}>${wished?`\nOn ${wished} other wishlist(s).`:''}`,RARITIES[result.char.rarity].color)],components:claimComponents(i.customId.slice(6),true),allowedMentions:{parse:[]}});
}

export async function execute(i,store){
 if(!guildRequired(i))return i.reply({content:'This economy works in servers, not DMs.',flags:EF});
 const guildId=i.guildId, playerId=i.user.id,g=store.guild(guildId);
 const sub=i.options.getSubcommand(false);
 switch(i.commandName){
  case 'roll': {
    const type=i.options.getString('medium')||'all';
    const r=performRoll(store,guildId,playerId,type,i.channelId);
    if(!r.ok)return reply(i,r);
    const c=r.char;
    const e=embed(`${RARITIES[c.rarity].emoji} ${c.name}`,`**${c.series}**\n${TYPES[c.type]} • **${c.rarity.toUpperCase()}**\nCollection value: ${money(c.value)}\n\n**Claim in 90 seconds!** Anyone in this server can claim it if their claim cooldown is ready.\nRoll cost: ${money(CONFIG.rollCost)} • <@${playerId}>`,RARITIES[c.rarity].color);
    e.addFields({name:'Roll ID',value:`\`${r.spawn.id}\``,inline:true});
    await i.reply({embeds:[e],components:claimComponents(r.spawn.id),allowedMentions:{parse:[]}});
    break;
  }
  case 'claim': {
    const sId=i.options.getString('roll_id')||getRollFromChannel(g,i.channelId,Date.now())?.id;
    if(!sId)return i.reply({content:'No active roll here. Use /roll first.',flags:EF});
    const r=claimSpawn(store,guildId,playerId,sId,i.channelId);
    if(!r.ok)return reply(i,r);
    await i.reply({embeds:[embed('💜 Claimed!',`${charLine(r.char)}\nClaimed by <@${playerId}>`,RARITIES[r.char.rarity].color)],allowedMentions:{parse:[]}});
    break;
  }
  case 'daily':return reply(i,daily(store,guildId,playerId));
  case 'balance': {
    const u=i.options.getUser('user')||i.user,p=store.player(g,u.id);
    return i.reply({embeds:[embed(`🪙 ${u.username}'s MediaCoins`,
      `Balance: **${money(p.coins)}**\n${p.luckUntil>Date.now()?`🍀 Luck boost: ${clock(p.luckUntil-Date.now())} remaining`:'No active luck boost.'}`)]});
  }
  case 'collection': {
    const u=i.options.getUser('user')||i.user,p=store.player(g,u.id);
    const type=i.options.getString('medium');
    const ids=p.collection.filter(id=>BY_ID.has(id)&&(!type||BY_ID.get(id).type===type));
    const page=i.options.getInteger('page')||1,perPage=10,pages=Math.max(1,Math.ceil(ids.length/perPage));
    if(page>pages)return i.reply({content:`There are only ${pages} page(s).`,flags:EF});
    const arr=ids.slice((page-1)*perPage,page*perPage).map((id,idx)=>`${(page-1)*perPage+idx+1}. ${charLine(BY_ID.get(id))}\n   Value: ${money(BY_ID.get(id).value)}`);
    return i.reply({embeds:[embed(`📚 ${u.username}'s Collection (${ids.length})`,
      `${arr.join('\n')||'No characters here yet. Start with /roll.'}\n\nPage **${page}/${pages}** • Total collection value: ${money(ids.reduce((sum,id)=>sum+BY_ID.get(id).value,0))}`)]});
  }
  case 'wishlist':{
    const p=store.player(g,playerId);
    if(sub==='show')return i.reply({embeds:[embed('💜 Your Wishlist',p.wishlist.map((id,n)=>`${n+1}. ${charLine(BY_ID.get(id))}`).join('\n')||'Empty. Add characters with \`/wishlist add\`.')] ,flags:EF});
    const id=findId(i.options.getString('character'));
    return reply(i,wish(store,guildId,playerId,id,sub==='remove'));
  }
  case 'sell':{
    const id=findId(i.options.getString('character'));
    return reply(i,sell(store,guildId,playerId,id));
  }
  case 'favorite':{
    const id=findId(i.options.getString('character'));
    return reply(i,favorite(store,guildId,playerId,id));
  }
  case 'trade':{
    if(sub==='offer'){
      const u=i.options.getUser('user');
      if(u.bot)return i.reply({content:'You cannot trade with bots.',flags:EF});
      const giveId=findId(i.options.getString('give'));
      const wantId=i.options.getString('want')?findId(i.options.getString('want')):null;
      const r=offerTrade(store,guildId,playerId,u.id,giveId,wantId);
      if(!r.ok)return reply(i,r);
      return i.reply({embeds:[embed('🔁 New MediaTok Trade',
        `From: <@${playerId}> → <@${u.id}>\n**Offering:** ${charLine(BY_ID.get(giveId))}\n**Asking:** ${wantId?charLine(BY_ID.get(wantId)):'Nothing (gift)'}\n\nOffer ID: \`${r.trade.id}\`\nRecipient: use \`/trade accept\` with this ID within 15 minutes. Either party can decline/cancel.`,BRAND)],allowedMentions:{parse:[]}});
    }
    const r=resolveTrade(store,guildId,playerId,i.options.getString('id'),sub==='accept');
    return reply(i,r);
  }
  case 'pay':{
    const u=i.options.getUser('user');
    if(u.bot)return i.reply({content:'You cannot pay bots.',flags:EF});
    return reply(i,pay(store,guildId,playerId,u.id,i.options.getInteger('amount')));
  }
  case 'leaderboard':{
    const sort=i.options.getString('sort')||'coins';
    const top=Object.entries(g.players).sort((a,b)=>(sort==='collection'?b[1].collection.length-a[1].collection.length:b[1][sort]-a[1][sort])).slice(0,10);
    return i.reply({embeds:[embed(`🏆 MediaTok Leaderboard: ${sort==='coins'?'MediaCoins':sort==='xp'?'XP':'Collections'}`,
       top.map(([id,p],index)=>`**${index+1}.** <@${id}> — ${sort==='collection'?`${p.collection.length} characters`:sort==='xp'?`${p.xp} XP`:money(p.coins)}`).join('\n')||'Nobody has played yet!')],allowedMentions:{parse:[]}});
  }
  case 'profile':{
    const u=i.options.getUser('user')||i.user,p=store.player(g,u.id);
    const fav=p.favorite&&BY_ID.get(p.favorite);
    const total=p.collection.reduce((n,id)=>n+(BY_ID.get(id)?.value||0),0);
    const e=embed(`✨ ${u.username}'s MediaTok Profile`,
      `**Featured:** ${fav?charLine(fav):'No favorite selected'}\n**MediaCoins:** ${money(p.coins)}\n**Characters:** ${p.collection.length}\n**Collection value:** ${money(total)}\n**XP:** ${p.xp}\n**Rolls:** ${p.rolls}\n**All-time claims:** ${p.totalClaims}\n**Trades:** ${p.trades}\n**Daily streak:** ${p.dailyStreak} day(s)\n**Wishlist:** ${p.wishlist.length}/20`);
    e.setThumbnail(u.displayAvatarURL());
    return i.reply({embeds:[e]});
  }
  case 'catalog':{
    if(sub==='stats'){
      const counts=Object.entries(TYPES).map(([type,label])=>`**${label}**: ${CATALOG.filter(c=>c.type===type).length}`);
      return i.reply({embeds:[embed(`🌐 MediaTok Catalog (${CATALOG.length} characters)`,counts.join('\n')+'\n\nAll entries are curated. No NSFW/lolicon entries or third-party search API required.')]});
    }
    const q=i.options.getString('query').toLowerCase();
    const items=CATALOG.filter(c=>`${c.name} ${c.series} ${TYPES[c.type]}`.toLowerCase().includes(q));
    return i.reply({embeds:[embed(`🔎 Catalog Search (${items.length} matches)`,items.slice(0,15).map(charLine).join('\n')||'No matching characters in the starter catalog.')]});
  }
  case 'shop':{
    if(sub==='view')return i.reply({embeds:[embed('🛍️ MediaTok Shop',
      `🍀 **Lucky Rolls** — ${money(CONFIG.shopLuckPrice)}\nBoost rare, epic, legendary, and mythic roll odds for **30 minutes**.\nPurchase with \`/shop buy-luck\`.\n\nNo real-money purchases or gambling.`)]});
    return reply(i,buyLuck(store,guildId,playerId));
  }
  case 'economyhelp':{
    const e=embed('📖 MediaTok Economy — Commands',
      '**Collect**\n`/roll` · `/claim` · `/collection` · `/catalog` · `/favorite`\n\n**Economy**\n`/daily` · `/balance` · `/sell` · `/pay` · `/shop`\n\n**Social**\n`/wishlist` · `/trade` · `/leaderboard` · `/profile`\n\n**Rules**\n• Roll costs **20 MediaCoins**, with a **25-second** cooldown.\n• Anybody can claim the spawn during its **90-second** window.\n• Each person can claim once every **10 minutes**.\n• `/daily` grants **325–475 coins** once every 24 hours.\n• Character ownership is **unique per server**, not across all servers.\n• Selling earns **65%** of character value.\n• Trades expire after **15 minutes**.\n• Each server has its own economy.\n\nOur catalog spans anime, manga, light novels, webnovels, movies, TV, games, and books. No explicit/lolicon content.');
    return i.reply({embeds:[e]});
  }
  default:return i.reply({content:'Unknown command. Try /economyhelp.',flags:EF});
 }
}
