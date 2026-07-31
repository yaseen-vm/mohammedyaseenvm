const loader = document.getElementById('loader');
const cursor = document.getElementById('cursor');
const menuBtn = document.querySelector('.menu-btn');
const siteNav = document.getElementById('site-nav');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (loader) {
  window.addEventListener('load', () => {
    window.setTimeout(() => loader.classList.add('hide'), 350);
  });
}

if (cursor && hasFinePointer && !reduceMotion) {
  window.addEventListener('mousemove', (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });

  document.querySelectorAll('a, button, .magnetic').forEach((element) => {
    element.addEventListener('mouseenter', () => cursor.classList.add('big'));
    element.addEventListener('mouseleave', () => cursor.classList.remove('big'));
  });
}

if (menuBtn && siteNav) {
  menuBtn.addEventListener('click', () => {
    const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!expanded));
    siteNav.classList.toggle('is-open');
    document.body.classList.toggle('menu-open');
  });

  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuBtn.setAttribute('aria-expanded', 'false');
      siteNav.classList.remove('is-open');
      document.body.classList.remove('menu-open');
    });
  });
}

const revealElements = document.querySelectorAll('.reveal');
if (revealElements.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((element) => io.observe(element));
}

const text = document.querySelector('.reveal-text');
if (text) {
  const textIO = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        text.animate(
          [{ opacity: 0.15, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }],
          { duration: 1000, fill: 'forwards', easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
        );
        textIO.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  textIO.observe(text);
}

if (hasFinePointer && !reduceMotion) {
  document.querySelectorAll('.magnetic').forEach((element) => {
    element.addEventListener('mousemove', (event) => {
      const rect = element.getBoundingClientRect();
      const offsetX = (event.clientX - rect.left - rect.width / 2) * 0.012;
      const offsetY = (event.clientY - rect.top - rect.height / 2) * 0.012;
      element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = '';
    });
  });
}

if (window.gsap && window.ScrollTrigger && !reduceMotion) {
  gsap.registerPlugin(ScrollTrigger);

  const splitChars = (element, extraClass = '') => {
    const textContent = element.textContent;
    element.textContent = '';
    for (const character of textContent) {
      if (character === ' ') {
        element.appendChild(document.createTextNode(' '));
        continue;
      }
      const span = document.createElement('span');
      span.className = `char${character === '.' ? ' dot' : ''}${extraClass ? ` ${extraClass}` : ''}`;
      span.textContent = character;
      span.style.display = 'inline-block';
      span.style.willChange = 'transform, opacity';
      span.style.transformOrigin = '50% 100%';
      element.appendChild(span);
    }
    return [...element.querySelectorAll('.char')];
  };

  const random = gsap.utils.random;
  const assembleIn = (chars, { stagger = 0.06, duration = 1.3, delay = 0, from = 'random', spread = 1 } = {}) => {
    return gsap.fromTo(
      chars,
      {
        opacity: 0,
        transformPerspective: 1000,
        scale: () => random(1.8, 3.2),
        z: () => random(-600, -180),
        xPercent: () => random(-160, 160) * spread,
        yPercent: () => random(-180, 180) * spread,
        rotationX: () => random(-160, 160),
        rotationY: () => random(-160, 160),
        rotationZ: () => random(-100, 100),
        filter: 'blur(18px)'
      },
      {
        opacity: 1,
        scale: 1,
        z: 0,
        xPercent: 0,
        yPercent: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        filter: 'blur(0px)',
        duration,
        ease: 'expo.out',
        delay,
        stagger: { each: stagger, from }
      }
    );
  };

  const titleChars = [];
  gsap.utils.toArray('.hero-title .line > span').forEach((word) => {
    word.style.animation = 'none';
    word.style.transform = 'none';
    word.style.overflow = 'visible';
    word.parentElement.style.overflow = 'visible';
    titleChars.push(...splitChars(word));
  });

  assembleIn(titleChars, { stagger: 0.055, duration: 1.5, delay: 0.3, from: 'random', spread: 1 });

  gsap.to(titleChars, {
    yPercent: -170,
    opacity: 0,
    rotateX: 75,
    ease: 'none',
    immediateRender: false,
    stagger: { each: 0.02, from: 'start' },
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 }
  });

  const metaChars = [];
  gsap.utils.toArray('.hero-meta > span').forEach((value) => {
    metaChars.push(...splitChars(value));
  });

  gsap.set('.hero-meta', { opacity: 1 });
  assembleIn(metaChars, { stagger: 0.015, duration: 1, delay: 0.1, from: 'random', spread: 0.5 });

  gsap.to('.hero-meta', {
    yPercent: -120,
    opacity: 0,
    filter: 'blur(4px)',
    ease: 'none',
    immediateRender: false,
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '42% top', scrub: 0.5 }
  });

  ScrollTrigger.matchMedia({
    '(min-width: 801px)': () => {
      const section = document.querySelector('.hscroll');
      const track = document.querySelector('.hscroll-track');
      if (!section || !track) return;
      section.classList.add('gsap-pinned');
      const distance = () => track.scrollWidth - window.innerWidth;

      const scrub = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => '+=' + distance(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });

      const panels = gsap.utils.toArray('.hscroll .panel');
      panels.forEach((panel) => {
        gsap.from(panel, {
          opacity: 0,
          y: 60,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: panel,
            containerAnimation: scrub,
            start: 'left 85%',
            end: 'left 55%',
            scrub: true
          }
        });
      });

      return () => section.classList.remove('gsap-pinned');
    }
  });
}
