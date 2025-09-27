(async () => {
  // ===================== НАСТРОЙКИ =====================
  const MAX_PAGES = 50;
  const REQUEST_DELAY_MS = 400;

  const TOPIC_SELECTOR = '.topic';
  const BLOCK_SPACER_LINES = 2;
  const BLOCK_SEP = '\n'.repeat(BLOCK_SPACER_LINES + 1);
  const POST_SEPARATOR = '\n\n----------------\n\n';
  const TOPIC_SEP = `\n\n${'='.repeat(80)}\n\n`;

  // стили: тихо и только same-origin, чтобы не было CORS-алертов в консоли
  const QUIET_CSS_WARNINGS = true;
  const CSS_SAME_ORIGIN_ONLY = true;

  // ===================== УТИЛИТЫ =====================
  const enc = new TextEncoder();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const abs = (u, base) => new URL(u, base).href;
  const safeName = (s) => (s || 'export')
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g,'_')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,160);
  const encodeUtf8WithBOM = (s)=>{const b=enc.encode(s);const out=new Uint8Array(3+b.length);out.set([0xEF,0xBB,0xBF],0);out.set(b,3);return out;};

  const BBCODE_IMG_RE = /\[(?:icon|img)\]\s*(https?:\/\/[^\]\s]+)\s*\[\/(?:icon|img)\]/ig;
  const PLAIN_IMG_URL_RE = /(https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg|ico)(?:\?[^\s\]]*)?)/ig;

  async function fetchBuffer(url, opts={}) {
    const res = await fetch(url, { credentials:'include', ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = await res.arrayBuffer();
    return { buf:new Uint8Array(buf), ctype: res.headers.get('content-type')||'' };
  }

  // ---- декодёр HTML ----
  function decodeBest(bytes, hinted) {
    const variants=[]; if(hinted) variants.push(hinted.toLowerCase());
    variants.push('utf-8','windows-1251','koi8-r','iso-8859-5');
    const tried=new Set(), cand=[];
    for(const n of variants){ if(tried.has(n))continue; tried.add(n);
      try{ const td=new TextDecoder(n,{fatal:false}); const text=td.decode(bytes);
        const bad=(text.match(/\uFFFD/g)||[]).length; cand.push({n,text,bad}); }catch{}
    }
    cand.sort((a,b)=>(a.bad-b.bad)||(a.n==='utf-8'?-1:0));
    return cand[0] || { text:new TextDecoder().decode(bytes) };
  }
  const sniffCharsetFromCtype=(ctype)=>(ctype||'').match(/charset\s*=\s*([^\s;]+)/i)?.[1]||null;
  function sniffCharsetFromHtmlHead(chunk){
    return /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)\s*["']?/i.exec(chunk)?.[1]
        || /http-equiv=["']content-type["'][^>]*content=["'][^"']*charset=([\w-]+)/i.exec(chunk)?.[1]
        || null;
  }
  async function fetchDocSmart(url){
    const { buf, ctype } = await fetchBuffer(url);
    const hinted1 = sniffCharsetFromCtype(ctype);
    let { text } = decodeBest(buf, hinted1);
    const hinted2 = sniffCharsetFromHtmlHead(text.slice(0,4096));
    if (hinted2 && hinted2.toLowerCase() !== (hinted1||'').toLowerCase()) text = decodeBest(buf, hinted2).text;
    return new DOMParser().parseFromString(text, 'text/html');
  }

  // ---- пагинация ----
  function findNextUrl(doc, baseUrl){
    const linkNext = doc.querySelector('link[rel="next"]');
    if (linkNext?.getAttribute('href')) return abs(linkNext.getAttribute('href'), baseUrl);
    const aSel = doc.querySelector('a[rel="next"], a.next, a[aria-label="Next"], a[aria-label="Следующая"], a[aria-label="Далее"]');
    if (aSel?.getAttribute('href')) return abs(aSel.getAttribute('href'), baseUrl);
    const all=[...doc.querySelectorAll('a[href]')];
    const re=/^(next|след(ующая|)|далее|more|older|вперёд|›|»|→)$/i;
    const byText=all.find(a=>re.test(a.textContent.trim().toLowerCase()));
    if (byText) return abs(byText.getAttribute('href'), baseUrl);
    const classNext=all.find(a=>/next/i.test(a.className));
    if (classNext) return abs(classNext.getAttribute('href'), baseUrl);
    return null;
  }

  // ---- раскрытие спойлеров/шаблонов ----
  function inlineHiddenTemplates(root){
    root.querySelectorAll('script[type="text/html"], script[type="text/template"]').forEach(sc=>{
      try{ const tmp=document.createElement('div'); tmp.innerHTML=sc.textContent||'';
        const frag=document.createDocumentFragment(); while(tmp.firstChild) frag.appendChild(tmp.firstChild); sc.replaceWith(frag);}catch{}
    });
    root.querySelectorAll('div[onclick*="toggleSpoiler"]').forEach(div=>{
      const q = (div.nextElementSibling && div.nextElementSibling.tagName==='BLOCKQUOTE') ? div.nextElementSibling : null;
      const sc = q && q.nextElementSibling && q.nextElementSibling.tagName==='SCRIPT' &&
                 /^(text\/html|text\/template)$/i.test(q.nextElementSibling.type) ? q.nextElementSibling : null;
      if(q && sc){ try{ q.innerHTML=sc.textContent||''; sc.remove(); }catch{} }
    });
  }

  // ---- TXT сериализация ----
  function topicToPlainText(topicNode, pageUrl){
    const node = topicNode.cloneNode(true);
    inlineHiddenTemplates(node);
    node.querySelectorAll('script,style,noscript,iframe').forEach(n=>n.remove());
    node.querySelectorAll('a[href]').forEach(a=>{
      const href = abs(a.getAttribute('href'), pageUrl);
      const text = (a.textContent||'').trim().replace(/\s+/g,' ');
      a.replaceWith(document.createTextNode(text? `${text} (${href})` : href));
    });
    node.querySelectorAll('img').forEach(img=>{
      const alt=img.getAttribute('alt')||'';
      const src=img.getAttribute('src')?abs(img.getAttribute('src'), pageUrl):'';
      img.replaceWith(document.createTextNode(alt?`${alt} [image: ${src}]`:(src?`[image: ${src}]`:'[image]')));
    });

    const POST_MARK='\u0001__POST__\u0001', BLK_MARK='\u0001__BLK__\u0001', LINE_MARK='\u0001__LINE__\u0001';
    const BLOCK=new Set(['P','DIV','SECTION','ARTICLE','ASIDE','HEADER','FOOTER','NAV','H1','H2','H3','H4','H5','H6','UL','OL','LI','DL','DT','DD','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','BLOCKQUOTE','PRE','HR','FIGURE','FIGCAPTION']);
    const norm=(s)=>s.replace(/\u00A0+/g,' ').replace(/[ \t]{2,}/g,' ');
    const isPostRoot=(el)=>el.matches?.('.post, .post-content');
    const inPost=(el)=>!!(el.closest?.('.post, .post-content'));
    const sepFor=(ctx)=>ctx.inPost?POST_MARK:(ctx.inList?LINE_MARK:BLK_MARK);

    function ser(el,ctx={inPost:false,inList:false}){
      if(el.nodeType===Node.TEXT_NODE) return norm(el.nodeValue);
      if(el.nodeType===Node.ELEMENT_NODE){
        const tag=el.nodeName;
        const here={inPost:ctx.inPost||inPost(el)||isPostRoot(el),inList:ctx.inList};
        if(tag==='BR') return (here.inPost||here.inList)?'\n':' ';
        if(tag==='LI'){ const inside=[...el.childNodes].map(n=>ser(n,{...here,inList:true})).join(''); return `- ${inside}${LINE_MARK}`; }
        if(tag==='TR'){ const cells=[...el.children].filter(c=>c.nodeName==='TD'||c.nodeName==='TH').map(c=>norm([...c.childNodes].map(n=>ser(n,here)).join('')).trim()); return cells.join(' | ')+LINE_MARK; }
        if(tag==='UL'||tag==='OL'){ const inside=[...el.childNodes].map(n=>ser(n,{...here,inList:true})).join(''); return inside+sepFor(here); }
        if(tag==='TABLE'){ const inside=[...el.childNodes].map(n=>ser(n,here)).join(''); return inside.trimEnd()+sepFor(here); }
        const inside=[...el.childNodes].map(n=>ser(n,here)).join('');
        if(BLOCK.has(tag)){ const trimmed=inside.trim(); return trimmed?(trimmed+sepFor(here)):''; }
        return inside;
      }
      return '';
    }

    const posts=[...node.querySelectorAll('.post')];
    let out;
    if(posts.length){
      const parts=posts.map(p=>{
        let s=ser(p,{inPost:true,inList:false});
        s = s.replace(/\r/g,'').replace(/[ \t]+/g,' ')
          .replace(new RegExp(LINE_MARK,'g'),'\n')
          .replace(new RegExp(POST_MARK,'g'),'\n\n')
          .replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').replace(/^[ \t]+/gm,'').trim();
        return s;
      }).filter(Boolean);
      out = parts.join(POST_SEPARATOR);
    } else {
      out = ser(node,{inPost:false,inList:false});
      while(out.includes(BLK_MARK+BLK_MARK)) out=out.replace(BLK_MARK+BLK_MARK,BLK_MARK);
      while(out.includes(POST_MARK+POST_MARK)) out=out.replace(POST_MARK+POST_MARK,POST_MARK);
      out = out.replace(/\r/g,'').replace(/[ \t]+/g,' ')
        .replace(new RegExp(LINE_MARK,'g'),'\n')
        .replace(new RegExp(POST_MARK,'g'),'\n\n')
        .replace(new RegExp(BLK_MARK,'g'),BLOCK_SEP)
        .replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').replace(/^[ \t]+/gm,'').trim();
    }

    // BBCode/голые URL -> [image: ...]
    out = out
      .replace(BBCODE_IMG_RE, (_m, url) => `[image: ${url}]`)
      .replace(PLAIN_IMG_URL_RE, (url) => `[image: ${url}]`);

    return out;
  }

  // ---- HTML блок + сбор IMG ----
  function topicToHTMLBlock(topicNode, pageUrl, heading, imgSet){
    const node = topicNode.cloneNode(true);
    inlineHiddenTemplates(node);
    node.querySelectorAll('script,iframe,noscript').forEach(n=>n.remove());

    node.querySelectorAll('a[href]').forEach(a=>{
      try{ a.setAttribute('href', abs(a.getAttribute('href'), pageUrl)); }catch{}
    });
    node.querySelectorAll('img[src]').forEach(img=>{
      try{ const u=abs(img.getAttribute('src'), pageUrl); img.setAttribute('src', u); imgSet.add(u);}catch{}
    });

    // IMG из BBCode/голых URL в тексте
    const rawText = node.textContent || '';
    for (const re of [BBCODE_IMG_RE, PLAIN_IMG_URL_RE]) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(rawText)) !== null) {
        try { imgSet.add(new URL(m[1] || m[0], pageUrl).href); } catch {}
      }
    }
    // BBCode -> <img>
    const bbcodeToImg = (html) => html.replace(BBCODE_IMG_RE, (_m, url) => `<img src="${url}">`);

    const content = bbcodeToImg(node.innerHTML);
    const srcLink = `<div class="source">Источник: <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">${pageUrl}</a></div>`;
    return `<section class="topic-block">
  <h2 class="topic-title">${escapeHtml(heading)}</h2>
  ${srcLink}
  <div class="topic-content">${content}</div>
</section>`;
  }
  const escapeHtml = (s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ---- ПОЛНЫЙ CSS СТРАНИЦЫ (тихо + только same-origin) ----
  async function collectPageCSS(doc, pageUrl, fetched) {
    let css = '';

    // inline <style>
    doc.querySelectorAll('style').forEach(st => {
      try { css += rewriteCssUrls(st.textContent || '', pageUrl) + '\n'; }
      catch(e){ /* тихо */ }
    });

    // внешние стили
    const links = [...doc.querySelectorAll('link[rel~="stylesheet"][href]')];
    for (const ln of links) {
      const hrefAbs = abs(ln.getAttribute('href'), pageUrl);
      if (fetched.has(hrefAbs)) continue;
      fetched.add(hrefAbs);

      if (CSS_SAME_ORIGIN_ONLY) {
        try {
          const same = new URL(hrefAbs, location.href).origin === location.origin;
          if (!same) continue; // тихо пропускаем чужие домены
        } catch { continue; }
      }

      try {
        const same = new URL(hrefAbs, location.href).origin === location.origin;
        const res = await fetch(hrefAbs, same ? { credentials:'include' } : { mode:'cors', credentials:'omit' });
        if (!res.ok) continue;                // тихо
        const text = await res.text();
        css += rewriteCssUrls(text, hrefAbs) + '\n';
      } catch {
        // тихо
      }

      await sleep(50);
    }

    return css.trim();
  }
  function rewriteCssUrls(cssText, baseUrl) {
    return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_, q, url) => {
      if (/^data:|^https?:|^\/\//i.test(url)) return `url(${url})`;
      try { return `url(${abs(url, baseUrl)})`; } catch { return `url(${url})`; }
    });
  }

  // ---- ZIP (store) ----
  const CRC_TABLE=(()=>{let c, t=new Uint32Array(256);for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(u8){let c=0^(-1);for(let i=0;i<u8.length;i++) c=(c>>>8)^CRC_TABLE[(c^u8[i])&0xFF];return (c^(-1))>>>0;}
  function dtToDos(d){const time=((d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)))&0xFFFF;
    const date=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;return {time,date};}
  function U16(v){const b=new Uint8Array(2);b[0]=v&255;b[1]=(v>>>8)&255;return b;}
  function U32(v){const b=new Uint8Array(4);b[0]=v&255;b[1]=(v>>>8)&255;b[2]=(v>>>16)&255;b[3]=(v>>>24)&255;return b;}
  class SimpleZip{
    constructor(){this.parts=[];this.central=[];this.offset=0;}
    _cat(arr){const n=arr.reduce((s,a)=>s+a.length,0);const u=new Uint8Array(n);let o=0;for(const a of arr){u.set(a,o);o+=a.length;}return u;}
    addFile(path, dataU8, mtime=new Date()){
      const name=enc.encode(path); const {time,date}=dtToDos(mtime); const crc=crc32(dataU8); const method=0, flags=0x0800;
      const local=this._cat([U32(0x04034b50),U16(20),U16(flags),U16(method),U16(time),U16(date),U32(crc),U32(dataU8.length),U32(dataU8.length),U16(name.length),U16(0),name,dataU8]);
      const ofs=this.offset; this.parts.push(local); this.offset+=local.length;
      const cent=this._cat([U32(0x02014b50),U16(20),U16(20),U16(flags),U16(method),U16(time),U16(date),U32(crc),U32(dataU8.length),U32(dataU8.length),U16(name.length),U16(0),U16(0),U16(0),U16(0),U32(0),U32(ofs),name]);
      this.central.push(cent);
    }
    buildBlob(){const cent=this._cat(this.central);
      const eocd=this._cat([U32(0x06054b50),U16(0),U16(0),U16(this.central.length),U16(this.central.length),U32(cent.length),U32(this.offset),U16(0)]);
      return new Blob([...this.parts,cent,eocd],{type:'application/zip'});}
  }

  // ---------- экспорт темы ----------
  async function exportThread(threadUrl){
    const u = new URL(threadUrl, location.href);
    const id = u.searchParams.get('id') || '0';

    const result = {
      title: '',
      folder: '',
      pageTxtName: '',
      pageTxtBytes: null,
      pageHtmlName: '',
      pageHtmlBytes: null,
      images: [],
      failedPages: [],
      pagesCount: 0,
      imagesCount: 0
    };

    // страницы
    const pages=[];
    let doc0=await fetchDocSmart(u.href);
    pages.push({url:u.href, doc:doc0});
    let next=findNextUrl(doc0,u.href);
    const seen=new Set([abs(u.href,location.href)]);
    while(next && pages.length<MAX_PAGES && !seen.has(next)){
      seen.add(next);
      try{ const d=await fetchDocSmart(next); pages.push({url:next,doc:d}); next=findNextUrl(d,next);}catch{break;}
      await sleep(REQUEST_DELAY_MS);
    }
    result.pagesCount = pages.length;

    // текст+html+css+картинки
    let finalText=''; 
    const htmlBlocks=[]; 
    const imgSet=new Set();
    let fullCSS = '';
    const fetchedStyles = new Set();

    for (const {url:pageUrl,doc} of pages){
      fullCSS += '\n' + await collectPageCSS(doc, pageUrl, fetchedStyles);

      const pageTitle=(doc.querySelector('title')?.textContent||'').trim();
      if (!result.title) result.title = pageTitle || `topic_${id}`;

      const topics=[...doc.querySelectorAll(TOPIC_SELECTOR)];
      if(!topics.length){ result.failedPages.push(pageUrl); continue; }
      for (const t of topics){
        const heading=t.querySelector('h1,h2,h3,.title,.topic__title')?.textContent?.trim()||pageTitle||'topic';

        const text=topicToPlainText(t,pageUrl);
        const headerTxt=`${heading}\n${'-'.repeat(Math.min(80,heading.length))}\nИсточник: ${pageUrl}`;
        finalText += (finalText?TOPIC_SEP:'') + `${headerTxt}\n\n${text}`;

        const blockHtml = topicToHTMLBlock(t, pageUrl, heading, imgSet);
        htmlBlocks.push(blockHtml);
      }
    }

    // скачать изображения
    const filenameByUrl = new Map();
    let imgIdx=1;
    const extFrom=(ctype,path)=>{const map={'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg','image/bmp':'bmp','image/x-icon':'ico','image/vnd.microsoft.icon':'ico','image/heic':'heic','image/avif':'avif'}; if(map[ctype])return map[ctype]; const m=/\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(path||''); return m?m[1].toLowerCase():'bin';};
    for (const src of imgSet){
      try{
        const iu=new URL(src, location.href);
        const same=iu.origin===location.origin;
        const opts = same ? {credentials:'include'} : {mode:'cors', credentials:'omit'};
        const res=await fetch(iu.href, opts);
        if(!res.ok){ result.failedPages.push(`[IMG ${res.status}] ${iu.href}`); continue; }
        const buf=new Uint8Array(await res.arrayBuffer());
        const ext=extFrom(res.headers.get('content-type')||'', iu.pathname);
        const local = `images/img_${String(imgIdx++).padStart(4,'0')}.${ext}`;
        filenameByUrl.set(iu.href, local);
        result.images.push({ path: local, bytes: buf });
      }catch(e){ result.failedPages.push(`[IMG ERR] ${src} :: ${e.message}`); }
    }
    result.imagesCount = result.images.length;

    // финальный HTML
    const titleName = safeName(result.title || `topic_${id}`);
    const baseFrameCSS = `
:root { --fg:#111; --bg:#fff; --muted:#666; --sep:#ddd; }
*{box-sizing:border-box}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,'Noto Sans',sans-serif;line-height:1.6}
h1{font-size:20px;margin:0 0 16px}
h2.topic-title{font-size:18px;margin:24px 0 8px}
.topic-block{margin:0 0 24px;padding:0 0 16px;border-bottom:1px solid var(--sep)}
.source{color:var(--muted);font-size:12px;margin-bottom:8px;word-break:break-all}
img{max-width:100%;height:auto}
blockquote{border-left:3px solid var(--sep);padding:0 0 0 12px;margin:8px 0}
table{border-collapse:collapse} td,th{border:1px solid var(--sep);padding:4px 8px}
`;
    const stylesFinal = `${baseFrameCSS}\n/* ---- Inlined from pages ---- */\n${fullCSS || ''}`;

    let html = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titleName)}</title>
