/* Foxint AI — лендинг: частицы, меню, анимации */

(function(){
  const burger = document.getElementById('navBurger');
  const links = document.querySelector('.nav-links');
  if (!burger || !links) return;
  burger.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav')) links.classList.remove('open');
  });
})();

(function(){
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const items = [];
  const isMobile = window.innerWidth < 720 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const COUNT = isMobile ? 40 : 80;

  function resize(){
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function make(){
    return {
      x: Math.random()*w, y: Math.random()*h,
      r: 1.5 + Math.random()*3.5,
      vy: 0.3 + Math.random()*1.0,
      vx: (Math.random()-0.5)*0.3,
      a: 0.4 + Math.random()*0.5,
      hue: 350 + Math.random()*15,
      ph: Math.random()*6.28
    };
  }

  function init(){ resize(); items.length = 0; for (let i = 0; i < COUNT; i++) items.push(make()); }

  function draw(){
    ctx.clearRect(0, 0, w, h);
    const t = Date.now()/1000;
    for (const p of items){
      p.x += p.vx; p.y += p.vy;
      if (p.y > h + 10){ p.y = -10; p.x = Math.random()*w; }
      if (p.x > w + 10) p.x = -10;
      if (p.x < -10) p.x = w + 10;
      const tw = 0.75 + 0.25 * Math.sin(t*1.5 + p.ph);
      const al = p.a * tw;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r*5);
      glow.addColorStop(0, `hsla(${p.hue},90%,65%,${al})`);
      glow.addColorStop(1, `hsla(${p.hue},90%,65%,0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r*5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},95%,78%,${Math.min(1, al+0.2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { clearTimeout(window._rt); window._rt = setTimeout(init, 200); });
  init();
  draw();
})();

(function(){
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting){
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.feature, .faq-item, .download-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity .6s cubic-bezier(.4,0,.2,1), transform .6s cubic-bezier(.4,0,.2,1)';
    observer.observe(el);
  });
})();

(function(){
  document.querySelectorAll('a[download][href$=".apk"]').forEach(a => {
    a.addEventListener('click', () => {
      console.log('[Foxint] Скачивание APK началось');
    });
  });
})();
