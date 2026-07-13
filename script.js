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
  assembleIn(titleChars,{stagger:0.055,duration:1.5,delay:0.3,from:'random',spread:1});

  // Scroll-driven exit: as the hero scrolls away, each character flies up, tilts and fades.
  gsap.to(titleChars,{
    yPercent:-170,opacity:0,rotateX:75,
    ease:'none',immediateRender:false,
    stagger:{each:0.02,from:'start'},
    scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:0.6},
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
