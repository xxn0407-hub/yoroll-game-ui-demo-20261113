const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const R=require('../engine/rules.js');
const data=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
const game=data('game.json');
const chapters=game.chapters.map(chapter=>data(chapter.dataPath));
const find=id=>chapters.flatMap(chapter=>[...chapter.nodes,...(chapter.side_nodes||[])]).find(node=>node.id===id);
test('all 94 original nodes keep their IDs, links and byte-identical chapter data',()=>{
 const manifest=data('source-manifest.json');
 assert.equal(chapters.flatMap(chapter=>chapter.nodes).length,74);
 assert.equal(chapters.flatMap(chapter=>chapter.side_nodes||[]).length,20);
 assert.deepEqual(R.validateGraph(chapters),[]);
 for(const chapter of manifest.chapters){
  const bytes=fs.readFileSync(path.join(__dirname,'../data',chapter.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),chapter.sha256);
 }
});
test('high, low and character-comparison choices follow original values and visibility',()=>{
 const state=R.initialState(game);
 R.applyEffects(state,find('choice-stat-1'),game,'first-gain');
 assert.equal(state.characters.sophia.favor,10);
 assert.equal(state.characters.lily.favor,5);
 assert.equal(state.stats.favor,5,'legacy and modern effect fields must not double-award');
 assert.deepEqual(R.choicesFor(find('choice-condition-test'),state).map(choice=>[choice.index,choice.enabled]),[[0,true],[1,false],[2,true],[3,true]]);
 assert.equal(R.choose(find('choice-condition-test'),1,state),null);
 R.applyEffects(state,find('choice-stat-2'),game,'first-loss');
 assert.equal(state.characters.sophia.favor,0);
 assert.deepEqual(R.choicesFor(find('choice-condition-low-test'),state).map(choice=>[choice.index,choice.enabled]),[[0,false],[1,true],[3,true]]);
 R.applyEffects(state,find('choice-stat-1'),game,'first-gain');
 assert.equal(state.characters.sophia.favor,0,'re-rendering cannot reapply node effects');
});
test('a visited prerequisite stays unlocked when the player returns to a choice',()=>{
 const state=R.initialState(game),node=find('visited-test-choice');
 assert.equal(R.choicesFor(node,state)[1].enabled,false);
 R.recordVisit(state,'1','visited-test-required');
 R.recordVisit(state,'1','visited-test-required');
 assert.equal(state.visited.length,1);
 assert.equal(R.choicesFor(node,state)[1].enabled,true);
});
test('configured material checks are atomic and the two source recipes stay distinct',()=>{
 const state=R.initialState(game),recipe=game.craftRecipes[0];
 const before=R.clone(state);
 assert.equal(R.craft(state,recipe),false);
 assert.deepEqual(state,before);
 R.applyEffects(state,find('item-reward-test'),game,'items');
 const option=find('qte-use-item-click-test').qte.use_item_config.options[0];
 assert.equal(R.useItem(state,option),true);
 assert.equal(state.items.herb,2,'the source click-use option has no consumption flag');
 assert.equal(R.craft(state,recipe),true);
 assert.deepEqual(state.items,{herb:0,rope:0,potion:1});
 const bench=find('craft-bench-test').qte.craft_bench_config.recipes[0];
 assert.deepEqual(R.ingredientCounts(bench.inputs),{herb:1,rope:1});
});
test('immediate settlement and waiting for the video end are separate outcomes',()=>{
 const state=R.initialState(game),choice=find('choice-timed');
 assert.equal(R.choose(choice,0,state).immediate,true);
 assert.equal(R.choose(choice,1,state).immediate,false);
 assert.equal(R.qteOutcome(find('qte-click'),0).immediate,true);
 assert.equal(R.qteOutcome(find('qte-click'),1).immediate,false);
 assert.equal(R.qteOutcome(find('dial-lock-test'),0).retry,true);
});
test('swipe distance and angle are evaluated independently',()=>{
 assert.equal(R.swipeMatches({x:0,y:0},{x:110,y:10},{direction:'right',minDistance:100,angleTolerance:30}),true);
 assert.equal(R.swipeMatches({x:0,y:0},{x:90,y:0},{direction:'right',minDistance:100,angleTolerance:30}),false);
 assert.equal(R.swipeMatches({x:0,y:0},{x:110,y:100},{direction:'right',minDistance:100,angleTolerance:30}),false);
 assert.equal(R.swipeMatches({x:0,y:0},{x:-120,y:0},{direction:'right',minDistance:100,angleTolerance:30}),false);
});
test('the custom paper outline is judged by accuracy and coverage, not just closing',()=>{
 const config=find('qte-paper-cutting-custom').qte.paper_cutting_config;
 const template=R.resample(R.patternPoints(config));
 assert.equal(R.traceResult(template,config).success,true);
 assert.equal(R.traceResult(template.slice(0,15),config).retry,true);
 const wrong=template.map(point=>({x:point.x+.2,y:point.y+.2}));
 assert.equal(R.traceResult(wrong,config).success,false);
});
test('the final image holds for the rest of the original 12-second audio',()=>{
 const images=find('image-audio-test').images;
 assert.equal(R.mediaFrameAt(images,2.99,12),0);
 assert.equal(R.mediaFrameAt(images,3,12),1);
 assert.equal(R.mediaFrameAt(images,6,12),2);
 assert.equal(R.mediaFrameAt(images,11.99,12),2);
});
test('scene clue combinations return their configured result IDs',()=>{
 const config=find('qte-click-video-branch-test').qte.scene_click_video;
 assert.equal(R.sceneResult(['bp_1'],config),null);
 assert.equal(R.sceneResult(['bp_1','bp_2'],config),2);
 assert.equal(R.sceneResult(['bp_2','bp_3'],config),3);
});
test('a missed overlapping note does not end another active hold or slow-motion window',()=>{
 const notes=find('ch2-slow-instant-rhythm-mid-wait').qte.rhythm_beatmap.notes;
 const resolved=new Set([0,1,2,3,5]);
 const active=R.activeNotes(notes,6.9,resolved);
 assert.equal(active.length,1);
 assert.equal(active[0].noteType,'OSUHoldNote');
 assert.equal(R.activeNotes(notes,7.36,resolved).length,0);
});
test('quick QTE allows two mistakes; regular rhythm still uses its target score',()=>{
 const quick=find('ch2-quick-qte-test').qte.rhythm_beatmap;
 assert.equal(R.rhythmResult(quick,[100,0,100,0,100]).success,true);
 assert.equal(R.rhythmResult(quick,[100,0,0,0,100]).failedEarly,true);
 const regular=find('qte-rhythm').qte;
 assert.equal(R.rhythmResult(regular.rhythm_beatmap,[100,50],regular.target_score).success,false);
});
