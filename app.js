
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const KEYS = { progress:'frv-progress-v1', settings:'frv-settings-v1', custom:'frv-custom-v1', remote:'frv-remote-v1', activity:'frv-activity-v1' };
const defaultSettings = { dailyGoal:20, syncUrl:'' };
let words=[], progress={}, settings={...defaultSettings}, currentMode='study', queue=[], queueIndex=0, revealed=false;
let test={items:[],index:0,correct:0,answered:false,type:'choice'};
let libraryLimit=80;
let deferredInstallPrompt=null, waitingWorker=null;
const BUILT_IN_SYNC_URL='./vocab.json';

function read(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function save(key,val){ localStorage.setItem(key,JSON.stringify(val)) }
function norm(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ')}
function wordKey(w){return norm(w.word)+'|'+norm(w.meaning)+'|'+norm(w.week||w.source)}
function makeId(w){let s=wordKey(w),h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return 'w'+(h>>>0).toString(16)}
function mergeWords(...lists){const map=new Map();lists.flat().filter(Boolean).forEach(w=>{if(!w.word||!w.meaning)return;const x={week:'自定义',article:'未分类',pages:'',addedAt:new Date().toISOString().slice(0,10),source:'手动导入',...w};x.id=x.id||makeId(x);const k=wordKey(x);if(!map.has(k))map.set(k,x)});return [...map.values()]}
function pFor(id){return progress[id]||{level:0,reviews:0,correct:0,wrong:0,nextReview:null,lastReviewed:null}}
function dateKey(d=new Date()){return d.toLocaleDateString('en-CA')}
function activity(){return read(KEYS.activity,{})}
function bumpToday(){const a=activity(),k=dateKey();a[k]=(a[k]||0)+1;save(KEYS.activity,a)}
function isDue(w){const p=pFor(w.id);return p.reviews>0 && (!p.nextReview || new Date(p.nextReview)<=new Date())}
function statusOf(w){const p=pFor(w.id);if(!p.reviews)return 'new';if(p.level>=5)return 'mastered';return 'learning'}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2300)}


