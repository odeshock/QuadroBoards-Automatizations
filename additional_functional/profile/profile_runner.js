// profile_runner.js
(async function(){
  'use strict';

  // 0) библиотеки (подставь свои массивы)
  const LIB_PLASHKA = [
    { id: '1', html: `<div class="item" title="за вступление!" data-id="1">
      <a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka"><wrds>я не подарок, но и ты не шаверма</wrds></a>
    </div>` },
    { id: '2', html: `<div class="item" title="новый дизайн — новая плашка! такие вот делишки, девчонки и мальчишки) а так же их родители.." data-id="2">
      <a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka"><wrds>twinkle twinkle little star</wrds></a>
    </div>` }
  ];
  const LIB_ICON = []; // TODO
  const LIB_BACK = []; // TODO (если класс "_background" — поменяй ниже targetClass)

  function getProfileId(){
    const u=new URL(location.href);
    return u.searchParams.get('id') || '';
  }
  function mountPoint(){
    return document.querySelector('#viewprofile .container') ||
           document.querySelector('#viewprofile #container') ||
           document.querySelector('#viewprofile') ||
           document.querySelector('#container') ||
           document.body;
  }
  const toast = (msg, ok=true)=>{
    const d=document.createElement('div');
    d.textContent=msg;
    d.style.cssText=`position:fixed;right:12px;bottom:12px;background:${ok?'#333':'#a33'};color:#fff;padding:8px 10px;border-radius:8px;z-index:2147483647;opacity:.95`;
    document.body.appendChild(d); setTimeout(()=>d.remove(),1600);
  };

  // 1) проверки
  if (!window.skinAdmin?.load) { toast('admin_bridge.js не подключен', false); return; }
  if (!window.createChoicePanel) { toast('set_up_skin.patched.js не подключен', false); return; }
  const N = getProfileId();
  if (!/^\d+$/.test(N)) { toast('неверный id профиля', false); return; }

  // 2) грузим админку
  const admin = await window.skinAdmin.load(N);
  const root = mountPoint();

  if (admin.status !== 'ok') {
    const msg=document.createElement('div');
    msg.style.cssText='margin:12px 0;padding:10px 12px;border:1px solid #f0caca;background:#fff3f3;border-radius:8px;color:#a33;';
    msg.textContent=admin.status; root.appendChild(msg); return;
  }

  // 3) рисуем три панели в external-режиме
  const header=document.createElement('div');
  header.style.cssText='margin:12px 0;font-weight:600;';
  header.textContent='Скины';
  root.appendChild(header);

  const host=document.createElement('div');
  host.id='__skins_host__';
  root.appendChild(host);

  // панель 1: Плашки
  const p1 = window.createChoicePanel({
    mountEl: host,
    external: true,
    title: 'Плашки',
    targetClass: '_plashka',
    library: LIB_PLASHKA,
    initialHtml: admin.initialHtml
  });

  // панель 2: Иконки
  const p2 = window.createChoicePanel({
    mountEl: host,
    external: true,
    title: 'Иконки',
    targetClass: '_icon',
    library: LIB_ICON,
    initialHtml: admin.initialHtml
  });

  // панель 3: Фон
  const BACK_CLASS = '_back'; // или '_background' — если так у тебя в разметке
  const p3 = window.createChoicePanel({
    mountEl: host,
    external: true,
    title: 'Фон',
    targetClass: BACK_CLASS,
    library: LIB_BACK,
    initialHtml: admin.initialHtml
  });

  // 4) кнопка «Сохранить»
  const footer=document.createElement('div');
  footer.style.cssText='display:flex;justify-content:flex-end;gap:8px;margin:14px 0;';
  const btn=document.createElement('button');
  btn.textContent='Сохранить';
  btn.style.cssText='border:1px solid #2f67ff;background:#2f67ff;color:#fff;padding:8px 14px;border-radius:8px;cursor:pointer';
  footer.appendChild(btn);
  root.appendChild(footer);

  btn.addEventListener('click', async ()=>{
    try {
      // порядок важен: каждый builder меняет только свой блок
      let next = admin.initialHtml;
      next = p1.builder(next);
      next = p2.builder(next);
      next = p3.builder(next);

      const res = await admin.save(next);
      toast(res.ok ? 'Успешно' : (res.status || 'Ошибка'), !!res.ok);
    } catch (e){
      console.error(e);
      toast('Ошибка сохранения', false);
    }
  });
})();
