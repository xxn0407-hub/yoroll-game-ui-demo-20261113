const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const bankRoot=path.join(root,'playtests/assets/audio');
const manifest=JSON.parse(fs.readFileSync(path.join(bankRoot,'manifest.json'),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('every gameplay event resolves to a new local asset with approved source provenance',()=>{
 let definitions;
 const window={YorollSound:{registerCues(value){definitions=value;}}};
 const document={currentScript:{src:'https://demo.test/playtests/audio.js'},documentElement:{dataset:{}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'playtests/audio.js'),'utf8'),{window,document,URL});
 for(const [event,definition] of Object.entries(definitions)){
  const name=event.slice(5),asset=manifest.assets[name];
  assert.ok(asset,`missing asset for ${event}`);
  assert.equal(new URL(definition.file).pathname,`/playtests/${asset.file}`);
  assert.equal(hash(fs.readFileSync(path.join(root,'playtests',asset.file))),asset.sha256);
  assert.match(asset.source,/^assets\/audio\/(home-opening|ui-[a-z-]+)\.wav$/);
  assert.equal(hash(fs.readFileSync(path.join(root,asset.source))),asset.sourceSha256);
 }
 assert.equal(Object.keys(definitions).length,17);
 assert.equal(manifest.assets['image-audio'].durationSeconds,12,'image timing stays unchanged');
 assert.equal(Object.keys(manifest.assets).length,18);
});

test('all new PCM cues stay quiet, finite and zero-ended without boundary clicks',()=>{
 for(const [name,asset] of Object.entries(manifest.assets)){
  const bytes=fs.readFileSync(path.join(root,'playtests',asset.file));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(22),2);
  assert.equal(bytes.readUInt32LE(24),48000);assert.equal(bytes.readUInt16LE(34),16);
  const offset=bytes.indexOf(Buffer.from('data'))+8;
  const count=bytes.readUInt32LE(offset-4)/2;
  let peak=0,sum=0,tail=0;const tailCount=Math.min(1920,count);
  for(let i=0;i<count;i++){const v=bytes.readInt16LE(offset+i*2)/32768;peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>=count-tailCount)tail+=v*v;}
  assert.ok(peak>0&&peak<=.15,`${name} peak ${peak}`);
  assert.ok(20*Math.log10(Math.sqrt(sum/count))<=-30,`${name} should not overpower UI`);
  assert.ok(Math.sqrt(tail/tailCount)<Math.sqrt(sum/count)*.5,`${name} needs a soft tail`);
  for(const i of [0,1,count-2,count-1])assert.equal(bytes.readInt16LE(offset+i*2),0,`${name} endpoint`);
  assert.ok(Math.abs(count/96000-asset.durationSeconds)<.0001);
 }
});
