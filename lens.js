/* ---- Selected Work: pinned "glass lens + live architecture diagram" ----
   Paper stage, title on the left, one refractive glass lens on the right (same family as the hero
   blob). Scrolling morphs the lens from project to project while the project's real stack draws
   itself around it as a small system diagram with data packets flowing in. Scroll velocity smears
   the image, the pointer tilts the lens and ripples it. Project data is read from the existing
   .project markup, which stays as the no-WebGL / mobile fallback. */
function initLens({splitChars}){
  const work=document.getElementById('work');
  if(!work||!window.THREE||innerWidth<=800) return;
  const items=[...work.querySelectorAll('.project')];
  if(items.length<2) return;
  const N=items.length;
  const LENS_R=.33;                       // lens radius as a fraction of the stage height

  const projects=items.map(a=>{
    const link=a.querySelector('.project-image');
    const raw=a.querySelector('.project-info p').textContent;
    const [lead,...rest]=raw.split('/');
    return {
      href:link.getAttribute('href'),external:link.target==='_blank',img:a.querySelector('img').src,
      no:a.querySelector('.project-no').textContent,title:a.querySelector('h2').textContent,
      desc:lead.trim(),stack:rest.join(',').split(',').map(s=>s.trim()).filter(Boolean).slice(0,5),
      year:a.querySelector('.project-info>span').textContent,
    };
  });

  const canvas=document.createElement('canvas');
  canvas.className='lens-canvas';
  let renderer;
  try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'}); }catch(err){ return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setClearColor(0x000000,0);

  /* ---------- DOM ---------- */
  const pad=n=>String(n).padStart(2,'0');
  const sec=document.createElement('section');
  sec.className='lens';
  sec.setAttribute('aria-label','Selected projects');
  sec.innerHTML=`
    <div class="lens-bigs" aria-hidden="true"></div>
    <div class="lens-copy">
      <div class="lens-top"><span class="lens-count"><b>01</b> / ${pad(N)}</span><p class="lens-desc"></p></div>
      <div class="lens-bottom">
        <div class="lens-titles"></div>
        <div class="lens-row">
          <a class="lens-cta" href="#">View project ↗</a>
          <span class="lens-year"></span>
          <div class="lens-ticks">${projects.map(()=>'<i></i>').join('')}</div>
          <span class="lens-hint">Scroll ↓</span>
        </div>
      </div>
    </div>
    <div class="lens-stage">
      <svg class="lens-svg" aria-hidden="true"><circle class="lens-orbit"/><g class="lens-spokes"></g><g class="lens-dots"></g></svg>
      <div class="lens-nodes" aria-hidden="true"></div>
      <a class="lens-hit" href="#" aria-label="Open project"></a>
    </div>`;
  const stage=sec.querySelector('.lens-stage');
  stage.prepend(canvas);
  work.classList.add('lens-on');
  work.after(sec);

  const q=s=>sec.querySelector(s);
  const hit=q('.lens-hit'),cta=q('.lens-cta'),countEl=q('.lens-count b'),descEl=q('.lens-desc'),yearEl=q('.lens-year');
  const hint=q('.lens-hint'),ticks=[...sec.querySelectorAll('.lens-ticks i')];
  const svg=q('.lens-svg'),orbit=q('.lens-orbit'),spokeG=q('.lens-spokes'),dotG=q('.lens-dots'),nodeLayer=q('.lens-nodes');
  const SVGNS='http://www.w3.org/2000/svg';

  // Per project: an outlined numeral (behind the lens) and the title; both roll in per character.
  const slides=projects.map(p=>{
    const big=document.createElement('div');
    big.className='lens-big'; big.textContent=p.no.replace('.','');
    q('.lens-bigs').appendChild(big);
    const t=document.createElement('div');
    t.className='lens-title';
    t.innerHTML='<h3></h3>'; t.firstChild.textContent=p.title;
    q('.lens-titles').appendChild(t);
    const chars=[...splitChars(big),...splitChars(t.firstChild)];
    // keep each word's letters together so titles only wrap between words
    t.firstChild.querySelectorAll('.char').forEach(c=>{ if(c.previousSibling&&c.previousSibling.nodeType===1&&c.previousSibling.classList.contains('word')) c.previousSibling.appendChild(c); else { const w=document.createElement('span'); w.className='word'; c.before(w); w.appendChild(c); } });
    return {els:[big,t],chars};
  });

  const cursor=document.getElementById('cursor');
  [hit,cta].forEach(el=>{
    el.addEventListener('mouseenter',()=>cursor.classList.add('big'));
    el.addEventListener('mouseleave',()=>cursor.classList.remove('big'));
  });

  /* ---------- Shader scene ---------- */
  const loader=new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const blank=new THREE.DataTexture(new Uint8Array([22,16,42,255]),1,1,THREE.RGBAFormat);
  blank.needsUpdate=true;
  const tex=projects.map(()=>({map:blank,aspect:1}));
  projects.forEach((p,i)=>loader.load(p.img,t=>{
    t.minFilter=THREE.LinearFilter; t.generateMipmaps=false; t.anisotropy=4;
    tex[i]={map:t,aspect:t.image.width/t.image.height};
  }));

  const material=new THREE.ShaderMaterial({
    uniforms:{
      uA:{value:blank},uB:{value:blank},uAsp:{value:new THREE.Vector2(1,1)},uRes:{value:new THREE.Vector2(1,1)},
      uT:{value:0},uMorph:{value:0},uR:{value:LENS_R},uTime:{value:0},uVel:{value:0},uRip:{value:0},uAct:{value:0},uEnter:{value:0},
      uMouse:{value:new THREE.Vector2(.5,.5)},uOff:{value:new THREE.Vector2(0,0)},uTilt:{value:new THREE.Vector2(0,0)},
    },
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uA,uB; uniform vec2 uAsp,uRes,uMouse,uOff,uTilt;
      uniform float uT,uMorph,uR,uTime,uVel,uRip,uAct,uEnter;
      const vec3 NIGHT=vec3(.086,.063,.165), LAV=vec3(.72,.61,1.), IND=vec3(.16,.09,.55);

      // cover-fit a square lens region onto an image of aspect ta
      vec2 cov(vec2 u,float ta){ vec2 s=ta<1.?vec2(1.,ta):vec2(1./ta,1.); return (u-.5)*s+.5; }
      // scroll-velocity smear along y with per-channel (RGB) split
      vec3 samp(sampler2D t,vec2 u,float ta){
        vec2 o=vec2(0.,uVel*.03); vec3 c=vec3(0.);
        for(int i=0;i<5;i++){
          float k=float(i)/4.-.5; vec2 v=u+o*k;
          c.r+=texture2D(t,cov(v+o*.4,ta)).r;
          c.g+=texture2D(t,cov(v,ta)).g;
          c.b+=texture2D(t,cov(v-o*.4,ta)).b;
        }
        return c/5.;
      }
      vec3 grade(vec3 c,float keep){
        float g=dot(c,vec3(.299,.587,.114));
        return mix(mix(NIGHT*1.4,LAV,smoothstep(.0,.95,g)),c,keep);
      }
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

      void main(){
        float asp=uRes.x/uRes.y; vec2 half2=vec2(asp,1.);
        vec2 p=(vUv-.5)*half2;
        vec2 m=(uMouse-.5)*half2; float md=length(p-m);

        // blob silhouette: a soft wobble that swells while the lens morphs between projects
        vec2 q=p-uOff; float d=length(q); float ang=atan(q.y,q.x);
        float wob=(.008+.03*uMorph)*(sin(ang*3.+uTime*1.1)+.7*sin(ang*5.-uTime*1.4)+.4*sin(ang*2.+uTime*.7+1.));
        float R=uR*(1.-.09*uMorph);
        float dd=d-wob;
        float inside=1.-smoothstep(R-.005,R+.002,dd);
        float rel=clamp(dd/R,0.,1.);

        // refraction: magnified at the centre, parallax with the tilt, ripple from the pointer
        vec2 rip=normalize(p-m+1e-4)*sin(md*40.-uTime*5.)*exp(-md*6.)*uRip*.012;
        vec2 u=q/(2.*R)*mix(.56,1.,rel*rel)+.5+uTilt*(1.-rel)*.05+rip/(2.*R);
        float keep=.74+.26*(1.-smoothstep(.0,.22,md))*uAct;
        vec3 ca=grade(samp(uA,u,uAsp.x),keep), cb=grade(samp(uB,u,uAsp.y),keep);

        // next project grows out of the centre as an expanding ring
        float front=uT*1.3;
        float mB=1.-smoothstep(front-.3,front,rel);
        vec3 col=mix(ca,cb,mB);
        col+=LAV*exp(-pow((rel-(front-.15))*10.,2.))*sin(3.14159*uT)*.5;

        // glass: fresnel rim, specular arc, soft highlight, hairline ring
        float fres=pow(rel,2.6);
        col=mix(col,mix(LAV,IND,rel),fres*.55)*(1.-fres*.22);
        vec2 L=normalize(vec2(-.55,.7));
        col+=vec3(.9,.86,1.)*pow(max(dot(normalize(q+1e-4),L),0.),8.)*smoothstep(.55,.97,rel)*.9;
        col+=vec3(1.)*exp(-length(q-L*R*.5)*9./R)*.22;
        col+=vec3(.85,.8,1.)*(1.-smoothstep(.0,.012,abs(dd-R)))*.4;
        col+=(hash(vUv*uRes+uTime)-.5)*.03;

        // outside the lens: violet glow and a soft ground shadow (premultiplied alpha)
        float glow=exp(-max(dd-R,0.)*14.)*.30;
        float sh=exp(-(pow(q.x/(R*.85),2.)+pow((q.y+R*1.22)/(R*.14),2.)))*.35;
        vec3 outc=LAV*glow+IND*sh*(1.-glow);
        float oa=clamp(glow+sh,0.,.6);
        vec3 rgb=col*inside+outc*(1.-inside);
        float a=inside+oa*(1.-inside);
        gl_FragColor=vec4(rgb,a)*uEnter;
      }`,
  });
  const scene=new THREE.Scene(),camera=new THREE.Camera();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  const U=material.uniforms;

  /* ---------- Architecture diagram ---------- */
  // Node slots as fractions of the stage, in the order they get used for 1..5 nodes.
  const SLOT=[[.10,.10],[.89,.17],[.94,.52],[.85,.90],[.11,.83]];
  const ORDER={1:[2],2:[1,4],3:[1,4,2],4:[1,4,2,0],5:[1,4,2,0,3]};
  let diaTweens=[],orbitTween=null;
  const make=(tag,attrs)=>{ const el=document.createElementNS(SVGNS,tag); for(const k in attrs) el.setAttribute(k,attrs[k]); return el; };

  const layoutStage=()=>{
    const w=stage.clientWidth,h=stage.clientHeight;
    if(!w||!h) return;
    renderer.setSize(w,h,false);
    U.uRes.value.set(w,h);
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    orbit.setAttribute('cx',w/2); orbit.setAttribute('cy',h/2); orbit.setAttribute('r',LENS_R*h+26);
    const d=LENS_R*h*2;
    hit.style.width=hit.style.height=d+'px';
    if(orbitTween) orbitTween.kill();
    orbitTween=gsap.fromTo(orbit,{rotation:0,svgOrigin:`${w/2} ${h/2}`},{rotation:360,svgOrigin:`${w/2} ${h/2}`,duration:70,ease:'none',repeat:-1});
  };

  const drawDiagram=(i,instant)=>{
    diaTweens.forEach(t=>t.kill()); diaTweens=[];
    const old=[...spokeG.children,...dotG.children,...nodeLayer.children];
    if(instant) old.forEach(n=>n.remove());
    else if(old.length) gsap.to(old,{opacity:0,duration:.25,overwrite:true,onComplete:()=>old.forEach(n=>n.remove())});

    const W=stage.clientWidth,H=stage.clientHeight,cx=W/2,cy=H/2,Rpx=LENS_R*H;
    const stack=projects[i].stack;
    const slots=(ORDER[stack.length]||[]).map(n=>SLOT[n]);
    const base=instant?0:.3;
    slots.forEach(([fx,fy],j)=>{
      const px=fx*W,py=fy*H,a=Math.atan2(py-cy,px-cx),ca=Math.cos(a),sa=Math.sin(a);
      const sx=cx+ca*(Rpx+8),sy=cy+sa*(Rpx+8),ex=px-ca*9,ey=py-sa*9;
      const bend=(j%2?1:-1)*Math.hypot(ex-sx,ey-sy)*.16;
      const kx=(sx+ex)/2-sa*bend,ky=(sy+ey)/2+ca*bend;
      const path=make('path',{d:`M${sx} ${sy}Q${kx} ${ky} ${ex} ${ey}`,fill:'none',stroke:'currentColor','stroke-width':1,'stroke-opacity':.75});
      spokeG.appendChild(path);
      const len=path.getTotalLength();
      path.style.strokeDasharray=len;

      const node=document.createElement('div');
      node.className='lens-node';
      node.style.left=px+'px'; node.style.top=py+'px';
      node.innerHTML='<i></i><span><b></b></span>';
      node.querySelector('b').textContent=pad(j+1);
      node.querySelector('span').append(stack[j]);
      nodeLayer.appendChild(node);

      const dot=make('circle',{r:2.8,fill:'currentColor',opacity:0});
      dotG.appendChild(dot);

      if(instant){ path.style.strokeDashoffset=0; return; }
      path.style.strokeDashoffset=len;
      const delay=base+j*.12;
      diaTweens.push(
        gsap.to(path,{strokeDashoffset:0,duration:.9,delay,ease:'power2.inOut'}),
        gsap.from(node,{opacity:0,y:8,duration:.6,delay:delay+.45,ease:'power3.out'}),
        gsap.from(node.querySelector('i'),{scale:0,duration:.5,delay:delay+.5,ease:'back.out(3)'}),
      );
      // data packets travelling from each service into the lens
      const o={t:0};
      diaTweens.push(gsap.to(o,{
        t:1,duration:1.6+j*.25,delay:delay+1,repeat:-1,repeatDelay:.4+j*.2,ease:'power1.in',
        onUpdate:()=>{
          const pt=path.getPointAtLength(len*(1-o.t));
          dot.setAttribute('cx',pt.x); dot.setAttribute('cy',pt.y);
          dot.setAttribute('opacity',Math.sin(Math.PI*o.t)*.9);
        },
      }));
    });
  };

  layoutStage();
  addEventListener('resize',()=>{ layoutStage(); if(shown>=0) drawDiagram(shown,true); });

  /* ---------- Pointer ---------- */
  const mouse={x:.5,y:.5,tx:.5,ty:.5,act:0,tAct:0,rip:0};
  sec.addEventListener('mousemove',e=>{
    const r=stage.getBoundingClientRect();
    const nx=(e.clientX-r.left)/r.width,ny=1-(e.clientY-r.top)/r.height;
    mouse.rip=Math.min(1,mouse.rip+Math.hypot(nx-mouse.tx,ny-mouse.ty)*14);
    mouse.tx=nx; mouse.ty=ny; mouse.tAct=1;
  });
  sec.addEventListener('mouseleave',()=>mouse.tAct=0);

  /* ---------- Scroll → state ---------- */
  const state={target:0,cur:0,vel:0,enter:0};
  ScrollTrigger.create({
    trigger:sec,start:'top 85%',end:'top 15%',
    onUpdate:self=>{ state.enter=self.progress; },
  });
  ScrollTrigger.create({
    trigger:sec,start:'top top',end:()=>'+='+Math.round(innerHeight*N*.85),
    pin:true,anticipatePin:1,invalidateOnRefresh:true,
    onUpdate:self=>{ state.target=self.progress; },
  });

  let shown=-1;
  const show=i=>{
    if(i===shown) return;
    const dir=i>shown?1:-1,prev=slides[shown],next=slides[i];
    if(prev){
      gsap.killTweensOf(prev.chars);
      gsap.to(prev.chars,{yPercent:-110*dir,duration:.45,ease:'power3.in',stagger:.012,onComplete:()=>prev.els.forEach(e=>e.classList.remove('on'))});
    }
    next.els.forEach(e=>e.classList.add('on'));
    gsap.killTweensOf(next.chars);
    gsap.fromTo(next.chars,{yPercent:110*dir},{yPercent:0,duration:.9,ease:'expo.out',stagger:.025,delay:prev?.15:0});
    const p=projects[i];
    countEl.textContent=pad(i+1);
    yearEl.textContent=p.year;
    descEl.textContent=p.desc;
    gsap.fromTo([descEl,yearEl],{opacity:0,y:8},{opacity:1,y:0,duration:.7,ease:'power3.out',delay:.2});
    cta.setAttribute('href',p.href); hit.setAttribute('href',p.href);
    [cta,hit].forEach(a=>{
      if(p.external){ a.target='_blank'; a.rel='noopener'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
    });
    hit.setAttribute('aria-label','Open '+p.title);
    ticks.forEach((t,n)=>t.classList.toggle('on',n===i));
    drawDiagram(i,false);
    shown=i;
  };

  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

  let visible=false;
  new IntersectionObserver(([e])=>{ visible=e.isIntersecting; },{rootMargin:'20% 0px'}).observe(sec);
  const clock=new THREE.Clock();
  const frame=()=>{
    requestAnimationFrame(frame);
    if(!visible) return;
    const t=clock.getElapsedTime();

    // damped progress; the lag between target and current is the scroll "velocity"
    state.cur+=(state.target-state.cur)*.085;
    state.vel+=(clamp((state.target-state.cur)*N*4,-1,1)-state.vel)*.18;

    // each project: hold until f=.6, then morph into the next one
    const g=clamp(state.cur*N,0,N-1);
    const i0=Math.min(Math.floor(g),N-1),i1=Math.min(i0+1,N-1);
    const f=g-i0;
    const ut=i0===i1?0:ease(clamp((f-.6)/.4,0,1));
    const a=tex[i0],b=tex[i1];
    U.uA.value=a.map; U.uB.value=b.map;
    U.uAsp.value.set(a.aspect,b.aspect);
    U.uT.value=ut;
    U.uMorph.value=Math.sin(Math.PI*ut);
    U.uVel.value=state.vel;
    U.uTime.value=t;

    mouse.x+=(mouse.tx-mouse.x)*.12; mouse.y+=(mouse.ty-mouse.y)*.12;
    mouse.act+=(mouse.tAct-mouse.act)*.08;
    mouse.rip*=.94;
    U.uMouse.value.set(mouse.x,mouse.y);
    U.uAct.value=mouse.act;
    U.uRip.value=mouse.rip;

    // lens floats, leans toward the pointer, and grows in as the section arrives
    const asp=stage.clientWidth/stage.clientHeight;
    const tx=(mouse.x-.5)*asp*.05+Math.sin(t*.6)*.008,ty=(mouse.y-.5)*.05+Math.cos(t*.5)*.01;
    U.uOff.value.x+=(tx-U.uOff.value.x)*.06; U.uOff.value.y+=(ty-U.uOff.value.y)*.06;
    U.uTilt.value.x+=((mouse.x-.5)*2-U.uTilt.value.x)*.06; U.uTilt.value.y+=((mouse.y-.5)*2-U.uTilt.value.y)*.06;
    const en=1-Math.pow(1-state.enter,3);
    U.uEnter.value=clamp(en*1.4,0,1);
    U.uR.value=LENS_R*(.55+.45*en);

    if(shown<0&&en>.55) show(0);
    if(shown>=0) show(ut>.5?i1:i0);
    hint.style.opacity=clamp(1-state.cur*N*8,0,1);
    renderer.render(scene,camera);
  };
  frame();
}
