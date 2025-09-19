(() => {
  // ---------- найти наш <script> ----------
  function findSelfScript() {
    const scripts = Array.from(document.getElementsByTagName('script'));
    const bySrc = scripts.filter(s => (s.src||'').includes('bingo-vinyl.js'));
    if (bySrc.length) return bySrc[bySrc.length - 1];
    return document.currentScript || scripts[scripts.length - 1] || null;
  }
  function getMarks() {
    const el = findSelfScript();
    if (!el) return '';
    const a = el.getAttribute('marks') || el.getAttribute('data-marks');
    if (a) return a;
    try {
      const u = new URL(el.src, location.href);
      return u.searchParams.get('m') || '';
    } catch(_) { return ''; }
  }

  // ---------- задачи ----------
  const CAPTIONS = [
    "привёл друга",
    "набрал 100 сообщений",
    "оставил 3 мема",
    "порекламил 10 раз",
    "написал 3 заявки в «хочу видеть»",
    "определился с ролью",
    "выбрал сторону",
    "поучаствовал в лотерее",
    "отплюсил более 10 раз",
    "оставил 30 сообщений во флуде",
    "поиграл в бутылочку",
    "поделился музыкой"
  ];

  const MARKS = getMarks();

  // ---------- парсер marks ----------
  // формат: строка из 0 и 1 (без пробелов), лишние символы игнорируются
  function parseMarks(str, n) {
    const clean = String(str).replace(/[^01]/g,'');
    return Array.from({length:n},(_,i)=> clean[i]==='1');
  }

  // ---------- блокировка интерактивности ----------
  function lock(input,label,val){
    input.checked = !!val;
    input.disabled = true;
    input.tabIndex = -1;
    const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    for (const ev of ['click','mousedown','pointerdown','touchstart','keydown','change']) {
      (ev==='touchstart')
        ? input.addEventListener(ev, stop, {capture:true, passive:false})
        : input.addEventListener(ev, stop, true);
    }
    if (label) {
      for (const ev of ['click','mousedown','pointerdown','touchstart'])
        label.addEventListener(ev, stop, {capture:true, passive:false});
    }
  }

  // ---------- стили ----------
  function ensureStyles(){
    if (document.getElementById('bingo-vinyl-css')) return;
    const font=document.createElement('link');
    font.rel='stylesheet';
    font.href='https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap';
    document.head.appendChild(font);

    const style=document.createElement('style');
    style.id='bingo-vinyl-css';
    style.textContent=`
.fmv-bingo-vinyl{--bg:#f3efe8;--vinyl:#262626;--groove:#1b1b1b;--label:#e9dcc3;--accent:#9aa17f;--size:120px;--caption:17px;font-family:Georgia,serif;background:var(--bg);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:14px;max-width:760px;margin:0 auto 20px;}
.vinyl-grid{display:grid;gap:16px;grid-template-columns:repeat(3,1fr);}
@media (min-width:720px){.vinyl-grid{grid-template-columns:repeat(4,1fr);}}
.vinyl{width:var(--size);margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;}
.vinyl input{position:absolute;inset:0 0 calc(-1*(var(--caption)+20px)) 0;opacity:0;}
.disc{width:var(--size);height:var(--size);border-radius:50%;background:
 radial-gradient(circle at 50% 50%, #0000 0 36%, rgba(0,0,0,.08) 37% 60%, #0000 61%),
 repeating-radial-gradient(circle at 50% 50%, var(--vinyl) 0 1.6px, var(--groove) 1.6px 3.2px);
 filter:drop-shadow(0 1px 3px rgba(0,0,0,.30));transition:transform .15s ease, box-shadow .15s ease;}
.vinyl:hover .disc{transform:translateY(-1px) scale(1.02);}
.label{position:absolute;left:50%;top:calc(var(--size)/2);transform:translate(-50%,-50%);width:34%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 50% 50%, var(--label) 0 90%, #0000 91%);pointer-events:none;}
.label::after{content:"";position:absolute;left:50%;top:50%;width:18%;aspect-ratio:1/1;border-radius:50%;transform:translate(-50%,-50%);background:#0f0f0f;}
.vinyl input:checked ~ .disc{box-shadow:0 0 0 2px rgba(154,161,127,.6),0 0 10px 2px rgba(154,161,127,.65),0 0 24px 6px rgba(154,161,127,.45);}
.caption{font-family:'Caveat',cursive;font-size:var(--caption);font-weight:700;line-height:1.2;color:#2f2f2f;text-align:center;text-wrap:balance;margin-top:2px;transition:color .15s ease,text-decoration-color .15s ease,opacity .15s ease;}
.vinyl input:checked ~ .caption{text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:var(--accent);opacity:.9;}
`;
    document.head.appendChild(style);
  }

  function buildCell(text,i){
    const label=document.createElement('label');
    label.className='vinyl'; label.dataset.i=String(i); label.setAttribute('role','listitem');
    const input=document.createElement('input'); input.type='checkbox'; input.setAttribute('aria-label', text);
    const disc=document.createElement('div'); disc.className='disc';
    const center=document.createElement('span'); center.className='label';
    const cap=document.createElement('div'); cap.className='caption'; cap.textContent=text;
    label.append(input,disc,center,cap);
    return {label,input};
  }

  function init(){
    ensureStyles();
    const root=document.createElement('div');
    root.id='fmv-bingo-v8';
    root.className='fmv-bingo-vinyl';

    const grid=document.createElement('div');
    grid.className='vinyl-grid'; grid.setAttribute('role','list');

    const marks=parseMarks(MARKS, CAPTIONS.length);
    CAPTIONS.forEach((t,i)=>{
      const {label,input}=buildCell(t,i);
      lock(input,label,marks[i]);
      grid.appendChild(label);
    });

    root.appendChild(grid);
    document.body.appendChild(root);
  }

  (document.readyState==='loading')
    ? document.addEventListener('DOMContentLoaded', init, {once:true})
    : init();
})();