function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function updateConnectivity(){const offline=!navigator.onLine;$('#offlineBanner')?.classList.toggle('hidden',!offline)}
function updateInstallUI(){
  const show=!isStandalone() && (Boolean(deferredInstallPrompt)||isIOS());
  $$('.install-trigger').forEach(el=>el.classList.toggle('hidden',!show));
}
async function promptInstall(){
  if(isStandalone()){toast('应用已经安装');return}
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;updateInstallUI();
    toast(choice.outcome==='accepted'?'正在安装应用':'已取消安装');
    return;
  }
  const iosGuide=$('#iosInstallGuide'), generic=$('#genericInstallGuide');
  iosGuide?.classList.toggle('hidden',!isIOS());generic?.classList.toggle('hidden',isIOS());
  $('#installDialog')?.showModal();
}
async function requestPersistentStorage(){
  try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}
}
function setupPWA(){
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;updateInstallUI()});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallUI();toast('已安装到手机桌面')});
  window.addEventListener('online',()=>{updateConnectivity();toast('网络已恢复，正在检查词库更新');syncRemote(false,BUILT_IN_SYNC_URL)});
  window.addEventListener('offline',updateConnectivity);
  updateConnectivity();updateInstallUI();requestPersistentStorage();
}
async function registerServiceWorker(){
  if(!('serviceWorker' in navigator) || !location.protocol.startsWith('http'))return;
  try{
    const registration=await navigator.serviceWorker.register('./sw.js');
    if(registration.waiting){waitingWorker=registration.waiting;$('#updateBanner')?.classList.remove('hidden')}
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;if(!worker)return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller){waitingWorker=worker;$('#updateBanner')?.classList.remove('hidden')}
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
  }catch(err){console.warn('Service worker registration failed',err)}
}
function applyAppUpdate(){if(waitingWorker)waitingWorker.postMessage({type:'SKIP_WAITING'})}
function openInitialView(){
  const view=new URLSearchParams(location.search).get('view');
  if(['study','review','test','library'].includes(view))setTimeout(()=>navigate(view),0);
}
async function init(){
  settings={...defaultSettings,...read(KEYS.settings,{})};progress=read(KEYS.progress,{});
  const bundled=window.__VOCAB_DATA__?.words||[];
  words=mergeWords(bundled,read(KEYS.custom,[]),read(KEYS.remote,[]));
  bind();setupPWA();populateFilters();renderHome();renderLibrary();openInitialView();
  registerServiceWorker();
  if(location.protocol.startsWith('http')){
    await syncRemote(false,BUILT_IN_SYNC_URL);
    if(settings.syncUrl && settings.syncUrl!==BUILT_IN_SYNC_URL)syncRemote(false,settings.syncUrl);
  }
}
function bind(){
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  $$('.install-trigger').forEach(b=>b.addEventListener('click',promptInstall));
  $('#closeInstallDialog')?.addEventListener('click',()=>$('#installDialog').close());
  $('#applyUpdate')?.addEventListener('click',applyAppUpdate);
  $('#flashcard').addEventListener('click',reveal);$('#revealButton').addEventListener('click',reveal);
  $$('#ratingButtons button').forEach(b=>b.addEventListener('click',()=>rate(b.dataset.rating)));
  $('#startTest').addEventListener('click',startTest);$('#nextQuestion').addEventListener('click',nextTest);$('#restartTest').addEventListener('click',()=>{$('#testResult').classList.add('hidden');$('#testSetup').classList.remove('hidden')});
  $('#spellingForm').addEventListener('submit',e=>{e.preventDefault();answerSpelling()});
  $('#searchInput').addEventListener('input',()=>{libraryLimit=80;renderLibrary()});$('#weekFilter').addEventListener('change',renderLibrary);$('#statusFilter').addEventListener('change',renderLibrary);$('#loadMore').addEventListener('click',()=>{libraryLimit+=80;renderLibrary()});
  $('#openSettings').addEventListener('click',openSettings);$('#saveSettings').addEventListener('click',saveSettings);$('#syncNow').addEventListener('click',()=>syncRemote(true));
  $('#openImport').addEventListener('click',()=>$('#importDialog').showModal());$('#runImport').addEventListener('click',runImport);$('#importFile').addEventListener('change',loadImportFile);
  $('#exportJson').addEventListener('click',exportBackup);$('#exportCsv').addEventListener('click',exportCSV);
  document.addEventListener('keydown',e=>{if($('.view.active')?.id==='studyView'){if(e.code==='Space'){e.preventDefault();reveal()}if(revealed&&['Digit1','Digit2','Digit3','Digit4'].includes(e.code))rate(['again','hard','good','easy'][+e.code.slice(-1)-1])}})
}
function navigate(name){
  const target=name==='review'?'study':name;
  $$('.view').forEach(v=>v.classList.remove('active'));$('#'+target+'View').classList.add('active');
  $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===name || (name==='review'&&b.dataset.go==='review')));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='home')renderHome();if(name==='library')renderLibrary();if(name==='study'||name==='review')startSession(name);if(name==='test')resetTestView();
}
function renderHome(){
  const learned=words.filter(w=>pFor(w.id).reviews>0).length, mastered=words.filter(w=>pFor(w.id).level>=5).length,due=words.filter(isDue).length;
  const done=activity()[dateKey()]||0;
  $('#todayDone').textContent=done;$('#dailyGoal').textContent=settings.dailyGoal;$('#goalProgress').style.width=Math.min(100,done/settings.dailyGoal*100)+'%';
  $('#totalWords').textContent=words.length;$('#dueWords').textContent=due;$('#learnedWords').textContent=learned;$('#masteredWords').textContent=mastered;$('#reviewHint').textContent=due?`${due} 个词等待复习`:'当前没有到期词汇';
  const byWeek={};words.forEach(w=>byWeek[w.week]=(byWeek[w.week]||0)+1);$('#sourceSummary').innerHTML=Object.entries(byWeek).sort().map(([k,v])=>`<div class="source-item"><div><b>${escapeHtml(k)} 外刊词汇</b><br><small>${new Set(words.filter(w=>w.week===k).map(w=>w.article)).size} 篇文章</small></div><strong>${v} 词</strong></div>`).join('');
}
function startSession(mode){
  currentMode=mode;queueIndex=0;
  if(mode==='review')queue=words.filter(isDue).sort((a,b)=>new Date(pFor(a.id).nextReview)-new Date(pFor(b.id).nextReview));
  else queue=words.filter(w=>pFor(w.id).reviews===0).slice(0,settings.dailyGoal);
  $('#studyModeLabel').textContent=mode==='review'?'SPACED REVIEW':'NEW WORDS';$('#studyTitle').textContent=mode==='review'?'到期复习':'新词学习';showCard();
}
function showCard(){
  const empty=queueIndex>=queue.length;$('#emptyStudy').classList.toggle('hidden',!empty);$('#studyArea').classList.toggle('hidden',empty);$('#studyCounter').textContent=`${Math.min(queueIndex+1,queue.length)} / ${queue.length}`;if(empty)return;
  const w=queue[queueIndex];revealed=false;$('#cardWord').textContent=w.word;$('#cardMeaning').textContent=w.meaning;$('#cardWeek').textContent=w.week;$('#cardArticle').textContent=w.article;$('#cardAnswer').classList.add('hidden');$('#ratingButtons').classList.add('hidden');$('#revealButton').classList.remove('hidden');
}
function reveal(){if(queueIndex>=queue.length||revealed)return;revealed=true;$('#cardAnswer').classList.remove('hidden');$('#ratingButtons').classList.remove('hidden');$('#revealButton').classList.add('hidden')}
function rate(kind,word=queue[queueIndex],countActivity=true){
  if(!word)return;const p=pFor(word.id),now=new Date();let days=0,mins=0,level=p.level;
  if(kind==='again'){level=Math.max(0,level-1);mins=10;p.wrong++}
  if(kind==='hard'){level=Math.max(1,level);days=1;p.correct++}
  if(kind==='good'){level=Math.min(8,level+1);days=[1,2,4,7,14,30,60,120,180][level]||180;p.correct++}
  if(kind==='easy'){level=Math.min(8,level+2);days=[2,4,7,14,30,60,120,180,240][level]||240;p.correct++}
  const next=new Date(now);mins?next.setMinutes(next.getMinutes()+mins):next.setDate(next.getDate()+days);
  progress[word.id]={...p,level,reviews:(p.reviews||0)+1,lastReviewed:now.toISOString(),nextReview:next.toISOString()};save(KEYS.progress,progress);if(countActivity){bumpToday();queueIndex++;showCard()}renderHome();
}
function resetTestView(){$('#testSetup').classList.remove('hidden');$('#testGame').classList.add('hidden');$('#testResult').classList.add('hidden');$('#testCounter').textContent='准备'}
function startTest(){
  const scope=$('#testScope').value,count=+$ ('#testCount').value;test={items:[],index:0,correct:0,answered:false,type:$('#testType').value};
  let pool=scope==='all'?words:scope==='due'?words.filter(isDue):words.filter(w=>pFor(w.id).reviews>0);if(pool.length<4)pool=words;
  test.items=shuffle(pool).slice(0,Math.min(count,pool.length));$('#testSetup').classList.add('hidden');$('#testGame').classList.remove('hidden');showQuestion();
}
function showQuestion(){
  if(test.index>=test.items.length)return finishTest();test.answered=false;const w=test.items[test.index];$('#testCounter').textContent=`${test.index+1} / ${test.items.length}`;$('#quizSource').textContent=`${w.week} · ${w.article}`;$('#quizFeedback').classList.add('hidden');$('#nextQuestion').classList.add('hidden');$('#choiceOptions').innerHTML='';$('#spellingForm').classList.add('hidden');
  if(test.type==='choice'||test.type==='reverse'){
    const reverse=test.type==='reverse';$('#quizPrompt').textContent=reverse?w.meaning:w.word;const value=reverse?'word':'meaning';let distract=shuffle(words.filter(x=>x.id!==w.id&&x[value]!==w[value])).slice(0,3);shuffle([w,...distract]).forEach(opt=>{const b=document.createElement('button');b.textContent=opt[value];b.addEventListener('click',()=>answerChoice(b,opt.id===w.id,w));$('#choiceOptions').appendChild(b)})
  }else{$('#quizPrompt').textContent=w.meaning;$('#spellingForm').classList.remove('hidden');$('#spellingInput').value='';setTimeout(()=>$('#spellingInput').focus(),50)}
}
function answerChoice(btn,ok,w){if(test.answered)return;test.answered=true;$$('#choiceOptions button').forEach(b=>b.disabled=true);btn.classList.add(ok?'correct':'wrong');if(!ok){$$('#choiceOptions button').find(b=>b.textContent===(test.type==='reverse'?w.word:w.meaning))?.classList.add('correct')}finishAnswer(ok,w)}
function answerSpelling(){if(test.answered)return;const w=test.items[test.index],given=norm($('#spellingInput').value),ok=given===norm(w.word);test.answered=true;finishAnswer(ok,w,`正确答案：${w.word}`)}
function finishAnswer(ok,w,extra=''){if(ok){test.correct++;rate('good',w,false)}else rate('again',w,false);const f=$('#quizFeedback');f.textContent=(ok?'✓ 回答正确':'✗ 回答错误')+(extra?'｜'+extra:'');f.classList.remove('hidden');$('#nextQuestion').classList.remove('hidden')}
function nextTest(){test.index++;showQuestion()}
function finishTest(){const pct=Math.round(test.correct/test.items.length*100)||0;$('#testGame').classList.add('hidden');$('#testResult').classList.remove('hidden');$('#scoreText').textContent=pct+'%';$('#resultTitle').textContent=pct>=90?'记得很牢！':pct>=70?'表现不错':'再复习一轮会更好';$('#resultDetail').textContent=`共 ${test.items.length} 题，答对 ${test.correct} 题，答错 ${test.items.length-test.correct} 题。`;$('#testCounter').textContent='完成';renderHome()}
function populateFilters(){const weeks=[...new Set(words.map(w=>w.week))].sort();$('#weekFilter').innerHTML='<option value="all">全部周次</option>'+weeks.map(w=>`<option>${escapeHtml(w)}</option>`).join('')}
function renderLibrary(){
  const q=norm($('#searchInput')?.value),wk=$('#weekFilter')?.value||'all',st=$('#statusFilter')?.value||'all';let list=words.filter(w=>(!q||norm(w.word).includes(q)||norm(w.meaning).includes(q))&&(wk==='all'||w.week===wk)&&(st==='all'||statusOf(w)===st));
  $('#libraryCount').textContent=list.length+' 词';const shown=list.slice(0,libraryLimit);$('#wordList').innerHTML=shown.map(w=>`<div class="word-row"><div><b>${escapeHtml(w.word)}</b><br><small>${escapeHtml(w.week)} · ${escapeHtml(w.article)}</small></div><p>${escapeHtml(w.meaning)}</p><span class="status-dot ${statusOf(w)}" title="${statusOf(w)}"></span></div>`).join('')||'<div class="empty-state"><p>没有找到符合条件的词汇。</p></div>';$('#loadMore').classList.toggle('hidden',shown.length>=list.length)
}
function openSettings(){$('#goalInput').value=settings.dailyGoal;$('#syncUrlInput').value=settings.syncUrl;$('#syncStatus').textContent=settings.syncUrl?'已配置额外远程词库':'内置词库会自动检查更新';$('#settingsDialog').showModal()}
function saveSettings(e){e.preventDefault();settings.dailyGoal=Math.max(5,Math.min(200,+$('#goalInput').value||20));settings.syncUrl=$('#syncUrlInput').value.trim();save(KEYS.settings,settings);$('#settingsDialog').close();renderHome();toast('设置已保存')}
async function syncRemote(show=true,urlOverride=''){
  const url=urlOverride||$('#syncUrlInput')?.value.trim()||settings.syncUrl;if(!url){if(show)toast('请先填写远程词库地址');return}if($('#syncStatus'))$('#syncStatus').textContent='正在检查更新…';
  try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();const incoming=Array.isArray(data)?data:(data.words||[]);const before=words.length;const remote=mergeWords(read(KEYS.remote,[]),incoming);save(KEYS.remote,remote);words=mergeWords(window.__VOCAB_DATA__?.words||[],read(KEYS.custom,[]),remote);populateFilters();renderHome();renderLibrary();const added=words.length-before;if($('#syncStatus'))$('#syncStatus').textContent=`同步成功，新增 ${Math.max(0,added)} 个词`;if(show)toast(`同步完成：新增 ${Math.max(0,added)} 个词`)}catch(err){if($('#syncStatus'))$('#syncStatus').textContent='同步失败：'+err.message;if(show)toast('同步失败，请检查地址或网络')}
}
async function loadImportFile(){const f=$('#importFile').files[0];if(f)$('#importText').value=await f.text()}
function parseImport(text,source){
  text=text.trim();if(!text)return[];try{const j=JSON.parse(text),a=Array.isArray(j)?j:(j.words||[]);return a.map(x=>typeof x==='string'?null:{...x,source:x.source||source,week:x.week||source}).filter(Boolean)}catch{}
  const lines=text.split(/\r?\n/).filter(Boolean),out=[];let header=null;for(let line of lines){let cells=line.includes('\t')?line.split('\t'):line.split(',');cells=cells.map(s=>s.trim().replace(/^"|"$/g,''));if(!header&&/^(word|english|英文)$/i.test(cells[0])){header=cells.map(norm);continue}if(cells.length>=2)out.push({word:cells[0],meaning:cells[1],week:cells[2]||source,article:cells[3]||'导入词汇',pages:cells[4]||'',source})}return out
}
function runImport(){const source=$('#importSource').value.trim()||'手动导入',incoming=parseImport($('#importText').value,source);if(!incoming.length){$('#importMessage').textContent='没有识别到可导入的词汇。';$('#importMessage').classList.remove('hidden');return}const before=words.length,custom=mergeWords(read(KEYS.custom,[]),incoming);save(KEYS.custom,custom);words=mergeWords(window.__VOCAB_DATA__?.words||[],custom,read(KEYS.remote,[]));const added=words.length-before;populateFilters();renderHome();renderLibrary();$('#importMessage').textContent=`识别 ${incoming.length} 条，实际新增 ${Math.max(0,added)} 条（重复项已跳过）。`;$('#importMessage').classList.remove('hidden');toast('导入完成')}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportBackup(){download(`外刊词库备份_${dateKey()}.json`,JSON.stringify({version:1,exportedAt:new Date().toISOString(),words,progress,settings},null,2),'application/json')}
function exportCSV(){const esc=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const rows=[['word','meaning','week','article','pages','status'],...words.map(w=>[w.word,w.meaning,w.week,w.article,w.pages,statusOf(w)])];download(`外刊词库_${dateKey()}.csv`, '\ufeff'+rows.map(r=>r.map(esc).join(',')).join('\n'),'text/csv;charset=utf-8')}
init();
