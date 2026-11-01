/* Fizya v3 — ADDITIVE magnetic studio. Original v3 code and labs are untouched. */
(function(){
'use strict';
const MU=4*Math.PI*1e-7, TWO=Math.PI*2;
const forms=[['wire','Straight Wire','السلك المستقيم'],['loop','Circular Loop','الحلقة الدائرية'],['coil','Multi-turn Coil','ملف متعدد اللفات'],['solenoid','Solenoid','الملف الحلزوني'],['parallel','Parallel Wires','سلكان متوازيان'],['perpendicular','Perpendicular Wires','سلكان متعامدان'],['flux','Magnetic Flux','الفيض المغناطيسي']];
const names=Object.fromEntries(forms.map(([id,en])=>[id,en]));
const initial=()=>({form:'wire',view:'2d',on:true,current:4,current2:3,direction:1,direction2:1,turns:30,radius:.10,length:.5,gap:.22,angle:35,externalB:.25,probeX:.06,probeY:.08,showLines:true,showArrows:true,showCompass:true,showCurrent:true,yaw:.7,pitch:.42,zoom:1});
let s=initial(),lastCanvas=null,stageRAF=0,phase=0,frameTime=0,mouseOrbit=null,probeDragging=false;
let explored=new Set(['wire']), views=new Set(['2d']), reversed=false;
const f=(n,d=2)=>Number.isFinite(n)?Number(n).toFixed(d):'—';
const text=(ar,en)=>uiLang==='en'?en:ar;
const titleForm=id=>{const row=forms.find(x=>x[0]===id);return row?text(row[2],row[1]):id};
function onCurrent(s){return s.on?s.current:0}
function field(s){
 const I=onCurrent(s)*s.direction,R=Math.max(.001,s.radius),N=s.form==='loop'?1:s.turns;
 switch(s.form){
 case 'wire': {const r=Math.hypot(s.probeX,s.probeY);return {b:r<.003?NaN:MU*I/(TWO*r),formula:'B = μ₀I / (2πr)',at:'عند نقطة القياس P',dir:I>=0?'اتجاه اليد اليمنى':'عكس اتجاه اليد اليمنى'};}
 case 'loop':return {b:MU*N*I/(2*R),formula:'B(center) = μ₀NI / (2R)',at:'مركز الحلقة',dir:I>=0?'خارج الصفحة ⊙':'داخل الصفحة ⊗'};
 case 'coil':return {b:MU*N*I/(2*R),formula:'B(center) = μ₀NI / (2R)',at:'مركز الملف متقارب اللفات',dir:I>=0?'خارج الصفحة ⊙':'داخل الصفحة ⊗'};
 case 'solenoid':return {b:MU*N*I/s.length,formula:'B ≈ μ₀NI / L',at:'داخل سولينويد طويل (تقريب)',dir:I>=0?'القطب N يمينًا':'القطب N يسارًا'};
 case 'parallel':{const x1=-s.gap/2,x2=s.gap/2,x=s.probeX,da=x-x1,db=x-x2;
   const b1=Math.abs(da)<.003?NaN:-MU*I/(TWO*da);
   const b2=Math.abs(db)<.003?NaN:-MU*(s.on?s.current2*s.direction2:0)/(TWO*db);
   return {b:b1+b2,b1,b2,formula:'Bₙₑₜ = B₁ + B₂ (بالاتجاه)',at:'عند النقطة P بين السلكين أو خارجهما',dir:b1+b2>=0?'خارج الصفحة ⊙':'داخل الصفحة ⊗'};}
 case 'perpendicular':{const x=s.probeX,y=s.probeY;
   // X-directed conductor: B_z = μ0 I_x/(2π y); Y-directed conductor: B_z = -μ0 I_y/(2π x).
   const b1=Math.abs(y)<.003?NaN:MU*I/(TWO*y);
   const b2=Math.abs(x)<.003?NaN:-MU*(s.on?s.current2*s.direction2:0)/(TWO*x);
   return {b:b1+b2,b1,b2,formula:'Bₙₑₜ = Bₓ + Bᵧ (بالاتجاه)',at:'عند نقطة P في مستوى السلكين',dir:b1+b2>=0?'خارج الصفحة ⊙':'داخل الصفحة ⊗'};}
 case 'flux':{const b=s.externalB,area=Math.PI*R*R,phi=b*area*Math.sin(s.angle*Math.PI/180);
   return {b,phi,area,formula:'Φ = BA sin θ',at:'زاوية θ بين مستوى الملف والمجال',dir:'المجال الخارجي ثابت الاتجاه'};}
 }
}
function niceB(v){if(!Number.isFinite(v))return 'اختر نقطة خارج السلك';const a=Math.abs(v);return a>=.001?f(a*1000,3)+' mT':f(a*1e6,2)+' μT';}
const v2=(x,y)=>`${x.toFixed(1)},${y.toFixed(1)}`;
const sym=(x,y,label,cl='mag-caption')=>`<text x="${x}" y="${y}" class="${cl}" text-anchor="middle">${label}</text>`;
const lineS=(x1,y1,x2,y2,color='#f4b575',w=4,more='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" ${more}/>`;
const circ=(x,y,r,fill='none',stroke='#edaf6c',w=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
function arrow(x1,y1,x2,y2,c='#79eddb',w=2.5){const t=Math.atan2(y2-y1,x2-x1),a=10;return `${lineS(x1,y1,x2,y2,c,w)}<path d="M${v2(x2,y2)}L${v2(x2-a*Math.cos(t-.48),y2-a*Math.sin(t-.48))}L${v2(x2-a*Math.cos(t+.48),y2-a*Math.sin(t+.48))}Z" fill="${c}"/>`}
function arrowRing(cx,cy,r,d,s){const a=-Math.PI*.32,b=a+(d>0?1:-1)*Math.PI*1.73;
 const p=(ang)=>[cx+r*Math.cos(ang),cy+r*Math.sin(ang)],pa=p(a),pb=p(b),t=b+(d>0?Math.PI/2:-Math.PI/2);
 return `<path d="M${v2(...pa)} A${r} ${r} 0 1 ${d>0?1:0} ${v2(...pb)}" fill="none" stroke="#6be7d1" stroke-width="2.5" stroke-dasharray="7 6"/>${s.showArrows?arrow(pb[0]-13*Math.cos(t),pb[1]-13*Math.sin(t),pb[0],pb[1]):''}`;
}
function coil2(s,cx,cy,r,multi){let result='';const many=multi?Math.min(11,Math.max(2,Math.round(s.turns/12))):1;
 for(let i=0;i<many;i++){const off=(i-(many-1)/2)*3.5;result+=circ(cx+off,cy+off,r,'none','#ffc683',i===many-1?4.8:2);}
 if(s.on&&s.current>0&&s.showCurrent)result+=`<circle class="mag-dot-moving" cx="${cx}" cy="${cy-r}" r="5" fill="#d9fff3"><animateMotion dur="${Math.max(.7,4/(.5+s.current/3))}s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear" path="M${cx} ${cy-r}a${r} ${r} 0 1 ${s.direction===1?1:0} 0 ${2*r}a${r} ${r} 0 1 ${s.direction===1?1:0} 0 ${-2*r}"/></circle>`;
 if(s.on&&s.current>0&&s.showLines){const op=Math.min(1,.2+s.current/11);result+=`<g opacity="${op}">`; for(let rr of [42,72])result+=circ(cx,cy,rr,'none','#5cceb9',2); result+='</g>'; }
 result+=sym(cx,cy+10,s.on?(s.direction===1?'⊙':'⊗'):'·','mag-core');
 return result;
}
function field2D(s,calc){const powered=s.on&&s.current>0, d=s.direction;
 let content=`<defs><linearGradient id="mag-copper" x1="0" x2="1"><stop stop-color="#ad6c3d"/><stop offset=".48" stop-color="#ffe3a6"/><stop offset="1" stop-color="#98532a"/></linearGradient></defs>`;
 content+=`<rect x="12" y="10" width="596" height="300" rx="16" fill="#102c41" fill-opacity=".35" stroke="#386079"/>`;
 if(s.form==='wire'){
 const cx=310,cy=161,rr=powered?1:0;
 content+=sym(308,40,'LONG STRAIGHT WIRE · مقطع عرضي')+circ(cx,cy,17,'#ac6e43','#ffcf8b',3)+sym(cx,cy+9,d>0?'⊙':'⊗','mag-core');
 if(powered&&s.showLines)for(let r of [44,77,111,145])content+=arrowRing(cx,cy,r,d,s);
 const px=310+s.probeX*480,py=161-s.probeY*390;
 if(s.showCompass){let r=Math.hypot(s.probeX,s.probeY)||1,tx=-s.probeY/r*s.direction,ty=-s.probeX/r*s.direction;content+=`<g class="mag-probe" data-mag-probe="1" transform="translate(${px},${py})">${circ(0,0,13,'#f1f5ed','#71dbc5',2)}${arrow(-tx*9,-ty*9,tx*9,ty*9,'#b84c49',2)}${sym(0,-18,'P')}</g>`;}
 }else if(s.form==='loop'||s.form==='coil'){
 const cx=310,cy=160,r=Math.max(34,s.radius*390);
 content+=sym(310,39,s.form==='loop'?'CIRCULAR LOOP · الحلقة الدائرية':'MULTI-TURN COIL · ملف متعدد اللفات');
 content+=coil2(s,cx,cy,r,s.form==='coil');
 if(s.showCompass)content+=sym(310,286,'B at center = '+niceB(calc.b));
 }else if(s.form==='solenoid'){
 const turns=Math.min(26,Math.max(3,Math.ceil(s.turns/7))),width=Math.max(190,Math.min(440,290*s.length/.5)),start=310-width/2,step=width/turns;
 content+=sym(310,35,'SOLENOID · ملف لولبي');
 if(powered&&s.showLines){for(let yy of [123,161,200])content+=arrow(d>0?start+9:start+width-9,yy,d>0?start+width-9:start+9,yy);
 for(let yy of [66,258])content+=`<path d="M${start+width} 161 Q${start+width+85} ${yy} 310 ${yy} Q${start-85} ${yy} ${start} 161" stroke="#45c8bb" stroke-width="2" fill="none" stroke-dasharray="5 8"/>`;}
 content+=`<rect x="${start}" y="111" width="${width}" height="100" rx="48" fill="#1c3a52" fill-opacity=".4" stroke="#416178" stroke-dasharray="5 6"/>`;
 for(let i=0;i<turns;i++){let x=start+(i+.5)*step;content+=`<ellipse cx="${x}" cy="161" rx="${Math.max(4,step*.52)}" ry="56" fill="none" stroke="url(#mag-copper)" stroke-width="${Math.min(4,step*.32)}"/>`;}
 if(powered&&s.showCurrent)content+=`<path d="M${start} 103 H${start+width}" class="mag-current-path ${d<0?'reverse':''}"/>`;
 content+=sym(start-23,165,d>0?'S':'N','mag-pole')+sym(start+width+22,165,d>0?'N':'S','mag-pole');
 }else if(s.form==='parallel'){
 const x1=310-s.gap*360,x2=310+s.gap*360;
 content+=sym(310,40,'TWO PARALLEL WIRES');
 for(const [x,i,dir] of [[x1,s.current,s.direction],[x2,s.current2,s.direction2]]){
 content+=lineS(x,71,x,266,'url(#mag-copper)',9);
 if(powered&&s.showCurrent)content+=`<path d="M${x} ${dir>0?260:76} V${dir>0?76:260}" class="mag-current-path"/>`;
 if(powered&&s.showLines)for(const r of [22,42])content+=arrowRing(x,167,r,dir,s);
 content+=sym(x,291,(dir>0?'↑':'↓')+' '+f(i,1)+' A');
 }
 const px=310+s.probeX*620,py=164-s.probeY*260;
 if(s.showCompass)content+=`<g class="mag-probe" data-mag-probe="1" transform="translate(${px},${py})">${circ(0,0,11,'#f7e8a7','#3ad7cd',2)}${sym(0,-15,'P')}</g>`;
 }else if(s.form==='perpendicular'){
 content+=sym(310,40,'PERPENDICULAR WIRES');
 content+=lineS(105,168,514,168,'url(#mag-copper)',8)+lineS(310,61,310,272,'url(#mag-copper)',8);
 if(powered&&s.showCurrent)content+=arrow(d>0?195:425,168,d>0?425:195,168,'#e3ffef',3)+arrow(s.direction2>0?310:310,s.direction2>0?236:95,310,s.direction2>0?95:236,'#e3ffef',3);
 if(powered&&s.showLines)for(const [x,y] of [[218,100],[400,100],[218,245],[400,245]])content+=sym(x,y,( ( (y<168?1:-1)*d + (x>310?-1:1)*s.direction2 ) >=0 )?'⊙':'⊗','mag-core-small');
 const px=310+s.probeX*450,py=168-s.probeY*420;
 if(s.showCompass)content+=`<g class="mag-probe" data-mag-probe="1" transform="translate(${px},${py})">${circ(0,0,11,'#f7e8a7','#3ad7cd',2)}${sym(0,-16,'P')}</g>`;
 }else if(s.form==='flux'){
 content+=sym(310,42,'MAGNETIC FLUX THROUGH A LOOP');
 const h=100*Math.max(.02,Math.sin(s.angle*Math.PI/180)),ang=s.angle*Math.PI/180;
 content+=`<ellipse cx="310" cy="165" rx="100" ry="${h}" fill="#2a9c9e" fill-opacity=".23" stroke="#f7b66e" stroke-width="5"/>`;
 if(s.showLines&&s.externalB>0)for(let x=130;x<=500;x+=Math.max(45,Math.round(135/(.3+s.externalB))))content+=arrow(x,74,x,262,'#65d9cf',2);
 content+=sym(310,292,`Φ = ${f(calc.phi,5)} Wb  ·  θ = ${s.angle}°`);
 }
 return `<div class="mag-2d-scene"><svg viewBox="0 0 620 320" role="img" aria-label="رسم المجال المغناطيسي في وضع ثنائي الأبعاد">${content}</svg>${['wire','parallel','perpendicular'].includes(s.form)?'<div class="mag-drag-note">اسحب النقطة P لتغيير مكان القياس</div>':''}</div>`;
}
const controlsNote={wire:'المجال دائري حول السلك الطويل، ويتناقص مع البعد عن السلك.',loop:'المجال عند المركز يتناسب مع عدد اللفات والتيار وعكسيًا مع نصف القطر.',coil:'ملف متقارب اللفات؛ الحساب عند مركزه على تقريب لفات دائرية متطابقة.',solenoid:'تقريب المجال الداخلي لملف لولبي طويل. شكل خطوط العودة خارج الملف توضيحي.',parallel:'اتجاه المجال يعتمد على اتجاه التيارين وموقع نقطة P. الحقل المحصل مجموع جبري.',perpendicular:'لكل سلك مساهمة في المجال عند P؛ لا تُستخدم نقطة على السلك نفسه.',flux:'زاوية θ بين مستوى الملف والمجال الخارجي؛ الفيض Φ = BA sin θ.'};
function paint3D(canvas,s,t){const ctx=canvas.getContext('2d');if(!ctx)return;const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
 const grd=ctx.createRadialGradient(W*.5,H*.45,20,W*.5,H*.5,540);grd.addColorStop(0,'#183c55');grd.addColorStop(1,'#091e2e');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
 const sy=Math.sin(s.yaw),cy=Math.cos(s.yaw),sp=Math.sin(s.pitch),cp=Math.cos(s.pitch);
 function project([x,y,z]){const xx=x*cy-z*sy,zz=x*sy+z*cy,yy=y*cp-zz*sp,depth=y*sp+zz*cp,persp=3.8/(3.8+depth*.25),k=135*s.zoom*persp;return [W/2+xx*k,H/2-yy*k,depth];}
 function curve(fn,color='#64ddcf',weight=2,glow=false){ctx.beginPath();for(let j=0;j<=110;j++){const [x,y]=project(fn(j/110));if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.lineCap='round';if(glow){ctx.shadowBlur=10;ctx.shadowColor=color}ctx.stroke();ctx.shadowBlur=0;}
 function sphere(v,color='#e9fff7',r=4){const p=project(v);ctx.beginPath();ctx.arc(p[0],p[1],r,0,TWO);ctx.fillStyle=color;ctx.shadowBlur=8;ctx.shadowColor=color;ctx.fill();ctx.shadowBlur=0;}
 function line3(a,b,color='#eec486',w=5){curve(u=>a.map((v,j)=>v+(b[j]-v)*u),color,w)}
 function arrow3(a,b,color='#68ead8'){const p=project(a),q=project(b),ang=Math.atan2(q[1]-p[1],q[0]-p[0]);ctx.beginPath();ctx.moveTo(...p.slice(0,2));ctx.lineTo(...q.slice(0,2));ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.stroke();ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(q[0]-11*Math.cos(ang-.5),q[1]-11*Math.sin(ang-.5));ctx.lineTo(q[0]-11*Math.cos(ang+.5),q[1]-11*Math.sin(ang+.5));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
 const dim=0.65+(s.on?Math.min(1,s.current/7)*.35:0),fieldColor=s.on?`rgba(97,234,212,${dim})`:'rgba(79,121,140,.25)';
 function ring(center,axis,r,color=fieldColor){curve(u=>{const a=TWO*u;return axis==='y'?[center[0]+r*Math.cos(a),center[1],center[2]+r*Math.sin(a)]:axis==='x'?[center[0],center[1]+r*Math.cos(a),center[2]+r*Math.sin(a)]:[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a),center[2]]},color,2);if(s.showArrows&&s.on){const a=TWO*((t*.35)%1),sign=s.direction;const p=axis==='y'?[center[0]+r*Math.cos(a),center[1],center[2]+r*Math.sin(a)]:axis==='x'?[center[0],center[1]+r*Math.cos(a),center[2]+r*Math.sin(a)]:[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a),center[2]];const tangent=axis==='y'?[-Math.sin(a),0,Math.cos(a)]:axis==='x'?[0,-Math.sin(a),Math.cos(a)]:[-Math.sin(a),Math.cos(a),0];arrow3(p,p.map((v,j)=>v+sign*tangent[j]*.26))}}
 function flow(fn){if(!s.on||!s.showCurrent)return;for(let i=0;i<9;i++){const u=((i/9+(s.direction*t)%1)+1)%1;sphere(fn(u),'#c0fff7',3.8)}}
 // Floor grid establishes depth and camera perspective.
 for(let q=-3;q<=3;q++){curve(u=>[-2+4*u,-1.43,q*.6],'rgba(93,138,161,.10)',1);curve(u=>[q*.6,-1.43,-2+4*u],'rgba(93,138,161,.10)',1)}
 const lineAxis=(loc,axis,d,idx)=>{const a=axis==='y'?[loc,-1.27,0]:[-1.45,loc,0],b=axis==='y'?[loc,1.27,0]:[1.45,loc,0];line3(a,b,'#8a502c',12);line3(a,b,'#ffc47e',7);flow(u=>a.map((v,j)=>v+(b[j]-v)*(d===1?u:1-u)));if(s.showLines&&s.on&&s.current>0)for(const r of [.46,.73])ring(axis==='y'?[loc,idx*.17,0]:[idx*.17,loc,0],axis,r)};
 switch(s.form){
 case 'wire':lineAxis(0,'y',s.direction,0);break;
 case 'loop':case 'coil':{
   const count=s.form==='loop'?1:Math.min(16,Math.max(3,Math.round(s.turns/10))), loopR=.42+s.radius*4;
   for(let k=0;k<count;k++){const z=(k-(count-1)/2)*.065;
    const C=s.form==='loop'?'#ffca80':'#e2aa6c';curve(u=>[loopR*Math.cos(TWO*u),loopR*Math.sin(TWO*u),z],C,4);
   }
   flow(u=>[loopR*Math.cos(TWO*u),loopR*Math.sin(TWO*u),0]);
   if(s.showLines&&s.on&&s.current>0){for(const r of [.56,.88])for(const ang of [0,Math.PI/2])curve(u=>{const a=TWO*u;return [(r+.32*Math.cos(a))*Math.cos(ang),(r+.32*Math.cos(a))*Math.sin(ang),1.08*Math.sin(a)]},fieldColor,2);for(const a of [-.55,.55])arrow3([0,0,a],[0,0,a+s.direction*.34]);}
   break;}
 case 'solenoid':{
   const wraps=Math.max(3,Math.min(28,Math.round(s.turns/6))),len=1.2+s.length*.8;
   const helix=u=>[-len+2*len*u,.66*Math.sin(TWO*wraps*u),.66*Math.cos(TWO*wraps*u)];curve(helix,'#f2b576',5,true);flow(helix);
   if(s.showLines&&s.on&&s.current>0){for(const yy of [-.3,0,.3])arrow3([s.direction>0?-1.15:1.15,yy,0],[s.direction>0?1.15:-1.15,yy,0]);for(const z of [.15,-.15])curve(u=>[1.4*Math.cos(Math.PI*u),1.04*Math.sin(Math.PI*u),z],fieldColor,2);}
   break;}
 case 'parallel':{const delta=.6+s.gap;lineAxis(-delta,'y',s.direction,-1);lineAxis(delta,'y',s.direction2,1);break;}
 case 'perpendicular':{lineAxis(0,'y',s.direction2,0);lineAxis(-.12,'x',s.direction,0);break;}
 case 'flux':{
   const a=(90-s.angle)*Math.PI/180;
   const vertices=Array.from({length:65},(_,i)=>{const phi=TWO*i/64, x=.95*Math.cos(phi), y=.95*Math.sin(phi);return [x*Math.cos(a),y,-x*Math.sin(a)]});
   ctx.beginPath();vertices.forEach((v,i)=>{const p=project(v);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1])});ctx.closePath();ctx.fillStyle='rgba(50,195,180,.22)';ctx.fill();ctx.strokeStyle='#f5bd78';ctx.lineWidth=4;ctx.stroke();
   if(s.showLines&&s.externalB>0)for(const x of [-1.1,-.55,0,.55,1.1].slice(0,Math.max(1,Math.ceil(s.externalB*5))))for(const y of [-.65,.65])arrow3([x,y,-1.1],[x,y,1.1]);break;}
 }
 if(s.showCompass&&['wire','parallel','perpendicular'].includes(s.form)){const x=clamp(s.probeX*3.4,-1.4,1.4),y=clamp(s.probeY*3.5,-.95,.95);sphere([x,y,.8],'#ffe092',7);}
 ctx.textAlign='left';ctx.font='bold 18px Arial';ctx.fillStyle='#e1f9f6';ctx.fillText(names[s.form],20,32);ctx.font='14px Arial';ctx.fillStyle='#95bfc9';ctx.fillText('3D INTERACTIVE • DRAG TO ORBIT',20,H-19);
}

function buttonTile(){return `<button class="special-tile" data-studio-open="1"><span class="tile-symbol">🧭</span><span><strong>${text('معمل المغناطيسية الشامل 2D / 3D','Magnetic Studio 2D / 3D')}</strong><small>${text('٧ تجارب • تحكم مباشر • خطوط المجال والقياسات','7 experiments • live controls • field visualization')}</small></span></button>`;}
// Preserve the original extraTiles output; only append one separate link.
const originalExtraTiles=extraTiles;
extraTiles=function(){return originalExtraTiles().replace('</section>',buttonTile()+'</section>')};
const landingExtra=document.querySelector('.landing-special');if(landingExtra)landingExtra.insertAdjacentHTML('beforeend',buttonTile());
const aside=document.querySelector('.sidebar-lab-links');if(aside)aside.insertAdjacentHTML('beforeend',`<button type="button" class="sidebar-special studio-sidebar-link" data-studio-open="1"><span>🧭</span><span>${text('معمل المغناطيسية الشامل','Magnetic Studio')}<small>2D / 3D • 7 Experiments</small></span></button>`);
function openStudio(){
 specialMode='magStudio';active=-1;
 $('landing').hidden=true;$('lessonView').hidden=true;$('extraView').hidden=false;
 $('sidebar').classList.remove('open');renderNav();
 document.querySelectorAll('.sidebar-special').forEach(x=>x.classList.toggle('selected',x.hasAttribute('data-studio-open')));
 document.title=text('معمل المغناطيسية الشامل | فِيزيا','Magnetic Studio | FIZYA');
 renderPage();window.scrollTo({top:0,behavior:'instant'});
}
const measure=(name,value)=>`<div class="studio-metric"><small>${name}</small><strong>${value}</strong></div>`;
const range=(id,ar,en,min,max,step,unit)=>{
 const v=s[id];return `<label class="studio-control" for="studio-${id}"><span><b>${text(ar,en)}</b><output data-studio-value="${id}">${f(v,Number.isInteger(step)?0:step>=.1?1:2)} ${unit}</output></span><input id="studio-${id}" data-studio-range="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"><span class="studio-minmax"><i>${min}</i><i>${max}</i></span></label>`;};
const toggle=(k,ar,en)=>`<button type="button" data-studio-toggle="${k}" class="studio-chip ${s[k]?'active':''}" aria-pressed="${s[k]}">${s[k]?'✓':'○'} ${text(ar,en)}</button>`;
const dirs=(key,ar,en)=>`<div class="studio-control"><span class="studio-control-title">${text(ar,en)}</span><div class="studio-segment"><button type="button" data-studio-direction="${key}" data-dir="1" class="${s[key]===1?'active':''}">+ ↻</button><button type="button" data-studio-direction="${key}" data-dir="-1" class="${s[key]===-1?'active':''}">− ↺</button></div></div>`;
function controlsHTML(){let h='';
 if(s.form!=='flux')h+=range('current','شدة التيار الأول','Current I₁',0,20,.5,'A');
 if(['parallel','perpendicular'].includes(s.form))h+=range('current2','شدة التيار الثاني','Current I₂',0,20,.5,'A');
 if(s.form!=='flux')h+=dirs('direction','اتجاه التيار الأول','Direction of current I₁');
 if(['parallel','perpendicular'].includes(s.form))h+=dirs('direction2','اتجاه التيار الثاني','Direction of current I₂');
 if(['coil','solenoid'].includes(s.form))h+=range('turns','عدد اللفات N','Number of turns N',1,200,1,'');
 if(['loop','coil','flux'].includes(s.form))h+=range('radius','نصف القطر R','Radius R',.03,.25,.01,'m');
 if(s.form==='solenoid')h+=range('length','طول الملف L','Solenoid length L',.15,1,.05,'m');
 if(s.form==='parallel')h+=range('gap','المسافة بين السلكين','Wire spacing',.10,.5,.01,'m');
 if(['wire','parallel','perpendicular'].includes(s.form))h+=range('probeX','نقطة القياس X','Probe X position',-.35,.35,.01,'m')+range('probeY','نقطة القياس Y','Probe Y position',-.30,.30,.01,'m');
 if(s.form==='flux')h+=range('externalB','المجال الخارجي B','External field B',0,1,.01,'T')+range('angle','زاوية مستوى الملف θ','Coil plane angle θ',0,90,1,'°');
 h+=`<div class="studio-control"><span class="studio-control-title">${text('أدوات العرض','Display tools')}</span><div class="studio-toggle-row">${toggle('showLines','خطوط المجال','Field lines')}${toggle('showArrows','أسهم الاتجاه','Direction arrows')}${toggle('showCompass','نقطة القياس / البوصلة','Probe / compass')}${toggle('showCurrent','حركة التيار','Current flow')}</div></div>`;
 if(s.form!=='flux')h+=`<button class="studio-power" data-studio-power="1">${s.on?text('⏸ إيقاف التيار','⏸ Switch current off'):text('▶ تشغيل التيار','▶ Switch current on')}</button>`;
 if(s.view==='3d')h+=range('zoom','تقريب الكاميرا','Camera zoom',.55,1.8,.05,'×')+`<button class="studio-reset" data-studio-resetcamera="1">⟲ ${text('إعادة زاوية الكاميرا','Reset camera angle')}</button>`;
 return h;
}
function sceneHTML(){const result=field(s);return s.view==='2d'?field2D(s,result):`<div class="mag-3d-scene"><canvas id="studio-canvas" width="900" height="490" aria-label="Interactive 3D magnetic field simulation"></canvas><div class="mag-3d-hint">${text('اسحب لتدوير المشهد · عجلة الماوس للتكبير','Drag to orbit · scroll to zoom')}</div></div>`;}
function metricsHTML(){const calc=field(s),val=niceB(calc.b);let h=measure(s.form==='flux'?text('المجال الخارجي B','External field B'):text('كثافة المجال |B|','Magnetic field |B|'),s.form==='flux'?f(s.externalB,3)+' T':val);
 h+=measure(s.form==='flux'?text('الفيض Φ','Flux Φ'):text('التيار الأول I₁','Current I₁'),s.form==='flux'?f(calc.phi,6)+' Wb':(s.on?s.current:0).toFixed(1)+' A');
 if(['parallel','perpendicular'].includes(s.form)){h+=measure(text('مساهمة السلك الأول','Wire 1 contribution'),niceB(calc.b1));h+=measure(text('مساهمة السلك الثاني','Wire 2 contribution'),niceB(calc.b2));h+=measure(text('المحصلة باتجاه','Signed resultant'),Number.isFinite(calc.b)?(calc.b>=0?'⊙ ':'⊗ ')+val:text('نقطة على السلك','Probe on wire'));}
 if(s.form==='flux')h+=measure(text('مساحة الحلقة','Loop area'),f(calc.area,4)+' m²');
 h+=measure(text('القانون المستخدم','Formula'),calc.formula);
 return h;
}
const question={
 wire:['لو زودت شدة التيار مع ثبات المسافة، المجال هيعمل إيه؟','What happens to B if current increases at constant distance?',['هيزود','هيقل','مش هيتغير'],['Increase','Decrease','Stay the same'],0,'B ∝ I'],
 loop:['لو كبرت نصف قطر الحلقة مع ثبات التيار، المجال عند المركز هيعمل إيه؟','What happens at the center if loop radius increases?',['هيزود','هيقل','مش هيتغير'],['Increase','Decrease','Stay the same'],1,'B = μ₀I / (2R)'],
 coil:['لو زودت اللفات، المجال عند المركز هيعمل إيه؟','What if the number of turns increases?',['هيزود','هيقل','مش هيتغير'],['Increase','Decrease','Stay the same'],0,'B ∝ N'],
 solenoid:['لو زودت طول الملف مع ثبات اللفات والتيار، المجال هيعمل إيه؟','What if solenoid length increases while N and I stay fixed?',['هيزود','هيقل','مش هيتغير'],['Increase','Decrease','Stay the same'],1,'B ≈ μ₀NI/L'],
 parallel:['لما سلكين متوازيين يحملوا تيارًا في نفس الاتجاه، بيحصل بينهم إيه؟','Two parallel wires carrying current in the same direction will...',['يتجاذبوا','يتنافروا','ملهمش تأثير'],['Attract','Repel','Not interact'],0,'الأسلاك المتوازية ذات التيار في نفس الاتجاه تتجاذب.'],
 perpendicular:['لو عكست اتجاه تيار سلك واحد، محصل المجال عند P ممكن تتغير؟','If you reverse one wire current, can the resultant field at P change?',['أيوه','لأ','بتفضل ثابتة دايمًا'],['Yes','No','Always stays fixed'],0,'التراكب الاتجاهي يتغير عند عكس تيار أحد السلكين.'],
 flux:['لو مستوى الملف بقى عمودي على المجال، الفيض هيكون؟','If the coil plane is perpendicular to the field, the flux is...',['أقصى قيمة','صفر','سالب دائمًا'],['Maximum','Zero','Always negative'],0,'Φ = BA sin θ؛ الزاوية هنا بين المستوى والمجال.']
};
let quizChoice={};
function quizHTML(){const q=question[s.form],choice=quizChoice[s.form];return `<section class="studio-panel studio-quiz"><h3>🎯 ${text('تحدي سريع','Quick challenge')}</h3><p>${text(q[0],q[1])}</p><div class="studio-quiz-options">${q[2].map((a,i)=>`<button data-studio-answer="${i}" class="${choice===i?(i===q[4]?'correct':'wrong'):''}" aria-pressed="${choice===i}">${text(a,q[3][i])}</button>`).join('')}</div>${choice===undefined?'':`<p class="studio-quiz-result">${choice===q[4]?text('✓ إجابة صحيحة','✓ Correct'):text('✕ جرب تراجع القانون','✕ Review the formula')} — ${q[5]}</p>`}</section>`;}
function renderPage(){if(specialMode!=='magStudio')return;
 explored.add(s.form);views.add(s.view);
 const html=`<div class="magstudio"><div class="breadcrumb"><button data-studio-home="1">${text('جميع المعامل','All labs')}</button><span> / </span><span>Magnetic Studio</span></div>
 <header class="extra-header studio-header"><div><span class="eyebrow">MAGNETIC STUDIO · 2D / 3D</span><h1>🧭 ${text('معمل المغناطيسية الشامل','Interactive Magnetic Studio')}</h1><p>${text('اختار الشكل، غيّر أي متغير، واتفرج على المجال والقراءات تتغير فورًا. المعامل القديمة محفوظة زي ما هي.','Choose a shape, change the variables, and watch the field and readings update live. All original labs are preserved.')}</p></div><button class="lab-action" data-studio-home="1">${text('← العودة','← Back')}</button></header>
 <section class="studio-panel studio-form-panel"><h2>① ${text('اختار الشكل','Choose an experiment')}</h2><div class="studio-form-grid">${forms.map(([id,en,ar])=>`<button type="button" data-studio-form="${id}" class="studio-form ${s.form===id?'selected':''}" aria-pressed="${s.form===id}"><span>${({wire:'│',loop:'◯',coil:'◎',solenoid:'▥',parallel:'║',perpendicular:'╋',flux:'Φ'})[id]}</span><b>${text(ar,en)}</b></button>`).join('')}</div></section>
 <div class="studio-columns"><div class="studio-maincol"><section class="studio-panel studio-viewport-panel"><div class="studio-viewport-top"><h2>② ${text('شوف التجربة','Live simulation')}</h2><div class="studio-view-tabs"><button data-studio-view="2d" class="${s.view==='2d'?'selected':''}">▣ 2D</button><button data-studio-view="3d" class="${s.view==='3d'?'selected':''}">⬡ 3D</button></div></div><div class="studio-viewport" id="studio-scene">${sceneHTML()}</div><p class="studio-scene-note" id="studio-note"></p></section>
 <section class="studio-panel"><h2>③ ${text('القياسات المباشرة','Live measurements')} <span class="studio-live">● LIVE</span></h2><div class="studio-metrics" id="studio-metrics">${metricsHTML()}</div><p class="studio-explain" id="studio-explain"></p></section>${quizHTML()}
 </div><aside class="studio-panel studio-controls"><h2>④ ${text('لوحة التحكم','Controls')}</h2><p class="studio-controls-description">${text('حرّك المؤشرات؛ القيم والرسم بيتغيروا في نفس اللحظة.','Move the sliders to update the simulation immediately.')}</p><div id="studio-control-list">${controlsHTML()}</div></aside></div>
 <div class="studio-footer-note">${text('ملاحظة علمية: خطوط المجال المرسومة توضيحية؛ معادلات B محسوبة عند نقطة القياس أو المركز وفق افتراضات سلك طويل أو ملف مثالي. تمثيل 3D قابل للدوران وليس محاكي مجال ثلاثي الأبعاد لكل نقطة.','Scientific note: Displayed field lines are illustrative; B values are computed at the probe or center under idealized wire/coil assumptions. The orbitable 3D view is not a full spatial field solver.')}</div></div>`;
 $('extraView').innerHTML=html;
 if(s.view==='3d')startCanvas();
 refreshData();
}
function refreshData(){if(specialMode!=='magStudio')return;const metrics=$('studio-metrics');if(metrics)metrics.innerHTML=metricsHTML();const calc=field(s);const note=$('studio-note');if(note)note.textContent=(s.view==='2d'?text('عرض مسطح • ','2D view • '):text('مجسم قابل للدوران • ','Orbitable 3D • '))+controlsNote[s.form];const explanation=$('studio-explain');if(explanation)explanation.textContent=calc.at+' — '+calc.dir;for(const el of document.querySelectorAll('[data-studio-value]')){const k=el.dataset.studioValue;const input=document.getElementById('studio-'+k);if(input)el.textContent=f(s[k],Number.isInteger(+input.step)?0:+input.step>=.1?1:2)+' '+(k==='turns'?'':k==='angle'?'°':k==='externalB'?'T':k==='current'||k==='current2'?'A':k==='zoom'?'×':'m');}}
function refreshScene(){if(specialMode!=='magStudio')return;if(s.view==='2d'){$('studio-scene').innerHTML=sceneHTML();}else if(!lastCanvas||!lastCanvas.isConnected)startCanvas();refreshData();}
function startCanvas(){cancelAnimationFrame(stageRAF);lastCanvas=$('studio-canvas');frameTime=0;if(!lastCanvas)return;lastCanvas.style.touchAction='none';
 const canvas=lastCanvas;function draw(t){if(specialMode!=='magStudio'||s.view!=='3d'||!canvas.isConnected)return;if(frameTime){phase+=(t-frameTime)/1000*(s.on?(.35+s.current*.035):0)}frameTime=t;paint3D(canvas,s,phase);stageRAF=requestAnimationFrame(draw)}stageRAF=requestAnimationFrame(draw);
}
// New data attributes only. Existing lesson handlers and their state are not touched.
document.addEventListener('click',e=>{
 const open=e.target.closest('[data-studio-open]');if(open){e.preventDefault();openStudio();return;}
 if(specialMode!=='magStudio')return;
 if(e.target.closest('[data-studio-home]')){showHome();return;}
 const choose=e.target.closest('[data-studio-form]');if(choose){s.form=choose.dataset.studioForm;explored.add(s.form);renderPage();return;}
 const view=e.target.closest('[data-studio-view]');if(view){s.view=view.dataset.studioView;views.add(s.view);renderPage();return;}
 const dir=e.target.closest('[data-studio-direction]');if(dir){const id=dir.dataset.studioDirection;s[id]=+dir.dataset.dir;if(s[id]===-1)reversed=true;renderPage();return;}
 const toggle=e.target.closest('[data-studio-toggle]');if(toggle){s[toggle.dataset.studioToggle]=!s[toggle.dataset.studioToggle];renderPage();return;}
 if(e.target.closest('[data-studio-power]')){s.on=!s.on;renderPage();return;}
 if(e.target.closest('[data-studio-resetcamera]')){s.yaw=.7;s.pitch=.42;s.zoom=1;renderPage();return;}
 const answer=e.target.closest('[data-studio-answer]');if(answer){quizChoice[s.form]=+answer.dataset.studioAnswer;const box=document.querySelector('.studio-quiz');if(box)box.outerHTML=quizHTML();return;}
});
document.addEventListener('input',e=>{if(specialMode!=='magStudio'||!e.target.matches('[data-studio-range]'))return;const key=e.target.dataset.studioRange;s[key]=+e.target.value;refreshScene();});
// Rotating the 3D canvas works with pointer devices, mouse and touch.
document.addEventListener('pointerdown',e=>{if(specialMode!=='magStudio')return;const canvas=e.target.closest('#studio-canvas');if(canvas){mouseOrbit={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture?.(e.pointerId);e.preventDefault();return;}
 if(s.view==='2d'&&e.target.closest('.mag-probe')){probeDragging=true;e.preventDefault();}
});
document.addEventListener('pointermove',e=>{if(specialMode!=='magStudio')return;if(mouseOrbit){s.yaw+=(e.clientX-mouseOrbit.x)*.009;s.pitch=Math.max(-1.4,Math.min(1.4,s.pitch+(e.clientY-mouseOrbit.y)*.009));mouseOrbit.x=e.clientX;mouseOrbit.y=e.clientY;e.preventDefault();return;}
 if(!probeDragging||s.view!=='2d')return;const svg=document.querySelector('#studio-scene svg');if(!svg)return;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const ctm=svg.getScreenCTM();if(!ctm)return;const pos=point.matrixTransform(ctm.inverse());let fx=s.form==='parallel'?620:s.form==='wire'?480:450;let fy=s.form==='parallel'?260:s.form==='wire'?390:420;let originY=s.form==='perpendicular'?168:s.form==='wire'?161:164;s.probeX=Math.round(Math.max(-.35,Math.min(.35,(pos.x-310)/fx))*100)/100;s.probeY=Math.round(Math.max(-.30,Math.min(.30,(originY-pos.y)/fy))*100)/100;
 const mark=svg.querySelector('.mag-probe');if(mark)mark.setAttribute('transform',`translate(${310+s.probeX*fx},${originY-s.probeY*fy})`);refreshData();e.preventDefault();
});
document.addEventListener('pointerup',()=>{if(probeDragging){probeDragging=false;refreshScene()}mouseOrbit=null;});document.addEventListener('pointercancel',()=>{probeDragging=false;mouseOrbit=null;});
document.addEventListener('wheel',e=>{if(specialMode!=='magStudio'||!e.target.closest('#studio-canvas'))return;e.preventDefault();s.zoom=Math.max(.55,Math.min(1.8,s.zoom*(e.deltaY<0?1.07:.93)));refreshData();},{passive:false});
// Keep the existing EN/Arabic toggle's behavior; only refresh this optional page afterward.
const originalChangeLanguage=changeLanguage;
changeLanguage=function(lang){originalChangeLanguage(lang);const link=document.querySelector('.studio-sidebar-link');if(link)link.querySelector('span:nth-child(2)').childNodes[0].textContent=text('معمل المغناطيسية الشامل','Magnetic Studio');if(specialMode==='magStudio')renderPage();};
})();
