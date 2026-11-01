/* 렉처 내비 — 공부 기능 (index.html 다음에 읽힌다)
   ② 실시간 전사·번역  ④ 슬라이드 연결  ⑤ 중요 별 표시  ⑥ 근거 있는 질문 답변  ⑦ 문제  ⑧ 요약
   AI 가 없어도 되는 것: 실시간 자막(브라우저 음성 인식), 전사문 가져오기, 슬라이드 연결, 별 표시, 별 모음 요약,
                        빈칸 문제, 전사문 검색, 「Claude 앱에서 물어보기」(질문을 복사해 claude.ai 로)
   Claude API 키를 넣으면 더 되는 것: 번역, AI 답변, AI 문제, AI 요약 (키는 이 기기 localStorage 에만 둔다)
   index.html 은 hook('이름', …) 으로 여기 on_이름() 을 부른다. */
'use strict';

/* ---- 설정 ---- */
const CFG={cap:true,tr:false,key:'',lang:'ko-KR'};
try{Object.assign(CFG,JSON.parse(localStorage.getItem('lnCfg')||'{}'))}catch(e){}
function saveCfg(){try{localStorage.setItem('lnCfg',JSON.stringify(CFG))}catch(e){}}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SRC=window.SpeechRecognition||window.webkitSpeechRecognition;
const lecLang=()=>(active&&active.lec.lang)||CFG.lang||'ko-KR';

/* ---- 화면 요소 ---- */
const SP=$('sp'),SPB=$('spb'),CAP=$('cap'),CAPB=$('capb'),STUDYB=$('studyb');
let TAB='tr',FILTER='page';

/* ======================================================================
   ② 실시간 자막 (브라우저 음성 인식)
   녹음(MediaRecorder)과 따로 돈다. 문장이 끝나면 '그 문장을 말하기 시작한 시각'을
   녹음 시각으로 바꿔 전사문(lec.tr)에 넣는다 → 문장을 누르면 그 녹음으로 간다.
   아이폰은 음성 인식과 녹음이 마이크를 두고 다툴 수 있다. 자막을 켠 직후 녹음이 끊기면
   자막을 끄고(그 기기에서는 다시 안 켬) 녹음을 살린다. 그때는 녹음 뒤 「전사문 넣기」를 쓴다. */
const LIVE={rec:null,gen:0,starts:{},interim:'',restartT:0,err:null,startedAt:0};
const capWanted=()=>CFG.cap&&!CFG.capBroken&&REC.on&&!!SRC&&!document.hidden;
function liveStart(){
  if(!capWanted()||LIVE.rec)return;
  let r;try{r=new SRC()}catch(e){return}
  r.lang=lecLang();r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
  const gen=++LIVE.gen;LIVE.starts={};
  r.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const res=e.results[i],k=gen+':'+i;
      if(!LIVE.starts[k])LIVE.starts[k]=Date.now();
      if(res.isFinal){const x=(res[0]&&res[0].transcript||'').trim();if(x)addLine(x,LIVE.starts[k]);delete LIVE.starts[k]}
      else interim+=res[0]?res[0].transcript:'';
    }
    LIVE.interim=interim;capRender();
  };
  r.onerror=e=>{
    LIVE.err=e.error;
    if(e.error==='not-allowed'||e.error==='service-not-allowed'){
      CFG.cap=false;saveCfg();capSync();
      toast('음성 인식을 쓸 수 없어서 자막을 껐어요. (아이폰은 설정 → 일반 → 키보드 → 받아쓰기를 켜 주세요)',5000);
    }
  };
  r.onend=()=>{
    if(LIVE.rec===r)LIVE.rec=null;
    if(capWanted()){clearTimeout(LIVE.restartT);LIVE.restartT=setTimeout(liveStart,LIVE.err==='network'?2500:250)}
    LIVE.err=null;
  };
  try{r.start();LIVE.rec=r;LIVE.startedAt=Date.now()}catch(e){LIVE.rec=null}
  capRender();
}
function liveStop(){
  clearTimeout(LIVE.restartT);
  const r=LIVE.rec;LIVE.rec=null;
  if(r){r.onend=null;try{r.stop()}catch(e){}}
  LIVE.interim='';capRender();
}
function addLine(x,startEpoch){
  const t=active,seg=REC.seg;if(!t||!seg)return;
  const ms=Math.max(0,startEpoch-seg.start-300);
  t.lec.tr=t.lec.tr||[];
  const line={id:nextId(t.lec),s:seg.id,t:ms,x,src:'live'};
  t.lec.tr.push(line);saveLec();
  LAST.push(line);if(LAST.length>2)LAST.shift();
  trQueue(line);dirty();
}
const LAST=[];
function nextId(lec){lec.trn=(lec.trn||0)+1;return lec.trn}
function capRender(){
  const show=REC.on&&CFG.cap&&!CFG.capBroken&&!!SRC;
  CAP.hidden=!show||(!LAST.length&&!LIVE.interim);
  if(CAP.hidden)return;
  CAP.innerHTML=LAST.map(l=>'<div class="cl">'+esc(l.x)+(l.k?'<div class="ck">'+esc(l.k)+'</div>':'')+'</div>').join('')+
    (LIVE.interim?'<div class="cl ci">'+esc(LIVE.interim)+'</div>':'');
}
function capSync(){
  CAPB.classList.toggle('on',CFG.cap&&!CFG.capBroken&&!!SRC);
  CAPB.disabled=!SRC;CAPB.title=SRC?'실시간 자막 켜기/끄기':'이 브라우저는 음성 인식이 없어요';
  CAP.classList.toggle('top2',INK.pos==='top'&&INK.open);
  capRender();
}
CAPB.onclick=()=>{
  if(!SRC){toast('이 브라우저에서는 실시간 자막을 쓸 수 없어요. 녹음 뒤 「전사문 넣기」를 써 주세요',3500);return}
  if(CFG.capBroken){CFG.capBroken=false;toast('자막을 다시 켜 볼게요. 녹음이 끊기면 다시 꺼요',3000)}
  CFG.cap=!CFG.cap;saveCfg();capSync();
  if(CFG.cap){toast(REC.on?'실시간 자막을 켰어요':'녹음을 시작하면 자막이 나와요');liveStart()}else{liveStop();toast('실시간 자막을 껐어요')}
};

