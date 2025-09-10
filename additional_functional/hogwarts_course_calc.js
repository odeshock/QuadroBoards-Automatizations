  // helpers
  const toDate=(y,m,d)=>new Date(y,m-1,d);
  const fmt=(d)=>d.toLocaleDateString('ru-RU',{year:'numeric',month:'long',day:'numeric'});
  const fmtMonthYear=(d)=>d.toLocaleDateString('ru-RU',{year:'numeric',month:'long'});
  function pluralYears(n){n=Math.floor(Math.abs(n));const l=n%10,l2=n%100;if(l===1&&l2!==11)return`${n} год`;if([2,3,4].includes(l)&&![12,13,14].includes(l2))return`${n} года`;return`${n} лет`;}
  const parseInput=id=>{const el=document.getElementById(id);if(!el.value)return null;const [Y,M,D]=el.value.split('-').map(Number);return toDate(Y,M,D);};
  const box=html=>`<div class="quote-box quote-main">${html}</div>`;
  const clear=()=>document.getElementById('result').innerHTML='';

  // year sanity: 4 digits & range
  function checkYear(id){
    const el=document.getElementById(id); if(!el.value) return {ok:true};
    const [y]=el.value.split('-'); const yn=Number(y);
    if(y.length!==4) return {ok:false,msg:`В поле ${id} год должен быть из 4 цифр.`};
    if(isNaN(yn)||yn<1900||yn>2099) return {ok:false,msg:`В поле ${id} укажите год 1900–2099.`};
    return {ok:true};
  }

  // rules
  function enrollmentYear(dob){
    const y=dob.getFullYear(), m=dob.getMonth()+1, d=dob.getDate();
    const bornOnSept1=(m===9&&d===1);
    const beforeOrOnAug31=(m<9)||(m===8&&d<=31);
    if(bornOnSept1) return y+12;
    return beforeOrOnAug31? y+11 : y+12;
  }
  function graduationDate(enrollYear,maxCourse){ return toDate(enrollYear+maxCourse,6,30); }
  function statusAt(asOf,enrollYear,maxCourse){
    const start1=toDate(enrollYear,9,1);
    if(asOf<start1) return {type:'pre', text:`Ещё не поступил(а) (старт — ${fmt(start1)})`};
    for(let k=0;k<maxCourse;k++){
      const c=k+1;
      const yS=toDate(enrollYear+k,9,1), yE=toDate(enrollYear+k+1,6,30);
      const sS=toDate(enrollYear+k+1,7,1), sE=toDate(enrollYear+k+1,8,31);
      if(asOf>=yS && asOf<=yE) return {type:'in', text:`${c}-й курс`};
      if(asOf>=sS && asOf<=sE){
        if(c===maxCourse) return {type:'grad', text:`Выпустился(ась) (лето после ${maxCourse}-го курса)`};
        return {type:'summer', text:`Закончил(а) ${c}-й курс (лето)`};
      }
    }
    return {type:'grad', text:'Выпустился(ась)'};
  }
  function ageOn(dob,asOf){
    let y=asOf.getFullYear()-dob.getFullYear();
    const had=(asOf.getMonth()>dob.getMonth())||(asOf.getMonth()===dob.getMonth()&&asOf.getDate()>=dob.getDate());
    if(!had) y--; return y;
  }

  function commonBlock(dob,asOf){
    const enrollY=enrollmentYear(dob);
    const enrollDate=toDate(enrollY,9,1);
    const age=ageOn(dob,asOf);
    return box(`
      <div class="cntr"><strong>Общие данные</strong></div><br>
      <div><span class="muted">Дата рождения:</span> <strong>${fmt(dob)}</strong></div>
      <div><span class="muted">Дата в игре:</span> <strong>${fmt(asOf)}</strong></div><br>
      <div><span class="muted">Поступление:</span> <strong>${fmt(enrollDate)}</strong></div>
      <div><span class="muted">Возраст на выбранную дату:</span> <strong>${pluralYears(age)}</strong></div>
    `);
  }

  function variantBlock(label,maxCourse,dob,asOf){
    const enrollY=enrollmentYear(dob);
    const grad=graduationDate(enrollY,maxCourse);
    const st=statusAt(asOf,enrollY,maxCourse);
    return box(`
      <div class="cntr">${label}</div><br>
      <div><span class="muted">Выпуск:</span><strong> ${fmtMonthYear(grad)}</strong></div>
      <div><span class="muted">Статус на ${fmt(asOf)}:</span> <strong>${st.text}</strong></div>
    `);
  }

  function calc(){
    clear();

    const y1=checkYear('dob'), y2=checkYear('asof');
    if(!y1.ok) return document.getElementById('result').innerHTML=box(`<div class="error">${y1.msg}</div>`);
    if(!y2.ok) return document.getElementById('result').innerHTML=box(`<div class="error">${y2.msg}</div>`);

    const dob=parseInput('dob');
    const asof=parseInput('asof');
    if(!dob) return document.getElementById('result').innerHTML=box('<div class="error">Ошибка в дате рождения.</div>');
    if(!asof) return document.getElementById('result').innerHTML=box('<div class="error">Ошибка в дате в игре.</div>');
    if(asof<dob) return document.getElementById('result').innerHTML=box('<div class="error">Дата в игре раньше даты рождения.</div>');

    // общие (один раз)
    const res=document.getElementById('result');
    res.insertAdjacentHTML('beforeend', commonBlock(dob,asof));
    // варианты
    res.insertAdjacentHTML('beforeend', variantBlock('<strong>Если учится 7 курсов</strong>', 7, dob, asof));
    res.insertAdjacentHTML('beforeend', variantBlock('<strong>Если учится 5 курсов</strong>', 5, dob, asof));
  }

  document.getElementById('calc').addEventListener('click',calc);
  document.getElementById('reset').addEventListener('click',()=>{
    document.getElementById('dob').value='';
    document.getElementById('asof').value='1997-08-01';
    clear();
  });
