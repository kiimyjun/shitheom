import Phaser from 'phaser';
import type { Mode } from './main';
import { advancePaper, canFlip, chargeProgress, HOLD_MS } from './rules.mjs';
import { GameAudio } from './audio';

type Paper = { name: string; mode: string; progress: number; done: boolean; view: Phaser.GameObjects.Container; sheet: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; x: number; y: number; angle: number; texture: string };
type Hooks = { onSelect(index: number): void; onProgress(): void; onMessage(message: string): void };
const INK = '#343b2c';
const font = (size: number, weight = 400) => `${weight} ${size}px "Noto Sans KR", -apple-system, sans-serif`;
const seeded = (seed: number) => { let n = seed; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; };

export class DeskScene extends Phaser.Scene {
  papers: Paper[] = [];
  flipped = false;
  private hooks: Hooks;
  private active = false;
  private selected = 0;
  private mode: Mode = 'crumple';
  private ready = false;
  private desk!: Phaser.GameObjects.Container;
  private paperLayer!: Phaser.GameObjects.Container;
  private effects!: Phaser.GameObjects.Container;
  private shredder!: Phaser.GameObjects.Container;
  private chargeUI!: Phaser.GameObjects.Container;
  private chargeBar!: Phaser.GameObjects.Graphics;
  private chargeText!: Phaser.GameObjects.Text;
  private chargeStart: number | null = null;
  private chargeSource: 'keyboard' | 'pointer' | null = null;
  private charged = false;
  private fxAudio = new GameAudio();
  private previewNames: string[] = [];
  private badge!: Phaser.GameObjects.Container;
  private dynamicTextureKeys: string[] = [];
  private run = 0;
  private tearingBusy = false;
  constructor(hooks: Hooks) { super('desk'); this.hooks = hooks; }
  create() {
    this.makeBackground();
    this.desk = this.add.container(550, 378);
    this.makeDesktop();
    this.paperLayer = this.add.container(0, 0); this.desk.add(this.paperLayer);
    this.makeProps(); this.makeShredder();
    this.effects = this.add.container(0, 0).setDepth(50);
    this.makeChargeUI();
    this.badge = this.add.container(550, 703).setDepth(60);
    const badgeBg = this.add.graphics().fillStyle(0xf8f5e8, 0.94).fillRoundedRect(-162, -22, 324, 44, 22).lineStyle(1, 0x8c8d72, 0.3).strokeRoundedRect(-162, -22, 324, 44, 22);
    const badgeLabel = this.add.text(0, 0, '시험지는 가볍게. 마음은 더 가볍게.', { fontFamily: '"Noto Sans KR", sans-serif', fontSize: '15px', color: '#697155' }).setOrigin(0.5);
    this.badge.add([badgeBg, badgeLabel]);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.active) { this.hooks.onMessage('과목을 추가하고 책상에 앉아 봐.'); return; }
      if (this.mode === 'flip') { this.startCharge('pointer'); return; }
      this.processPaper(pointer.x, pointer.y);
    });
    this.input.on('pointerup', () => { if (this.chargeSource === 'pointer') this.releaseCharge(); });
    this.input.on('pointerupoutside', () => this.cancelCharge());
    const down = (event: KeyboardEvent) => {
      if (!this.active || this.mode !== 'flip' || event.code !== 'Space' || this.isEditing(event.target)) return;
      event.preventDefault(); if (!event.repeat) this.startCharge('keyboard');
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space' && this.chargeSource === 'keyboard') { event.preventDefault(); this.releaseCharge(); } };
    const blur = () => this.cancelCharge();
    const visibility = () => { if (document.hidden) this.cancelCharge(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    this.events.once('shutdown', () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); });
    this.ready = true; this.previewSubjects(this.previewNames);
  }
  private isEditing(target: EventTarget | null) { return target instanceof HTMLElement && (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName) || target.isContentEditable); }
  setMuted(value: boolean) { this.fxAudio.muted = value; }
  previewSubjects(names: string[]) { this.previewNames = names; if (!this.ready || this.active) return; this.resetDesk(); this.createPapers(names.length ? names : ['미적분학', '전공필수', '영어']); this.badge.setVisible(true); this.shredder.setAlpha(0.88); }
  begin(names: string[], mode: Mode) { if (!this.ready) { this.events.once('create', () => this.begin(names, mode)); return; } this.resetDesk(); this.active = true; this.mode = mode; this.selected = 0; this.createPapers(names); this.badge.setVisible(false); this.selectPaper(0, false); this.setMode(mode); }
  stopPlay() { this.active = false; this.cancelCharge(); }
  private resetDesk() {
    this.cancelCharge(); this.tweens.killAll(); this.cameras.main.resetFX(); this.flipped = false; this.tearingBusy = false; this.run++;
    this.desk.setPosition(550, 378).setAngle(0).setScale(1).setAlpha(1);
    this.effects.removeAll(true); this.paperLayer.removeAll(true); this.papers = [];
    for (const key of this.dynamicTextureKeys) this.textures.remove(key); this.dynamicTextureKeys = [];
    this.shredder.setPosition(912, 540).setAngle(0).setScale(1).setAlpha(1);
  }
  setMode(mode: Mode) { this.cancelCharge(); this.mode = mode; if (!this.ready) return; this.chargeUI.setVisible(this.active && mode === 'flip' && !this.flipped); this.shredder.setAlpha(mode === 'shred' ? 1 : 0.8); if (this.active && !this.flipped) this.layoutPapers(); }
  selectPaper(index: number, notify = true) { if (!this.papers[index] || this.flipped) return; this.cancelCharge(); this.selected = index; if (this.active) this.layoutPapers(); if (notify) this.hooks.onSelect(index); }
  private makeBackground() {
    const texture = this.textures.createCanvas('room', 1100, 790)!; const c = texture.context;
    c.fillStyle = '#e6d4b5'; c.fillRect(0, 0, 1100, 790);
    const gradient = c.createLinearGradient(0, 0, 1100, 790); gradient.addColorStop(0, '#e6d2b0'); gradient.addColorStop(1, '#cebb9a'); c.fillStyle = gradient; c.fillRect(0, 0, 1100, 790);
    const rand = seeded(42);
    for (let i = 0; i < 6500; i++) { c.fillStyle = rand() > 0.5 ? '#ffffff0b' : '#4c382507'; c.fillRect(rand() * 1100, rand() * 790, rand() * 3 + 1, 1); }
    c.strokeStyle = '#8e76561a'; c.lineWidth = 1;
    for (let y = 60; y < 790; y += 100) { c.beginPath(); c.moveTo(0,y); c.lineTo(1100,y-35); c.stroke(); }
    c.fillStyle = '#3d412c16'; c.beginPath(); c.ellipse(570,680,500,74,-0.1,0,Math.PI*2); c.fill();
    texture.refresh(); this.add.image(0,0,'room').setOrigin(0);
    this.add.text(46, 43, 'POST-EXAM\nRELIEF STATION', { fontFamily: 'monospace', fontSize: '12px', lineSpacing: 5, color: '#978667' }).setAlpha(0.7);
  }
  private makeDesktop() {
    const texture = this.textures.createCanvas('wood',1100,790)!; const c=texture.context;
    c.save(); c.translate(550,378);
    c.fillStyle='#826047'; c.beginPath(); c.moveTo(-383,182); c.lineTo(-342,178); c.lineTo(-344,333); c.lineTo(-370,341); c.closePath(); c.fill();
    c.fillStyle='#785940'; c.beginPath(); c.moveTo(399,122); c.lineTo(435,118); c.lineTo(441,278); c.lineTo(416,283); c.closePath(); c.fill();
    c.fillStyle='#a07b54'; c.beginPath(); c.moveTo(-470,-183); c.lineTo(415,-237); c.lineTo(500,178); c.lineTo(-406,270); c.closePath(); c.fill();
    c.fillStyle='#ac8357'; c.beginPath(); c.moveTo(-406,242); c.lineTo(500,149); c.lineTo(500,178); c.lineTo(-406,270); c.closePath(); c.fill();
    c.fillStyle='#bc9868'; c.beginPath(); c.moveTo(415,-237); c.lineTo(500,149); c.lineTo(500,178); c.lineTo(415,-209); c.closePath(); c.fill();
    c.save(); c.beginPath(); c.moveTo(-470,-211); c.lineTo(415,-265); c.lineTo(500,149); c.lineTo(-406,242); c.closePath(); c.clip();
    const g=c.createLinearGradient(-400,-200,400,250); g.addColorStop(0,'#d6b784'); g.addColorStop(.5,'#dfc493'); g.addColorStop(1,'#c4a473'); c.fillStyle=g; c.fillRect(-550,-395,1100,790);
    const rand=seeded(882);
    for(let i=0;i<180;i++){let y=rand()*650-320; c.beginPath(); c.moveTo(-550,y); c.bezierCurveTo(-250,y-25+rand()*10,150,y-26,550,y-75); c.strokeStyle=i%4===0?'#b18b5535':'#f4dfb52e'; c.lineWidth=rand()*2+.4; c.stroke();}
    for(let y=-220;y<300;y+=105){c.beginPath();c.moveTo(-550,y);c.lineTo(550,y-82);c.strokeStyle='#a37e4b38';c.lineWidth=1.2;c.stroke();}
    for(let i=0;i<2200;i++){c.fillStyle=rand()>.5?'#fff9df0c':'#84612f09';c.fillRect(rand()*1100-550,rand()*790-395,rand()*7+1,1);}
    c.restore(); c.beginPath(); c.moveTo(-470,-211);c.lineTo(415,-265);c.lineTo(500,149);c.lineTo(-406,242);c.closePath();c.strokeStyle='#eed8ae';c.lineWidth=3;c.stroke();c.restore();texture.refresh();
    this.desk.add(this.add.image(-550,-378,'wood').setOrigin(0));
  }
  private makeProps() {
    const g = this.add.graphics();
    g.fillStyle(0x4a4d36,0.14).fillEllipse(-294,-119,168,38); g.fillStyle(0x616d43).fillEllipse(-310,-142,108,47);
    g.fillStyle(0x84925d).fillEllipse(-310,-153,100,43).lineStyle(3,0x57633c).strokeEllipse(-310,-153,100,43);
    g.lineStyle(9,0x647249).lineBetween(-306,-153,-330,-259).lineBetween(-330,-259,-276,-294);
    g.lineStyle(4,0x9aa878).lineBetween(-306,-153,-330,-259).lineBetween(-330,-259,-276,-294);
    g.fillStyle(0x778751).fillEllipse(-268,-287,106,45); g.fillStyle(0x697847).fillTriangle(-321,-289,-217,-289,-239,-342);g.fillTriangle(-321,-289,-239,-342,-280,-345);
    g.fillStyle(0xf3e3a8).fillEllipse(-269,-282,90,28);
    this.desk.add(g);
    const note = this.add.container(294,-181).setAngle(-8);
    const n = this.add.graphics().fillStyle(0x655b2a,.12).fillRect(-58,-43,130,107).fillStyle(0xd7e57c).fillRect(-65,-50,130,107);
    n.fillStyle(0xf1efcf,.6).fillRect(-26,-60,51,18);
    note.add([n,this.add.text(0,-8,'이번 시험도\n일단 끝!',{fontFamily:'"Noto Sans KR",sans-serif',fontSize:'21px',fontStyle:'bold',color:'#5e6b32',align:'center',lineSpacing:6}).setOrigin(.5)]);this.desk.add(note);
    const book=this.add.container(-332,110).setAngle(-13);const b=this.add.graphics().fillStyle(0x6d593c,.15).fillRoundedRect(-69,-53,148,110,3).fillStyle(0xf1ebd8).fillRoundedRect(-73,-59,145,106,2).fillStyle(0x687c53).fillRoundedRect(-75,-65,145,103,3).fillStyle(0x82956b).fillRect(-75,-65,13,103);
    book.add([b,this.add.text(-43,-42,'NOT TODAY.',{fontFamily:'monospace',fontSize:'13px',color:'#d9e2c6'}),this.add.text(-43,-4,'내일의 나에게',{fontFamily:'sans-serif',fontSize:'11px',color:'#b9c6a8'})]);this.desk.add(book);
    const pen=this.add.graphics().fillStyle(0x665332,.2).fillRoundedRect(-205,122,14,140,4).fillStyle(0x586344).fillRoundedRect(-213,114,11,136,4).fillStyle(0xc6bd99).fillRect(-213,116,11,28).fillStyle(0xe4d2a6).fillTriangle(-213,250,-202,250,-207,267).fillStyle(0x333829).fillTriangle(-210,261,-205,261,-207,267);pen.setAngle(-24);this.desk.add(pen);
    const eraser=this.add.graphics().fillStyle(0x735c40,.15).fillRoundedRect(-289,211,59,29,3).fillStyle(0xe6c5ad).fillRoundedRect(-294,203,60,28,3).fillStyle(0xede7d5).fillRect(-284,203,33,28).lineStyle(1,0xbeb49a).lineBetween(-284,204,-284,230);eraser.setAngle(7);this.desk.add(eraser);
  }
  private makeShredder(){
    this.shredder=this.add.container(912,540).setDepth(12);
    const g=this.add.graphics().fillStyle(0x4b422d,.18).fillEllipse(0,139,178,43).fillStyle(0x414b38).fillRoundedRect(-78,-6,156,145,12).fillStyle(0x293429).fillRoundedRect(-76,2,154,135,10).fillStyle(0x525f43).fillRoundedRect(-88,-36,176,58,10);
    g.fillStyle(0x20291f).fillRoundedRect(-64,-16,128,10,4).fillStyle(0x94a269).fillRoundedRect(-67,-18,134,3,1).fillStyle(0xd5f349).fillCircle(62,-24,4).fillStyle(0x151d17).fillRoundedRect(-51,40,102,67,5);
    g.lineStyle(1,0x657154,.7);for(let x=-43;x<50;x+=12)g.lineBetween(x,49,x,98);
    g.fillStyle(0xd9d7bb).fillRect(-38,82,6,21).fillRect(-17,74,5,26).fillRect(5,84,6,18).fillRect(27,78,5,23);
    this.shredder.add([g,this.add.text(0,120,'GOODBYE, EXAM.',{fontFamily:'monospace',fontSize:'8px',color:'#9ba88d'}).setOrigin(.5)]);
  }
  private paperTexture(name:string,key:string){
    const texture=this.textures.createCanvas(key,240,320)!;const c=texture.context;const rand=seeded(name.length*81+62);
    c.fillStyle='#58452d20';c.fillRect(15,17,213,291);c.fillStyle='#fffdf1';c.fillRect(9,9,213,291);c.strokeStyle='#d7d6bf';c.lineWidth=1;c.strokeRect(9.5,9.5,212,290);
    c.fillStyle=INK;c.font=font(10,500);c.fillText('2026학년도 · 중간고사',27,37);
    c.font=font(name.length>12?17:23,800);let title=name;if(title.length>16)title=title.slice(0,15)+'…';c.fillText(title,26,72,178);
    c.fillStyle='#9a9c87';c.font=font(8);c.fillText('학번 ______________   이름 __________',27,93);c.strokeStyle='#9ea28b';c.beginPath();c.moveTo(27,104);c.lineTo(204,104);c.stroke();
    for(let i=0;i<4;i++){const y=128+i*39;c.fillStyle='#626b52';c.font=font(8,600);c.fillText(`${i+1}.`,27,y);c.fillStyle='#c0c3ac';c.fillRect(41,y-5,130+rand()*25,2);c.fillRect(41,y+3,95+rand()*50,2);c.strokeStyle='#a8ae96';for(let j=0;j<4;j++){c.beginPath();c.arc(44+j*40,y+16,3,0,Math.PI*2);c.stroke();c.fillStyle='#a6ac93';c.fillRect(51+j*40,y+15,18,1);}}
    c.font='8px monospace';c.fillStyle='#a9ad99';c.fillText('YOU DID YOUR BEST.',27,282);c.fillText('1 / 1',177,282);texture.refresh();return key;
  }
  private crumpleTexture(p:Paper,step:number){
    const key=`${p.texture}-crumple-${step}`;if(this.textures.exists(key))return key;
    const tex=this.textures.createCanvas(key,240,320)!;this.dynamicTextureKeys.push(key);const c=tex.context;const rand=seeded(271+step*19);const w=196-step*21,h=282-step*33;const cx=120,cy=160;
    const points:Array<[number,number]>=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const r=.82+rand()*.18;points.push([cx+Math.cos(a)*w*.5*r,cy+Math.sin(a)*h*.5*r]);}
    c.save();c.shadowColor='#58452d40';c.shadowBlur=9;c.shadowOffsetY=8;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle='#eee8d3';c.fill();c.shadowColor='transparent';
    c.clip();
    const shades=['#fffdf0','#e8e1cb','#f6f0de','#d7d0b9','#fdf9e8','#e0d9c1'];
    for(let i=0;i<points.length;i++){const midx=cx+(rand()-.5)*w*.44,midy=cy+(rand()-.5)*h*.44;c.beginPath();c.moveTo(...points[i]);c.lineTo(...points[(i+1)%points.length]);c.lineTo(midx,midy);c.closePath();c.fillStyle=shades[i%shades.length];c.fill();c.strokeStyle='#9d987d66';c.lineWidth=.8;c.stroke();}
    for(let i=0;i<8;i++){c.beginPath();c.moveTo(cx+(rand()-.5)*w,cy+(rand()-.5)*h);c.lineTo(cx+(rand()-.5)*w,cy+(rand()-.5)*h);c.strokeStyle='#ada58d66';c.stroke();}
    if(step<4){c.save();c.translate(cx,cy-h*.17);c.rotate(-.15*step);c.font=font(17-step*2,700);c.fillStyle='#687052';c.fillText(p.name.slice(0,10),-w*.3,0,w*.6);c.restore();}
    c.restore();tex.refresh();return key;
  }
  private createPapers(names:string[]){
    names.forEach((name,index)=>{
      const key=`paper-${this.run}-${index}`;this.dynamicTextureKeys.push(key);this.paperTexture(name,key);
      const angle=-15+index*13;const x=(index-(names.length-1)/2)*95;const y=-10+Math.abs(index-(names.length-1)/2)*16;
      const view=this.add.container(x,y).setAngle(angle).setScale(names.length>5?.72:.88);
      const ring=this.add.graphics().lineStyle(3,0x8d9d4e,.85).strokeRoundedRect(-119,-159,234,317,5).setVisible(false);
      const sheet=this.add.image(0,0,key);view.add([ring,sheet]);
      const hit=this.add.rectangle(0,0,222,300,0xffffff,0).setInteractive({useHandCursor:true});view.add(hit);
      hit.on('pointerdown',(pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
        event.stopPropagation();if(!this.active){this.hooks.onMessage('과목을 추가하고 책상에 앉아 봐.');return;}
        if(this.mode==='flip'){this.startCharge('pointer');return;}
        if(this.selected!==index){this.selectPaper(index);return;}this.processPaper(pointer.x,pointer.y);
      });
      this.paperLayer.add(view);this.papers.push({name,mode:'',progress:0,done:false,view,sheet,ring,x,y,angle,texture:key});
    });
  }
  private layoutPapers(){
    this.papers.forEach((p,i)=>{
      const current=i===this.selected;this.tweens.killTweensOf(p.view);p.ring.setVisible(current&&!p.done);
      let x=p.x,y=p.y,angle=p.angle,scale=this.papers.length>5?.72:.88;
      if(current){x=this.mode==='shred'?362:-10;y=this.mode==='shred'?26:-10;angle=this.mode==='shred'?0:-5;scale=this.mode==='shred'?.75:1.04;this.paperLayer.bringToTop(p.view);}
      else{x=p.x-(i<this.selected?125:-95);y=p.y+28;scale*=.84;}
      if(p.mode==='shred'&&p.progress>0){p.sheet.setCrop(0,0,240,Math.max(1,320-p.progress*40));p.sheet.setY(p.progress*40);}
      this.tweens.add({targets:p.view,x,y,angle,scale,duration:260,ease:'Cubic.Out'});
    });
  }
  private processPaper(x:number,y:number){
    if(this.flipped||this.tearingBusy)return;const p=this.papers[this.selected];if(!p)return;
    if(p.done){this.hooks.onMessage('이 과목은 처리 끝! 다른 시험지를 골라 봐.');return;}
    if(!advancePaper(p,this.mode))return;
    this.fxAudio.play(this.mode==='crumple'?'crumple':'shred');
    this.tweens.killTweensOf(p.sheet);
    if(this.mode==='crumple'){
      p.sheet.setCrop();p.sheet.setY(0);p.sheet.setTexture(this.crumpleTexture(p,p.progress));p.sheet.setAngle(Phaser.Math.Between(-9,9));p.sheet.setScale(.95);
      this.tweens.add({targets:p.sheet,scale:1,angle:0,duration:160,ease:'Back.Out'});
      this.floatingWord(x,y, ['바스락.','꾸깃!','조금 더.','와작.','마지막!','후련.'][p.progress-1]);
      this.cameras.main.shake(75,.0015);
    }else{
      p.sheet.setTexture(p.texture);p.sheet.setCrop(0,0,240,Math.max(1,320-p.progress*40));p.sheet.setY(p.progress*40);
      this.emitStrips();this.tweens.add({targets:this.shredder,angle:{from:-1,to:1},yoyo:true,repeat:2,duration:30,onComplete:()=>this.shredder.setAngle(0)});
      this.floatingWord(875,365,p.done?'잘 가.':'드르륵.');
      if(p.done)p.sheet.setVisible(false);
    }
    if(p.done){p.ring.setVisible(false);this.fxAudio.play('done');this.hooks.onMessage(`${p.name}, 처리 완료. 수고했어!`);}
    this.hooks.onProgress();
  }
  private floatingWord(x:number,y:number,word:string){const t=this.add.text(Phaser.Math.Clamp(x,100,1000),Phaser.Math.Clamp(y-40,90,680),word,{fontFamily:'"Noto Sans KR",sans-serif',fontSize:'27px',fontStyle:'bold',color:'#43502e',stroke:'#faf4dc',strokeThickness:4}).setOrigin(.5).setDepth(60).setAngle(Phaser.Math.Between(-12,10));this.effects.add(t);this.tweens.add({targets:t,y:t.y-65,alpha:0,duration:750,ease:'Cubic.Out',onComplete:()=>t.destroy()});}
  private emitStrips(){for(let i=0;i<12;i++){const strip=this.add.rectangle(860+Math.random()*100,543,4+Math.random()*5,25+Math.random()*24,[0xf7f1dc,0xe9e3ca,0xfffae9][i%3]).setAngle(Phaser.Math.Between(-12,12));this.effects.add(strip);this.tweens.add({targets:strip,x:strip.x+Phaser.Math.Between(-90,90),y:680+Math.random()*70,angle:Phaser.Math.Between(-150,150),alpha:.1,duration:650+Math.random()*450,ease:'Quad.Out',onComplete:()=>strip.destroy()});}}
  private makeChargeUI(){
    this.chargeUI=this.add.container(550,676).setDepth(80).setVisible(false);
    const bg=this.add.graphics().fillStyle(0x283222,.97).fillRoundedRect(-212,-45,424,99,11);
    this.chargeText=this.add.text(0,-18,'SPACE 꾹 누르고 → 놓기',{fontFamily:'"Noto Sans KR",sans-serif',fontSize:'17px',fontStyle:'bold',color:'#f1f5dd'}).setOrigin(.5);
    const barBg=this.add.graphics().fillStyle(0x566046).fillRoundedRect(-180,11,360,9,4);this.chargeBar=this.add.graphics();
    this.chargeUI.add([bg,this.chargeText,barBg,this.chargeBar]);
  }
  private startCharge(source:'keyboard'|'pointer'){
    if(!this.active||this.flipped||this.mode!=='flip'||this.chargeStart!==null)return;
    this.chargeStart=performance.now();this.chargeSource=source;this.charged=false;this.fxAudio.play('charge');this.chargeUI.setVisible(true);
  }
  private cancelCharge(){this.chargeStart=null;this.chargeSource=null;this.charged=false;if(this.chargeBar)this.chargeBar.clear();if(this.chargeText)this.chargeText.setText('SPACE 꾹 누르고 → 놓기').setColor('#f1f5dd');if(this.desk&&!this.flipped)this.desk.setPosition(550,378);}
  private releaseCharge(){
    if(this.chargeStart===null)return;const ready=canFlip(this.chargeStart,performance.now());this.cancelCharge();
    if(ready)this.flipDesk();else this.hooks.onMessage('조금만 더 꾹! 1.5초를 채운 뒤 놓아 봐.');
  }
  private flipDesk(){
    if(this.flipped)return;this.flipped=true;this.chargeUI.setVisible(false);this.fxAudio.play('flip');this.cameras.main.shake(500,.014);this.cameras.main.flash(120,246,245,217);
    this.tweens.killTweensOf(this.desk);this.tweens.add({targets:this.desk,angle:-31,y:455,x:485,scaleX:1.02,scaleY:.69,duration:480,ease:'Back.In'});
    this.papers.forEach((p,i)=>{
      this.tweens.killTweensOf(p.view);const matrix=p.view.getWorldTransformMatrix();const pos=new Phaser.Math.Vector2(matrix.tx,matrix.ty);
      this.paperLayer.remove(p.view);this.effects.add(p.view);p.view.setPosition(pos.x,pos.y);p.ring.setVisible(false);
      this.tweens.add({targets:p.view,x:pos.x+Phaser.Math.Between(-270,270),y:Phaser.Math.Between(-160,110),angle:p.view.angle+Phaser.Math.Between(-230,230),duration:450+i*25,ease:'Cubic.Out',onComplete:()=>{this.tweens.add({targets:p.view,y:Phaser.Math.Between(690,850),x:p.view.x+Phaser.Math.Between(-140,140),angle:p.view.angle+Phaser.Math.Between(-160,160),duration:750,ease:'Quad.In'});}});
      p.done=true;
    });
    for(let i=0;i<23;i++){const piece=this.add.rectangle(550,380,Phaser.Math.Between(8,18),Phaser.Math.Between(16,35),[0xf4edd7,0xc5d16f,0x768358][i%3]).setAngle(i*17);this.effects.add(piece);this.tweens.add({targets:piece,x:Phaser.Math.Between(30,1070),y:Phaser.Math.Between(40,740),angle:Phaser.Math.Between(-340,340),alpha:0,duration:1200,ease:'Cubic.Out',onComplete:()=>piece.destroy()});}
    const run=this.run;this.time.delayedCall(420,()=>{if(run===this.run)this.floatingWord(550,300,'시험 끝. 내 세상 시작.');});
    this.hooks.onProgress();this.hooks.onMessage('시원하다. 오늘도 시험 보느라 수고했어.');
  }
  update(){
    if(this.chargeStart===null||this.flipped)return;const progress=chargeProgress(this.chargeStart,performance.now());
    this.chargeBar.clear().fillStyle(progress>=1?0xe1ff65:0xc3de5a).fillRoundedRect(-180,11,Math.max(1,360*progress),9,4);
    this.desk.setPosition(550+(Math.random()-.5)*progress*12,378+(Math.random()-.5)*progress*8);
    if(progress>=1){this.chargeText.setText('준비됐어. 손을 떼!').setColor('#d5f349');if(!this.charged){this.charged=true;this.fxAudio.play('done');}}
    else this.chargeText.setText(`꾹… ${(progress*HOLD_MS/1000).toFixed(1)} / 1.5초`);
  }
}
