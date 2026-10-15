import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { CATALOG,BY_ID,TYPES } from '../src/catalog.js';
import {
 performRoll,claimSpawn,daily,sell,pay,offerTrade,resolveTrade,wish,
 buyLuck,CONFIG,chooseCharacter
} from '../src/game.js';

function fresh(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mt-economy-'));return {store:new Store(path.join(dir,'state.json')),cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};}
test('starter catalog is valid, unique, and covers every medium',()=>{
 assert.ok(CATALOG.length>=130);
 assert.equal(new Set(CATALOG.map(x=>x.id)).size,CATALOG.length);
 for(const c of CATALOG){assert.ok(TYPES[c.type]);assert.ok(BY_ID.get(c.id));assert.ok(c.value>0);}
 for(const type of Object.keys(TYPES)) assert.ok(CATALOG.some(c=>c.type===type));
});
test('daily reward, streak, cooldown and persistence',()=>{
 const {store,cleanup}=fresh();
 try{
   const t=1_800_000_000_000;
   assert.equal(daily(store,'g','a',t).reward,325);
   assert.equal(daily(store,'g','a',t+100).ok,false);
   assert.equal(daily(store,'g','a',t+CONFIG.dailyCooldownMs+1).reward,350);
   assert.equal(new Store(store.filePath).guild('g').players.a.coins,1025);
 }finally{cleanup();}
});
test('roll costs coins and same spawn can only be claimed once',()=>{
 const {store,cleanup}=fresh();
 try{
   const now=Date.now()+2_000;
   const r=performRoll(store,'g','alice','anime','chan',now);
   assert.equal(r.ok,true);
   assert.equal(r.balance,330);
   assert.equal(performRoll(store,'g','alice','anime','chan',now).ok,false);
   assert.equal(claimSpawn(store,'g','bob',r.spawn.id,'other-channel',now+100).ok,false);
   assert.equal(claimSpawn(store,'g','bob',r.spawn.id,'chan',now+100).ok,true);
   assert.equal(claimSpawn(store,'g','alice',r.spawn.id,'chan',now+101).ok,false);
   assert.equal(store.guild('g').claimed[r.char.id],'bob');
 }finally{cleanup();}
});
test('no concurrent unclaimed duplicate spawns',()=>{
 const {store,cleanup}=fresh();
 try{
   const now=Date.now()+2_000;
   const r1=performRoll(store,'g','alice','anime','chan',now);
   const r2=performRoll(store,'g','bob','anime','chan',now+1);
   assert.notEqual(r1.char.id,r2.char.id);
 }finally{cleanup();}
});
test('sell releases ownership and applies 65% payout',()=>{
 const {store,cleanup}=fresh();
 try{
   const now=Date.now()+2_000,r=performRoll(store,'g','alice','webnovel','chan',now);
   claimSpawn(store,'g','alice',r.spawn.id,'chan',now+1);
   const before=store.player(store.guild('g'),'alice').coins;
   const s=sell(store,'g','alice',r.char.id);
   assert.equal(s.earned,Math.floor(r.char.value*.65));
   assert.equal(store.player(store.guild('g'),'alice').coins,before+s.earned);
   assert.equal(store.guild('g').claimed[r.char.id],undefined);
   assert.equal(sell(store,'g','alice',r.char.id).ok,false);
 }finally{cleanup();}
});
test('trade gift and swap ownership, recipient-only acceptance',()=>{
 const {store,cleanup}=fresh();
 try{
   const g=store.guild('g'),a=store.player(g,'alice'),b=store.player(g,'bob');
   const c1=CATALOG[0].id,c2=CATALOG[1].id;
   a.collection=[c1];b.collection=[c2];g.claimed[c1]='alice';g.claimed[c2]='bob';
   const t=offerTrade(store,'g','alice','bob',c1,c2,Date.now());
   assert.equal(t.ok,true);
   assert.equal(resolveTrade(store,'g','alice',t.trade.id,true).ok,false);
   assert.equal(resolveTrade(store,'g','bob',t.trade.id,true).ok,true);
   assert.equal(g.claimed[c1],'bob');assert.equal(g.claimed[c2],'alice');
 }finally{cleanup();}
});
test('pay, wishlist and luck boost enforce limits',()=>{
 const {store,cleanup}=fresh();
 try{
  const id=CATALOG[0].id;
  assert.equal(wish(store,'g','alice',id).ok,true);
  assert.equal(wish(store,'g','alice',id).ok,false);
  assert.equal(wish(store,'g','alice',id,true).ok,true);
  assert.equal(pay(store,'g','alice','bob',100).ok,true);
  assert.equal(pay(store,'g','alice','bob',1000).ok,false);
  const g=store.guild('g');store.player(g,'alice').coins=700;
  assert.equal(buyLuck(store,'g','alice').ok,true);
  assert.equal(buyLuck(store,'g','alice').ok,false);
 }finally{cleanup();}
});
test('server ownership is isolated',()=>{
 const {store,cleanup}=fresh();
 try {
  const g1=store.guild('one'),g2=store.guild('two');
  const id=CATALOG[0].id;
  g1.claimed[id]='user';
  assert.equal(g2.claimed[id],undefined);
  assert.equal(chooseCharacter(g1,'all')?.id===id,false);
 }finally{cleanup();}
});
