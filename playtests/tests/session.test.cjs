const test=require('node:test');
const assert=require('node:assert/strict');
const {Clock,Gate,validWebMessage,returnFromSide}=require('../engine/session.js');
test('manual, modal, visibility and review pauses cannot resume each other',()=>{
 const clock=new Clock();clock.advance(.1);clock.pause('visibility');clock.pause('modal');clock.advance(.1);assert.equal(clock.time,.1);
 clock.resume('modal');clock.advance(.1);assert.equal(clock.time,.1);clock.resume('visibility');clock.advance(.1);assert.equal(clock.time,.2);
 clock.pause('manual');clock.pause('review');clock.resume('review');assert.equal(clock.paused,true);clock.resume('manual');assert.equal(clock.paused,false);
});
test('stale engine callbacks and repeated completion cannot change the active gameplay session',()=>{
 const gate=new Gate(),first=gate.begin('carracing','race');assert.equal(gate.accept(first.sessionId),true);
 const second=gate.begin('ChessQTE','chess');assert.equal(gate.settle(first.sessionId),false);assert.equal(gate.settle(second.sessionId),true);assert.equal(gate.settle(second.sessionId),false);
 gate.stop();assert.equal(gate.accept(second.sessionId),false);
});
test('web-game messages require exact origin, actual iframe window, namespace and version',()=>{
 const source={},other={},origin='https://voyage4.mimomo.ai',data={namespace:'yoroll-gameplay',version:1,type:'result',payload:{score:1}};
 assert.equal(validWebMessage({origin,source,data},origin,source),true);
 assert.equal(validWebMessage({origin:'https://example.com',source,data},origin,source),false);
 assert.equal(validWebMessage({origin,source:other,data},origin,source),false);
 assert.equal(validWebMessage({origin,source,data:{...data,namespace:'other'}},origin,source),false);
 assert.equal(validWebMessage({origin,source,data:{...data,version:2}},origin,source),false);
});
test('skipped side stories do not count as viewed and completed replays do not duplicate the count',()=>{
 const record={parent:'clues',pointId:'letter',viewed:['jade'],allowSkip:true};
 assert.deepEqual(returnFromSide(record,false).viewed,['jade']);
 assert.deepEqual(returnFromSide(record,true).viewed,['jade','letter']);
 assert.deepEqual(returnFromSide({...record,viewed:['jade','letter']},true).viewed,['jade','letter']);
});
