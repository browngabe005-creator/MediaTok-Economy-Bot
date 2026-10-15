// Standalone MediaTok Economy bot. Keep your existing moderation bot untouched.
import 'dotenv/config';
import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import { Store } from './src/store.js';
import { commands, execute, autocomplete, onClaimButton } from './src/commands.js';

if (!process.env.TOKEN || process.env.TOKEN.includes('PASTE_')) {
  console.error('Missing TOKEN. Copy .env.example to .env and set your bot token.');
  process.exit(1);
}
const store = new Store();
const client = new Client({intents:[GatewayIntentBits.Guilds]});
let initialized=false;
client.once(Events.ClientReady, async ready => {
  console.log(`✅ Logged in as ${ready.user.tag}`);
  try {
    const definitions=commands.map(c=>c.toJSON());
    if(process.env.GUILD_ID && !process.env.GUILD_ID.includes('PASTE_')) {
      const guild=await client.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set(definitions);
      console.log(`Registered ${definitions.length} commands in ${guild.name}.`);
    } else {
      await client.application.commands.set(definitions);
      console.log(`Registered ${definitions.length} global commands (may take time to appear).`);
    }
    initialized=true;
  } catch(e) {
    console.error('Command registration failed:',e);
    console.error('Make sure the bot has applications.commands scope and GUILD_ID is correct.');
  }
  ready.user.setPresence({activities:[{name:'mediatok.org • /roll',type:3}],status:'online'});
  console.log(`Catalog ready. ${store.data.guilds ? Object.keys(store.data.guilds).length : 0} server saves loaded.`);
});
client.on(Events.InteractionCreate,async i=>{
  try {
    if(i.isAutocomplete()) return await autocomplete(i,store);
    if(i.isButton() && i.customId.startsWith('claim:')) return await onClaimButton(i,store);
    if(i.isChatInputCommand()) return await execute(i,store);
  } catch(e) {
    console.error('Economy interaction error:',e);
    const msg={content:'Something went wrong. Try again, or contact an admin.',flags:MessageFlags.Ephemeral};
    if(i.isRepliable()) {
      try { if(i.deferred||i.replied)await i.followUp(msg); else await i.reply(msg); }catch{}
    }
  }
});
const shutdown=()=>{try {store.save();}catch(e){console.error('Unable to write store on shutdown',e);} client.destroy();process.exit(0);};
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
client.login(process.env.TOKEN).catch(e=>{console.error('Bot login failed:',e.message);process.exitCode=1;});
