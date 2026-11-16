const test=require('node:test');
const assert=require('node:assert/strict');
const layout=require('../../responsive-layout.js');

test('phone presentation does not activate when a desktop window is resized',()=>{
 for(const [width,height] of [[1440,810],[844,390],[390,844],[320,568]]){
  assert.equal(layout.isPhone({width,height,userAgent:'Mozilla/5.0 Macintosh',coarse:false,mobile:false}),false);
 }
 assert.equal(layout.isPhone({width:390,height:844,preview:'mobile'}),true);
 assert.equal(layout.isPhone({width:390,height:844,preview:'desktop',mobile:true}),false);
 assert.equal(layout.isPhone({width:390,height:844,mobile:false,coarse:true}),false);
});

test('phone detection survives rotation and browsers without UA client hints',()=>{
 for(const [width,height] of [[390,844],[844,390]]){
  assert.equal(layout.isPhone({width,height,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}),true);
  assert.equal(layout.isPhone({width,height,mobile:true}),true);
  assert.equal(layout.isPhone({width,height,coarse:true}),true);
 }
 assert.equal(layout.isPhone({width:1920,height:1080,coarse:true}),false);
});

test('content orientation preserves configured coordinates independently of device rotation',()=>{
 assert.equal(layout.orientationOf('Portrait'),'portrait');
 assert.equal(layout.orientationOf('landscape-primary'),'landscape');
 assert.deepEqual(layout.referenceSize('Portrait'),{width:1080,height:1920});
 assert.deepEqual(layout.referenceSize('Landscape'),{width:1920,height:1080});
 assert.deepEqual(layout.normalizePoint(960,540,'Landscape'),{x:.5,y:.5});
 assert.deepEqual(layout.normalizePoint(540,960,'Portrait'),{x:.5,y:.5});
 assert.deepEqual(layout.normalizePoint(108,1728,'Portrait'),{x:.1,y:1-.9});
});

test('media and interaction planes fit landscape and portrait content without cropping coordinates',()=>{
 for(const [width,height] of [[804,202],[528,132],[350,544],[280,268]]){
  for(const orientation of ['Landscape','Portrait']){
   const frame=layout.referenceSize(orientation),plane=layout.fitPlane(width,height,orientation);
   assert.ok(plane.width<=width+.001&&plane.height<=height+.001);
   assert.ok(Math.abs(plane.width/plane.height-frame.width/frame.height)<.000001);
   const center=layout.normalizePoint(frame.width/2,frame.height/2,orientation);
   assert.equal(center.x*plane.width,plane.width/2);
   assert.equal(center.y*plane.height,plane.height/2);
  }
 }
});