/* ---- index.html 에서 부르는 곳 ---- */
function on_segStart(){LAST.length=0;liveStop();setTimeout(liveStart,400)}
function on_recStop(){liveStop();LAST.length=0;capRender();dirty()}
function on_recover(why){
  /* 자막을 켠 지 6초 안에 마이크가 끊기면 이 기기는 둘을 같이 못 쓴다고 본다 */
  if(LIVE.rec&&Date.now()-LIVE.startedAt<6000&&why!=='gap'){
    CFG.capBroken=true;saveCfg();liveStop();capSync();
    toast('이 기기에서는 녹음과 실시간 자막을 같이 쓰면 녹음이 끊겨서 자막을 껐어요. 녹음 뒤 「전사문 넣기」를 써 주세요',6000);
  }else liveStop();
}
function on_visible(){if(capWanted()&&!LIVE.rec)setTimeout(liveStart,600)}
function on_hidden(){/* 화면이 숨으면 브라우저가 음성 인식을 멈춘다 — 돌아오면 다시 켠다 */}
function on_open(t){
  t.lec.tr=t.lec.tr||[];if(!t.lec.lang)t.lec.lang=CFG.lang;
  OTHER=null;STARS=null;slideText(t);loadOther(t.lec);
  capSync();dirty(true);
}
function on_close(){liveStop();spClose(true);OTHER=null;STARS=null}
let pgT=0,lastPg=0;
function on_page(n){if(n===lastPg)return;lastPg=n;if(!SP.hidden&&TAB==='tr'&&FILTER==='page'){clearTimeout(pgT);pgT=setTimeout(render,250)}}
let tmT=0;
function on_time(){if(SP.hidden||TAB!=='tr')return;const n=performance.now();if(n-tmT<400)return;tmT=n;markNow()}

/* ======================================================================
   ④ 슬라이드 연결: 녹음 중 넘긴 쪽(lec.pl)으로 문장마다 쪽을 정한다 */
function pageOf(s,t){
  const pl=active.lec.pl||[];let p=0;
  for(const e of pl){if(e[0]!==s)continue;if(e[1]<=t+800)p=e[2];else{if(!p)p=e[2];break}}
  return p;
}
async function slideText(t){
  const lec=t.lec;
  if(lec.st&&lec.st.length===lec.np&&lec.stt&&lec.stt.length===lec.np)return;
  for(let i=0;i<200&&!t.doc;i++){await new Promise(r=>setTimeout(r,200));if(active!==t)return}
  if(!t.doc)return;
  const out=[],tit=[];
  for(let i=1;i<=t.doc.numPages;i++){
    try{
      const pg=await t.doc.getPage(i),tc=await pg.getTextContent(),H=pg.getViewport({scale:1}).height;
      out.push(tc.items.map(o=>o.str).join(' ').replace(/\s+/g,' ').trim().slice(0,4000));
      /* 쪽 제목: 위쪽 30% 안에서 가장 큰 글자 */
      const top=tc.items.filter(o=>/[A-Za-z가-힣]{3,}/.test(o.str)&&o.transform&&o.transform[5]>H*.7);   // 수식 조각(C, dC …)은 빼고 글자만
      const mh=Math.max(0,...top.map(o=>Math.abs(o.transform[3])));
      tit.push(mh?top.filter(o=>Math.abs(o.transform[3])>=mh*.85).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]).map(o=>o.str).join(' ').replace(/\s+/g,' ').replace(/\s+([-–])\s+/g,'$1').trim().slice(0,40):'');
      pg.cleanup();
    }catch(e){out.push('');tit.push('')}
    if(active!==t)return;
  }
  lec.st=out;lec.stt=tit;saveLec();dirty();
}
const slideTitle=p=>{const L=active.lec,t=L.stt&&L.stt[p-1];if(t)return t;const s=L.st&&L.st[p-1];return s?s.slice(0,40):''};

/* ======================================================================
   ⑤ 중요 별 표시 = 말(강조 표현) + 반복
   ★   강조 표현 또는 반복 설명 중 하나
   ★★  강조 표현 + 반복 설명
   ★★★ 강조 표현 + 다른 강의에서도 나온 반복 용어
   반복 = 그 쪽 슬라이드에도 있는 용어가 이 강의에서 3문장 이상, 1분 넘게 떨어져 다시 나옴.
   사용자가 직접 바꾼 별(m)이 언제나 이긴다. */
