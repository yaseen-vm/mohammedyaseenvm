/* ---- The Journey of a Request ----
   A camera rides one glowing thread (the request) through five physical, lit objects: a night-side
   planet with satellites (edge), a brushed-metal server rack (cache), glass tubes holding spinning
   chrome platters (sharded database), a glass orb of living filaments inside a gimbal of metal
   rings (AI), and a shockwave of light (response). Scroll = position along the thread.
   Materials are PBR, lit by a procedural studio environment and a headlight that travels with the
   camera. All textures are generated at runtime; the story text is plain HTML revealed per chapter. */
(()=>{
  const root=document.documentElement;
  const canvas=document.getElementById('gl');
  let renderer;
  try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); }
  catch(err){ root.classList.add('no-gl'); return; }
  if(!window.gsap||!window.ScrollTrigger){ root.classList.add('no-gl'); return; }
  gsap.registerPlugin(ScrollTrigger);

  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small=innerWidth<=800;
  const DPR=Math.min(devicePixelRatio||1,small?1.5:1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x07050f,1);
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;

  const scene=new THREE.Scene();
  scene.fog=new THREE.Fog(0x07050f,26,125);
  const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,320);
  const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const COL={lav:0xb79cff,vio:0x8a4de0,pink:0xff9ad5,white:0xffffff};
  const uTime={value:0};
  const density=small?.55:1;

  /* ---------- Lighting: a procedural studio, a key light and a headlight ---------- */
  {
    const pm=new THREE.PMREMGenerator(renderer);
    const studio=new THREE.Scene();
    studio.add(new THREE.Mesh(new THREE.BoxGeometry(90,90,90),new THREE.MeshBasicMaterial({color:0x0d0a26,side:THREE.BackSide})));
    const panel=(w,h,pos,color,k)=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(k),side:THREE.DoubleSide}));
      m.position.set(...pos); m.lookAt(0,0,0); studio.add(m);
    };
    panel(44,14,[-22,30,20],0xfff4ff,7);   // key softbox
    panel(10,44,[36,4,8],0xff8fd0,5);      // pink strip
    panel(36,10,[0,-32,-8],0x8a6cff,3.5);  // violet underlight
    panel(28,28,[0,8,-40],0xb79cff,3);     // back
    panel(8,30,[-38,0,-6],0x9cc8ff,3);     // cool kicker
    scene.environment=pm.fromScene(studio,.03).texture;
    pm.dispose();
  }
  scene.add(new THREE.AmbientLight(0x2c2058,.9));
  const key=new THREE.DirectionalLight(0xe9e0ff,1.6); key.position.set(-6,9,8); scene.add(key);
  const head=new THREE.PointLight(0xcdbbff,1.9,46,2); scene.add(head);

  /* ---------- The thread ---------- */
  const curve=new THREE.CatmullRomCurve3([
    V3(0,0,0),V3(4,2,-32),V3(-5,-1,-68),V3(6,3,-104),V3(-4,-2,-142),V3(5,1,-180),V3(-3,3,-218),V3(0,0,-258),V3(0,0,-300),
  ],false,'catmullrom',.5);
  const U_MAX=.965;
  const CH=7,T=i=>i/(CH-1);               // chapter i sits at scroll progress i/6

  const threadMat=glow=>new THREE.ShaderMaterial({
    uniforms:{uTime,uHead:{value:0},uGlow:{value:glow}},
    vertexShader:'varying vec2 vUv;varying float vD;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader:`
      uniform float uTime,uHead,uGlow; varying vec2 vUv; varying float vD;
      void main(){
        float u=vUv.x;
        vec3 lav=vec3(.72,.61,1.),pink=vec3(1.,.6,.84);
        vec3 col=mix(lav,pink,smoothstep(.3,.95,u));
        float passed=1.-smoothstep(uHead-.004,uHead+.004,u);
        float flow=.12+.1*sin(u*500.-uTime*3.);
        float head=exp(-pow((u-uHead)*70.,2.))*2.2;
        float a=mix(flow,.95,passed)+head;
        a*=mix(1.,.16,uGlow);
        a*=smoothstep(3.5,13.,vD)*(1.-smoothstep(70.,150.,vD));
        gl_FragColor=vec4(col*(1.+head),a);
      }`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  });
  const tubeCore=new THREE.Mesh(new THREE.TubeGeometry(curve,1100,.026,6,false),threadMat(0));
  const tubeGlow=new THREE.Mesh(new THREE.TubeGeometry(curve,500,.14,8,false),threadMat(1));
  scene.add(tubeCore,tubeGlow);

  /* ---------- Shared glow helpers ---------- */
  const pointMat=(color,size,alpha)=>new THREE.ShaderMaterial({
    uniforms:{uTime,uColor:{value:new THREE.Color(color)},uSize:{value:size},uAlpha:{value:alpha},uPx:{value:DPR}},
    vertexShader:`
      uniform float uTime,uSize,uPx; attribute float aSeed; varying float vA,vD;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; vD=-mv.z;
        gl_PointSize=clamp(uSize*uPx*(16./vD),1.,90.);
        vA=.55+.45*sin(uTime*1.4+aSeed*6.2831);
      }`,
    fragmentShader:`
      uniform vec3 uColor; uniform float uAlpha; varying float vA,vD;
      void main(){
        float r=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,r); a*=a;
        gl_FragColor=vec4(uColor,a*vA*uAlpha*(1.-smoothstep(70.,150.,vD)));
      }`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  });
  const makePoints=(arr,color,size,alpha)=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(arr instanceof Float32Array?arr:new Float32Array(arr),3));
    const seeds=new Float32Array(g.attributes.position.count);
    for(let i=0;i<seeds.length;i++) seeds[i]=Math.random();
    g.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    return new THREE.Points(g,pointMat(color,size,alpha));
  };
  const glowMat=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});
  const emissive=(color,k=1)=>new THREE.MeshStandardMaterial({color:0x000000,emissive:color,emissiveIntensity:k,roughness:1});
  const metal=(color,rough,metalness=.9)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness,envMapIntensity:1.4});

  /* ---------- Procedural noise (for the planet) ---------- */
  const hash3=(x,y,z)=>{ let h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return h-Math.floor(h); };
  const vnoise=(x,y,z)=>{
    const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi;
    const s=t=>t*t*(3-2*t),u=s(xf),v=s(yf),w=s(zf),L=(a,b,t)=>a+(b-a)*t;
    return L(L(L(hash3(xi,yi,zi),hash3(xi+1,yi,zi),u),L(hash3(xi,yi+1,zi),hash3(xi+1,yi+1,zi),u),v),
             L(L(hash3(xi,yi,zi+1),hash3(xi+1,yi,zi+1),u),L(hash3(xi,yi+1,zi+1),hash3(xi+1,yi+1,zi+1),u),v),w);
  };
  const fbm=(x,y,z,o=5)=>{ let a=.5,f=1,s=0; for(let i=0;i<o;i++){ s+=a*vnoise(x*f,y*f,z*f); f*=2.03; a*=.5; } return s; };

  // Equirectangular maps for a three.js SphereGeometry (pixel -> point on the sphere, seamless)
  const makePlanet=()=>{
    const W=small?512:1024,H=W/2;
    const col=document.createElement('canvas'),emi=document.createElement('canvas'),bmp=document.createElement('canvas');
    [col,emi,bmp].forEach(c=>{ c.width=W; c.height=H; });
    const cc=col.getContext('2d'),ec=emi.getContext('2d'),bc=bmp.getContext('2d');
    const ci=cc.createImageData(W,H),bi=bc.createImageData(W,H),land=new Uint8Array(W*H);
    for(let py=0;py<H;py++){
      const th=py/H*Math.PI,sy=Math.sin(th),cy=Math.cos(th);
      for(let px=0;px<W;px++){
        const ph=px/W*Math.PI*2;
        const x=-Math.cos(ph)*sy,y=cy,z=Math.sin(ph)*sy;
        const n=fbm(x*1.9+4,y*1.9+4,z*1.9+4,5),m=fbm(x*5+9,y*5+9,z*5+9,3);
        const isLand=n>.52, i=(py*W+px)*4;
        land[py*W+px]=isLand?1:0;
        const e=clamp((n-.5)*14,0,1),d=clamp((.52-n)*6,0,1);      // soft coast
        const hh=clamp((n-.52)*5,0,1),lr=14+hh*26+m*12,lg=14+hh*20+m*9,lb=34+hh*26+m*12;
        const or=4+(1-d)*10,og=8+(1-d)*20,ob=26+(1-d)*44;
        const r=or+(lr-or)*e,g=og+(lg-og)*e,b=ob+(lb-ob)*e,h=40+e*(30+clamp((n-.52)*6,0,1)*120);
        ci.data[i]=r; ci.data[i+1]=g; ci.data[i+2]=b; ci.data[i+3]=255;
        bi.data[i]=bi.data[i+1]=bi.data[i+2]=h; bi.data[i+3]=255;
      }
    }
    cc.putImageData(ci,0,0); bc.putImageData(bi,0,0);
    // city lights: clustered on land, denser around a few hubs
    ec.fillStyle='#000'; ec.fillRect(0,0,W,H); ec.globalCompositeOperation='lighter';
    const hubs=[]; let guard=0;
    while(hubs.length<9&&guard++<5000){ const x=Math.random()*W,y=H*(.22+Math.random()*.5); if(land[Math.floor(y)*W+Math.floor(x)]) hubs.push([x,y]); }
    let count=0,tries=0;
    while(count<(small?1100:2600)&&tries++<80000){
      const hub=hubs.length&&Math.random()<.72?hubs[Math.floor(Math.random()*hubs.length)]:null;
      const px=hub?hub[0]+(Math.random()+Math.random()+Math.random()-1.5)*W*.05:Math.random()*W;
      const py=hub?hub[1]+(Math.random()+Math.random()+Math.random()-1.5)*H*.07:H*(.12+Math.random()*.76);
      if(px<0||px>=W||py<0||py>=H||!land[Math.floor(py)*W+Math.floor(px)]) continue;
      count++;
      const r=.45+Math.random()*.95,gr=ec.createRadialGradient(px,py,0,px,py,r*2.2);
      gr.addColorStop(0,'rgba(255,214,150,'+(.55+Math.random()*.45)+')'); gr.addColorStop(1,'rgba(255,170,90,0)');
      ec.fillStyle=gr; ec.beginPath(); ec.arc(px,py,r*2.2,0,6.283); ec.fill();
    }
    const enc=c=>{ const t=new THREE.CanvasTexture(c); t.anisotropy=4; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; return t; };
    const map=enc(col); map.encoding=THREE.sRGBEncoding;
    const emap=enc(emi); emap.encoding=THREE.sRGBEncoding;
    return {map,emap,bump:enc(bmp),W,H,hubs};
  };
  const onSphere=(px,py,W,H,r)=>{ const th=py/H*Math.PI,ph=px/W*Math.PI*2; return V3(-Math.cos(ph)*Math.sin(th)*r,Math.cos(th)*r,Math.sin(ph)*Math.sin(th)*r); };

  const makeClouds=()=>{
    const W=512,H=256,c=document.createElement('canvas'); c.width=W; c.height=H;
    const x=c.getContext('2d'),im=x.createImageData(W,H);
    for(let py=0;py<H;py++){ const th=py/H*Math.PI,sy=Math.sin(th),cy=Math.cos(th);
      for(let px=0;px<W;px++){ const ph=px/W*Math.PI*2,n=fbm(-Math.cos(ph)*sy*2.6+20,cy*2.6+20,Math.sin(ph)*sy*2.6+20,5),a=clamp((n-.5)*3.2,0,1),i=(py*W+px)*4;
        im.data[i]=im.data[i+1]=im.data[i+2]=255; im.data[i+3]=a*255; } }
    x.putImageData(im,0,0); return new THREE.CanvasTexture(c);
  };

  /* ---------- Ambient dust along the path ---------- */
  {
    const n=Math.round(2600*density),a=new Float32Array(n*3),b=new Float32Array(Math.round(380*density)*3);
    const fill=(arr,rMin,rMax)=>{ for(let i=0;i<arr.length;i+=3){
      const p=curve.getPointAt(Math.random()),r=rMin+Math.pow(Math.random(),.6)*(rMax-rMin),th=Math.random()*Math.PI*2;
      arr[i]=p.x+Math.cos(th)*r; arr[i+1]=p.y+Math.sin(th)*r; arr[i+2]=p.z+rnd(-6,6);
    } };
    fill(a,2.5,16); fill(b,3,22);
    scene.add(makePoints(a,COL.lav,1.5,.6),makePoints(b,COL.pink,3.2,.55));
  }

  /* ---------- Sculptures ---------- */
  const sculptures=[];       // {group,update(t)}
  const anchor=(i,side,off=0)=>{
    const u=clamp(T(i)*U_MAX+off,0,1),p=curve.getPointAt(u),tan=curve.getTangentAt(u);
    const right=new THREE.Vector3().crossVectors(tan,V3(0,1,0)).normalize();
    return {p:p.clone().addScaledVector(right,side*5.8).add(V3(0,side*.4,0)),tan,right};
  };

  // 1 · EDGE — a night-side planet: city lights, atmosphere, clouds, a satellite and a lit network
  {
    const a=anchor(1,+1,.03),g=new THREE.Group(); g.position.copy(a.p);
    const R=3,P=makePlanet();
    const planet=new THREE.Group();
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(R,small?48:96,small?32:64),new THREE.MeshStandardMaterial({
      map:P.map,emissiveMap:P.emap,emissive:0xffffff,emissiveIntensity:1.25,roughness:.62,metalness:.05,bumpMap:P.bump,bumpScale:.35,envMapIntensity:.3,
    })));
    const clouds=new THREE.Mesh(new THREE.SphereGeometry(R*1.014,small?40:80,small?28:56),new THREE.MeshStandardMaterial({
      alphaMap:makeClouds(),color:0xe8e2ff,transparent:true,opacity:.34,roughness:1,metalness:0,depthWrite:false,
    }));
    planet.add(clouds);
    // the edge network: glowing arcs hopping between the busiest cities
    const nodes=[]; P.hubs.slice(0,6).forEach(h=>nodes.push(onSphere(h[0],h[1],P.W,P.H,R*1.004)));
    const arcs=[];
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      if(Math.random()>.55) continue;
      const A=nodes[i],B=nodes[j],M=A.clone().add(B).multiplyScalar(.5).normalize().multiplyScalar(R*(1.18+A.distanceTo(B)*.06));
      const arc=new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A,M,B),48,.011,5,false),glowMat(i%2?COL.pink:COL.lav,.7));
      planet.add(arc); arcs.push(arc);
    }
    // the origin of the request: a beam rising from the first hub
    const origin=nodes[0]||V3(0,R,0),upv=origin.clone().normalize();
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.012,.05,3.2,12,1,true),glowMat(COL.pink,.4));
    beam.position.copy(origin).addScaledVector(upv,1.3); beam.quaternion.setFromUnitVectors(V3(0,1,0),upv);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.16,.012,8,48),glowMat(COL.pink,.9));
    ring.position.copy(origin).addScaledVector(upv,.02); ring.quaternion.setFromUnitVectors(V3(0,0,1),upv);
    planet.add(beam,ring);
    g.add(planet);
    // atmosphere
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.07,48,32),new THREE.ShaderMaterial({
      vertexShader:'varying vec3 vN,vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'varying vec3 vN,vV;void main(){float f=pow(1.-max(dot(vN,vV),0.),4.2);gl_FragColor=vec4(vec3(.55,.46,1.)*f*1.1,f*.75);}',
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.FrontSide,
    })));
    // a small satellite: gold body, dark solar wings
    const sat=new THREE.Group();
    sat.add(new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.2),metal(0xd9b36a,.3,1)));
    [-1,1].forEach(s=>{ const w=new THREE.Mesh(new THREE.BoxGeometry(.78,.02,.3),new THREE.MeshStandardMaterial({color:0x14224d,metalness:.8,roughness:.25,emissive:0x1b2f7a,emissiveIntensity:.5})); w.position.x=s*.56; sat.add(w); });
    g.add(sat);
    g.rotation.x=.3;
    scene.add(g);
    sculptures.push({group:g,update:t=>{
      planet.rotation.y=t*.07; clouds.rotation.y=t*.02;
      const f=(t*.6)%1; ring.scale.setScalar(1+f*3); ring.material.opacity=.9*(1-f);
      arcs.forEach((m,i)=>{ m.material.opacity=.35+.4*Math.pow(.5+.5*Math.sin(t*1.3+i),2); });
      const an=t*.35; sat.position.set(Math.cos(an)*4.7,Math.sin(an)*1.6,Math.sin(an)*4.7); sat.rotation.y=-an;
    }});
  }

  // 2 · CACHE — a brushed-metal server rack; one unit lights up on the "hit"
  {
    const a=anchor(2,-1,.03),g=new THREE.Group(); g.position.copy(a.p);
    const rr=(s,x,y,w,h,r)=>{ s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); };
    const sh=new THREE.Shape(); rr(sh,-2.6,-.3,5.2,.6,.07);
    const body=new THREE.ExtrudeGeometry(sh,{depth:2.9,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:6}); body.translate(0,0,-1.45);
    const bodyMat=metal(0x211c3f,.34,.9),plateMat=metal(0x332c5c,.26,.95);
    const slot=new THREE.BoxGeometry(.05,.36,.06),slotMat=new THREE.MeshStandardMaterial({color:0x04030a,roughness:.9,metalness:.2});
    const ledGeo=new THREE.SphereGeometry(.04,12,8),leds=[],units=[];
    for(let i=0;i<6;i++){
      const u=new THREE.Group(); u.position.y=(i-2.5)*.74;
      u.add(new THREE.Mesh(body,bodyMat));
      const plate=new THREE.Mesh(new THREE.BoxGeometry(5.0,.5,.05),plateMat); plate.position.z=1.5; u.add(plate);
      const vents=new THREE.InstancedMesh(slot,slotMat,26),m=new THREE.Matrix4();
      for(let k=0;k<26;k++){ m.setPosition(-2.3+k*.1,0,1.54); vents.setMatrixAt(k,m); }
      u.add(vents);
      [-1,1].forEach(s=>{ const ear=new THREE.Mesh(new THREE.BoxGeometry(.16,.62,.1),metal(0x4a4480,.3,1)); ear.position.set(s*2.68,0,1.5); u.add(ear); });
      for(let k=0;k<4;k++){ const led=new THREE.Mesh(ledGeo,new THREE.MeshStandardMaterial({color:0x000000,emissive:k===0?0x7dffb0:COL.lav,emissiveIntensity:2})); led.position.set(2.0-k*.14,.12,1.56); u.add(led); leds.push({led,i,k}); }
      const strip=new THREE.Mesh(new THREE.BoxGeometry(1.25,.05,.03),emissive(COL.vio,1.2)); strip.position.set(1.0,-.15,1.55); u.add(strip);
      units.push({u,strip});
      g.add(u);
    }
    // vertical rack rails
    [-1,1].forEach(s=>{ const rail=new THREE.Mesh(new THREE.BoxGeometry(.12,4.9,.12),metal(0x2a2450,.3,1)); rail.position.set(s*2.78,0,1.46); g.add(rail); });
    g.rotation.set(.12,.62,0);
    scene.add(g);
    sculptures.push({group:g,update:t=>{
      units.forEach((o,i)=>{ o.u.position.x=Math.sin(t*.5+i*1.1)*.04; o.strip.material.emissiveIntensity=i===2?.8+3.2*Math.pow(.5+.5*Math.sin(t*2.6),3):.5; });
      leds.forEach(o=>{ o.led.material.emissiveIntensity=.3+2.4*Math.max(0,Math.sin(t*(2+o.k*.9)+o.i*1.7)); });
    }});
  }

  // 3 · DATABASE — two glass tubes (the shards), each holding spinning chrome platters
  {
    const a=anchor(3,+1,.03),g=new THREE.Group(); g.position.copy(a.p);
    const glass=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.04,transmission:1,thickness:.7,ior:1.42,envMapIntensity:1.8,side:THREE.DoubleSide,depthWrite:false});
    const platter=new THREE.CylinderGeometry(.95,.95,.045,56),platterMat=metal(0xbfaeff,.2,1);
    const rim=new THREE.TorusGeometry(.95,.012,8,80),notch=new THREE.BoxGeometry(.2,.06,.08);
    const cap=new THREE.CylinderGeometry(1.32,1.32,.2,56),capMat=metal(0x1d1838,.3,.95);
    const discs=[],shards=[];
    [-1,1].forEach((side,si)=>{
      const s=new THREE.Group(); s.position.x=side*1.75; g.add(s);
      s.add(new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,4.5,56,1,true),glass));
      [-1,1].forEach(e=>{ const c=new THREE.Mesh(cap,capMat); c.position.y=e*2.35; s.add(c);
        const r=new THREE.Mesh(new THREE.TorusGeometry(1.32,.014,8,90),emissive(si?COL.pink:COL.lav,2.2)); r.rotation.x=Math.PI/2; r.position.y=e*2.25+(e<0?.1:-.1); s.add(r); });
      for(let i=0;i<14;i++){
        const d=new THREE.Group(); d.position.y=-1.95+i*.3;
        d.add(new THREE.Mesh(platter,platterMat));
        const rg=new THREE.Mesh(rim,emissive(si?COL.pink:COL.vio,1.6)); rg.rotation.x=Math.PI/2; d.add(rg);
        const nt=new THREE.Mesh(notch,emissive(0xffffff,2.4)); nt.position.set(.85,.04,0); d.add(nt);
        s.add(d); discs.push({d,sp:(.25+(i%5)*.12)*(si?-1:1)});
      }
      // data motes rising inside the glass
      const n=Math.round(90*density),pos=new Float32Array(n*3);
      for(let i=0;i<n;i++){ const th=Math.random()*6.283,r=Math.sqrt(Math.random())*.9; pos[i*3]=Math.cos(th)*r; pos[i*3+1]=rnd(-2,2); pos[i*3+2]=Math.sin(th)*r; }
      const motes=makePoints(pos,si?COL.pink:COL.lav,2.4,.9); s.add(motes); shards.push({s,motes});
    });
    // the link between shards
    const link=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,3.5,8),emissive(COL.white,1.8)); link.rotation.z=Math.PI/2; g.add(link);
    g.rotation.set(.18,-.5,.04);
    scene.add(g);
    sculptures.push({group:g,update:t=>{
      discs.forEach(o=>{ o.d.rotation.y=t*o.sp; });
      shards.forEach(o=>{ o.motes.position.y=((t*.18)%4)-2; });
      g.rotation.y=-.5+Math.sin(t*.22)*.25;
    }});
  }

  // 4 · AI — a glass orb of living filaments, inside a gimbal of metal rings
  {
    const a=anchor(4,-1,.03),g=new THREE.Group(); g.position.copy(a.p);
    const R=1.9;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R,64,48),new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.03,transmission:1,thickness:1.4,ior:1.3,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:2,depthWrite:false})));
    // core
    const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.26,3),emissive(0xfff0fa,2.6)); g.add(core);
    g.add(makePoints([0,0,0],COL.pink,18,.8));
    // filaments: branching light-conducting strands that carry pulses outward
    const filMat=new THREE.ShaderMaterial({
      uniforms:{uTime},
      vertexShader:'attribute float aSeed;varying vec2 vUv;varying float vS;void main(){vUv=uv;vS=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform float uTime; varying vec2 vUv; varying float vS;
        void main(){
          float p=pow(.5+.5*sin(vUv.x*16.-uTime*(1.6+vS*2.)+vS*20.),7.);
          vec3 c=mix(vec3(1.,.6,.84),vec3(.72,.61,1.),vUv.x);
          gl_FragColor=vec4(c*(.5+p*2.4),(.4+p*.8)*(1.-vUv.x*.3));
        }`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    });
    const fils=new THREE.Group(),tips=[];
    const nF=small?22:42;
    for(let f=0;f<nF;f++){
      let dir=V3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize(),p=dir.clone().multiplyScalar(.3);
      const pts=[p.clone()]; const seg=6;
      for(let k=0;k<seg;k++){ dir.add(V3(rnd(-.55,.55),rnd(-.55,.55),rnd(-.55,.55))).normalize(); p=p.clone().addScaledVector(dir,(R*.82-.3)/seg); pts.push(p.clone()); }
      const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.02+Math.random()*.022,6,false);
      const sd=new Float32Array(geo.attributes.position.count).fill(Math.random()); geo.setAttribute('aSeed',new THREE.BufferAttribute(sd,1));
      fils.add(new THREE.Mesh(geo,filMat)); tips.push(pts[pts.length-1].x,pts[pts.length-1].y,pts[pts.length-1].z);
    }
    g.add(fils,makePoints(tips,COL.white,4,.9));
    // armillary gimbal: three nested metal rings, each spinning on its own axis, carrying a gem
    const gimbal=[];
    [[2.7,COL.pink,0],[3.15,COL.lav,1],[3.6,0xffffff,2]].forEach(([r,gem,i])=>{
      const grp=new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.TorusGeometry(r,.035,20,160),metal(0xcfc2ff,.22,1)));
      const g2=new THREE.Mesh(new THREE.SphereGeometry(.17,28,20),new THREE.MeshStandardMaterial({color:gem,metalness:.3,roughness:.12,emissive:gem,emissiveIntensity:.9,envMapIntensity:2})); g2.position.set(r,0,0); grp.add(g2);
      g.add(grp); gimbal.push({grp,i});
    });
    scene.add(g);
    sculptures.push({group:g,update:t=>{
      fils.rotation.y=t*.05; core.rotation.y=t*.6; core.scale.setScalar(1+.12*Math.sin(t*2.2));
      gimbal.forEach(o=>{ const s=.28+o.i*.1; o.grp.rotation.set(t*s*(o.i%2?1:-1)+o.i,t*s*.7,t*s*.4+o.i*1.3); });
    }});
  }

  // 5 · RESPONSE — luminous shockwave rings + a burst of sparks, centred on the thread
  {
    const u=T(5)*U_MAX+.03,p=curve.getPointAt(u),tan=curve.getTangentAt(u);
    const g=new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().add(tan));
    const rings=[]; for(let i=0;i<7;i++){ const m=new THREE.Mesh(new THREE.TorusGeometry(1,.018,10,180),glowMat(i%2?COL.pink:0xdcd0ff,.8)); g.add(m); rings.push(m); }
    const n=Math.round(900*density),pos=new Float32Array(n*3),dir=new Float32Array(n*3),seed=new Float32Array(n);
    for(let i=0;i<n;i++){ const th=Math.random()*Math.PI*2; dir[i*3]=Math.cos(th); dir[i*3+1]=Math.sin(th); dir[i*3+2]=rnd(-.15,.15); pos[i*3+2]=rnd(-5,5); seed[i]=Math.random(); }
    const bg=new THREE.BufferGeometry();
    bg.setAttribute('position',new THREE.BufferAttribute(pos,3)); bg.setAttribute('aDir',new THREE.BufferAttribute(dir,3)); bg.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
    g.add(new THREE.Points(bg,new THREE.ShaderMaterial({
      uniforms:{uTime,uPx:{value:DPR}},
      vertexShader:`
        uniform float uTime,uPx; attribute vec3 aDir; attribute float aSeed; varying float vA,vD;
        void main(){
          float f=fract(uTime*.22+aSeed);
          vec3 p=position+aDir*(1.6+f*9.)*(.6+aSeed*.8); vA=sin(f*3.14159);
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; vD=-mv.z;
          gl_PointSize=clamp(2.2*uPx*(16./vD),1.,40.);
        }`,
      fragmentShader:`
        varying float vA,vD;
        void main(){ float r=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,r); a*=a; gl_FragColor=vec4(1.,.72,.9,a*vA*.9*(1.-smoothstep(70.,150.,vD))); }`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    })));
    scene.add(g);
    sculptures.push({group:g,update:t=>{
      rings.forEach((m,i)=>{ const f=(t*.35+i/7)%1; m.scale.setScalar(1.2+f*8); m.position.z=(i-3)*.9; m.material.opacity=.8*Math.sin(f*Math.PI); });
    }});
  }

  // 6 · END — a bright orb where the thread arrives
  const endP=curve.getPointAt(1);
  scene.add(makePoints([endP.x,endP.y,endP.z],COL.lav,110,.55),makePoints([endP.x,endP.y,endP.z],COL.white,26,1));

  /* ---------- The request itself (a light just ahead of the camera) ---------- */
  const orb=makePoints([0,0,0],COL.white,18,1),orbHalo=makePoints([0,0,0],COL.lav,56,.55);
  scene.add(orb,orbHalo);

  /* ---------- Chapters (HTML) ---------- */
  const chaps=[...document.querySelectorAll('.chap')];
  const rail=document.getElementById('rail'),label=document.getElementById('s-label'),cur=document.getElementById('s-cur'),hint=document.getElementById('s-hint');
  const dots=chaps.map((c,i)=>{ const b=document.createElement('button'); b.setAttribute('aria-label',c.dataset.name); b.addEventListener('click',()=>goTo(i)); rail.appendChild(b); return b; });
  let shown=-1;
  const show=i=>{
    if(i===shown) return;
    const prev=chaps[shown],next=chaps[i];
    if(prev){
      const p=prev,sel=p.querySelectorAll('.ln>span,.eyebrow,.lead,.metric,.cta');
      gsap.killTweensOf(sel);
      gsap.to(sel,{opacity:0,yPercent:-40,duration:.4,ease:'power2.in',stagger:.03,onComplete:()=>p.classList.remove('on')});
    }
    next.classList.add('on');
    const q=s=>next.querySelectorAll(s);
    gsap.killTweensOf(next.querySelectorAll('.ln>span,.eyebrow,.lead,.metric,.cta'));
    gsap.fromTo(q('.ln>span'),{yPercent:115,opacity:1},{yPercent:0,duration:1.1,ease:'expo.out',stagger:.1,delay:.25});
    gsap.fromTo(q('.eyebrow,.lead,.metric,.cta'),{opacity:0,y:18},{opacity:1,y:0,duration:.9,ease:'power3.out',stagger:.1,delay:.5});
    dots.forEach((d,n)=>d.classList.toggle('on',n===i));
    cur.textContent=String(i+1).padStart(2,'0');
    label.textContent=String(i).padStart(2,'0')+' — '+next.dataset.name;
    shown=i;
  };

  /* ---------- Scroll → state ---------- */
  let lenis=null;
  if(window.Lenis&&!reduce){
    lenis=new Lenis({lerp:.075,smoothWheel:true});
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(t=>lenis.raf(t*1000));
    gsap.ticker.lagSmoothing(0);
  }
  const state={p:0,t:0};
  ScrollTrigger.create({trigger:'#track',start:'top top',end:'bottom bottom',onUpdate:self=>{ state.p=self.progress; }});
  const goTo=i=>{
    const track=document.getElementById('track'),y=track.offsetTop+(track.offsetHeight-innerHeight)*T(i);
    if(lenis) lenis.scrollTo(y,{duration:2}); else scrollTo({top:y,behavior:'smooth'});
  };

  /* ---------- Pointer parallax ---------- */
  const mouse={x:0,y:0,tx:0,ty:0};
  addEventListener('mousemove',e=>{ mouse.tx=e.clientX/innerWidth-.5; mouse.ty=e.clientY/innerHeight-.5; });

  addEventListener('resize',()=>{
    renderer.setSize(innerWidth,innerHeight,false);
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  });
  renderer.setSize(innerWidth,innerHeight,false);

  /* ---------- Frame loop ---------- */
  const clock=new THREE.Clock();
  const up=V3(0,1,0),tmp=V3(0,0,0),look=V3(0,0,0),side=V3(0,0,0),camPos=V3(0,0,0);
  const frame=()=>{
    requestAnimationFrame(frame);
    const dt=Math.min(clock.getDelta(),.1),time=clock.elapsedTime;
    uTime.value=time;

    const lag=state.p-state.t;
    state.t+=lag*(1-Math.exp(-dt*(reduce?30:3.4)));
    const t=clamp(state.t,0,1),u=t*U_MAX;

    camPos.copy(curve.getPointAt(u)); camPos.y+=.22;
    look.copy(curve.getPointAt(Math.min(u+.045,1)));
    const tan=curve.getTangentAt(u);
    side.crossVectors(tan,up).normalize();

    // pull the framing toward whichever sculpture we are passing
    sculptures.forEach((s,k)=>{
      const w=Math.exp(-Math.pow((t-T(k+1))/.055,2));
      if(w<.002) return;
      tmp.copy(s.group.position).sub(look); look.addScaledVector(tmp,.72*w);
      const away=Math.sign(tmp.dot(side))||1; camPos.addScaledVector(side,-away*1.1*w);
    });

    camPos.addScaledVector(side,mouse.x*.9).y-=mouse.y*.5;
    mouse.x+=(mouse.tx-mouse.x)*.06; mouse.y+=(mouse.ty-mouse.y)*.06;
    camera.position.copy(camPos); camera.lookAt(look);
    camera.fov=55+clamp(Math.abs(lag)*60,0,1)*9; camera.updateProjectionMatrix();

    // headlight: travels just behind and above the camera so nearby objects are lit as we arrive
    head.position.copy(camPos).addScaledVector(tan,-3).addScaledVector(side,.5).y+=1.2;

    // the request: a light just ahead of the camera, riding the thread
    const op=curve.getPointAt(Math.min(u+.022,1));
    orb.position.copy(op); orbHalo.position.copy(op);
    tubeCore.material.uniforms.uHead.value=tubeGlow.material.uniforms.uHead.value=Math.min(u+.022,1);

    sculptures.forEach(s=>s.update(time));

    show(clamp(Math.round(state.p*(CH-1)),0,CH-1));
    hint.style.opacity=clamp(1-state.p*18,0,1);
    renderer.render(scene,camera);
  };
  frame();

  // open: the veil lifts, the first chapter writes itself
  gsap.to('#veil',{opacity:0,duration:1.8,ease:'power2.inOut',delay:.2});
  show(0);
})();
