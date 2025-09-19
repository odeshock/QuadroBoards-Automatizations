(() => {
  // ---------- 1) Редактируемый список (читаемый текст) ----------
  // Просто правьте строки ниже. Если форум их «сломает», код возьмёт резервную копию.
  const CAPTIONS_PLAIN = [
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

  // ---------- 2) Резервная ASCII-копия (base64 UTF-8) ----------
  // Если выше появятся «Ð/Ñ/…», возьмём этот бэкап.
  const CAPTIONS_B64 =
    "WyLQv9C+0LTRgNC+0Lkg0L/QtdGA0L7QvdC40LkiLCLQutC+0YLQvtGA0YssINCc0L7RgtC+0LogMTAwINC80L7RiNC60LDRgtGMIiwgItCe0LHRg9C/0LrRgdC40Y8gMyDQvNCw0YHRgiIsICLQn9C70YzQvdC+IDEwINC80YvQuCIsICLQndC10YDQtdCz0L7Qu9C+0LIiLCAi0J/QsNGA0LjQv9C70LXQutC4IiwgItCe0LHQtdGC0Ywg0KPQsNC60L7QstCwIiwgItC80L7RgdC10YnQuNGH0LXRgiIsICLQn9C+0LPQvtGA0YssINC90L7QvNC10YDRgtGB0LrQuNGB0LgiLCAi0J/RgNC40LLQsNC90L3QvtC1IiwgItCe0L/RgNC+0LHQtdC70YzQvdC+IiwgItCf0L7QvNCw0YDRg9GB0YLQstC+0LIiXQ==";

  // ---------- 3) Детектор «кракозябр» ----------
  // Проверяем: если много символов из «Ð Ñ Ò Ó Ý» или мало кириллицы — считаем сломанным.
  function looksBroken(arr) {
    try {
      const s = (arr || []).join(" ");
      const bad = (s.match(/[ÐÑÒÓÝ]/g) || []).length;
      const cyr = (s.match(/[А-Яа-яЁё]/g) || []).length;
      return bad > 3 && cyr < 3; // эвристика
    } catch { return true; }
  }
  function b64json(b64) {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const txt = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(txt);
  }
  const CAPTIONS = looksBroken(CAPTIONS_PLAIN) ? b64json(CAPTIONS_B64) : CAPTIONS_PLAIN;

  // ---------- 4) Markers ----------
  const SELF  = document.currentScript;
  const MARKS = (SELF && SELF.getAttribute('marks')) || '';
  const RE_SPACE = /[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]+/ug; // любые пробелы/NBSP
  const isChecked = s => /[xх]/iu.test(String(s||'').normalize('NFKC').replace(RE_SPACE,''));
  const parseMarks = (str,n) => {
    const t = String(str||'').trim().split(RE_SPACE);
    return Array.from({length:n},(_,i)=> isChecked(t[i]||'.'));
  };

  // ---------- 5) UI / стили ----------
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

  function ensureStyles(){
    if (document.getElementById('bingo-vinyl-css')) return;
    const font=document.createElement('link');
    font.rel='stylesheet';
    font.href='https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap';
    document.head.appendChild(font);

    const style=document.createElement('style');
    style.id='bingo-vinyl-css';
    style.textContent=`
.fmv-bingo-vinyl{
  --bg:#f3efe8; --vinyl:#262626; --groove:#1b1b1b;
  --label:#e9dcc3; --accent:#9aa17f;
  --size:120px; --caption:17px;
  font-family: Georgia, serif;
  background:var(--bg);
  border:1px solid rgba(0,0,0,.06);
  border-radius:14px; padding:14px;
  max-width:760px; margin:0 auto 20px;
}
.vinyl-grid{display:grid;gap:16px;grid-template-columns:repeat(3,1fr);}
@media (min-width:720px){.vinyl-grid{grid-template-columns:repeat(4,1fr);}}
.vinyl{width:var(--size);margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;}
.vinyl input{position:absolute;inset:0 0 calc(-1*(var(--caption)+20px)) 0;opacity:0;}
.disc{
  width:var(--size);height:var(--size);border-radius:50%;
  background:
    radial-gradient(circle at 50% 50%, #0000 0 36%, rgba(0,0,0,.08) 37% 60%, #0000 61%),
    repeating-radial-gradient(circle at 50% 50%, var(--vinyl) 0 1.6px, var(--groove) 1.6px 3.2px);
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.30));transition:transform .15s ease, box-shadow .15s ease;
}
.vinyl:hover .disc{transform:translateY(-1px) scale(1.02);}
.label{position:absolute;left:50%;top:calc(var(--size)/2);transform:translate(-50%,-50%);width:34%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 50% 50%, var(--label) 0 90%, #0000 91%);pointer-events:none;}
.label::after{content:"";position:absolute;left:50%;top:50%;width:18%;aspect-ratio:1/1;border-radius:50%;transform:translate(-50%,-50%);background:#0f0f0f;}
.vinyl input:checked ~ .disc{box-shadow:0 0 0 2px rgba(154,161,127,.6),0 0 10px 2px rgba(154,161,127,.65),0 0 24px 6px rgba(154,161,127,.45);}
.caption{font-family:'Caveat',cursive;font-size:var(--caption);font-weight:700;line-height:1.2;color:#2f2f2f;text-align:center;text-wrap:balance;margin-top:2px;transition:color .15s ease,text-decoration-color .15s ease,opacity .15s ease;}
.vinyl input:checked ~ .caption{ text-decoration:line-through; text-decoration-thickness:2px; text-decoration-color:var(--accent); opacity:.9; }
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

  // ---------- 6) Рендер ----------
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
