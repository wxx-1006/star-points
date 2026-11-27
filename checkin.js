// ===== 每日打卡（家长确认制）=====
//   任务按日期规则生成：每日 / 工作日 / 每日轮流(3日轮换) / 周三·周六 / 周末 / 早读；
//   语文作文训练按三阶段计划（2026-10-08 起）显示当日具体内容。
//   流程：孩子端「我已完成」=申请(c=1，不计完成)；家长端「确认完成」=完成(d=1)并 +5 分
//   （ck_reward 系统流水不可删除；家长也可不经申请直接确认）。加分只发一次（r 标记防重，不随状态回退）；
//   分值：每个任务按配置分值（默认 5）；当日全部必打卡完成额外 +10（ck_must_bonus）、当日完成率 100% 额外 +20（ck_bonus），均为不可删流水。
//   状态按账号存本机 sp_ck__<phone>，云同步 sync-checkin.json（双端可推，逐字段并集合并：申请/完成/加分只进不退）。
var CK_PT=5;               // 默认每项任务分值（可在配置中按任务调整）
var CK_EPOCH='2026-10-08'; // 每日轮流任务轮换基准日
// 学科配色：任务卡背景/描边 + 学科角标
var CK_SUBJ={
  chinese:{n:'语文',c:'#C25B5B',bg:'#FDF1F0',bd:'#F1D9D8'},
  math:{n:'数学',c:'#3C72A4',bg:'#EEF4FD',bd:'#D4E3F5'},
  english:{n:'英语',c:'#3E7D33',bg:'#EFF6EC',bd:'#D5E8D2'},
  science:{n:'科学',c:'#6B5BA8',bg:'#F3F0FB',bd:'#DFD7F0'},
  other:{n:'其他',c:'#8F8578',bg:'#F7F5F0',bd:'#E8E2D6'}
};
// 默认打卡任务（仅对「已有打卡记录」的老账号沿用，数据不动；全新账号从空白开始，任务由家长自行创建）
// recur 循环：{type:'daily'} | {type:'weekly',days:[0-6]}(0=周日) | {type:'monthly',days:[1-31]} | {type:'rotate',rot:0-2}(3天一轮)
// zw:1 = 备注按语文作文三阶段计划随日期自动显示（用户填写自定义备注后转为静态备注）
var CK_DEFAULT_TASKS=[
  {id:'m1',name:'早读任务',subj:'chinese',min:15,pt:5,note:'文言文 / 知行合 / 同步作文',recur:{type:'daily'}},
  {id:'d1',name:'语文天天练',subj:'chinese',min:10,pt:5,recur:{type:'daily'}},
  {id:'d2',name:'英语背单词',subj:'english',min:10,pt:5,recur:{type:'daily'}},
  {id:'d3',name:'英语RAZ分级阅读',subj:'english',min:15,pt:5,recur:{type:'daily'}},
  {id:'d4',name:'舒尔特方格',subj:'other',min:10,pt:5,recur:{type:'daily'}},
  {id:'d5',name:'课外阅读',subj:'other',min:30,pt:5,recur:{type:'daily'}},
  {id:'w1',name:'数学拔尖',subj:'math',min:15,pt:5,recur:{type:'weekly',days:[1,2,3,4,5]}},
  {id:'w2',name:'英语自然拼读',subj:'english',min:10,pt:5,recur:{type:'weekly',days:[1,2,3,4,5]}},
  {id:'w3',name:'睡前英语音频',subj:'english',min:10,pt:5,recur:{type:'weekly',days:[1,2,3,4,5]}},
  {id:'w4',name:'语文作文训练',subj:'chinese',min:10,pt:10,zw:1,recur:{type:'weekly',days:[1,2,3,4,5]}},
  {id:'r1',name:'数学精准学',subj:'math',min:20,pt:5,recur:{type:'rotate',rot:0}},
  {id:'r2',name:'科学精准学',subj:'science',min:15,pt:5,recur:{type:'rotate',rot:1}},
  {id:'r3',name:'语文听写',subj:'chinese',min:15,pt:5,recur:{type:'rotate',rot:2}},
  {id:'ws1',name:'语文阅读理解',subj:'chinese',min:20,pt:5,recur:{type:'weekly',days:[3,6]}},
  {id:'e1',name:'数学加油包',subj:'math',pt:5,note:'华罗庚 / 举一反三 / 周周学 / 大白本',recur:{type:'weekend'}},
  {id:'e2',name:'语文作文训练',subj:'chinese',min:10,pt:20,zw:1,recur:{type:'weekend'}},
  {id:'e3',name:'学习机语文练习',subj:'chinese',pt:5,recur:{type:'weekend'}},
  {id:'e4',name:'校内背诵',subj:'other',pt:5,recur:{type:'weekend'}}
];
function ckDays(a,b){var da=new Date(a+'T00:00:00'),db=new Date(b+'T00:00:00');return Math.max(0,Math.round((db-da)/86400000))}
function ckZwStage(ds){ // 语文作文三阶段（按计划图）：1=观察与素材 2=结构与详略 3=细节打磨与情感
  // 计划开始前 / 两阶段间隙 / 计划结束后就近归属，保证每天都有具体作文任务可展示
  if(ds<'2026-11-09')return 1;
  if(ds<'2026-12-07')return 2;
  return 3;
}
function ckZwText(ds){ // 作文训练当日内容（周末两天共用同一内容；计划外日期就近归属阶段）
  var st=ckZwStage(ds),wd=new Date(ds+'T00:00:00').getDay();
  if(wd===0||wd===6){ // 周末任务：周六/周日显示一致
    if(st===1)return '日记扩写：挑本周 1 篇观察日记，扩写成 150-200 字';
    if(st===2)return '整篇首作：300-350 字，必须用五段式，核心段落≥40% 篇幅';
    return (Math.floor(ckDays('2026-12-07',ds)/7)%2===0)
      ?'范文对照精读（习作例文：我家的杏熟了/小木船），摘抄 3 个好句'
      :'整篇作文（300 字以上）+ 写后自查三项（细节≥2处/替换空词/首尾呼应）';
  }
  if(st===1)return '观察日记（3-5 句话片段：日期+地点+看到了什么+想到了什么）';
  if(st===2){
    if(wd===1)return '动作片段：把"他很高兴"改成动作描写（150-200 字）';
    if(wd===4)return '神态+心理片段：把"我很紧张"改成神态心理描写（150-200 字）';
    return '五段式框架练习（开头10%/起因15%/经过40%/结果感受25%/结尾10%）';
  }
  if(wd===2||wd===5)return '首尾升级训练：同一个开头写 3 种（开门见山/设置悬念/环境描写）';
  return '写后自查三项练习（细节描写≥2处/替换空词/开头结尾呼应题目）';
}
// —— 任务配置：存于 sp_ck__<phone> 的 _cfg（{tasks:[],t:最后修改时间}），随 sync-checkin.json 云同步（较新者胜）——
function ckHasState(b){ // 账号是否已有打卡数据（任一日期/任务状态）
  for(var k in b){if(k!=='_cfg')return true}
  return false;
}
function ckCfg(){ // 配置：已有 _cfg 直接用（含空任务列表，即用户删光任务的合法状态）；
  var b=ckBucket(); // 无配置的老账号（已有打卡记录）沿用默认任务、数据不动；全新账号返回空列表，任务由家长自行创建
  if(b._cfg&&b._cfg.tasks)return {tasks:b._cfg.tasks,t:b._cfg.t||0};
  if(ckHasState(b))return {tasks:JSON.parse(JSON.stringify(CK_DEFAULT_TASKS)),t:0};
  return {tasks:[],t:0};
}
function ckCfgSave(tasks){ // 家长端保存配置（孩子端只读，不会走到）；落库前按学科排序，使配置顺序=展示顺序
  tasks=ckSortTasks(tasks);
  var b=ckBucket(),old=b._cfg||{};
  b._cfg={tasks:tasks,t:Date.now()};
  if(old.retired&&old.retired.length)b._cfg.retired=old.retired; /* 退役任务快照必须保留：历史加分/名称靠它找回 */
  ckSaveBucket(b);ckQueue();
}
function ckSortTasks(list){ // 按学科排序：语→数→英→科→其他（同科内保持原顺序，稳定排序）
  var sk=Object.keys(CK_SUBJ);
  return list.slice().sort(function(a,b){
    var xa=sk.indexOf(a.subj||'other');if(xa<0)xa=4;
    var xb=sk.indexOf(b.subj||'other');if(xb<0)xb=4;
    return xa-xb;
  });
}
function ckRecurDesc(t){ // 循环规则的文字描述
  var rc=t.recur||{type:'daily'};
  if(rc.type==='daily')return '每天';
  if(rc.type==='weekday')return '工作日（周一至五）';
  if(rc.type==='weekend')return '周末（周六日 · 两天共用）';
  if(rc.type==='weekly'){
    var nm=['日','一','二','三','四','五','六'],dd=(rc.days||[]).slice().sort(),arr=[];
    for(var i=0;i<dd.length;i++)arr.push('周'+nm[dd[i]]);
    return '每'+arr.join('、');
  }
  if(rc.type==='monthly'){
    var md=(rc.days||[]).slice().sort(function(a,b){return a-b}),arr2=[];
    for(var j=0;j<md.length;j++)arr2.push(md[j]+'号');
    return '每月'+arr2.join('、');
  }
  return '每日轮流·第'+((rc.rot||0)+1)+'位';
}
function ckTasksFor(ds){ // 按日期 + 循环规则生成当日任务清单（配置顺序=展示顺序）
  var wd=new Date(ds+'T00:00:00').getDay(),dom=new Date(ds+'T00:00:00').getDate();
  var tasks=ckCfg().tasks,list=[];
  for(var i=0;i<tasks.length;i++){
    var t=tasks[i],rc=t.recur||{type:'daily'},ok=false;
    if(rc.type==='daily')ok=true;
    else if(rc.type==='weekly')ok=(rc.days||[]).indexOf(wd)>=0;
    else if(rc.type==='monthly')ok=(rc.days||[]).indexOf(dom)>=0;
    else if(rc.type==='weekday')ok=(wd>=1&&wd<=5); // 工作日：周一至周五
    else if(rc.type==='weekend')ok=(wd===0||wd===6); // 周末：周六+周日（两天共用状态）
    else if(rc.type==='rotate'){var df=Math.round((new Date(ds+'T00:00:00')-new Date(CK_EPOCH+'T00:00:00'))/86400000);ok=(((df%3)+3)%3===(rc.rot||0))} // 负数日期（查看历史）也正常轮换（仅旧任务兼容，配置不再新增）
    if(ok)list.push(t);
  }
  return ckSortTasks(list);
}
function ckTaskById(id){ // 当前任务优先；已删除（停用）的任务从退役快照里找，保证历史记录与补记能对上原名原分
  var tasks=ckCfg().tasks;
  for(var i=0;i<tasks.length;i++){if(tasks[i].id===id)return tasks[i]}
  var b=ckBucket(),rt=(b._cfg&&b._cfg.retired)||[];
  for(var j=0;j<rt.length;j++){if(rt[j]&&rt[j].id===id)return rt[j]}
  return null;
}
function ckFmtD(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function ckDayDone(b,ds){ // 某天是否有任务完成（奖励标记不算）
  var day=b[ds];if(!day)return false;
  for(var id in day){
    if(id==='_bonus'||id==='_mbonus')continue;
    if(day[id]&&day[id].d)return true;
  }
  return false;
}
function ckStreak(){ // 连续有完成记录的天数（从今天往前，上限 1500 天以覆盖 1000 天徽章）
  var b=ckBucket(),n=0,d=new Date();
  for(var i=0;i<1500;i++){
    if(!ckDayDone(b,ckFmtD(d)))break;
    n++;d.setDate(d.getDate()-1);
  }
  return n;
}
function ckWeekDone(){ // 本周（周一至今）完成的天数
  var b=ckBucket(),n=0,d=new Date(),dow=d.getDay();
  d.setDate(d.getDate()-((dow===0)?6:(dow-1)));
  for(var i=0;i<7;i++){
    if(ckDayDone(b,ckFmtD(d)))n++;
    d.setDate(d.getDate()+1);
  }
  return n;
}
var CK_MILESTONES=[{d:3,icon:'🌱'},{d:7,icon:'⭐'},{d:14,icon:'🔥'},{d:30,icon:'🏆'},{d:90,icon:'💎'},{d:180,icon:'👑'},{d:360,icon:'🌈'},{d:500,icon:'🥇'},{d:1000,icon:'🎖️'}]; // 里程碑徽章（纯视觉）
function ckBadgesHtml(){ // 连续打卡徽章：达到即点亮，不写文字
  var st=ckStreak(),h='';
  for(var i=0;i<CK_MILESTONES.length;i++){
    var m=CK_MILESTONES[i];
    h+='<span class="ck-badge'+(st>=m.d?' on':'')+'" title="连续打卡 '+m.d+' 天">'+m.icon+'</span>';
  }
  return '<div class="ck-badges">'+h+'</div><div class="ck-badge-note">连续打卡 3 / 7 / 14 / 30 / 90 / 180 / 360 / 500 / 1000 天依次点亮</div>';
}
var ckCalYM=null; // 日历当前显示的年月（可翻看历史月份）
var ckCalOpen=false; // 默认只显示本周；点「展开月历」显示整月
function ckCalToggle(){ ckCalOpen=!ckCalOpen; ckShow(); }
function ckCalendarHtml(){ // 打卡日历：默认本周 7 天，展开为整月；点日期跳到那天、高亮跟随所选日期
  var b=ckBucket(),now=new Date();
  if(!ckCalYM)ckCalYM={y:now.getFullYear(),m:now.getMonth()};
  var y=ckCalYM.y,m=ckCalYM.m;
  var head='<div class="sec-h"><div class="st-t">打卡日历</div>'
    +'<span class="ck-cal-toggle" onclick="ckCalToggle()">'+(ckCalOpen?'收起 ▴':'展开月历 ▾')+'</span></div>';
  if(!ckCalOpen){ /* 周视图：本周一 ~ 本周日 */
    var wd=new Date(),dow=wd.getDay(),back=(dow===0)?6:(dow-1);
    wd.setDate(wd.getDate()-back);
    var labs='',cells='',names=['一','二','三','四','五','六','日'];
    for(var wi=0;wi<7;wi++){
      var wds=ckFmtD(wd);
      labs+='<span class="ck-wd">'+names[wi]+'</span>';
      cells+='<span class="ck-cd'+(ckDayDone(b,wds)?' on':'')+(wds===ckDate?' cur':'')+'" onclick="ckCalPick(\''+wds+'\')">'+wd.getDate()+'</span>';
      wd.setDate(wd.getDate()+1);
    }
    return '<div class="sec" style="margin-top:14px">'+head
      +'<div class="ck-cal ck-cal-week">'+labs+'</div>'
      +'<div class="ck-cal ck-cal-week">'+cells+'</div></div>';
  }
  var days=new Date(y,m+1,0).getDate();
  var firstDow=(new Date(y,m,1).getDay()+6)%7; /* 0=周一：与周视图、盲盒统计口径一致（周一为一周首日） */
  var p2=function(n){return (n<10?'0':'')+n};
  var weekHead='<div class="ck-cal ck-cal-week"><span class="ck-wd">一</span><span class="ck-wd">二</span><span class="ck-wd">三</span><span class="ck-wd">四</span><span class="ck-wd">五</span><span class="ck-wd">六</span><span class="ck-wd">日</span></div>';
  var cells='';
  for(var i=0;i<firstDow;i++)cells+='<span class="ck-cd empty"></span>';
  for(var d=1;d<=days;d++){
    var ds=y+'-'+p2(m+1)+'-'+p2(d);
    cells+='<span class="ck-cd'+(ckDayDone(b,ds)?' on':'')+(ds===ckDate?' cur':'')+'" onclick="ckCalPick(\''+ds+'\')">'+d+'</span>';
  }
  return '<div class="sec" style="margin-top:14px">'+head
    +'<div class="ck-cal-h"><button type="button" onclick="ckCalShift(-1)" aria-label="上个月">‹</button>'
    +'<span class="ck-ym">'+y+' 年 '+(m+1)+' 月</span>'
    +'<button type="button" onclick="ckCalShift(1)" aria-label="下个月">›</button></div>'
    +weekHead
    +'<div class="ck-cal">'+cells+'</div></div>';
}
function ckCalShift(n){ // 翻月（上/下）
  if(!ckCalYM)return;
  var m=ckCalYM.m+n,y=ckCalYM.y;
  if(m<0){m=11;y--;} else if(m>11){m=0;y++;}
  ckCalYM={y:y,m:m};
  ckShow();
}
function ckCalPick(ds){ // 点日历某天：下方任务列表切到该日期
  ckDate=ds;
  ckShow();
}
/* 满勤盲盒：上周（周一~周日）7 天全完成 → 本周可抽一次（家长端操作，孩子端只提示） */
function ckLastWeekFull(){ // 上周 = 周一为首日的 7 天（周一~周日），与日历展示口径一致
  var b=ckBucket(),d=new Date(),dow=d.getDay();
  var back=(dow===0)?7:dow;
  d.setDate(d.getDate()-back-6); // 上周一
  for(var i=0;i<7;i++){
    if(!ckDayDone(b,ckFmtD(d)))return false;
    d.setDate(d.getDate()+1);
  }
  return true;
}
function ckWeekTagOf(date){ // ISO 周：周一为首日、周四决定所属年（跨年也正确）
  var t=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  var day=t.getUTCDay()||7; /* 周日=7 */
  t.setUTCDate(t.getUTCDate()+4-day); /* 移到本周四 */
  var yearStart=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  var week=Math.ceil((((t-yearStart)/86400000)+1)/7);
  return t.getUTCFullYear()+'-W'+String(week).padStart(2,'0');
}
function ckWeekTag(){ return ckWeekTagOf(new Date()); }
function ckBlindIsThisWeek(){ // 本周是否已抽过盲盒：账本时间戳优先（家长端），其次打卡桶标记（孩子端抽的会写这里），最后老周标记
  var tw=ckWeekTag();
  if(ad&&ad.ckBlindAt)return ckWeekTagOf(new Date(ad.ckBlindAt))===tw;
  var bm=(ckBucket()._blind)||null;
  if(bm&&bm.at)return ckWeekTagOf(new Date(bm.at))===tw;
  return !!(ad&&ad.ckBlindWeek===tw); /* 老数据没有时间戳时退回周标记 */
}
function ckBlindboxHtml(){
  if(!ckLastWeekFull())return '';
  var w=ckWeekTag();
  if(ckBlindIsThisWeek())return '<div class="sync-hint" style="margin:10px 16px 0">🎁 上周全勤，盲盒已抽过啦</div>';
  return '<div style="margin:10px 16px 0"><button class="bn bn-p" style="height:42px;width:100%" onclick="ckBlindboxOpen()">🎁 抽全勤盲盒（上周全勤）</button></div>'; /* 家长端和孩子端都能自己抽 */
}
function ckBlindPool(){ // 盲盒奖励池（家长端可在设置页配置；未配置时用默认）
  var p=(ad&&ad.ckBlindPool);
  if(p&&p.length)return p;
  return [{n:'+5 分',p:5},{n:'+10 分',p:10},{n:'+20 分',p:20}];
}
function ckBlindPoolRead(){ // 读取设置页当前输入
  var box=document.getElementById('blindPoolBox');
  if(!box)return ckBlindPool();
  var rows=box.querySelectorAll('[data-i]'),pool=[];
  for(var i=0;i<rows.length;i++){
    var n=((document.getElementById('bpN'+i)||{}).value||'').trim();
    var p=parseInt(((document.getElementById('bpP'+i)||{}).value||''),10)||0;
    if(n&&p>0)pool.push({n:n,p:p});
  }
  return pool;
}
function ckBlindPoolRender(){ // 设置页：盲盒奖励列表
  var box=document.getElementById('blindPoolBox');
  if(!box)return;
  if(box.contains(document.activeElement))return; /* 正在输入时不重排，避免打断 */
  var pool=ckBlindPool(),h='';
  for(var i=0;i<pool.length;i++){
    h+='<div style="display:flex;gap:6px;margin-bottom:6px" data-i="'+i+'">'
      +'<input class="fi" style="flex:2;min-width:0" id="bpN'+i+'" value="'+escHtml(pool[i].n||'')+'" placeholder="奖励名称，如 +10 分">'
      +'<input class="fi" style="flex:0 0 78px" id="bpP'+i+'" type="number" min="1" value="'+(pool[i].p||0)+'" placeholder="分值">'
      +'<button class="bn bn-q" style="flex:0 0 40px;padding:0" onclick="ckBlindPoolDel('+i+')" aria-label="删除">✕</button>'
      +'</div>';
  }
  box.innerHTML=h;
}
function ckBlindPoolAdd(){
  var pool=ckBlindPoolRead();pool.push({n:'',p:5});
  ad.ckBlindPool=pool;sd(ad);ckBlindPoolRender();
}
function ckBlindPoolDel(i){
  var pool=ckBlindPoolRead();pool.splice(i,1);
  ad.ckBlindPool=pool.length?pool:[{n:'+5 分',p:5}];sd(ad);ckBlindPoolRender();
}
function ckBlindPoolSave(){
  if(sessionRole!=='parent')return;
  var pool=ckBlindPoolRead();
  if(!pool.length){toast('至少保留一项有效奖励','err');return}
  ad.ckBlindPool=pool;sd(ad);ckBlindPoolRender();
  toast('盲盒奖励已保存（共 '+pool.length+' 项）','ok');
}
function ckBlindboxOpen(){ // 抽盲盒：家长端直接写账本；孩子端写打卡桶标记（孩子端不写账本），家长端加载时自动兑现成积分
  if(!sessionRole||!currentUser){toast('请先登录','err');return}
  if(!ckLastWeekFull()){toast('上周未全勤，暂无盲盒','err');return}
  if(ckBlindIsThisWeek()){toast('本周盲盒已抽过','err');return}
  var w=ckWeekTag();
  var pool=ckBlindPool(),pick=pool[Math.floor(Math.random()*pool.length)];
  var pts=parseInt(pick.p,10)||0;
  if(pts<=0){toast('盲盒奖励未配置有效分值','err');return}
  var nm=pick.n||('+'+pts+' 分');
  var now=Date.now();
  if(sessionRole==='kid'){
    /* 孩子端数据不落账本：把抽取结果写进打卡桶（会同步），家长端进打卡页时自动兑现积分 */
    var b=ckBucket();
    b._blind={week:w,name:nm,pts:pts,at:now};
    ckSaveBucket(b);
    markCkPending();ckSyncPush(); /* 立即上云，不等 4 秒防抖（防抖窗口内关 App 会丢标记） */
    toast('🎁 抽到「'+nm+'」！积分会在家长端同步后到账','ok');
  }else{
    ad.records.push({id:'ckb_'+w,date:today(),timestamp:now,type:'up',itemId:'ck_blindbox',name:nm,category:'打卡',score:pts,note:'上周全勤盲盒（'+nm+'）'});
    ad.ckBlindWeek=w;
    ad.ckBlindAt=now;
    sd(ad);
  }
  if(sessionRole==='kid')ckShow(); /* 孩子端不写账本无需 render()；且孩子端 ad 可能尚未加载，调 render() 会因 ad.totalPoints 抛错导致界面不刷新 */
  else{render();ckShow();}
  toast('🎁 抽到「'+nm+'」！'+(sessionRole==='kid'?'（家长端同步后到账）':''),'ok');
}
function ckMotivate(){ // 正向激励徽章：连续打卡天数 + 本周完成天数
  var st=ckStreak(),wk=ckWeekDone();
  if(!st&&!wk)return '';
  return '<div class="ck-motivate">🔥 已连续打卡 <b>'+st+'</b> 天 · 本周完成 <b>'+wk+'</b> 天</div>';
}
function ckAddDays(ds,n){var d=new Date(ds+'T00:00:00');d.setDate(d.getDate()+n);return ckFmtD(d)}
function ckStateKey(ds){ // 周末任务两天共用状态（以周六为锚）：周六完成→周日同显已完成，且只加一次分
  var d=new Date(ds+'T00:00:00');
  if(d.getDay()===0){d.setDate(d.getDate()-1);return ckFmtD(d)}
  return ds;
}
function ckKeyFor(ds,t){ // 仅周末任务共用周末状态键（周六为锚：任一天完成即算周末完成）；其余任务按各自日期独立计
  var wk=(t.recur&&t.recur.type==='weekend')||t.type==='weekend';
  return wk?ckStateKey(ds):ds;
}
// —— 状态：{[date]:{[taskId]:{c:孩子已申请,d:家长确认完成,r:已加分,t:最后操作时间}}}（date=状态键，周末任务以周六为锚）——
var ckDate=today(),ckPullAt=0;
function ckBucket(){try{return JSON.parse(localStorage.getItem('sp_ck__'+currentUser))||{}}catch(e){return {}}}
function ckSaveBucket(b){try{localStorage.setItem('sp_ck__'+currentUser,JSON.stringify(b))}catch(e){}}
function ckMergeAll(a,b){ // 双端合并：d/r 逐字段取大（完成/加分只进不退）；c（申请）以最后操作时间较新者为准；_cfg/_blind 是顶层标记，不当日期遍历
  var out={},ds,tid;
  for(ds in a)if(ds!=='_cfg'&&ds!=='_blind')out[ds]=a[ds];
  for(ds in b){
    if(ds==='_cfg'||ds==='_blind')continue; /* _blind 是盲盒抽取结果，按 at 整块取新，不能当日期逐字段拆（否则 pts/at 被改写成对象） */
    if(!out[ds]){out[ds]=b[ds];continue}
    for(tid in b[ds]){
      var x=out[ds][tid],y=b[ds][tid];
      if(!x){out[ds][tid]=y;continue}
      var nb=((y.t||0)>=(x.t||0))?y:x; // c 取较新操作的一侧；d/r/m 仍取大，防止旧申请覆盖已确认状态
      out[ds][tid]={c:nb.c||0,d:Math.max(x.d||0,y.d||0),r:Math.max(x.r||0,y.r||0),m:Math.max(x.m||0,y.m||0),dd:nb.dd||0,t:Math.max(x.t||0,y.t||0)}; /* dd 随较新侧（实际完成日） */
    }
  }
  var ca=a?a._cfg:null,cb=b?b._cfg:null;
  if(ca&&(!cb||((ca.t||0)>=(cb.t||0))))out._cfg=ca;
  else if(cb)out._cfg=cb;
  var ba=a?a._blind:null,bb=b?b._blind:null; /* 盲盒标记：整块取 at 较新的一侧 */
  if(ba&&(!bb||((ba.at||0)>=(bb.at||0))))out._blind=ba;
  else if(bb)out._blind=bb;
  return out;
}
function ckSweepStale(){ // 孩子申请（待家长确认）超过 24 小时未确认 → 自动重置回初始状态，可重新申请
  var b=ckBucket(),changed=false,now=Date.now();
  for(var ds in b){
    if(ds==='_cfg'||ds==='_blind')continue;
    var day=b[ds];
    for(var id in day){
      if(id==='_bonus')continue;
      var st=day[id];
      if(st&&st.c&&!st.d&&(now-(st.t||0))>=86400000){
        day[id]={c:0,d:0,r:st.r||0,m:st.m||0,t:now};changed=true;
      }
    }
  }
  if(changed){ckSaveBucket(b);ckQueue();}
}
// —— 云同步（sync-checkin.json，双端可推；未配置 token 时静默跳过）——
var GH_CK_API='https://api.github.com/repos/'+GH_REPO+'/contents/sync-checkin.json';
var CK_PENDING_KEY='sp_ck_sync_pending';
var ckSyncSHA='',ckSyncTimer=null,ckSyncBusy=false,ckSyncErr='',ckCloudCnt=-1;
function ckDateKeys(o){var n=0,k;if(!o||typeof o!=='object')return 0;for(k in o)if(k!=='_cfg'&&k!=='_blind')n++;return n}
function markCkPending(){try{localStorage.setItem(CK_PENDING_KEY,'1')}catch(e){}}
function clearCkPending(){try{localStorage.removeItem(CK_PENDING_KEY)}catch(e){}}
function hasCkPending(){try{return localStorage.getItem(CK_PENDING_KEY)==='1'}catch(e){return false}}
function ckQueue(){ // 状态变更防抖上云（4 秒）
  if(!currentUser||!getSyncToken())return;
  markCkPending();
  if(ckSyncTimer)clearTimeout(ckSyncTimer);
  ckSyncTimer=setTimeout(ckSyncPush,4000);
}
function ckSyncPush(){
  if(ckSyncTimer){clearTimeout(ckSyncTimer);ckSyncTimer=null}
  if(ckSyncBusy||!hasCkPending()||!currentUser||!getSyncToken())return;
  ckSyncBusy=true;ckSyncErr='';
  if(curTab==='checkin')ckShow();
  syncChannelPush({
    api:GH_CK_API, msg:'ck-sync:'+currentUser, maxRetry:3,
    local:function(){return ckBucket()},
    merge:function(local,remoteAll){
      var remote=remoteAll[currentUser]||{};
      var merged=ckMergeAll(local,remote); // 只进不退合并，不覆盖
      ckSaveBucket(merged);
      var all={};for(var k in remoteAll)all[k]=remoteAll[k];
      all[currentUser]=merged;
      return {all:all,merged:merged};
    }
  }).then(function(res){
    ckSyncBusy=false;
    if(res.ok){ckSyncErr='';clearCkPending();ckCloudCnt=ckDateKeys(res.merged)}
    else{markCkPending();ckSyncErr=res.code?('同步失败（HTTP '+res.code+(res.msg?'：'+res.msg:'')+'）'):'网络异常，稍后自动重试'}
    if(curTab==='checkin')ckShow();
  });
}
function ckSyncPull(cb){ // 进打卡页拉取：合并云端申请/完成状态后刷新；cb=合并完成后的回调（必打卡结算挂在此处，避免本地缺孩子端申请状态被误扣）
  if(!currentUser)return;
  if(!getSyncToken()){if(cb)cb();return} // 未配置同步：本地即全部真相，立即回调
  fetch(GH_CK_API,{headers:{'Authorization':'token '+getSyncToken()}})
    .then(function(r){
      if(!r.ok){ckSyncErr='拉取失败（HTTP '+r.status+'）';if(cb)cb();if(hasCkPending())ckSyncPush();else if(curTab==='checkin')ckShow();return}
      return r.json().then(function(meta){
        ckSyncSHA=meta.sha||'';
        if(!meta.content){ckCloudCnt=0;if(cb)cb();if(hasCkPending())ckSyncPush();return}
        var all={};try{all=JSON.parse(b64ToUtf8(meta.content))}catch(e){}
        ckCloudCnt=ckDateKeys(all[currentUser]);
        var merged=ckMergeAll(ckBucket(),all[currentUser]||{});
        ckSaveBucket(merged);
        ckSyncErr='';
        if(cb)cb(); // 合并完成后先回调（此时孩子端申请/完成状态已在本地，结算不会误判）
        if(hasCkPending())ckSyncPush();
        if(curTab==='checkin')ckShow();
      });
    })
    .catch(function(){ckSyncErr='网络异常，稍后自动重试';if(cb)cb();if(curTab==='checkin')ckShow()});
}
window.addEventListener('online',function(){if(hasCkPending())ckSyncPush()});
setInterval(function(){if(hasCkPending()&&!ckSyncBusy)ckSyncPush()},60000); // 网络不稳：待同步内容每分钟自动补推
document.addEventListener('visibilitychange',function(){ // 切回页面/切换设备查看时立即对齐最新状态
  if(document.hidden)return;
  if(hasCkPending()&&!ckSyncBusy)ckSyncPush();
  if(curTab==='checkin'){ckPullAt=0;ckShow()}
});
// —— 操作 ——
var CK_CHEERS=['太棒了','做得真棒','今天又坚持啦','你真厉害','继续保持','为你点赞','好样的','自律小达人']; // 孩子提交打卡后的随机鼓励语
function ckClaim(ds,id){ // 孩子端：我已完成（=申请，不计完成，待家长确认）
  if(sessionRole!=='kid')return;
  var b=ckBucket(),st=(b[ds]&&b[ds][id])||{};
  if(st.d)return;
  b[ds]=b[ds]||{};b[ds][id]={c:1,d:0,r:st.r||0,dd:today(),t:Date.now()}; /* dd=实际申请日：周末任务两天共用状态，加分记实际完成日 */
  ckSaveBucket(b);ckQueue();ckShow();
  var cheer=CK_CHEERS[Math.floor(Math.random()*CK_CHEERS.length)];
  toast(cheer+'！已申请完成，等家长确认哦~','ok');
}
function ckConfirm(ds,id){ // 家长端：确认完成（可不经孩子申请直接确认）→ 完成 + 发放 +5 分
  if(sessionRole!=='parent')return;
  var b=ckBucket(),st=(b[ds]&&b[ds][id])||{};
  if(st.d)return;
  b[ds]=b[ds]||{};b[ds][id]={c:st.c||0,d:1,r:1,dd:st.dd||today(),t:Date.now()}; /* dd 沿用孩子申请日（直接确认则为确认日） */
  ckSaveBucket(b);ckQueue();
  if(!st.r)ckAward(ds,id); // r 标记防重：同日期同任务只加一次分（加分后不随状态回退）
  ckMustBonus(ckDate); // 当日必打卡全部完成 → 额外 +10
  ckDayBonus(ckDate); // 当日全部完成 → 额外 +20 全勤奖励
  ckShow();render();
}
function ckAward(ds,id){ // 加分：ck_reward 系统流水（删除入口已拦截），计入总分；分值按任务配置（默认 5）；周末任务加分记实际完成日（dd）
  var t=ckTaskById(id);if(!t)return;
  var b=ckBucket(),st=(b[ds]&&b[ds][id])||{};
  var pts=t.pt||CK_PT,rid='ck_'+ds+'_'+id,has=false;
  for(var i=0;i<ad.records.length;i++){if(ad.records[i].id===rid){has=true;break}}
  if(has)return; // 账本已有该流水：防重复加分（兜底）
  ad.records.push({id:rid,date:st.dd||ds,timestamp:Date.now(),type:'up',itemId:'ck_reward',name:t.name+'（打卡）',category:'打卡',score:pts,note:'每日打卡·家长确认'});
  ad.totalPoints+=pts;
  sd(ad);
  toast('已完成「'+t.name+'」，+'+pts+' 分','ok');
}
function ckMakeup(ds,id){ // 家长端：过期未打卡任务补卡——加原分值一半（向下取整），任务标为已补卡完成（防重复补卡/确认）
  if(sessionRole!=='parent')return;
  var t=ckTaskById(id);if(!t)return;
  var b=ckBucket(),k=ckKeyFor(ds,t),st=(b[k]&&b[k][id])||{};
  if(st.d)return;
  var half=Math.floor((t.pt||CK_PT)/2);
  b[k]=b[k]||{};b[k][id]={c:0,d:1,r:1,mk:half,m:st.m||0,t:Date.now()};
  ckSaveBucket(b);ckQueue();
  var rid='ckmk_'+ds+'_'+id,has=false;
  for(var i=0;i<ad.records.length;i++){if(ad.records[i].id===rid){has=true;break}}
  if(!has){
    ad.records.push({id:rid,date:ds,timestamp:Date.now(),type:'up',itemId:'ck_makeup',name:t.name+'（补卡）',category:'打卡',score:half,note:'过期任务补卡，加原分值一半'});
    ad.totalPoints+=half;sd(ad);
  }
  ckMustBonus(ds); // 补卡后若当日必打卡已全完成 → 补发 +10
  ckShow();
  toast('已补卡「'+t.name+'」，+'+half+' 分','ok');
}
function ckMustBonus(ds){ // 当日全部必打卡任务完成 → 额外 +10 分（ck_must_bonus 流水；每日期一次；当天无必打卡任务不发）
  var b=ckBucket();
  if(b[ds]&&b[ds]._mbonus&&b[ds]._mbonus.r)return;
  var tasks=ckTasksFor(ds),hasMust=false;
  for(var i=0;i<tasks.length;i++){
    var t=tasks[i];
    if(!t.must)continue;
    hasMust=true;
    var k=ckKeyFor(ds,t);
    if(!(b[k]&&b[k][t.id]&&b[k][t.id].d))return; // 有必打卡任务未完成 → 不发
  }
  if(!hasMust)return;
  b[ds]=b[ds]||{};b[ds]._mbonus={r:1,t:Date.now()};
  ckSaveBucket(b);ckQueue();
  var bid='ckmb_'+ds,hasB=false;
  for(var j=0;j<ad.records.length;j++){if(ad.records[j].id===bid){hasB=true;break}}
  if(!hasB){
    ad.records.push({id:bid,date:ds,timestamp:Date.now(),type:'up',itemId:'ck_must_bonus',name:'当日必打卡全部完成',category:'打卡',score:10,note:'当日所有必打卡任务完成 额外奖励 10 分'});
    ad.totalPoints+=10;
    sd(ad);
  }
  toast('当日必打卡任务全部完成，额外 +10 分！','ok');
}
function ckDayBonus(ds){ // 当日完成率 100% → 额外 +20 分（ck_bonus 系统流水不可删除；每个日期只发一次）
  var b=ckBucket();
  if(b[ds]&&b[ds]._bonus&&b[ds]._bonus.r)return;
  var tasks=ckTasksFor(ds);
  if(!tasks.length)return; // 当天无任务不发全勤
  for(var i=0;i<tasks.length;i++){var k=ckKeyFor(ds,tasks[i]);if(!(b[k]&&b[k][tasks[i].id]&&b[k][tasks[i].id].d))return}
  b[ds]=b[ds]||{};b[ds]._bonus={r:1,t:Date.now()};
  ckSaveBucket(b);ckQueue();
  var bid='ckb_'+ds,hasB=false;
  for(var j=0;j<ad.records.length;j++){if(ad.records[j].id===bid){hasB=true;break}}
  if(!hasB){
    ad.records.push({id:bid,date:ds,timestamp:Date.now(),type:'up',itemId:'ck_bonus',name:'当日打卡全部完成',category:'打卡',score:20,note:'当日完成率100% 额外奖励 20 分'});
    ad.totalPoints+=20;
    sd(ad);
  }
  toast('当日任务全部完成，额外 +20 分！','ok');
}
function ckReconcileAwards(){ // 自愈：打卡状态已确认加分、但账本流水缺失（如加分后账本推送失败被云端覆盖）→ 补回流水与总分
  if(sessionRole!=='parent'||!currentUser||!ad||!ad.records)return;
  var b=ckBucket(),changed=false,ds,id,reAdd=0,tp0=ad.totalPoints||0;
  /* —— 兑现孩子端自己抽的盲盒：孩子端只写打卡桶 _blind，家长端在这里补写账本流水（幂等）—— */
  var bm=b._blind;
  if(bm&&bm.week&&bm.pts>0){
    var bid='ckb_'+bm.week,hasB=false;
    for(var bi=0;bi<ad.records.length;bi++){if(ad.records[bi]&&ad.records[bi].id===bid){hasB=true;break}}
    if(!hasB){
      ad.records.push({id:bid,date:today(),timestamp:bm.at||Date.now(),type:'up',itemId:'ck_blindbox',name:bm.name||('+'+bm.pts+' 分'),category:'打卡',score:bm.pts,note:'上周全勤盲盒（孩子端抽中，家长端兑现）'});
      ad.totalPoints+=bm.pts;changed=true;reAdd++;
      if(!ad.ckBlindAt||bm.at>ad.ckBlindAt){ad.ckBlindAt=bm.at;ad.ckBlindWeek=bm.week;}
    }
  }
  for(ds in b){
    if(ds==='_cfg'||ds==='_blind')continue;
    var day=b[ds];
    for(id in day){
      if(id==='_bonus')continue;
      var st=day[id];
      if(!(st&&st.d&&st.r))continue;
      var rid='ck_'+ds+'_'+id,has=false;
      for(var i=0;i<ad.records.length;i++){if(ad.records[i].id===rid){has=true;break}}
      if(has)continue;
      var t=ckTaskById(id);
      if(!t){ /* 任务已删除且无快照（早期数据）：按完成时的分值兜底补回，绝不因删任务丢掉历史加分 */
        var p0=(st.mk!=null)?st.mk:CK_PT;
        ad.records.push({id:rid,date:st.dd||ds,timestamp:st.t||Date.now(),type:'up',itemId:'ck_reward',name:'打卡（历史任务）',category:'打卡',score:p0,note:'历史打卡补记（原任务已删除）'});
        ad.totalPoints+=p0;changed=true;reAdd++;continue;
      }
      if(st.mk!=null){ // 补卡状态：自愈补的是半分补卡流水（ckmk_），不按全分
        var mrid='ckmk_'+ds+'_'+id,mhas=false;
        for(var mi=0;mi<ad.records.length;mi++){if(ad.records[mi].id===mrid){mhas=true;break}}
        if(!mhas){ad.records.push({id:mrid,date:ds,timestamp:st.t||Date.now(),type:'up',itemId:'ck_makeup',name:t.name+'（补卡）',category:'打卡',score:st.mk,note:'过期任务补卡，加原分值一半'});ad.totalPoints+=st.mk;changed=true;reAdd++}
        continue;
      }
      var pts=t.pt||CK_PT;
      ad.records.push({id:rid,date:st.dd||ds,timestamp:st.t||Date.now(),type:'up',itemId:'ck_reward',name:t.name+'（打卡）',category:'打卡',score:pts,note:'每日打卡·家长确认'});
      ad.totalPoints+=pts;changed=true;reAdd++;
    }
    if(day._mbonus&&day._mbonus.r){ // 必打卡档自愈
      var mbid='ckmb_'+ds,mhasB=false;
      for(var mj=0;mj<ad.records.length;mj++){if(ad.records[mj].id===mbid){mhasB=true;break}}
      if(!mhasB){
        ad.records.push({id:mbid,date:ds,timestamp:day._mbonus.t||Date.now(),type:'up',itemId:'ck_must_bonus',name:'当日必打卡全部完成',category:'打卡',score:10,note:'当日所有必打卡任务完成 额外奖励 10 分'});
        ad.totalPoints+=10;changed=true;reAdd++;
      }
    }
    if(day._bonus&&day._bonus.r){
      var bid='ckb_'+ds,hasB=false;
      for(var j=0;j<ad.records.length;j++){if(ad.records[j].id===bid){hasB=true;break}}
      if(!hasB){
        ad.records.push({id:bid,date:ds,timestamp:day._bonus.t||Date.now(),type:'up',itemId:'ck_bonus',name:'当日打卡全部完成',category:'打卡',score:20,note:'当日完成率100% 额外奖励 20 分'});
        ad.totalPoints+=20;changed=true;reAdd++;
      }
    }
  }
  if(changed){sd(ad);var gain=(ad.totalPoints||0)-tp0;toast('已补回 '+reAdd+' 条打卡积分'+(gain>0?'（+'+gain+' 分）':''),'ok');if(curTab==='checkin')ckShow();else render();}
  return reAdd;
}
// —— 渲染 ——
function ckShift(n){ // 日视图 ±1 天；最多查看今天起 7 天内
  var ds=ckAddDays(ckDate,n);
  if(ds>ckAddDays(today(),7))return;
  ckDate=ds;ckShow();
}
function ckRollbackWrongPenalties(){ // 回滚「修改任务配置后被按新配置重算补扣」的历史扣分（幂等）
  if(sessionRole!=='parent'||!currentUser||!ad||!ad.records)return 0;
  var cfg=ckCfg(),cfgT=cfg.t||0;
  if(!cfgT)return 0;
  var cfgDay=ckFmtD(new Date(cfgT));
  var b=ckBucket(),removed=0,ids=[];
  for(var i=ad.records.length-1;i>=0;i--){
    var r=ad.records[i];
    if(!r||String(r.id||'').indexOf('ckm_')!==0)continue;
    if(r.date>=cfgDay)continue;             /* 只看配置日之前的历史 */
    if(!(r.timestamp>cfgT))continue;         /* 只看改配置之后才写进去的（=重算误扣） */
    ad.del=ad.del||{};ad.del['r:'+r.id]=Date.now();
    ad.records.splice(i,1);
    ids.push(String(r.id).split('_').pop());
    removed++;
  }
  if(!removed)return 0;
  /* 清掉这些任务在历史日期上的「已扣」标记，避免再次被判已扣 */
  for(var ds in b){
    if(ds==='_cfg'||ds>=cfgDay)continue;
    var day=b[ds];
    for(var j=0;j<ids.length;j++){
      var tid=ids[j];
      if(day&&day[tid]&&day[tid].m){day[tid].m=0;}
    }
  }
  ckSaveBucket(b);
  ad.totalPoints=rdSumScore(ad);
  sd(ad);
  if(typeof markPendingSync==='function')markPendingSync();
  return removed;
}
function ckMustSweep(now){ // 必打卡结算规则：只有"完全未动"（无家长确认d/无孩子申请c/未扣过m）才扣分；孩子已申请(c)不扣——24h未确认由 ckSweepStale 重置回初始状态，之后由本函数补扣；周末任务(两天共用)扣分时点=该周末周日24点后；now 供测试注入
  now=now||new Date();
  if(!currentUser)return;
  var tds=ckFmtD(now);
  var cfg0=ckCfg(),tasks=cfg0.tasks,musts=[];
  var cfgDay=cfg0.t?ckFmtD(new Date(cfg0.t)):''; /* 配置最后修改日 */
  /* 配置只会影响未来：修改任务前已过去的日子视为定稿，不再按新配置重算（否则改一次任务就批量补扣历史） */
  for(var i=0;i<tasks.length;i++){if(tasks[i].must)musts.push(tasks[i])}
  if(!musts.length)return;
  var isWk=function(t){return (t.recur&&t.recur.type==='weekend')||t.type==='weekend'};
  var b=ckBucket(),changed=false,anyPenalty=false;
  var scan=function(ds){
    if(cfgDay&&ds<cfgDay)return; /* 历史日期已定稿：不按新配置补扣 */
    var day=ckTasksFor(ds),ids={},ti;
    for(ti=0;ti<day.length;ti++)ids[day[ti].id]=day[ti];
    for(var m=0;m<musts.length;m++){
      var t=musts[m];
      if(!ids[t.id])continue;
      if(isWk(t)){
        /* 周末任务以周六为锚两天共用：周日仍有整天可打卡，扣分统一推迟到该周末周日24点后（=锚周六+2的周一00:00起）；
           此前（含周六/周日22点的当日结算、历史遍历）一律跳过，防止提前扣 */
        if(ckFmtD(now)<ckAddDays(ds,2))continue;
      }
      var k=ckKeyFor(ds,t),st=(b[k]&&b[k][t.id])||{};
      if(st.d||st.c)continue;
      if(st.m){ // 已标记扣分：孩子端先结算时只写标记、不写账本流水（孩子端数据不落库），家长端补记扣分流水
        if(sessionRole==='parent'&&ad&&ad.records){
          var rid0='ckm_'+ds+'_'+t.id,has0=false;
          for(var j0=0;j0<ad.records.length;j0++){if(ad.records[j0].id===rid0){has0=true;break}}
          if(!has0&&!(ad.del&&ad.del['r:'+rid0])){ // 有删除墓碑=家长已删除该扣分，视为豁免，不再补记
            ad.records.push({id:rid0,date:ds,timestamp:st.t||Date.now(),type:'down',itemId:'ck_must',name:t.name+'（必打卡未完成）',category:'打卡',score:-(t.pt||CK_PT),note:isWk(t)?'必打卡周末任务周日24点前未完成自动扣分':'必打卡当日24点前未完成自动扣分'});
            ad.totalPoints-=(t.pt||CK_PT);
            markPendingSync();sd(ad); // 静默补记（后台修账，不弹提示避免每次进页面反复提醒）
          }
        }
        continue;
      }
      b[k]=b[k]||{};
      b[k][t.id]={c:st.c||0,d:0,r:st.r||0,m:1,t:Date.now()};
      changed=true;
      if(sessionRole==='parent'&&ad&&ad.records){
        var rid='ckm_'+ds+'_'+t.id,has=false;
        for(var j=0;j<ad.records.length;j++){if(ad.records[j].id===rid){has=true;break}}
        if(!has&&!(ad.del&&ad.del['r:'+rid])){ // 有删除墓碑=家长已删除该扣分，视为豁免，不再重复扣
          ad.records.push({id:rid,date:ds,timestamp:Date.now(),type:'down',itemId:'ck_must',name:t.name+'（必打卡未完成）',category:'打卡',score:-(t.pt||CK_PT),note:isWk(t)?'必打卡周末任务周日24点前未完成自动扣分':'必打卡当日24点前未完成自动扣分'});
          ad.totalPoints-=(t.pt||CK_PT);
          markPendingSync(); // 防随即 pull 用云端旧账本覆盖刚写的扣分流水
          anyPenalty=true;
        }
      }
    }
  };
  /* 必打卡 24 点规则：当天全天不扣（跨过 24 点的次日起才算超时）。过去 7 天主动补扫
     （不依赖 bucket 键存在——孩子连续多天未打卡/未开应用也能正确补扣）；更早且有键的历史由下方遍历兜底 */
  for(var bwd=1;bwd<=7;bwd++)scan(ckAddDays(tds,-bwd));
  for(var k2 in b){if(k2!=='_cfg'&&k2<tds)scan(k2)}
  /* 周末任务兜底：bucket 可能没有周末键（孩子整周末没打卡），周一~周五主动补扫上一个周六锚键 */
  var dow=now.getDay();
  if(dow>=1&&dow<=5)scan(ckAddDays(tds,-((dow+1)%7)));
  if(changed){ckSaveBucket(b);ckQueue()}
  if(anyPenalty){sd(ad);toast('必打卡任务有超时未完成，已自动扣分','err')}
}
function ckShow(){
  var host=document.getElementById('ckList');
  if(!host||!currentUser)return;
  if(ckDate>ckAddDays(today(),7))ckDate=ckAddDays(today(),7);
  /* 结算时序：必须先拉云端合并孩子端的申请/完成状态，再跑超时重置与必打卡结算——
     否则本地缺刚提交的 c/d 状态会误扣（修复"明明打卡了还被扣分"）。
     30 秒内已拉过则本地状态新鲜，直接结算。 */
  if(Date.now()-ckPullAt>30000){ckPullAt=Date.now();ckSyncPull(function(){ckSweepStale();ckMustSweep();ckReconcileAwards()})}
  else{ckSweepStale();ckMustSweep();ckReconcileAwards()}
  var rb=ckRollbackWrongPenalties();
  if(rb>0)toast('已回滚 '+rb+' 条因修改任务产生的历史误扣','ok');
  var tasks=ckTasksFor(ckDate),b=ckBucket();
  var syncHtml='';
  if(!getSyncToken())syncHtml='<span class="ck-sync err" onclick="ckTokOpen()" title="点击配置同步令牌">同步未开启，点击配置令牌</span>';
  else if(ckSyncBusy)syncHtml='<span class="ck-sync">同步中…</span>';
  else if(ckSyncErr)syncHtml='<span class="ck-sync err" onclick="ckSyncPush()" title="点击立即重试">同步异常：'+escHtml(ckSyncErr)+'</span>';
  else if(hasCkPending())syncHtml='<span class="ck-sync">待同步…</span>'; // 已同步时不显示任何状态文字
  var maxD=ckAddDays(today(),7);
  var html=''; /* 日期由下方日历选择：不再显示日期标题/进度条/统计行，避免信息冗余 */
  if(!tasks.length){ // 全新账号：无任务，引导家长自行创建
    html+='<div class="es" style="padding:40px 16px">'+esBricks()+'<div class="et">'+(sessionRole==='parent'?'还没有打卡任务，点右上角「管理任务」创建':'家长还没有创建打卡任务哦')+'</div></div>';
    host.innerHTML=html;
    document.getElementById('ckTip').innerHTML='<span>'+(sessionRole==='kid'?'打卡任务由家长在「管理任务」中创建后，这里就会显示':'打卡任务由你自行创建：支持每天/每周/每月/轮流循环，可设学科、时长、分值与备注')+'</span>'+syncHtml
      +(sessionRole==='parent'?'<button class="ck-cfg-btn" onclick="ckCfgOpen()">管理任务</button>':'');
    return;
  }
  var i;
  html+=ckMotivate()
    +ckBadgesHtml()
    +ckCalendarHtml()
    +ckBlindboxHtml();
  for(i=0;i<tasks.length;i++){
    var t=tasks[i],k=ckKeyFor(ckDate,t),st=(b[k]&&b[k][t.id])||{};
    var sm=CK_SUBJ[t.subj]||CK_SUBJ.other;
    var note=t.zw?ckZwText(ckDate):(t.note||'');
    var bd=st.d?'#B9DDB2':(st.c?'#E8D49A':sm.bd); // 已完成绿描边 / 待确认黄描边 / 学科本色
    if(t.must)note+=(note?' · ':'')+'必打卡，当日24点前未打卡将扣除相应分值';
    var mustPending=t.must&&!st.d&&!st.m; // 必打卡且未完成未扣分：描边加重区分
    var expired=ckDate<today()&&!st.d&&!st.c; // 过去日期仍未打卡（无家长确认也无孩子申请）：状态显示过期未打卡
    html+='<div class="ck-item'+(mustPending?' must-pending':'')+'" style="background:'+sm.bg+';border-color:'+bd+'">'
      +'<div class="ck-i-l"><div class="ck-nm"><span class="ck-subj" style="background:'+sm.c+'">'+sm.n+'</span>'+escHtml(t.name)+(t.must?'<span class="ck-mustb">必打卡</span>':'')+(t.min?'<span class="ck-min">'+t.min+'min</span>':'')+(st.m&&!st.d?'<span class="ck-min" style="color:var(--red-deep)">已扣'+(t.pt||CK_PT)+'分</span>':'<span class="ck-min">+'+(t.pt||CK_PT)+'分</span>')+'</div>'
      +(note?'<div class="ck-zw">'+escHtml(note)+'</div>':'')
      +'</div>';
    if(st.d){
      html+='<div class="ck-st done">'+(st.mk!=null?'✅ 已补卡<span>+'+st.mk+' 分</span>':'✅ 已完成<span>+'+(t.pt||CK_PT)+' 分</span>')+'</div>';
    }else if(ckDate>today()){
      html+='<div class="ck-st wait">计划中</div>'; // 未来日期仅查看计划，不可操作
    }else if(sessionRole==='kid'){
      /* 过去日期仍未打卡：状态即「过期未打卡」（纯展示，不可再操作） */
      html+=st.c?'<div class="ck-st wait">⏳ 待家长确认</div>'
        :(expired?'<div class="ck-st exp">过期未打卡</div>':'<button class="ck-b" onclick="ckClaim(\''+k+'\',\''+t.id+'\')">我已完成</button>');
    }else{
      html+=expired?'<div class="ck-st exp">过期未打卡</div><button class="ck-b p" onclick="ckMakeup(\''+k+'\',\''+t.id+'\')">补卡 +'+Math.floor((t.pt||CK_PT)/2)+' 分</button>'
        :'<button class="ck-b p" onclick="ckConfirm(\''+k+'\',\''+t.id+'\')">'+(st.c?'孩子已打卡，请确认！':'确认完成')+'</button>';
    }
    html+='</div>';
  }
  host.innerHTML=html;
  var tipTxt=sessionRole==='kid'
    ?'点「我已完成」后请等家长确认，确认后才会加分哦'
    :'孩子申请后需家长确认；也可直接点「确认完成」。每个任务按配置分值计分（默认 5 分）；当日必打卡任务全部完成额外 +10 分，当日全部任务完成再额外 +20 分。加分不可删除。';
  document.getElementById('ckTip').innerHTML='<span>'+tipTxt+'</span>'+syncHtml
    +(sessionRole==='parent'?'<button class="ck-cfg-btn" onclick="ckCfgOpen()">管理任务</button>':'');
}
// —— 打卡任务配置（家长端）：列表 / 新增 / 编辑 / 删除 ——
function ckCfgOpen(){
  if(sessionRole!=='parent')return;
  var b=ckBucket();
  if(!(b._cfg&&b._cfg.tasks)){ // 首次打开管理：老账号（已有打卡记录）带入默认任务（数据不动）；全新账号从空白开始自行创建
    b._cfg={tasks:ckHasState(b)?JSON.parse(JSON.stringify(CK_DEFAULT_TASKS)):[],t:Date.now()};
    ckSaveBucket(b);
  }
  ckCfgRender();
  document.getElementById('mCkCfg').classList.add('show');
}
function ckCfgClose(){document.getElementById('mCkCfg').classList.remove('show')}
function ckCfgRender(){
  var raw=ckCfg().tasks,tasks=ckSortTasks(raw),html='<button class="ck-cfg-add" onclick="ckCfgEdit(-1)">＋ 新增任务</button>';
  for(var i=0;i<tasks.length;i++){
    var t=tasks[i],sm=CK_SUBJ[t.subj]||CK_SUBJ.other,oi=raw.indexOf(t); /* 原数组下标：编辑/删除按原始索引操作 */
    var note=t.zw?'备注：按作文三阶段计划自动显示':(t.note||'');
    if(t.must)note+=(note?' · ':'')+'必打卡，当日24点前未打卡将扣除相应分值';
    html+='<div class="ck-cfg-row">'
      +'<div class="ck-cfg-i"><div class="ck-nm"><span class="ck-subj" style="background:'+sm.c+'">'+sm.n+'</span>'+escHtml(t.name)+(t.must?'<span class="ck-mustb">必打卡</span>':'')+(t.min?'<span class="ck-min">'+t.min+'min</span>':'')+'<span class="ck-min">+'+(t.pt||CK_PT)+'分</span></div>'
      +'<div class="ck-zw">'+escHtml(ckRecurDesc(t))+(note?' · '+escHtml(note):'')+'</div></div>'
      +'<div class="ck-cfg-btns"><button class="ck-b" onclick="ckCfgEdit('+oi+')">编辑</button><button class="ck-b d" onclick="ckCfgDel('+oi+')">删除</button></div>'
      +'</div>';
  }
  html+='<div class="ck-cfg-tip">循环说明：每天=每日出现；每周=勾选星期几；每月=勾选几号；每日轮流=与其它轮流任务按 3 天一循环依次出现。任务配置会同步到所有设备。</div>';
  document.getElementById('ckCfgBody').innerHTML=html;
}
function ckCfgEdit(idx){
  var tasks=ckCfg().tasks;
  var t=idx>=0?tasks[idx]:{id:'t'+Date.now(),name:'',subj:'other',min:10,pt:CK_PT,note:'',recur:{type:'daily'}};
  var h='<div class="fg"><label class="fl">任务名称</label><input class="fi" id="ckfName" maxlength="20" value="'+escHtml(t.name)+'" placeholder="如：语文天天练"></div>'
    +'<div class="fg"><label class="fl">学科</label><select class="fi" id="ckfSubj">';
  for(var s in CK_SUBJ)h+='<option value="'+s+'"'+(t.subj===s?' selected':'')+'>'+CK_SUBJ[s].n+'</option>';
  h+='</select></div>'
    +'<div class="fg"><label class="fl">是否必打卡</label><select class="fi" id="ckfMust"><option value="0"'+(t.must?'':' selected')+'>否</option><option value="1"'+(t.must?' selected':'')+'>是</option></select></div>'
    +'<div class="fg"><label class="fl">循环方式</label><select class="fi" id="ckfType" onchange="ckCfgTypePick()">';
  var types=[['daily','每天'],['weekday','工作日（周一至五）'],['weekend','周末（周六日·共用）'],['weekly','每周（选星期）'],['monthly','每月（选几号）']];
  if((t.recur||{}).type==='rotate')types.push(['rotate','每日轮流（3 天一轮）']); // 仅旧轮流任务可见，兼容不新增
  for(var k=0;k<types.length;k++)h+='<option value="'+types[k][0]+'"'+((t.recur||{}).type===types[k][0]?' selected':'')+'>'+types[k][1]+'</option>';
  h+='</select><div id="ckfPick"></div></div>'
    +'<div class="fg" style="display:flex;gap:10px"><div style="flex:1"><label class="fl">预计时长（分钟，0=不显示）</label><input class="fi" id="ckfMin" type="number" min="0" max="600" value="'+(t.min||0)+'"></div>'
    +'<div style="flex:1"><label class="fl">分值</label><input class="fi" id="ckfPt" type="number" min="1" max="100" value="'+(t.pt||CK_PT)+'"></div></div>'
    +'<div class="fg"><label class="fl">备注（展示在任务下方的灰色文字）</label><input class="fi" id="ckfNote" maxlength="60" value="'+escHtml(t.note||'')+'" placeholder="'+(t.zw?'留空则按作文三阶段计划自动显示当日内容':'选填')+'"></div>'
    +'<div class="ck-cfg-btns" style="margin-top:14px"><button class="ck-b p" style="flex:1" onclick="ckCfgSubmit('+idx+')">保存</button><button class="ck-b" style="flex:1" onclick="ckCfgRender()">取消</button></div>';
  document.getElementById('ckCfgBody').innerHTML=h;
  ckCfgTypePick(t.recur);
}
function ckCfgTypePick(recur){ // 按循环方式渲染选择器（星期多选 / 日期多选 / 轮换位）
  recur=recur||{};
  var type=document.getElementById('ckfType').value;
  var el=document.getElementById('ckfPick');
  if(type==='daily'){el.innerHTML='<div class="ck-cfg-tip">每天都会出现在打卡列表</div>';return}
  if(type==='weekday'){el.innerHTML='<div class="ck-cfg-tip">周一至周五出现，周末不出现</div>';return}
  if(type==='weekend'){el.innerHTML='<div class="ck-cfg-tip">周六和周日出现，且两天共用打卡状态：任一天完成即算周末完成</div>';return}
  if(type==='weekly'){
    var days=(recur.days)||[],nm=['日','一','二','三','四','五','六'],vals=[0,1,2,3,4,5,6],h='<div class="ck-days">';
    for(var i=0;i<7;i++)h+='<label class="ck-day'+(days.indexOf(vals[i])>=0?' on':'')+'"><input type="checkbox" value="'+vals[i]+'"'+(days.indexOf(vals[i])>=0?' checked':'')+' onchange="this.parentNode.classList.toggle(\'on\',this.checked)">'+nm[i]+'</label>';
    el.innerHTML=h+'</div>';return;
  }
  if(type==='monthly'){
    var md=(recur.days)||[],h2='<div class="ck-days">';
    for(var d=1;d<=31;d++)h2+='<label class="ck-day'+(md.indexOf(d)>=0?' on':'')+'"><input type="checkbox" value="'+d+'"'+(md.indexOf(d)>=0?' checked':'')+' onchange="this.parentNode.classList.toggle(\'on\',this.checked)">'+d+'</label>';
    el.innerHTML=h2+'</div>';return;
  }
  var rot=(recur.rot)||0,h3='<select class="fi" id="ckfRot">';
  for(var r=0;r<3;r++)h3+='<option value="'+r+'"'+(rot===r?' selected':'')+'>轮换第 '+(r+1)+' 位</option>';
  el.innerHTML=h3+'</select><div class="ck-cfg-tip">轮换任务与其它「每日轮流」任务共用 3 天循环序列，按基准日依次出现</div>';
}
function ckCfgSubmit(idx){
  var name=document.getElementById('ckfName').value.trim();
  if(!name){toast('请填写任务名称','err');return}
  var subj=document.getElementById('ckfSubj').value;
  var type=document.getElementById('ckfType').value,recur={type:type};
  if(type==='weekly'){
    var cbs=document.querySelectorAll('#ckfPick input:checked'),days=[];
    for(var i=0;i<cbs.length;i++)days.push(parseInt(cbs[i].value,10));
    if(!days.length){toast('每周循环请至少选择一个星期','err');return}
    days.sort(function(a,b){return ((a+6)%7)-((b+6)%7)}); // 周一~周日排序
    /* 归一化：恰好勾满工作日 → 存为工作日类型；恰好勾周六+周日 → 存为周末类型（两天共用状态） */
    if(days.length===5&&days.join(',')==='1,2,3,4,5'){type='weekday';recur={type:'weekday'}}
    else if(days.length===2&&days.join(',')==='6,0'){type='weekend';recur={type:'weekend'}}
    else recur.days=days;
  }else if(type==='monthly'){
    var cbs2=document.querySelectorAll('#ckfPick input:checked'),md=[];
    for(var j=0;j<cbs2.length;j++)md.push(parseInt(cbs2[j].value,10));
    if(!md.length){toast('每月循环请至少选择一个日期','err');return}
    md.sort(function(a,b){return a-b});recur.days=md;
  }else if(type==='rotate'){
    recur.rot=parseInt(document.getElementById('ckfRot').value,10)||0;
  }
  var min=parseInt(document.getElementById('ckfMin').value,10)||0;
  var pt=parseInt(document.getElementById('ckfPt').value,10)||CK_PT;
  var note=document.getElementById('ckfNote').value.trim();
  var must=document.getElementById('ckfMust').value==='1'?1:0;
  var tasks=ckCfg().tasks;
  var t=idx>=0?tasks[idx]:{id:'t'+Date.now()};
  t.name=name;t.subj=subj;t.recur=recur;t.min=min;t.pt=pt;t.note=note;t.must=must;
  delete t.sub;delete t.type;delete t.rot;delete t.zw; // 统一为新结构
  if(!note&&idx>=0&&tasks[idx].zw)t.zw=1; // 原动态作文任务且备注留空 → 保留按计划自动显示
  if(idx>=0)tasks[idx]=t;else tasks.push(t);
  ckCfgSave(tasks);
  ckCfgRender();ckShow();
  toast('已保存，「'+name+'」已更新','ok');
}
function ckCfgDel(idx){
  var tasks=ckCfg().tasks;
  var name=tasks[idx]?tasks[idx].name:'';
  sc2('删除打卡任务','删除「'+name+'」？已完成的记录与积分都会保留，只是从今天起不再安排。',function(){
    var del=tasks[idx];
    if(del){
      var b=ckBucket();
      b._cfg=b._cfg||{};
      b._cfg.retired=b._cfg.retired||[];
      var snap={};for(var k in del)snap[k]=del[k];
      snap.retiredAt=Date.now();
      b._cfg.retired.push(snap);
      var seen={},rr=[]; /* 同 id 只保留最新一份快照 */
      for(var i=b._cfg.retired.length-1;i>=0;i--){var r0=b._cfg.retired[i];if(!r0||seen[r0.id])continue;seen[r0.id]=1;rr.unshift(r0);}
      b._cfg.retired=rr;
      ckSaveBucket(b);
    }
    tasks.splice(idx,1);ckCfgSave(tasks);ckCfgRender();ckShow();
  });
}
// —— 打卡同步令牌（孩子端无设置页签，可在打卡页直接配置）——
function ckTokOpen(){
  document.getElementById('ckTokInput').value=getSyncToken();
  document.getElementById('mCkTok').classList.add('show');
  setTimeout(function(){var i=document.getElementById('ckTokInput');i.focus();i.select()},120);
}
function ckTokClose(){document.getElementById('mCkTok').classList.remove('show')}
function ckTokSave(){
  var v=document.getElementById('ckTokInput').value.trim();
  if(!v){toast('请填写令牌','err');return}
  try{localStorage.setItem(TOKEN_KEY,v)}catch(e){}
  ckTokClose();
  if(!currentUser){ // 登录页：配好令牌后立即重新查找账本（打通新设备找回流程）
    toast('令牌已保存，正在查找账本…','ok');
    var pEl=document.getElementById('loginPhone');
    if(pEl&&pEl.value.trim())doLogin();else checkLoginPhone();
    return;
  }
  ckPullAt=0;ckShow();
  toast('令牌已保存，正在同步打卡状态…','ok');
}