const EMPH=[/중요/,/시험/,/핵심/,/반드시/,/명심/,/꼭\s*(기억|알아|외워|보세요|봐)/,/기억(하세요|해\s*두|해야|하시)/,/주의(하세요|해야|할\s*점)/,/잊지\s*마/,
  /\bimportant\b/i,/\bexams?\b/i,/\btests?\b/i,/\bremember\b/i,/\bkey\s+(point|concept|idea|equation)s?\b/i,/\bmake sure\b/i,/\bmust know\b/i,/\bpay attention\b/i,/\bcrucial\b/i,/\bessential\b/i,/\bdon'?t forget\b/i];
const STOP_EN=new Set(('this that with from have they will what when which there their about would could should these those into than then them were been being also because very just like your more some here only over such even most much many does done each other okay right well want going know think look said gonna kind sort really thing things maybe actually basically something people today time first second next last same different example case cases way ways make made take using used have has had where while after before between both through under again further once there here every any all most other some such only own same than too very can will just should now').split(' '));
const STOP_KO=new Set(('그래서 그러면 그리고 이제 여기 이거 저거 그거 우리 여러분 이렇게 저렇게 그렇게 지금 다음 이번 하나 정도 경우 때문 이런 저런 그런 그냥 아니 이것 저것 그것 무엇 어떤 있는 없는 같은 됩니다 합니다 거예요 거죠 얘기 이렇 그렇 저렇 그러 이게 그게 저게 근데 그런데 하지만 그러니까 그래 네네 예예 자자 뭐냐 어디 언제 이건 그건 저건 수업 시간 오늘 지난').split(' '));
const JOSA=/(으로써|으로서|에서는|에게서|이라고|라고|이라는|라는|으로|에서|에게|까지|부터|이랑|하고|이다|입니다|이고|해서|하는|하면|되는|된다|에는|에도|와는|과는|은|는|이|가|을|를|의|에|도|와|과|로|만)$/;
function terms(x){
  const out=new Set();
  for(const w of (x.toLowerCase().match(/[a-z][a-z0-9\-]{3,}/g)||[]))if(!STOP_EN.has(w))out.add(w);
  for(const w of (x.match(/[가-힣]{2,}/g)||[])){const r=w.replace(JOSA,'');if(r.length>=2&&!STOP_KO.has(r))out.add(r)}
  return out;
}
let STARS=null,OTHER=null;
async function loadOther(lec){
  try{
    const all=await DB.all('lec'),set=new Set();
    for(const l of all)if(l.id!==lec.id)for(const s of l.tr||[])for(const w of terms(s.x))set.add(w);
    if(active&&active.lec===lec){OTHER=set;dirty()}
  }catch(e){OTHER=new Set()}
}
function computeStars(){
  const lec=active.lec,tr=lec.tr||[],st=lec.st||[];
  const slideSet=st.map(s=>s?terms(s):new Set()),anySlide=new Set();slideSet.forEach(s=>s.forEach(w=>anySlide.add(w)));
  const occ=new Map(),tt=tr.map(l=>terms(l.x));
  tr.forEach((l,i)=>{for(const w of tt[i]){let o=occ.get(w);if(!o)occ.set(w,o=[]);o.push(l.t+(l.s===tr[0].s?0:1e9))}});
  const rep=new Set();
  for(const [w,o] of occ){if(o.length>=3&&Math.max(...o)-Math.min(...o)>=60000&&(!anySlide.size||anySlide.has(w)))rep.add(w)}
  const res=new Map();
  tr.forEach((l,i)=>{
    const p=pageOf(l.s,l.t),ps=p&&slideSet[p-1]&&slideSet[p-1].size?slideSet[p-1]:null;
    let key='',kc=0,multi=false;
    for(const w of tt[i]){if(!rep.has(w)||(ps&&!ps.has(w)))continue;const c=occ.get(w).length;if(c>kc){kc=c;key=w}if(OTHER&&OTHER.has(w))multi=true}
    const emph=EMPH.some(re=>re.test(l.x)),r=!!key;
    let n=emph&&r&&multi?3:emph&&r?2:emph||r?1:0;
    if(typeof l.m==='number')n=l.m;
    res.set(l.id,{n,p,key,emph});
  });
  STARS=res;
}
const starOf=l=>(STARS&&STARS.get(l.id))||{n:0,p:0,key:''};
const starTxt=n=>n?'★'.repeat(n):'';

/* ======================================================================
   공부 창 */
let dT=0;
function dirty(now){clearTimeout(dT);dT=setTimeout(()=>{if(!active)return;computeStars();render()},now?0:400)}
function spOpen(tab){
  if(tab)TAB=tab;SP.hidden=false;STAGE.classList.add('spopen');STUDYB.classList.add('on');
  relayout();if(!STARS)computeStars();render();
}
function spClose(silent){
  if(SP.hidden)return;SP.hidden=true;STAGE.classList.remove('spopen');STUDYB.classList.remove('on');
  if(!silent)relayout();
}
function relayout(){
  const t=active;if(!t||!t.doc)return;
  requestAnimationFrame(()=>{const w=PAGES.clientWidth;if(w&&w!==t.laidW){saveScroll(t);layout(t);restoreScroll(t);controls()}});
}
STUDYB.onclick=()=>{if(SP.hidden)spOpen();else spClose()};
$('spx').onclick=()=>spClose();
document.querySelectorAll('#sptabs button').forEach(b=>b.onclick=()=>{TAB=b.dataset.t;render()});

function chip(l){
  const st=starOf(l),seg=segOf(l.s),p=st.p;
  const b=document.createElement('button');b.type='button';b.className='chip';
  b.textContent=(p?'p.'+p+' · ':'')+(seg?'녹음'+seg.n+' ':'')+fmt(l.t)+' ▶';
  b.onclick=e=>{e.stopPropagation();jump(l)};return b;
}
function jump(l){
  const seg=segOf(l.s),p=starOf(l).p||pageOf(l.s,l.t);
  if(p&&active&&curPage(active)!==p)goPage(active,p);
  if(!seg)return;
  if(REC.on&&REC.seg===seg){toast('지금 녹음 중인 부분이에요. 녹음을 멈추면 들을 수 있어요');return}
  if(!playAt(seg,Math.max(0,l.t/1000-1)))toast('이 문장의 녹음 파일을 찾지 못했어요');
}
function pageChip(p){const b=document.createElement('button');b.type='button';b.className='chip';b.textContent='p.'+p+' 보기';b.onclick=()=>goPage(active,p);return b}
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function note(txt){return el('p','spn',txt)}

function render(){
  if(SP.hidden||!active)return;
  document.querySelectorAll('#sptabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===TAB));
  SPB.innerHTML='';
  ({tr:rTr,sum:rSum,quiz:rQuiz,ask:rAsk,set:rSet})[TAB]();
}

/* ---- 전사문 탭 ---- */
function rTr(){
  const lec=active.lec,tr=lec.tr||[];
  const bar=el('div','spbar');
  for(const [k,lab] of [['page','이 쪽'],['all','전체'],['star','★만']]){
    const b=el('button','seg'+(FILTER===k?' on':''),lab);b.type='button';b.onclick=()=>{FILTER=k;render()};bar.appendChild(b);
  }
  SPB.appendChild(bar);
  if(!tr.length){
    SPB.appendChild(note(SRC?'녹음하면서 「자막」을 켜 두면 교수님 말이 여기에 쌓여요. 이미 녹음했다면 「녹음 목록 → 전사문 넣기」로 TurboScribe 같은 받아쓰기 결과를 넣을 수 있어요.':'이 브라우저는 실시간 자막이 안 돼요. 「녹음 목록 → 전사문 넣기」로 받아쓰기 결과(SRT·TXT)를 넣어 주세요.'));
    return;
  }
  const cp=curPage(active);
  let list=tr.slice().sort((a,b)=>a.s===b.s?a.t-b.t:(segOf(a.s)||{n:0}).n-(segOf(b.s)||{n:0}).n);
  if(FILTER==='page')list=list.filter(l=>starOf(l).p===cp);
  if(FILTER==='star')list=list.filter(l=>starOf(l).n>0);
  const head=el('p','spn',FILTER==='page'?cp+'쪽을 보던 동안 나온 말 '+list.length+'문장':FILTER==='star'?'별 표시 '+list.length+'문장':'전체 '+list.length+'문장');
  SPB.appendChild(head);
  if(FILTER==='page'&&!list.length)SPB.appendChild(note('이 쪽에서 나온 말이 없어요. 녹음하는 동안 이 쪽을 펴 두지 않았거나, 전사문이 아직 없어요.'));
  const frag=document.createDocumentFragment();
  for(const l of list){
    const st=starOf(l),row=el('div','ln'+(st.n?' s'+st.n:''));row.dataset.id=l.id;
    const top=el('div','lt');top.appendChild(chip(l));
    const sb=el('button','starb',st.n?starTxt(st.n):'☆');sb.type='button';sb.title='별 바꾸기 (0~3)';
    sb.onclick=e=>{e.stopPropagation();l.m=((st.n||0)+1)%4;saveLec();dirty(true)};
    top.appendChild(sb);
    if(st.emph)top.appendChild(el('span','tag','강조'));
    if(st.key)top.appendChild(el('span','tag','반복: '+st.key));
    row.appendChild(top);row.appendChild(el('div','lx',l.x));
    if(l.k)row.appendChild(el('div','lk',l.k));
    row.onclick=()=>jump(l);
    frag.appendChild(row);
  }
  SPB.appendChild(frag);markNow();
}
function markNow(){
  if(!AUD.seg||SP.hidden||TAB!=='tr')return;
  const ms=AU.currentTime*1000,tr=(active.lec.tr||[]).filter(l=>l.s===AUD.seg);
  let cur=null;for(const l of tr)if(l.t<=ms+200&&(!cur||l.t>cur.t))cur=l;
  SPB.querySelectorAll('.ln.now').forEach(e=>e.classList.remove('now'));
  if(!cur)return;
  const e=SPB.querySelector('.ln[data-id="'+cur.id+'"]');
  if(e){e.classList.add('now');if(!AU.paused)e.scrollIntoView({block:'nearest',behavior:'smooth'})}
}

/* ---- 요약 탭 (⑧): 별 모음은 AI 없이, AI 요약은 키가 있을 때 ---- */
let SUMMIN=2;
function rSum(){
  const lec=active.lec,tr=lec.tr||[];
  const bar=el('div','spbar');
  for(const [k,lab] of [[2,'시험 전 한 장 (★★ 이상)'],[1,'별 모음 (★ 이상)']]){
    const b=el('button','seg'+(SUMMIN===k?' on':''),lab);b.type='button';b.onclick=()=>{SUMMIN=k;render()};bar.appendChild(b);
  }
  SPB.appendChild(bar);
  const pick=tr.filter(l=>starOf(l).n>=SUMMIN).sort((a,b)=>(starOf(a).p-starOf(b).p)||(a.t-b.t));
  if(!pick.length){SPB.appendChild(note(tr.length?'아직 이 기준에 맞는 별 표시가 없어요. 「별 모음 (★ 이상)」을 보거나, 전사문에서 ☆를 눌러 직접 별을 달 수 있어요.':'전사문이 있어야 요약을 만들 수 있어요.'))}
  else{
    let lastP=-1;const box=el('div','sumbox');
    for(const l of pick){
      const p=starOf(l).p;
      if(p!==lastP){lastP=p;const h=el('div','sumh',p?'■ '+p+'쪽  '+slideTitle(p):'■ 쪽 모름');box.appendChild(h)}
      const r=el('div','sumr');r.appendChild(el('span','sst',starTxt(starOf(l).n)));r.appendChild(el('span','',' '+l.x+' '));r.appendChild(chip(l));box.appendChild(r);
    }
    SPB.appendChild(box);
    const cp=el('button','vb','글로 복사');cp.type='button';
    cp.onclick=()=>copyText(pick.map(l=>{const p=starOf(l).p;return (p?'[p.'+p+'] ':'')+starTxt(starOf(l).n)+' '+l.x}).join('\n'),'요약을 복사했어요');
    SPB.appendChild(el('div','spact')).appendChild(cp);
  }
  SPB.appendChild(el('h4','sph','AI 요약'));
  if(lec.aiSum)SPB.appendChild(aiBlock(lec.aiSum));
  SPB.appendChild(aiButton(lec.aiSum?'AI 요약 다시 만들기':'AI로 시험 전 한 장 요약 만들기',async()=>{
    const txt=await askClaude(sumPrompt(),'medium',6000);lec.aiSum=txt;saveLec();render();
  },()=>sumPrompt()));
}

/* ---- 문제 탭 (⑦): 빈칸 문제는 AI 없이 / AI 객관식은 키가 있을 때. 틀린 문제는 다음 날 다시 ---- */
const DAY=86400000;
function quizItems(){
  const lec=active.lec,items=[];
  for(const l of lec.tr||[]){
    const st=starOf(l);if(st.n<1||!st.key||l.x.length<12)continue;
    const re=new RegExp(st.key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');if(!re.test(l.x))continue;
    items.push({k:'b'+l.id,kind:'blank',q:l.x.replace(re,'＿＿＿'),a:(l.x.match(re)||[st.key])[0],l,n:st.n});
  }
  (lec.aiq||[]).forEach((q,i)=>items.push({k:'a'+i,kind:'mc',q:q.q,ch:q.ch,a:q.a,why:q.why,n:3}));
  return items;
}
let QI=null,QSHOW=false;
function rQuiz(){
  const lec=active.lec;lec.qz=lec.qz||{};
  const now=Date.now(),all=quizItems(),due=all.filter(it=>!lec.qz[it.k]||lec.qz[it.k].due<=now).sort((a,b)=>b.n-a.n);
  SPB.appendChild(note('별 표시된 문장에서 문제를 내요. 몰랐던 문제는 1일 뒤, 알았던 문제는 3일 → 7일 → … 뒤에 다시 나와요. 오늘 풀 문제 '+due.length+'개 / 전체 '+all.length+'개'));
  if(!all.length)SPB.appendChild(note('아직 문제를 만들 별 표시 문장이 없어요.'));
  else if(!due.length)SPB.appendChild(note('오늘 풀 문제를 다 풀었어요 👍'));
  else{
    if(!QI||!due.some(x=>x.k===QI.k)){QI=due[0];QSHOW=false}
    const it=QI,card=el('div','qcard');
    card.appendChild(el('div','qh',(it.kind==='blank'?'빈칸 채우기':'객관식')+' · '+starTxt(it.n)));
    if(it.kind==='blank'){card.appendChild(el('div','qq',it.q));if(it.l)card.appendChild(chipWrap(it.l,'근거 '))}
    else{card.appendChild(aiBlock(it.q,'qq'));(it.ch||[]).forEach((c,i)=>card.appendChild(el('div','qc','ABCD'[i]+') '+c)))}
    if(QSHOW){
      const a=el('div','qa');a.appendChild(el('b','','정답: '));a.appendChild(document.createTextNode(it.kind==='blank'?it.a:'ABCD'[it.a]+') '+((it.ch||[])[it.a]||'')));card.appendChild(a);
      if(it.why)card.appendChild(aiBlock(it.why,'qw'));
      const r=el('div','spact');
      r.appendChild(qBtn('몰랐어요',()=>grade(it,false)));r.appendChild(qBtn('알았어요',()=>grade(it,true),'ok'));card.appendChild(r);
    }else{const r=el('div','spact');r.appendChild(qBtn('정답 보기',()=>{QSHOW=true;render()},'ok'));card.appendChild(r)}
    SPB.appendChild(card);
  }
  SPB.appendChild(el('h4','sph','AI 객관식 문제'));
  SPB.appendChild(aiButton((lec.aiq&&lec.aiq.length)?'AI 문제 다시 만들기 (5개)':'AI로 객관식 문제 만들기 (5개)',async()=>{
    const txt=await askClaude(quizPrompt(),'medium',8000);const qs=parseQuiz(txt);
    if(!qs.length)throw new Error('문제를 읽지 못했어요. 다시 눌러 주세요');
    lec.aiq=qs;Object.keys(lec.qz).filter(k=>k[0]==='a').forEach(k=>delete lec.qz[k]);saveLec();QI=null;render();
  },()=>quizPrompt()));
}
function qBtn(t,fn,cls){const b=el('button','vb'+(cls?' '+cls:''),t);b.type='button';b.onclick=fn;return b}
function chipWrap(l,pre){const d=el('div','qref',pre||'');d.appendChild(chip(l));return d}
function grade(it,ok){
  const qz=active.lec.qz,o=qz[it.k]||{iv:0};
  o.iv=ok?(o.iv?Math.min(60,Math.round(o.iv*2.3)):3):1;o.due=Date.now()+o.iv*DAY;qz[it.k]=o;saveLec();QI=null;QSHOW=false;render();
}

/* ---- 질문 탭 (⑥): 키 없으면 전사문·슬라이드 검색 + 「Claude 앱에서 물어보기」, 키 있으면 AI 답변(근거 번호 달림) ---- */
let QTXT='',QRES=null;
function rAsk(){
  const f=el('form','askf');
  const ta=el('textarea','');ta.rows=3;ta.placeholder='예: 확산식에 왜 마이너스가 붙어요?';ta.value=QTXT;ta.oninput=()=>{QTXT=ta.value};
  const b=el('button','vb ok','찾아보기');b.type='submit';
  f.append(ta,b);f.onsubmit=e=>{e.preventDefault();QTXT=ta.value.trim();if(!QTXT)return;QRES=search(QTXT);render()};
  SPB.appendChild(f);
  SPB.appendChild(note('「찾아보기」는 전사문과 슬라이드에서 관련 부분을 찾아 근거 위치를 보여 줘요. AI 답변은 아래에서.'));
  if(QRES){
    if(!QRES.lines.length&&!QRES.pages.length)SPB.appendChild(note('관련된 부분을 찾지 못했어요. 다른 말로 물어봐 주세요.'));
    for(const p of QRES.pages){const r=el('div','ln');r.appendChild(pageChip(p));r.appendChild(el('div','lx',slideTitle(p)));SPB.appendChild(r)}
    for(const l of QRES.lines){const r=el('div','ln');r.appendChild(chip(l));r.appendChild(el('div','lx',l.x));if(l.k)r.appendChild(el('div','lk',l.k));r.onclick=()=>jump(l);SPB.appendChild(r)}
  }
  SPB.appendChild(el('h4','sph','AI 답변'));
  if(active.lec.aiAsk&&active.lec.aiAsk.q){SPB.appendChild(el('p','spn','질문: '+active.lec.aiAsk.q));SPB.appendChild(aiBlock(active.lec.aiAsk.a))}
  SPB.appendChild(aiButton('AI에게 물어보기',async()=>{
    if(!QTXT)throw new Error('위 칸에 질문을 먼저 써 주세요');
    const a=await askClaude(askPrompt(QTXT),'medium',4000);active.lec.aiAsk={q:QTXT,a};saveLec();render();
  },()=>QTXT?askPrompt(QTXT):null));
}
function search(q){
  const qt=[...terms(q)],lec=active.lec;if(!qt.length)return{lines:[],pages:[]};
  const sc=x=>{const tl=x.toLowerCase();let s=0;for(const w of qt)if(tl.includes(w))s++;return s};
  const lines=(lec.tr||[]).map(l=>({l,s:sc(l.x)+(starOf(l).n*.2)})).filter(o=>o.s>=1).sort((a,b)=>b.s-a.s).slice(0,10).map(o=>o.l);
  const pages=(lec.st||[]).map((s,i)=>({p:i+1,s:sc(s||'')})).filter(o=>o.s>=Math.min(2,qt.length)).sort((a,b)=>b.s-a.s).slice(0,4).map(o=>o.p);
  return{lines,pages};
}

/* ---- 설정 탭 ---- */
function rSet(){
  const lec=active.lec;
  SPB.appendChild(el('h4','sph','이 강의의 말 (음성 인식 언어)'));
  const lb=el('div','spbar');
  for(const [k,lab] of [['ko-KR','한국어'],['en-US','English']]){
    const b=el('button','seg'+(lecLang()===k?' on':''),lab);b.type='button';
    b.onclick=()=>{lec.lang=k;CFG.lang=k;saveCfg();saveLec();if(LIVE.rec){liveStop();setTimeout(liveStart,300)}render()};lb.appendChild(b);
  }
  SPB.appendChild(lb);
  SPB.appendChild(note(SRC?'실시간 자막은 브라우저 음성 인식을 써요 (인터넷 필요). 「자막」 버튼으로 켜고 끕니다.'+(CFG.capBroken?' 이 기기에서는 녹음과 같이 쓰면 녹음이 끊겨서 꺼 두었어요.':''):'이 브라우저는 음성 인식이 없어서 실시간 자막을 쓸 수 없어요.'));

  SPB.appendChild(el('h4','sph','Claude API 키 (선택)'));
  SPB.appendChild(note('넣으면 영어 자막 번역, AI 답변·문제·요약을 이 앱 안에서 바로 써요. 키는 이 기기의 이 브라우저에만 저장되고, 요청할 때 Anthropic 서버로만 보내요. 사용료는 Anthropic 콘솔(console.anthropic.com)의 크레딧에서 나가요. 키가 없어도 각 AI 버튼 옆 「Claude 앱에서 물어보기」로 같은 내용을 claude.ai 에 붙여 넣어 쓸 수 있어요.'));
  const f=el('form','askf');
  const inp=el('input','');inp.type='password';inp.autocomplete='off';inp.placeholder=CFG.key?'저장된 키 있음 (바꾸려면 새로 입력)':'sk-ant-로 시작하는 키';
  const sv=el('button','vb ok','저장');sv.type='submit';
  f.append(inp,sv);f.onsubmit=e=>{e.preventDefault();const v=inp.value.trim();if(!v)return;CFG.key=v;saveCfg();toast('API 키를 이 기기에 저장했어요');render()};
  SPB.appendChild(f);
  if(CFG.key){const d=qBtn('키 지우기',()=>{CFG.key='';CFG.tr=false;saveCfg();toast('키를 지웠어요');render()});SPB.appendChild(el('div','spact')).appendChild(d)}

  SPB.appendChild(el('h4','sph','영어 자막 번역'));
  const tb=qBtn(CFG.tr?'번역 끄기':'번역 켜기',()=>{if(!CFG.key){toast('먼저 API 키를 넣어 주세요');return}CFG.tr=!CFG.tr;saveCfg();render();if(CFG.tr)trBackfill()},CFG.tr?'':'ok');
  SPB.appendChild(el('div','spact')).appendChild(tb);
  SPB.appendChild(note('강의 언어가 English 일 때, 새로 나오는 자막을 몇 문장씩 묶어 한국어로 번역해요. 켜면 아직 번역 안 된 문장도 채워요.'));
}

/* ======================================================================
   Claude API (공식 SDK, 브라우저에서 사용자 본인 키로 직접 호출) */
let SDK=null;
async function sdk(){
  if(!SDK){const m=await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm');SDK=m.default||m.Anthropic}
  return SDK;
}
async function askClaude(prompt,effort,maxTok){
  if(!CFG.key)throw new Error('설정 탭에서 Claude API 키를 먼저 넣어 주세요');
  const Anthropic=await sdk();
  const client=new Anthropic({apiKey:CFG.key,dangerouslyAllowBrowser:true});
  let r;
  try{
    r=await client.beta.messages.create({
      model:'claude-opus-5-5',max_tokens:maxTok||4000,
      betas:['server-side-fallback-2026-07-01'],fallbacks:'default',     // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도
      output_config:{effort:effort||'medium'},
      system:prompt.system,messages:[{role:'user',content:prompt.user}],
    });
  }catch(e){
    if(e instanceof Anthropic.AuthenticationError)throw new Error('API 키가 맞지 않아요. 설정에서 다시 넣어 주세요');
    if(e instanceof Anthropic.PermissionDeniedError)throw new Error('이 키로는 쓸 수 없어요 (권한 없음)');
    if(e instanceof Anthropic.RateLimitError)throw new Error('요청이 많아요. 잠시 뒤에 다시 눌러 주세요');
    if(e instanceof Anthropic.BadRequestError)throw new Error('요청을 처리하지 못했어요: '+e.message);
    if(e instanceof Anthropic.APIConnectionError)throw new Error('인터넷 연결을 확인해 주세요');
    if(e instanceof Anthropic.APIError)throw new Error('Claude 오류 ('+e.status+')');
    throw e;
  }
  if(r.stop_reason==='refusal')throw new Error('Claude가 이 요청에 답하지 않았어요');
  return r.content.filter(b=>b.type==='text').map(b=>b.text).join('').trim();
}
/* AI 버튼 + 「Claude 앱에서 물어보기」(키 없이: 질문을 복사해서 claude.ai 에 붙여 넣기) */
function aiButton(label,run,promptFn){
  const wrap=el('div','spact');
  const b=el('button','vb ok',label);b.type='button';
  b.onclick=async()=>{
    if(!CFG.key){toast('설정 탭에서 API 키를 넣거나, 옆의 「Claude 앱에서 물어보기」를 써 주세요',3500);return}
    b.disabled=true;const old=b.textContent;b.textContent='Claude가 생각하는 중…';
    try{await run()}catch(e){toast(e.message||String(e),4500)}finally{b.disabled=false;b.textContent=old}
  };
  const c=el('button','vb','Claude 앱에서 물어보기');c.type='button';
  c.onclick=()=>{const p=promptFn();if(!p){toast('위 칸에 질문을 먼저 써 주세요');return}
    copyText(p.system+'\n\n'+p.user,'질문을 복사했어요. claude.ai 에 붙여 넣어 주세요');
    const a=$('claudelink');a.hidden=false};
  wrap.append(b,c);
  const a=document.getElementById('claudelink')||(()=>{const x=el('a','vb','claude.ai 열기 ↗');x.id='claudelink';x.href='https://claude.ai/new';x.target='_blank';x.rel='noopener';x.hidden=true;return x})();
  wrap.appendChild(a);
  return wrap;
}
function copyText(s,msg){
  const done=()=>toast(msg||'복사했어요');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(s).then(done,()=>fallbackCopy(s,done));else fallbackCopy(s,done);
}
function fallbackCopy(s,done){const t=document.createElement('textarea');t.value=s;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){toast('복사하지 못했어요')}t.remove()}
/* AI 글의 [#12] / [p.3] 근거 표시를 눌러서 가는 버튼으로 바꾼다 */
function aiBlock(txt,cls){
  const d=el('div',cls||'aib');const byId=new Map((active.lec.tr||[]).map(l=>[l.id,l]));
  for(const line of String(txt).split('\n')){
    const p=el('div',/^\s*■/.test(line)?'aih':'ail');
    const parts=line.split(/(\[#\d+(?:\s*,\s*#?\d+)*\]|\[p\.\s*\d+\])/);
    for(const part of parts){
      let m;
      if((m=part.match(/^\[#([\d,#\s]+)\]$/))){for(const id of m[1].split(/[,#\s]+/).filter(Boolean)){const l=byId.get(+id);if(l)p.appendChild(chip(l));else p.appendChild(document.createTextNode('[#'+id+']'))}}
      else if((m=part.match(/^\[p\.\s*(\d+)\]$/)))p.appendChild(pageChip(+m[1]));
      else if(part)p.appendChild(document.createTextNode(part));
    }
    d.appendChild(p);
  }
  return d;
}

/* ---- 프롬프트 ---- */
const MAXC=120000;
function lineRef(l){const st=starOf(l);return '#'+l.id+' ('+(st.p?'p.'+st.p+', ':'')+fmt(l.t)+(st.n?', '+starTxt(st.n):'')+') '+l.x}
function slidesBlock(limit){const st=active.lec.st||[];let s='',n=0;for(let i=0;i<st.length;i++){const x='[p.'+(i+1)+'] '+(st[i]||'')+'\n';if(n+x.length>limit)break;s+=x;n+=x.length}return s}
function linesBlock(lines,limit){let s='',n=0;for(const l of lines){const x=lineRef(l)+'\n';if(n+x.length>limit)break;s+=x;n+=x.length}return s}
const SYS_BASE='너는 대학 전공 강의 복습을 돕는 조교다. 아래에 주는 슬라이드 글자와 교수님 말 전사문만 근거로 쓰고, 자료에 없는 내용은 지어내지 말고 "자료에 없음"이라고 말한다. 근거를 달 때는 전사문은 [#번호], 슬라이드는 [p.쪽] 형식을 그대로 쓴다. 한국어로 쓴다. ★ 표시는 교수님이 강조하거나 반복한 문장이라는 뜻이다.';
function askPrompt(q){
  const tr=active.lec.tr||[],hit=new Set(search(q).lines.map(l=>l.id));
  const pri=tr.filter(l=>hit.has(l.id)||starOf(l).n>0),rest=tr.filter(l=>!(hit.has(l.id)||starOf(l).n>0));
  return{system:SYS_BASE+' 질문에 바로 답하고, 답의 문장마다 끝에 근거를 단다. 근거가 되는 전사문 문장의 녹음을 학생이 직접 들어 볼 수 있도록 [#번호]를 꼭 단다.',
    user:'## 슬라이드\n'+slidesBlock(MAXC*.35)+'\n## 전사문 (관련·강조 문장 먼저)\n'+linesBlock(pri.concat(rest),MAXC*.6)+'\n## 질문\n'+q};
}
function sumPrompt(){
  const tr=(active.lec.tr||[]).slice().sort((a,b)=>(starOf(b).n-starOf(a).n));
  return{system:SYS_BASE+' 시험 직전에 볼 "한 장 요약"을 만든다. 슬라이드 쪽 순서대로 "■ p.N 제목" 줄을 쓰고 그 아래에 핵심을 2~4줄씩 쓴다. 교수님이 강조(★)한 내용을 먼저 넣고, 각 줄 끝에 근거 [#번호]를 단다. 마크다운 표나 굵은 글씨는 쓰지 않는다.',
    user:'## 슬라이드\n'+slidesBlock(MAXC*.35)+'\n## 전사문 (★ 많은 순)\n'+linesBlock(tr,MAXC*.6)};
}
function quizPrompt(){
  const tr=(active.lec.tr||[]).filter(l=>starOf(l).n>0).sort((a,b)=>starOf(b).n-starOf(a).n);
  const base=tr.length?tr:(active.lec.tr||[]);
  return{system:SYS_BASE+' 이해했는지 확인하는 객관식 문제 5개를 만든다. ★ 문장(교수님 강조)을 중심으로 낸다. 반드시 아래 형식만 쓰고 문제 사이에 --- 줄을 넣는다.\nQ: 질문\nA) 보기\nB) 보기\nC) 보기\nD) 보기\n정답: A~D 중 하나\n해설: 한두 문장 [#번호]',
    user:'## 슬라이드\n'+slidesBlock(MAXC*.3)+'\n## 강조된 전사문\n'+linesBlock(base,MAXC*.6)};
}
function parseQuiz(txt){
  const out=[];
  for(const blk of txt.split(/\n-{3,}\n?/)){
    const q=(blk.match(/Q:\s*([\s\S]*?)\n\s*A\)/)||[])[1];
    const ch=['A','B','C','D'].map(k=>((blk.match(new RegExp('\\n\\s*'+k+'\\)\\s*(.+)'))||[])[1]||'').trim());
    const a='ABCD'.indexOf(((blk.match(/정답:\s*([A-D])/)||[])[1]||'').trim());
    const why=((blk.match(/해설:\s*([\s\S]*)$/)||[])[1]||'').trim();
    if(q&&a>=0&&ch.every(Boolean))out.push({q:q.trim(),ch,a,why});
  }
  return out;
}

/* ---- 번역 (영어 강의 + 키 + 번역 켬) : 문장을 모아 몇 초마다 한 번에 ---- */
const TRQ=[];let trT=0,trBusy=false;
function trQueue(l){if(!CFG.tr||!CFG.key||lecLang()!=='en-US')return;TRQ.push(l);clearTimeout(trT);trT=setTimeout(trFlush,TRQ.length>=4?200:3500)}
function trBackfill(){if(!active)return;for(const l of active.lec.tr||[])if(!l.k)TRQ.push(l);trFlush()}
async function trFlush(){
  if(trBusy||!TRQ.length||!CFG.key)return;trBusy=true;
  const batch=TRQ.splice(0,25);
  try{
    const txt=await askClaude({system:'영어로 된 대학 전공 강의 문장을 자연스러운 한국어로 번역한다. 전공 용어는 처음 나올 때 한국어(영어)로 함께 쓴다. 입력의 "번호|문장" 줄마다 "번호|번역" 한 줄씩만 출력한다.',
      user:batch.map((l,i)=>(i+1)+'|'+l.x).join('\n')},'low',3000);
    for(const ln of txt.split('\n')){const m=ln.match(/^\s*(\d+)\s*\|\s*(.+)$/);if(m&&batch[+m[1]-1])batch[+m[1]-1].k=m[2].trim()}
    saveLec();capRender();if(!SP.hidden&&TAB==='tr')render();
  }catch(e){TRQ.unshift(...batch.filter(l=>!l.k));if(/키|권한/.test(e.message||'')){CFG.tr=false;saveCfg()}toast('번역: '+(e.message||e),3500)}
  finally{trBusy=false;if(TRQ.length)setTimeout(trFlush,1500)}
}

/* ======================================================================
   전사문 넣기 (녹음 목록에서 녹음마다): TurboScribe 등에서 받은 SRT / VTT / 시간 붙은 TXT, 또는 그냥 글 */
function parseTranscript(txt){
  txt=txt.replace(/\r/g,'').replace(/^\uFEFF/,'');
  const out=[],cue=/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*[^\n]+\n([\s\S]*?)(?=\n\s*\n|$)/g;let m;
  while((m=cue.exec(txt))){
    const ms=((+(m[1]||0))*3600+(+m[2])*60+(+m[3]))*1000+(+m[4].padEnd(3,'0'));
    const x=m[5].replace(/<[^>]+>/g,'').replace(/\n/g,' ').replace(/\s+/g,' ').trim();if(x)out.push({t:ms,x});
  }
  if(out.length)return{lines:out,approx:false};
  const re=/^\s*[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d+)?[\])]?\s*[-–:]?\s*(.*)$/;let cur=null;
  for(const ln of txt.split('\n')){
    const k=ln.match(re);
    if(k){const p=k[1].split(':').map(Number),ms=(p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1])*1000;cur={t:ms,x:k[2].trim()};out.push(cur)}
    else if(cur&&ln.trim())cur.x+=(cur.x?' ':'')+ln.trim();
  }
  const lines=out.filter(o=>o.x);
  if(lines.length)return{lines,approx:false};
  const sents=txt.replace(/\s+/g,' ').split(/(?<=[.?!])\s+|(?<=[다요죠]\.)\s*/).map(s=>s.trim()).filter(s=>s.length>1);
  return{lines:sents.map((x,i)=>({t:i,x})),approx:true};
}
function importDialog(seg){
  closeSheet();spOpen('tr');
  SPB.innerHTML='';
  SPB.appendChild(el('h4','sph','녹음 '+seg.n+'에 전사문 넣기'));
  SPB.appendChild(note('TurboScribe 같은 받아쓰기 서비스에서 받은 SRT·VTT 파일이나, 시간이 붙은 글([00:01:23] 문장 …)을 넣어 주세요. 시간이 없는 글도 되지만 녹음 위치는 대략으로만 맞춰져요. 이 녹음에 있던 전사문은 새 것으로 바뀌어요.'));
  const fi=el('input','');fi.type='file';fi.accept='.srt,.vtt,.txt,text/plain';
  const ta=el('textarea','');ta.rows=8;ta.placeholder='여기에 붙여 넣어도 돼요';
  fi.onchange=async()=>{const f=fi.files&&fi.files[0];if(f)ta.value=await f.text()};
  const go=qBtn('넣기',()=>{
    const r=parseTranscript(ta.value||'');if(!r.lines.length){toast('읽을 수 있는 문장이 없어요');return}
    const lec=active.lec,dur=seg.dur||1;
    if(r.approx){const n=r.lines.length;r.lines.forEach((o,i)=>{o.t=Math.round(i/n*dur)})}
    lec.tr=(lec.tr||[]).filter(l=>l.s!==seg.id).concat(r.lines.map(o=>({id:nextId(lec),s:seg.id,t:Math.min(o.t,dur),x:o.x,src:'import'})));
    saveLec();toast(r.lines.length+'문장을 넣었어요'+(r.approx?' (시간은 대략)':''));
    if(CFG.tr)trBackfill();TAB='tr';FILTER='all';dirty(true);
  },'ok');
  const cancel=qBtn('취소',()=>render());
  const a=el('div','spact');a.append(go,cancel);
  SPB.append(fi,ta,a);
}

capSync();