<style>${stylesFinal}</style>
</head><body>
<h1>${escapeHtml(titleName)}</h1>
${htmlBlocks.join('\n')}
</body></html>`;

    // относительные пути к images из pages/
    const htmlPath = `pages/${titleName}.html`;
    const upPrefix = '../'.repeat(Math.max(0, htmlPath.split('/').length - 1));
    for (const [urlAbs, local] of filenameByUrl.entries()) {
      html = html.split(urlAbs).join(`${upPrefix}${local}`); // ../images/...
    }

    result.folder = `${titleName} [${id}]`;
    result.pageTxtName = `pages/${titleName}.txt`;
    result.pageTxtBytes = encodeUtf8WithBOM(finalText || '[empty]');
    result.pageHtmlName = htmlPath;
    result.pageHtmlBytes = encodeUtf8WithBOM(html);

    return result;
  }

  // ---------- собрать ссылки из текущего #pN-content ----------
  function collectLinksFromCurrent() {
    const m = location.hash.match(/^#p(\d+)/i);
    if (!m) { console.warn('В URL нет #pN — не от чего отталкиваться'); return []; }
    const N = m[1];
    const host = document.querySelector(`#p${N}-content`);
    if (!host) { console.warn(`Не найден контейнер #p${N}-content`); return []; }

    const clone = host.cloneNode(true);
    try { inlineHiddenTemplates(clone); } catch {}

    const out = [];
    const seen = new Set();

    // <a href>
    clone.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!/viewtopic\.php\?id=\d+/i.test(href)) return;
      try {
        const u = new URL(href, location.href).href;
        if (!seen.has(u)) { seen.add(u); out.push(u); }
      } catch {}
    });

    // ссылки в тексте
    const text = clone.textContent || '';
    const URL_IN_TEXT = /\[url\]\s*(https?:\/\/[^\]\s]+viewtopic\.php\?id=\d+[^\]\s]*)\s*\[\/url\]|(https?:\/\/[^\s<>"']*viewtopic\.php\?id=\d+[^\s<>"']*)/ig;
    let mt;
    while ((mt = URL_IN_TEXT.exec(text)) !== null) {
      const raw = (mt[1] || mt[2] || '').trim();
      if (!raw) continue;
      try {
        const u = new URL(raw, location.href).href;
        if (!seen.has(u)) { seen.add(u); out.push(u); }
      } catch {}
    }
    return out;
  }

  // ---------- Оркестратор ----------
  const threads = collectLinksFromCurrent();
  if (!threads.length) { console.warn('Внутри соответствующего #pN-content не нашлось ссылок на темы'); return; }

  const zip = new SimpleZip();
  const failures = [];
  const bundleName = `${safeName(document.title)}`;

  for (const href of threads){
    console.log('▶ Экспорт темы:', href);
    try{
      const r = await exportThread(href);
      const folder = r.folder; // "TITLE [ID]"

      // pages/
      zip.addFile(`${folder}/${r.pageTxtName}`, r.pageTxtBytes);
      zip.addFile(`${folder}/${r.pageHtmlName}`, r.pageHtmlBytes);
      // images/
      for (const img of r.images) zip.addFile(`${folder}/${img.path}`, img.bytes);

      if (!r.pageTxtBytes || (new TextDecoder().decode(r.pageTxtBytes.slice(3))).trim()==='[empty]') {
        failures.push(`EMPTY TEXT :: ${href}`);
      }
      if (r.failedPages.length) failures.push(`--- ${href}\n${r.failedPages.map(s=>'  - '+s).join('\n')}`);
    }catch(e){
      failures.push(`THREAD ERROR :: ${href} :: ${e.message}`);
    }
  }

  const report =
`Экспорт из блока ${location.hash || '(без хеша)'}
Всего тем: ${threads.length}
Дата: ${new Date().toISOString()}
Источник: ${location.href}

Проблемы:
${failures.length ? failures.join('\n') : '— нет —'}
`;
  zip.addFile(`FAILED_SUMMARY.txt`, encodeUtf8WithBOM(report));

  const blob = zip.buildBlob();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${bundleName}.zip`;
  a.style.display='none'; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);

  console.log(`🏁 Готово: ${bundleName}.zip  | Найдено тем: ${threads.length}`);
})();
