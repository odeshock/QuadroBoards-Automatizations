(() => {
  // читаем плейлист из HTML
  const list   = document.getElementById('fmv-radio-tracks');
  const tracks = Array.from(list.querySelectorAll('li')).map(li => ({
    url: li.dataset.src || '',
    title: li.dataset.title || '',
    artist: li.dataset.artist || '',
    cover: li.dataset.cover || ''
  })).filter(t => t.url);

  const $ = id => document.getElementById(id);
  const audio  = $('fmv-radio-audio');
  const btnPrev= $('fmv-radio-prev');
  const btnNext= $('fmv-radio-next');
  const btnTgl = $('fmv-radio-toggle');
  const bar    = $('fmv-radio-progress');
  const cover  = $('fmv-radio-cover');
  const titleL = $('fmv-radio-titleline');

  let index=0, seeking=false;

  const label = t => `${(t.title||'—').toLowerCase()} // ${(t.artist||'').toLowerCase()}`;
  const setPlayingUI = on => btnTgl.classList.toggle('is-playing', on);

  // заголовок + обложка; вторую копию добавляем ТОЛЬКО если не влезает
  function setTitleAndCover(t){
    const text = label(t);
    titleL.innerHTML = '';

    const track = document.createElement('span');
    track.className = 'track';

    const first = document.createElement('span');
    first.className = 'copy';
    first.textContent = text;

    track.appendChild(first);
    titleL.appendChild(track);

    requestAnimationFrame(() => {
      const need = first.scrollWidth > titleL.clientWidth + 2;
      titleL.classList.toggle('scroll', need);

      if (need) {
        const second = first.cloneNode(true);
        track.appendChild(second);

        const gap = parseInt(getComputedStyle(titleL).getPropertyValue('--gap')) || 0;
        titleL.style.setProperty('--shift', `-${first.scrollWidth + gap}px`);
      } else {
        titleL.style.removeProperty('--shift');
      }
    });

    cover.style.backgroundImage = t.cover ? `url("${t.cover}")` : 'none';
  }

  function setFill(p){
    bar.style.background = `linear-gradient(to right, var(--acc) 0% ${p}%, var(--rail) ${p}% 100%)`;
  }



  function load(i, autoplay){
    if (!tracks.length) return;
    index = (i + tracks.length) % tracks.length;
    const t = tracks[index];

    audio.src = t.url;
    setTitleAndCover(t);
    bar.value = 0; setFill(0);
    audio.load();

    if (autoplay) {
      setPlayingUI(true);                   // оптимистично — без мигания
      audio.play().catch(() => setPlayingUI(false));
    } else {
      setPlayingUI(false);
    }
  }

  function play(){ audio.play().then(()=>setPlayingUI(true)).catch(()=>{}); }
  function pause(){ audio.pause(); setPlayingUI(false); }
  const toggle = () => (audio.paused ? play() : pause());

  // сохраняем состояние при ручном prev/next
  function prev(){
    const shouldAutoplay = !audio.paused;
    load(index - 1, shouldAutoplay);
  }
  function next(forceAutoplay){
    const shouldAutoplay = forceAutoplay === true ? true : !audio.paused;
    load(index + 1, shouldAutoplay);
  }

  // синхронизация UI с реальными событиями
  audio.addEventListener('playing', () => setPlayingUI(true));
  audio.addEventListener('pause',   () => setPlayingUI(false));

  // прогресс
  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    const pct = (audio.currentTime/(audio.duration||1))*100;
    bar.value = isFinite(pct) ? pct : 0;
    setFill(bar.value);
  });

  // по окончании — всегда автоплей следующего
  audio.addEventListener('ended', () => next(true));

  bar.addEventListener('input', () => { seeking = true; setFill(bar.value); });
  bar.addEventListener('change', () => {
    const t = (bar.value/100)*(audio.duration||0);
    if (isFinite(t)) audio.currentTime = t;
    seeking = false;
  });

  // кнопки + хоткеи
  btnTgl.addEventListener('click', toggle);
  btnPrev.addEventListener('click', prev);
  btnNext.addEventListener('click', () => next()); // сохраняем play/pause
  // document.addEventListener('keydown', e => {
  //   const t = e.target;
  //   if (t && (t.isContentEditable || ['INPUT','TEXTAREA'].includes(t.tagName))) return;
  //   if (e.code === 'Space') { e.preventDefault(); toggle(); }
  //   else if (e.code === 'ArrowRight') next();
  //   else if (e.code === 'ArrowLeft')  prev();
  // });

  // старт
  load(0,false);
})();
