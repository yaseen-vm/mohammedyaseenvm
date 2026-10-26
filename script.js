const loader=document.getElementById('loader');
window.addEventListener('load',()=>setTimeout(()=>loader.classList.add('hide'),500));

const cursor=document.getElementById('cursor');
window.addEventListener('mousemove',e=>{cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});
document.querySelectorAll('a,button,.magnetic').forEach(el=>{
  el.addEventListener('mouseenter',()=>cursor.classList.add('big'));
  el.addEventListener('mouseleave',()=>cursor.classList.remove('big'));
});

const io=new IntersectionObserver(entries=>entries.forEach(e=>{
  if(e.isIntersecting)e.target.classList.add('visible');
}),{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

const text=document.querySelector('.reveal-text');
const textIO=new IntersectionObserver(([e])=>{
  if(e.isIntersecting){text.animate([{opacity:.15,transform:'translateY(30px)'},{opacity:1,transform:'none'}],{duration:1000,fill:'forwards',easing:'cubic-bezier(.2,.7,.2,1)'})}
},{threshold:.3}); textIO.observe(text);

document.querySelectorAll('.magnetic').forEach(el=>{
  el.addEventListener('mousemove',e=>{
    const r=el.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)*.012,y=(e.clientY-r.top-r.height/2)*.012;
    el.style.transform=`translate(${x}px,${y}px)`;
  });
  el.addEventListener('mouseleave',()=>el.style.transform='');
});

/* ---- GSAP kinetic hero: per-character intro + scroll-driven exit ---- */
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(window.gsap && window.ScrollTrigger && !reduceMotion){
  gsap.registerPlugin(ScrollTrigger);

  // Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger scrubs stay in sync.
  if(window.Lenis){
    const lenis=new Lenis({lerp:.09,smoothWheel:true});
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(t=>lenis.raf(t*1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('click',e=>{
      const a=e.target.closest('a[href^="#"]');
      const target=a&&a.getAttribute('href').length>1&&document.querySelector(a.getAttribute('href'));
      if(target){ e.preventDefault(); lenis.scrollTo(target,{duration:1.6}); }
    });
  }

  // Split an element's text into per-character spans (spaces stay as breakable text nodes).
  const splitChars=(el,extraClass='')=>{
    const text=el.textContent;
    el.textContent='';
    for(const ch of text){
      if(ch===' '){ el.appendChild(document.createTextNode(' ')); continue; }
      const s=document.createElement('span');
      s.className='char'+(ch==='.'?' dot':'')+(extraClass?' '+extraClass:'');
      s.textContent=ch;
      s.style.display='inline-block';
      s.style.willChange='transform,opacity';
      s.style.transformOrigin='50% 100%';
      el.appendChild(s);
    }
    return [...el.querySelectorAll('.char')];
  };

  // Per-letter 3D assembly: every character flies in from scattered depth / position /
  // rotation — blurred and oversized — then snaps sharp into place. Each letter is unique.
  const rnd=gsap.utils.random;
  const assembleIn=(chars,{stagger=0.06,duration=1.3,delay=0,from='random',spread=1}={})=>{
    return gsap.fromTo(chars,
      {
        opacity:0,
        transformPerspective:1000,
        scale:()=>rnd(1.8,3.2),
        z:()=>rnd(-600,-180),
        xPercent:()=>rnd(-160,160)*spread,
        yPercent:()=>rnd(-180,180)*spread,
        rotationX:()=>rnd(-160,160),
        rotationY:()=>rnd(-160,160),
        rotationZ:()=>rnd(-100,100),
        filter:'blur(18px)',
      },
      {
        opacity:1,scale:1,z:0,xPercent:0,yPercent:0,
        rotationX:0,rotationY:0,rotationZ:0,filter:'blur(0px)',
        duration,ease:'expo.out',delay,
        stagger:{each:stagger,from},
      });
  };

  /* ---------- HERO TITLE (IMAGINE / ENGINEER / DEPLOY.) ---------- */
  const titleChars=[];
  gsap.utils.toArray('.hero-title .line > span').forEach(w=>{
    w.style.animation='none';          // disable the CSS rise keyframe — GSAP owns this now
    w.style.transform='none';
    w.style.overflow='visible';        // let letters scatter beyond the line box during assembly
    w.parentElement.style.overflow='visible';
    titleChars.push(...splitChars(w));
  });

  // Intro: characters assemble out of scattered 3D space and snap into the words.
  const titleIntro=assembleIn(titleChars,{stagger:0.055,duration:1.5,delay:0.3,from:'random',spread:1});

  // Scroll-driven exit: as the hero scrolls away, each character flies up, tilts and fades.
  // Explicit start values mean scrolling back to the top always restores the finished title,
  // and scrolling mid-intro finishes the intro first so the two tweens never fight over a letter.
  gsap.fromTo(titleChars,
    {yPercent:0,opacity:1,rotateX:0},
    {
      yPercent:-170,opacity:0,rotateX:75,
      ease:'none',immediateRender:false,
      stagger:{each:0.02,from:'start'},
      scrollTrigger:{
        trigger:'.hero',start:'top top',end:'bottom top',scrub:0.6,
        onUpdate:()=>{ if(titleIntro.progress()<1) titleIntro.progress(1); },
      },
    });

  /* ---------- HERO META (role / location / availability) ---------- */
  const metaChars=[];
  gsap.utils.toArray('.hero-meta > span').forEach(sp=>{ metaChars.push(...splitChars(sp)); });

  // Intro: lighter 3D assembly to match the title.
  gsap.set('.hero-meta',{opacity:1});
  assembleIn(metaChars,{stagger:0.015,duration:1.0,delay:0.1,from:'random',spread:0.5});

  // Scroll-driven: the whole meta row drifts up and dissolves before the title does.
  gsap.to('.hero-meta',{
    yPercent:-120,opacity:0,filter:'blur(4px)',
    ease:'none',immediateRender:false,
    scrollTrigger:{trigger:'.hero',start:'top top',end:'42% top',scrub:0.5},
  });

  /* ---------- SELECTED WORK (pinned WebGL lens) — must be created before later pins ---------- */
  initLens({splitChars});

  /* ---------- HORIZONTAL SCROLL (pinned Process strip) ---------- */
  // On desktop the section pins and its track translates sideways as you scroll
  // vertically. On touch / small screens we skip the pin and let it be a native
  // swipe strip (the base CSS keeps overflow-x scrollable).
  ScrollTrigger.matchMedia({
    '(min-width: 801px)':()=>{
      const section=document.querySelector('.hscroll');
      const track=document.querySelector('.hscroll-track');
      if(!section||!track) return;
      section.classList.add('gsap-pinned');           // lock overflow so the pin doesn't jump
      const distance=()=>track.scrollWidth-window.innerWidth;

      const scrub=gsap.to(track,{
        x:()=>-distance(),
        ease:'none',
        scrollTrigger:{
          trigger:section,
          start:'top top',
          end:()=>'+='+distance(),
          pin:true,
          scrub:1,
          anticipatePin:1,
          invalidateOnRefresh:true,
        },
      });

      // Each panel eases up + fades in as it enters the viewport, tied to the same
      // horizontal progress via containerAnimation — this is the scroll-driven bit.
      const panels=gsap.utils.toArray('.hscroll .panel');
      panels.forEach(p=>{
        gsap.from(p,{
          opacity:0,y:60,ease:'power2.out',
          scrollTrigger:{
            trigger:p,
            containerAnimation:scrub,
            start:'left 85%',
            end:'left 55%',
            scrub:true,
          },
        });
      });

      return ()=>section.classList.remove('gsap-pinned'); // cleanup when media query no longer matches
    },
  });
}

/* ---- Hero glass blob (Three.js): translucent lavender body, indigo refracting edges ---- */
(()=>{
  const wrap=document.getElementById('hero-blob'),canvas=document.getElementById('blob');
  if(!wrap||!canvas) return;
  const fail=()=>wrap.classList.add('fallback');
  if(!window.THREE) return fail();
  let renderer;
  try{ renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true}); }catch(err){ return fail(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,.1,50);
  camera.position.z=6;

  const vertex=`
    uniform float uTime; varying vec3 vView; varying vec3 vP;
    vec3 warp(vec3 p){
      vec3 q=p*vec3(.8,1.3,.72);
      float t=uTime*.35;
      float d=.26*sin(q.x*2.1+t)*sin(q.y*1.7-t*.8)+.2*sin(q.z*2.6+q.x*1.4+t*.6)+.14*sin(q.y*3.1+q.z*2.2-t);
      return q*(1.+d)+vec3(.18*sin(q.y*2.+t),0.,0.);
    }
    void main(){
      vec3 p=warp(position); vP=p;
      vec4 mv=modelViewMatrix*vec4(p,1.); vView=mv.xyz;
      gl_Position=projectionMatrix*mv;
    }`;
  const fragment=`
    varying vec3 vView; varying vec3 vP; uniform float uBack;
    void main(){
      vec3 n=normalize(cross(dFdx(vView),dFdy(vView)));
      vec3 v=normalize(-vView);
      if(dot(n,v)<0.) n=-n;
      float ndv=clamp(dot(n,v),0.,1.);
      float fres=pow(1.-ndv,2.0);
      vec3 pink=vec3(.93,.82,.98), lav=vec3(.78,.72,.98), mid=vec3(.42,.28,.86), deep=vec3(.16,.09,.55);
      vec3 base=mix(pink,lav,smoothstep(-.9,.9,vP.y));
      vec3 col=mix(base,mid,smoothstep(.12,.6,fres));
      col=mix(col,deep,smoothstep(.5,.92,fres));
      vec3 L=normalize(vec3(-.45,.75,.6));
      col+=vec3(1.)*pow(max(dot(reflect(-L,n),v),0.),60.)*.95;
      col+=vec3(.8,.76,1.)*smoothstep(.5,.58,fres)*(1.-smoothstep(.58,.68,fres))*.4;
      float a=mix(.5,.97,smoothstep(.08,.75,fres));
      if(uBack>.5){ col*=.72; a*=.55; }
      gl_FragColor=vec4(col,a);
    }`;
  const mk=(side,back)=>new THREE.ShaderMaterial({
    vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side,
    extensions:{derivatives:true},
    uniforms:{uTime:{value:0},uBack:{value:back}},
  });
  const geo=new THREE.IcosahedronGeometry(1,40);
  const backMat=mk(THREE.BackSide,1),frontMat=mk(THREE.FrontSide,0);
  const group=new THREE.Group();
  group.add(new THREE.Mesh(geo,backMat),new THREE.Mesh(geo,frontMat));
  group.scale.setScalar(.9);
  scene.add(group);

  const resize=()=>{
    const w=wrap.clientWidth,h=wrap.clientHeight;
    if(!w||!h) return;
    renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener('resize',resize);

  let mx=0,my=0;
  window.addEventListener('mousemove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
  const still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible=true;
  new IntersectionObserver(([e])=>{visible=e.isIntersecting}).observe(wrap);
  const clock=new THREE.Clock();
  const frame=()=>{
    requestAnimationFrame(frame);
    if(!visible&&!still) return;
    const t=still?2:clock.getElapsedTime();
    backMat.uniforms.uTime.value=frontMat.uniforms.uTime.value=t;
    group.rotation.y+=((t*.12+mx*.9)-group.rotation.y)*.05;
    group.rotation.x+=((-.25+my*.5)-group.rotation.x)*.05;
    group.rotation.z=-.35;
    group.position.y=-scrollY*.0006;
    renderer.render(scene,camera);
  };
  frame();
})();
