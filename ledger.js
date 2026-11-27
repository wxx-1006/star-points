function totalEarned(acc){ // 累计获得（所有正分流水之和，等级只升不降的依据）
  return ((acc&&acc.records)||[]).reduce(function(s,r){return s+((r&&r.score>0)?r.score:0)},0);
}
function kidLevel(earned){ // 累计积分 → 等级称号（三档：新星/闪耀星/璀璨星）
  if(earned>=200)return {lv:3,name:'璀璨星',icon:'✨'};
  if(earned>=50)return {lv:2,name:'闪耀星',icon:'⭐'};
  return {lv:1,name:'新星',icon:'☆'};
}
function renderKidGoal(){ // 孩子端首页：等级 + 愿望进度（家长端隐藏）
  var el=document.getElementById('kidGoal');
  var cta=document.getElementById('ctaSec');
  if(sessionRole!=='kid'){
    if(el)el.style.display='none';
    return;
  }
  if(cta)cta.style.display='none'; // 孩子端不显示「记录分数/兑换积分」入口
  if(!el)return;
  el.style.display='';
  var earned=totalEarned(ad),lv=kidLevel(earned);
  var h='<div class="kg-lv">'+lv.icon+' '+lv.name+' · 累计获得 '+earned+' 星</div>';
  var w=ad.wish;
  if(w&&w.name&&w.cost>0){
    var cur=Math.max(0,Math.min(ad.totalPoints,w.cost));
    var pct=Math.min(100,Math.round(ad.totalPoints/w.cost*100));
    var left=Math.max(0,w.cost-ad.totalPoints);
    h+='<div class="kg-wish"><div class="kg-wt">🎯 目标：'+escHtml(w.name)+'（'+w.cost+' 星）</div>'
      +'<div class="kg-bar"><i style="width:'+pct+'%"></i></div>'
      +'<div class="kg-wd">'+(left>0?('还差 <b>'+left+'</b> 星'):'🎉 目标达成！')+'</div></div>';
  }
  el.innerHTML=h;
}
function renderHome(){
  var tpEl=document.getElementById('tp');
  tpEl.textContent=ad.totalPoints;
  tpEl.classList.toggle('zero',!ad.totalPoints);
  // 徽章等级：红 <100 ≤ 黄 <500 ≤ 蓝
  document.getElementById('pcBrick').className='pc-brick'+(ad.totalPoints>=500?' b':(ad.totalPoints>=100?' y':''));

  var tr=ad.records.filter(function(r){return r.date===today()});
  var tu=tr.filter(function(r){return r.score>0}).reduce(function(s,r){return s+r.score},0);
  var td2=tr.filter(function(r){return r.score<0}).reduce(function(s,r){return s+Math.abs(r.score)},0);
  var tn=tu-td2;
  document.getElementById('tu').textContent='+'+tu;
  document.getElementById('td').textContent='-'+td2;
  var tpe=document.getElementById('tdp');
  if(tn>0) tpe.innerHTML='今日：<span class="up">+'+tn+'</span>';
  else if(tn<0) tpe.innerHTML='今日：<span class="down">'+tn+'</span>';
  else tpe.textContent='今日：0';

  var sk=0;var dc=new Date();
  while(true){
    var ds=dc.getFullYear()+'-'+String(dc.getMonth()+1).padStart(2,'0')+'-'+String(dc.getDate()).padStart(2,'0');
    if(ad.records.some(function(r){return r.date===ds})){sk++;dc.setDate(dc.getDate()-1)}
    else break;
  }
  document.getElementById('ts').textContent=sk;

  var wb=document.getElementById('wb');wb.innerHTML='';
  var dl=['日','一','二','三','四','五','六'];
  // 近一周概览：滚动 7 天窗口（今天-6 ~ 今天），按时间正序排列，最右为今天
  var ws=new Date();ws.setDate(ws.getDate()-6);
  for(var i=0;i<7;i++){
    var dd2=new Date(ws);dd2.setDate(ws.getDate()+i);
    var ds2=dd2.getFullYear()+'-'+String(dd2.getMonth()+1).padStart(2,'0')+'-'+String(dd2.getDate()).padStart(2,'0');
    var dr2=ad.records.filter(function(r){return r.date===ds2});
    var upN=dr2.filter(function(r){return r.score>0}).reduce(function(s,r){return s+r.score},0);
    var dnN=dr2.filter(function(r){return r.score<0}).reduce(function(s,r){return s+Math.abs(r.score)},0);
    var dn=upN-dnN;
    // 底部色条：加分绿 / 扣分红 / 混合日黄
    var bar='';
    if(upN>0&&dnN>0)bar='var(--yellow)';
    else if(dn>0)bar='var(--green)';
    else if(dn<0)bar='var(--red)';
    // 净分数字：正分绿 / 负分红 / 0（含无记录日）次级灰，成为格子视觉主体
    var sTxt='0',sClr='var(--ink2)';
    if(dn>0){sTxt='+'+dn;sClr='var(--grn-deep)'}
    else if(dn<0){sTxt=String(dn);sClr='var(--red-deep)'}
    var d=document.createElement('div');
    var vd2=selectedDay||today(); // 视图日：红框跟随选中格，未选中时停在今天
    var lbl=(ds2===today())?'今天':dl[dd2.getDay()];
    d.className='sbd'+(vd2===ds2?' tdy':'');
    d.innerHTML='<span class="sdl">'+lbl+'</span><span class="sdd">'+dd2.getDate()+'</span><span class="sds" style="color:'+sClr+'">'+sTxt+'</span>'+(bar?'<i class="sdbar" style="background:'+bar+'"></i>':'');
    d.onclick=(function(ds){return function(){openDayDetail(ds)}})(ds2);
    wb.appendChild(d);
  }

  // 当日记录列表：视图日 = selectedDay || 今天，点击周概览某格即就地切换到那天的记录
  var vd=selectedDay||today();
  var vrecs=ad.records.filter(function(r){return r.date===vd});
  var vexs=ad.exchanges.filter(function(e){return e.date===vd});
  var vitems=[];
  for(var i=0;i<vrecs.length;i++) vitems.push({type:'record',data:vrecs[i]});
  for(var i=0;i<vexs.length;i++) vitems.push({type:'exchange',data:vexs[i]});
  vitems.sort(cmpTimeDesc);

  document.getElementById('trTitle').textContent=dayTitle(vd);
  document.getElementById('backToday').style.display=(vd!==today())?'':'none';

  var trl=document.getElementById('tr');
  if(vitems.length===0){
    trl.innerHTML=(vd===today())
      ?'<div class="es">'+esBricks()+'<div class="et">今天还没有记录哦</div><div class="eg">'+(sessionRole==='kid'?'家长记分后会同步显示在这里':'点击上方按钮开始加分吧！')+'</div></div>'
      :'<div class="es">'+esBricks()+'<div class="et">该日暂无记录</div></div>';
  }else{
    var html2='';
    for(var i=0;i<vitems.length;i++){
      if(vitems[i].type==='record') html2+=renderRecord(vitems[i].data,vd);
      else html2+=renderExchange(vitems[i].data,vd);
    }
    trl.innerHTML=html2;
  }

}

// 当日记录区块标题：视图日为今天 →「今日记录」；其他日子 →「当日记录 · X月X日 周X」
function dayTitle(ds){
  if(ds===today())return'今日记录';
  var p=ds.split('-');
  var d=new Date(ds);
  var w=['周日','周一','周二','周三','周四','周五','周六'];
  return '当日记录 · '+parseInt(p[1],10)+'月'+parseInt(p[2],10)+'日 '+w[d.getDay()];
}

// 记录列表通用排序：按发生日期(data.date)降序，同日期内按录入时间(timestamp)降序。
// 补签记录的 timestamp 是录入时刻而非发生日期，故必须先比 date 才符合用户视角的时间倒序；
// timestamp 缺失（旧版迁移数据）按 0 处理，避免 NaN 导致排序错乱。
function cmpTimeDesc(a,b){
  if(a.data.date!==b.data.date) return a.data.date<b.data.date?1:-1;
  return (b.data.timestamp||0)-(a.data.timestamp||0);
}

function renderRecord(r,currentDay,ro){
  var u=r.score>0;
  var cls=u?'u':'d';
  var sign=u?'+':'';
  var noteStr=r.note?(' · '+escHtml(r.note)):'';
  var timeStr=(r.date===currentDay)?fdt(r.timestamp):fd(r.date)+' '+fdt(r.timestamp);
  // 只读模式（报告明细）/孩子端只读 + 系统流水（答题奖励/打卡里程碑/补签卡/每日打卡奖励/全勤奖励）不可删除 → 均不渲染删除按钮
  var del=(ro||sessionRole==='kid'||r.itemId==='quiz_reward'||r.itemId==='quiz_streak_reward'||r.itemId==='quiz_card_buy'||r.itemId==='ck_reward'||r.itemId==='ck_bonus')?'':'<button class="dl" onclick="deleteRecord(\''+r.id+'\')">✕</button>';
  return '<div class="ri"><span class="cat-dot" style="background:'+catColor(r.category)+'"></span><div class="inf"><div class="nm">'+escHtml(r.name)+'</div><div class="tm">'+timeStr+noteStr+'</div></div><div class="sc2 '+cls+'">'+sign+r.score+'</div>'+del+'</div>';
}

function renderExchange(e,currentDay,ro){
  var timeStr=(e.date===currentDay)?fdt(e.timestamp):fd(e.date)+' '+fdt(e.timestamp);
  var noteStr=e.note?(' · '+escHtml(e.note)):'';
  // 来源标注：source==='kid_request' 显示蓝域「孩子申请」；家长直接兑换及无 source 的旧数据显示「兑换」
  var src=e.source==='kid_request'
    ?'<span class="ex-chip kid">孩子申请</span>'
    :'<span class="ex-chip">兑换</span>';
  // 只读模式（报告明细）/孩子端只读：不渲染删除按钮
  var del=(ro||sessionRole==='kid')?'':'<button class="dl" onclick="deleteExchange(\''+e.id+'\')">✕</button>';
  return '<div class="ri"><span class="cat-dot" style="background:var(--yellow)"></span><div class="inf"><div class="nm">'+escHtml(e.name)+'</div><div class="tm">'+timeStr+noteStr+'</div></div>'+src+'<div class="sc2 e">-'+e.cost+'</div>'+del+'</div>';
}

// ===== 家长端：删除兑换记录（退分 + 移除记录 + 联动删除关联申请单） =====
// 退分 = totalPoints += cost（记分删除 deleteRecord 的对称操作）。
// 若该兑换由孩子申请审批产生（source==='kid_request' 且含 requestId）：
// 先取最新 requests.json（取最新 sha）→ 移除对应申请单 → PUT 成功后才动本地桶，
// 保证 requests.json 与 sync-data.json 不出现半途状态；网络失败则整体中止。
// 无 requestId（家长直接兑换）只退分 + 移除记录，不触碰 requests.json。
// 孩子端无删除入口（renderExchange 只读守卫），此处再加角色守卫双保险。
function deleteExchange(id){
  if(sessionRole!=='parent')return;
  var ex=null;
  for(var i=0;i<ad.exchanges.length;i++){if(ad.exchanges[i].id===id){ex=ad.exchanges[i];break}}
  if(!ex)return;
  var hasReq=ex.source==='kid_request'&&!!ex.requestId;
  var msg='将删除该兑换记录并退还 '+ex.cost+' 分'+(hasReq?'；该兑换来自孩子申请，对应申请单将一并移除。':'。');
  sc2('删除兑换记录',msg,function(){
    var doLocal=function(){
      ad.totalPoints+=ex.cost; // 退分
      ad.exchanges=ad.exchanges.filter(function(x){return x.id!==id});
      if(!ad.del)ad.del={};
      ad.del['e:'+id]=Date.now(); // 删除墓碑：防止云端旧副本复活
      sd(ad);
      toast('已删除，退还 '+ex.cost+' 分','ok');
      render();
    };
    if(!hasReq){doLocal();return}
    // 关联申请单：先处理 requests.json，成功后再动本地桶
    if(reqBusy)return;
    reqBusy=true;
    toast('正在删除关联申请…');
    pullRequests().then(function(obj){
      if(obj===null){reqBusy=false;toast('网络异常，删除失败，请重试','err');return}
      var list=obj[currentUser]||[];
      obj[currentUser]=list.filter(function(q){return q.id!==ex.requestId});
      pushRequests(obj).then(function(ok){
        reqBusy=false;
        if(!ok){toast('申请单同步失败，请重试','err');return}
        doLocal();
      });
    });
  });
}

function renderRecords(){
  if(!dateRangeStart) dateRangeStart=today();
  if(!dateRangeEnd) dateRangeEnd=today();
  document.getElementById('dateTriggerText').textContent=dateRangeStart.replace(/-/g,'/')+' 至 '+dateRangeEnd.replace(/-/g,'/');

  // 类型筛选按钮
  var types=['所有','得分','扣分','兑换'];
  var typeHtml='';
  for(var i=0;i<types.length;i++){
    typeHtml+='<div class="ftb'+(curTypeFilter===types[i]?' on':'')+'" onclick="setTypeFilter(\''+types[i]+'\')">'+types[i]+'</div>';
  }
  document.getElementById('typeFilter').innerHTML=typeHtml;

  var allItems=[];
  for(var i=0;i<ad.records.length;i++){
    allItems.push({type:'record',data:ad.records[i]});
  }
  for(var i=0;i<ad.exchanges.length;i++){
    allItems.push({type:'exchange',data:ad.exchanges[i]});
  }

  if(curTypeFilter==='得分') allItems=allItems.filter(function(item){return item.type==='record'&&item.data.score>0});
  else if(curTypeFilter==='扣分') allItems=allItems.filter(function(item){return item.type==='record'&&item.data.score<0});
  else if(curTypeFilter==='兑换') allItems=allItems.filter(function(item){return item.type==='exchange'});

  if(dateRangeStart) allItems=allItems.filter(function(item){return item.data.date>=dateRangeStart});
  if(dateRangeEnd) allItems=allItems.filter(function(item){return item.data.date<=dateRangeEnd});

  allItems.sort(cmpTimeDesc);

  var ar=document.getElementById('ar');
  if(allItems.length===0) ar.innerHTML='<div class="es">'+esBricks()+'<div class="et">这个时间段还没有记录</div></div>';
  else{
    var html='';
    for(var i=0;i<allItems.length;i++){
      if(allItems[i].type==='record') html+=renderRecord(allItems[i].data,today());
      else html+=renderExchange(allItems[i].data,today());
    }
    ar.innerHTML=html;
  }
}

function saveWish(){ // 家长端设置孩子愿望/目标（存账本，随同步到孩子端）
  if(sessionRole!=='parent'){toast('仅家长端可设置','err');return}
  var name=document.getElementById('wishName').value.trim();
  var cost=parseInt(document.getElementById('wishCost').value,10)||0;
  if(!name||cost<=0){toast('请填写目标名称和积分','err');return}
  ad.wish={name:name,cost:cost};
  sd(ad);
  render();
  toast('愿望已保存，孩子端可见','ok');
}
function renderSettings(){
  if(sessionRole==='kid')return; // 孩子端不渲染设置页（含云端 token，绝不让孩子看到）
  document.getElementById('upCnt').textContent=ad.upItems.length+' 项';
  document.getElementById('downCnt').textContent=ad.downItems.length+' 项';
  document.getElementById('shopCnt').textContent=ad.shopItems.length+' 项';
  renderSyncSettings();
  // 家长 PIN 状态行
  var ps=document.getElementById('pinStateLine');
  if(ps){
    var pb=loadBucket(currentUser);
    var hasPin=!!(pb&&pb.pinHash);
    ps.innerHTML='<span class="sync-dot '+(hasPin?'ok':'off')+'"></span><span class="sync-line-t">'+(hasPin?'已设置 PIN，家长端受保护':'未设置，下次进入家长端时将要求设置')+'</span>';
  }

  document.getElementById('sui').innerHTML=renderGroupedItems(ad.upItems,'up','up_main');
  document.getElementById('sdi').innerHTML=renderGroupedItems(ad.downItems,'down','down_main');

  var html='';
  for(var i=0;i<ad.shopItems.length;i++){
    var it=ad.shopItems[i];
    html+='<div class="sr"><span class="n">'+escHtml(it.name)+'</span><span class="s e">-'+it.cost+'分</span><button class="ed" onclick="editShopItem(\''+it.id+'\')">✎</button><button class="x" onclick="deleteItem(\'shop\',\''+it.id+'\')">✕</button></div>';
  }
  document.getElementById('ssi').innerHTML=html;

  // 恢复主分组展开状态（照 v3：按 .sec 序号回填 open 类）
  var sections=[
    {idx:1,stateKey:'up_main'},
    {idx:2,stateKey:'down_main'},
    {idx:3,stateKey:'shop_main'}
  ];
  for(var i=0;i<sections.length;i++){
    var sec=sections[i];
    var sgh=document.querySelector('#p-settings .sec:nth-child('+sec.idx+') .sg .sgh');
    var sgc=document.querySelector('#p-settings .sec:nth-child('+sec.idx+') .sg .sgc');
    if(sgh&&sgc){
      var isOpen=sectionState[sec.stateKey]===true;
      if(isOpen){sgh.classList.add('open');sgc.classList.add('open')}
      else{sgh.classList.remove('open');sgc.classList.remove('open')}
    }
  }
}

// 设置页行列表：照 v3——按分类再分组，每个分类小节可展开/收缩
// 状态存内存 sectionState[stateKey+'_'+cat]（刷新重置，不用 localStorage）
function renderGroupedItems(items,type,stateKey){
  var groups={};
  var order=[];
  for(var i=0;i<items.length;i++){
    var c=items[i].category;
    if(!groups[c]){groups[c]=[];order.push(c)}
    groups[c].push(items[i]);
  }
  var html='';
  for(var j=0;j<order.length;j++){
    var cat=order[j];
    var isOpen=sectionState[stateKey+'_'+cat]===true;
    html+='<div class="sg sg-sub">';
    html+='<div class="sgh'+(isOpen?' open':'')+'" onclick="toggleSection(this,\''+stateKey+'_'+cat+'\')">';
    html+='<div class="sgt"><span class="cat-dot" style="background:'+catColor(cat)+'" aria-hidden="true"></span>'+cat+'<span class="cnt">('+groups[cat].length+'项)</span></div>';
    html+='<span class="arr" aria-hidden="true"></span>';
    html+='</div>';
    html+='<div class="sgc'+(isOpen?' open':'')+'">';
    for(var k=0;k<groups[cat].length;k++){
      var it=groups[cat][k];
      var sign=type==='up'?'+':'-';
      html+='<div class="sr"><span class="n">'+escHtml(it.name)+'</span><span class="s '+(type==='up'?'u':'d')+'">'+sign+it.score+'</span><button class="ed" onclick="editItem(\''+type+'\',\''+it.id+'\')">✎</button><button class="x" onclick="deleteItem(\''+type+'\',\''+it.id+'\')">✕</button></div>';
    }
    html+='</div></div>';
  }
  return html;
}

// 折叠切换（照 v3）：切头与内容的 open 类，状态记入内存 sectionState
function toggleSection(header,stateKey){
  var content=header.nextElementSibling;
  header.classList.toggle('open');
  content.classList.toggle('open');
  if(stateKey){
    sectionState[stateKey]=header.classList.contains('open');
  }
}

function setTypeFilter(t){curTypeFilter=t;renderRecords()}

function openScore(){
  if(sessionRole==='kid')return; // 孩子端只读守卫（按钮已隐藏，双保险）
  scoreType='up';
  updateSeg();
  var dateInput=document.getElementById('sdate');
  // 选中日联动：点击过周概览某天且不晚于今天 → 默认该天（补签）；未来日子或未点击 → 默认今天
  var dv=today();
  if(selectedDay && selectedDay<=today()) dv=selectedDay;
  dateInput.value=dv;
  dateInput.min=minRecordDate();
  dateInput.max=today();
  populateCats();
  document.getElementById('sn').value='';
  document.getElementById('sv').value=''; // 统一分值留空=按各项预设分
  document.getElementById('ms').classList.add('show');
}

function setScoreType(type){
  scoreType=type;
  updateSeg();
  populateCats();
}

function updateSeg(){
  document.getElementById('segUp').classList.toggle('on',scoreType==='up');
  document.getElementById('segDown').classList.toggle('on',scoreType==='down');
}

// 补签最早可选日期：今天往前 6 天（含今天共 7 天）
function populateCats(){ // 渲染按分类分组的可多选项目列表（一次勾选多项，无需逐级选择）
  var items=scoreType==='up'?ad.upItems:ad.downItems;
  var cats=[],catSet={},groups={};
  for(var i=0;i<items.length;i++){
    var c=items[i].category||'其他';
    if(!catSet[c]){catSet[c]=true;cats.push(c);groups[c]=[]}
    groups[c].push(items[i]);
  }
  var h='';
  for(var k=0;k<cats.length;k++){
    h+='<div class="scat-g"><div class="scat-t"><span class="cat-dot" style="background:'+catColor(cats[k])+'"></span>'+escHtml(cats[k])+'</div><div class="scat-items">';
    var g=groups[cats[k]];
    for(var j=0;j<g.length;j++){
      var it=g[j],unitStr=it.unit?('/'+it.unit):'';
      h+='<label class="schip"><input type="checkbox" value="'+escHtml(it.id)+'" onchange="this.parentNode.classList.toggle(\'on\',this.checked)"><span>'+escHtml(it.name)+'<b>'+(scoreType==='up'?'+':'-')+it.score+'分'+escHtml(unitStr)+'</b></span></label>';
    }
    h+='</div></div>';
  }
  document.getElementById('sitems').innerHTML=h||'<div class="ck-cfg-tip">暂无可选项</div>';
}

function ss(){ // 批量记录：每个勾选项各记一笔（统一分值留空则按各项预设分），展示与单条记录完全一致
  var cbs=document.querySelectorAll('#sitems input:checked');
  if(!cbs.length){toast('请先勾选要记录的项目','err');return}
  var svRaw=document.getElementById('sv').value.trim();
  var svOverride=svRaw===''?0:(parseInt(svRaw,10)||0);
  if(svOverride<0){toast('分值不能为负','err');return}
  var sn=document.getElementById('sn').value.trim();
  var dateInput=document.getElementById('sdate');
  var recDate=dateInput.value||today();
  if(recDate>today()){toast('日期不能晚于今天','err');return}
  if(recDate<minRecordDate()){toast('只能补录最近7天内的记录','err');return}
  var items=scoreType==='up'?ad.upItems:ad.downItems;
  var n=0,total=0,ts=Date.now();
  for(var i=0;i<cbs.length;i++){
    var it=null;
    for(var j=0;j<items.length;j++){if(items[j].id===cbs[i].value){it=items[j];break}}
    if(!it)continue;
    var sv=svOverride>0?svOverride:it.score;
    if(!(sv>0))continue;
    var sc=scoreType==='up'?sv:-sv;
    ad.records.push({id:'r_'+ts+'_'+i,date:recDate,timestamp:ts+i,type:scoreType,itemId:it.id,name:it.name,category:it.category,score:sc,note:sn});
    ad.totalPoints+=sc;
    n++;total+=sv;
  }
  if(!n){toast('没有可记录的项目','err');return}
  sd(ad);
  document.getElementById('ms').classList.remove('show');
  toast((scoreType==='up'?'加分':'扣分')+' '+n+' 项，共 '+(scoreType==='up'?'+':'-')+total+' 分',scoreType==='up'?'ok':'err');
  render();
}

function openExchange(){
  if(sessionRole==='kid')return; // 孩子端只读守卫
  document.getElementById('exScore').textContent=ad.totalPoints;
  var html='';
  for(var i=0;i<ad.shopItems.length;i++){
    var it=ad.shopItems[i];
    var ca=ad.totalPoints>=it.cost;
    html+='<option value="'+it.id+'" data-cost="'+it.cost+'" '+(ca?'': 'disabled')+'>'+escHtml(it.name)+' (-'+it.cost+'分)</option>';
  }
  if(!html) html='<option value="">没有可兑换项</option>';
  document.getElementById('exSelect').innerHTML=html;
  var exBtn=document.getElementById('exConfirm');
  var anyFit=ad.shopItems.some(function(it){return ad.totalPoints>=it.cost});
  if(anyFit){
    exBtn.disabled=false;
    // 初始显式选中第一个可用项（disabled 首项会导致 selectedIndex=-1，cost 无法填充）
    var selEl=document.getElementById('exSelect');
    for(var j=0;j<selEl.options.length;j++){
      if(!selEl.options[j].disabled){selEl.selectedIndex=j;break}
    }
    onExSelectChange();
  }else{
    // 积分不足：按钮置 disabled（禁用视觉 .bn:disabled）；confirmExchange 内的 guard 保留兜底
    exBtn.disabled=true;
    document.getElementById('exCost').textContent='积分不足，暂无可兑换项';
  }
  document.getElementById('ms2').classList.add('show');
}

function onExSelectChange(){
  var sel=document.getElementById('exSelect');
  var opt=sel.options[sel.selectedIndex];
  if(opt&&opt.dataset.cost) document.getElementById('exCost').textContent=opt.dataset.cost+' 分';
  else document.getElementById('exCost').textContent='';
}

function confirmExchange(){
  if(sessionRole!=='parent')return; // 孩子端只能「申请兑换」，由家长审批扣分
  var sel=document.getElementById('exSelect');
  var itemId=sel.value;
  if(!itemId){toast('请选择兑换项','err');return}
  var it=null;
  for(var i=0;i<ad.shopItems.length;i++){if(ad.shopItems[i].id===itemId){it=ad.shopItems[i];break}}
  if(!it||ad.totalPoints<it.cost){toast('积分不足','err');return}
  sc2('确认兑换','用 '+it.cost+' 积分兑换「'+it.name+'」？',function(){
    ad.totalPoints-=it.cost;
    ad.exchanges.push({id:'ex_'+Date.now(),date:today(),timestamp:Date.now(),shopItemId:itemId,name:it.name,icon:it.icon,cost:it.cost});
    sd(ad);
    toast('兑换成功，剩余 '+ad.totalPoints+' 分','ok');
    document.getElementById('ms2').classList.remove('show');
    render();
  });
}

function deleteRecord(id){
  if(sessionRole!=='parent')return; // 孩子端不可删除记录（UI 已隐藏按钮，函数层双保险）
  var r=null;
  for(var i=0;i<ad.records.length;i++){if(ad.records[i].id===id){r=ad.records[i];break}}
  if(!r)return;
  // 系统流水不可删除：答题奖励 / 连续打卡里程碑奖励 / 购买补签卡 / 每日打卡确认奖励 / 全勤奖励
  // （删除会破坏对应业务状态：奖励已发放、打卡已达成、补签卡已入库，故一律拦截）
  if(r.itemId==='quiz_reward'||r.itemId==='quiz_streak_reward'||r.itemId==='quiz_card_buy'||r.itemId==='ck_reward'||r.itemId==='ck_bonus'||r.itemId==='ck_must'||r.itemId==='ck_must_bonus'||r.itemId==='ck_makeup'||r.itemId==='ck_blindbox'){toast('系统积分流水不可删除','err');return}
  var sign=r.score>0?'+':'';
  var action=r.score>0?'减少':'增加';
  sc2('删除记录','删除「'+r.name+'」('+sign+r.score+'分)？总分将'+action+Math.abs(r.score)+'分。',function(){
    ad.totalPoints-=r.score;
    ad.records=ad.records.filter(function(x){return x.id!==id});
    if(!ad.del)ad.del={};
    ad.del['r:'+id]=Date.now(); // 删除墓碑：防止云端旧副本在下次合并时复活
    sd(ad);
    toast('已删除');
    render();
  });
}

// ===== 周概览点击 → 首页「当日记录」就地切换 =====
function openDayDetail(ds){
  // 点「今天」的格子即回到今天视图（清除选中）
  selectedDay=(ds===today())?null:ds;
  renderHome();
}

// 回到今天：清除选中日并恢复今日视图
function goToday(){
  selectedDay=null;
  renderHome();
}

function sam(type){
  if(sessionRole==='kid')return; // 孩子端只读守卫
  if(type==='shop'){
    document.getElementById('amt3').textContent='添加兑换项';
    document.getElementById('editShopId').value='';
    document.getElementById('s3n').value='';
    document.getElementById('s3c').value='50';
    document.getElementById('s3i').value='';
    document.getElementById('s3d').value='';
    document.getElementById('ms3').classList.add('show');
  }else{
    document.getElementById('amt').textContent=type==='up'?'添加加分项':'添加扣分项';
    document.getElementById('editId').value='';
    document.getElementById('an').value='';
    document.getElementById('asc').value='5';
    document.getElementById('ma').classList.add('show');
  }
}

function editItem(type,id){
  var items=type==='up'?ad.upItems:ad.downItems;
  var it=null;
  for(var i=0;i<items.length;i++){if(items[i].id===id){it=items[i];break}}
  if(!it)return;
  document.getElementById('amt').textContent='编辑项目';
  document.getElementById('editId').value=id;
  document.getElementById('an').value=it.name;
  document.getElementById('asc').value=it.score;
  document.getElementById('acat').value=it.category;
  document.getElementById('ma').classList.add('show');
}

function editShopItem(id){
  var it=null;
  for(var i=0;i<ad.shopItems.length;i++){if(ad.shopItems[i].id===id){it=ad.shopItems[i];break}}
  if(!it)return;
  document.getElementById('amt3').textContent='编辑兑换项';
  document.getElementById('editShopId').value=id;
  document.getElementById('s3n').value=it.name;
  document.getElementById('s3c').value=it.cost;
  document.getElementById('s3i').value=it.icon;
  document.getElementById('s3d').value=it.desc||'';
  document.getElementById('ms3').classList.add('show');
}

function sai(){
  var n=document.getElementById('an').value.trim();
  var scv=parseInt(document.getElementById('asc').value)||0;
  var cat=document.getElementById('acat').value;
  if(!n){toast('请输入名称','err');return}
  if(scv<=0){toast('分值必须大于0','err');return}
  var editId=document.getElementById('editId').value;
  if(editId){
    // 编辑模式
    var items=ad.upItems.concat(ad.downItems);
    for(var i=0;i<items.length;i++){
      if(items[i].id===editId){
        items[i].name=n;items[i].score=scv;items[i].category=cat;break;
      }
    }
  }else{
    var isUp=document.getElementById('amt').textContent.indexOf('加分')>=0;
    var t=isUp?ad.upItems:ad.downItems;
    t.push({id:(isUp?'up_':'down_')+Date.now(),name:n,score:scv,category:cat});
  }
  sd(ad);
  document.getElementById('ma').classList.remove('show');
  toast('保存成功','ok');
  render();
}

function sasi(){
  var n=document.getElementById('s3n').value.trim();
  var c=parseInt(document.getElementById('s3c').value)||0;
  var ic=document.getElementById('s3i').value.trim()||'🎁';
  var d=document.getElementById('s3d').value.trim();
  if(!n){toast('请输入名称','err');return}
  if(c<=0){toast('积分必须大于0','err');return}
  var editId=document.getElementById('editShopId').value;
  if(editId){
    for(var i=0;i<ad.shopItems.length;i++){
      if(ad.shopItems[i].id===editId){
        ad.shopItems[i].name=n;ad.shopItems[i].cost=c;ad.shopItems[i].icon=ic;ad.shopItems[i].desc=d;break;
      }
    }
  }else{
    ad.shopItems.push({id:'shop_'+Date.now(),name:n,cost:c,icon:ic,desc:d});
  }
  sd(ad);
  document.getElementById('ms3').classList.remove('show');
  toast('保存成功','ok');
  render();
}

function deleteItem(type,id){
  var lb={up:'加分项',down:'扣分项',shop:'兑换项'};
  sc2('删除'+lb[type],'确定删除这个'+lb[type]+'吗？',function(){
    if(type==='up') ad.upItems=ad.upItems.filter(function(i){return i.id!==id});
    else if(type==='down') ad.downItems=ad.downItems.filter(function(i){return i.id!==id});
    else ad.shopItems=ad.shopItems.filter(function(i){return i.id!==id});
    sd(ad);
    toast('已删除');
    render();
  });
}

function ccd(){
  if(sessionRole!=='parent')return; // 清除所有数据仅家长端可用
  sc2('清除所有数据','这将删除所有积分记录、兑换记录和自定义项目，总分归零。确定要继续吗？',function(){
    ad=gd();sd(ad);toast('数据已清除');render();
  });
}

function cm(id){document.getElementById(id).classList.remove('show')}
var overlays=document.querySelectorAll('.mo');
for(var i=0;i<overlays.length;i++){
  overlays[i].addEventListener('click',function(e){if(e.target===this&&this.id!=='mPin')this.classList.remove('show')}); // 首次设 PIN 强制完成，遮罩点击不关闭
}

// ===== 兑换申请审批流（云端 requests.json，独立于 sync-data.json） =====
// 云端文件结构：{ 家长手机号: [{id,kidName,shopItemId,itemName,icon,cost,note,
//   status:'pending'|'approved'|'rejected',createdTime,handledTime}] }
// 安全边界：孩子端只读写 requests.json（pullRequests/pushRequests），
// 绝不 PUT 家长的 sync-data.json（syncPush 的 kid 守卫保持不变）。
var GH_REQ_FILE='requests.json';
var GH_REQ_API='https://api.github.com/repos/'+GH_REPO+'/contents/'+GH_REQ_FILE;
var reqSHA='';       // requests.json 当前 sha（PUT 必带，409=他人已写需重拉）
var pendingReqs=[];  // 家长端：待审批申请（驱动首页提醒条）
var approvalList=[]; // 家长端：审批弹窗当前全量列表
var reqBusy=false;   // 提交/审批请求进行中防抖
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function fmtTs(ts){var d=new Date(ts);return (d.getMonth()+1)+'月'+d.getDate()+'日 '+fdt(ts)}
function sessionNickname(){var s=readKidSession();return (s&&s.nickname)||'孩子'}
// 拉取 requests.json：404=空对象（新用户无申请，正常态）；
// 网络/权限失败返回 null（调用方按失败处理，绝不用空对象覆盖云端）。
// 注意：不触碰全局 syncStatus（与 sync-data.json 状态机解耦）。
function pullRequests(){
  var token=getSyncToken();
  if(!token)return Promise.resolve(null);
  return ghApiGet(GH_REQ_API)
    .then(function(g){
      reqSHA=g.sha||'';
      return g.obj||{}; /* 404 → 空对象（新用户无申请，正常态） */
    })
    .catch(function(){return null}); /* 网络/权限失败返回 null：调用方按失败处理，绝不用空对象覆盖云端 */
}
// 整体写入 requests.json（last-write-wins，家庭规模可接受）
function pushRequests(obj){
  var token=getSyncToken();
  if(!token)return Promise.resolve(false);
  /* 只保留 pending 的申请上云：已处理（通过/拒绝）的申请物理删除，避免 requests.json 无限堆积 */
  var clean={};
  for(var ph in obj){
    var arr=obj[ph];
    if(Object.prototype.toString.call(arr)==='[object Array]'){
      var kept=arr.filter(function(q){return q&&q.status==='pending'});
      if(kept.length)clean[ph]=kept;
    }
  }
  obj=clean;
  /* 整体写入（last-write-wins，家庭规模可接受）：先取最新 sha 再写，避免 sha 冲突 */
  return ghApiGet(GH_REQ_API)
    .then(function(g){ return ghApiPut(GH_REQ_API,obj,g.sha,'sync:requests'); })
    .then(function(p){ return !!p.ok; })
    .catch(function(){return false});
}

// ===== 孩子端：积分商城页渲染 =====
// 数据来源：家长桶（totalPoints/shopItems，经 syncPull 只读缓存）。
// 积分不足的项置灰但保留「申请兑换」入口（孩子先申请、家长审批时校验积分）。
function renderShopKid(){
  if(sessionRole!=='kid')return;
  var pts=document.getElementById('kShopPts');
  if(pts){
    pts.textContent=ad.totalPoints;
    pts.classList.toggle('zero',!ad.totalPoints);
  }
  var box=document.getElementById('kShopList');
  if(!box)return;
  if(!ad.shopItems.length){
    box.innerHTML='<div class="es" style="padding:16px 0">'+esBricks()+'<div class="et">暂无奖励项</div><div class="eg">请让家长在兑换项管理中添加</div></div>';
    return;
  }
  var html='';
  for(var i=0;i<ad.shopItems.length;i++){
    var it=ad.shopItems[i];
    var enough=ad.totalPoints>=it.cost;
    var desc=it.desc?escHtml(it.desc)+' · ':'';
    html+='<div class="ri'+(enough?'':' req-done')+'">'
      +'<span class="cat-dot" style="background:var(--yellow)"></span>'
      +'<div class="inf"><div class="nm">'+escHtml(it.name)+'</div>'
      +'<div class="tm">'+desc+(enough?'当前积分可兑换':'积分不足，仍可申请')+'</div></div>'
      +'<div class="sc2 e">-'+it.cost+'</div>'
      +'<button class="ap-btn ok" onclick="openReqModal(\''+it.id+'\')">申请兑换</button></div>';
  }
  box.innerHTML=html;
}

// —— 孩子端：提交申请（写 requests.json，由家长端审批展示） ——
// preId 可选：从商城页某项「申请兑换」进入时预选该项
function openReqModal(preId){
  if(sessionRole!=='kid')return; // 只读守卫：家长端不走此入口
  var sel=document.getElementById('reqItem');
  var html='';
  for(var i=0;i<ad.shopItems.length;i++){
    var it=ad.shopItems[i];
    html+='<option value="'+it.id+'" data-cost="'+it.cost+'">'+escHtml(it.name)+' (-'+it.cost+'分)</option>';
  }
  if(!html)html='<option value="">暂无奖励项，请让家长先配置</option>';
  sel.innerHTML=html;
  if(preId){
    var has=false;
    for(var j=0;j<sel.options.length;j++){if(sel.options[j].value===preId){has=true;break}}
    if(has)sel.value=preId; // 项已被家长删除时保持默认选中，避免静默错选
  }
  document.getElementById('reqNote').value='';
  onReqSelectChange();
  document.getElementById('mReq').classList.add('show');
}
function onReqSelectChange(){
  var sel=document.getElementById('reqItem');
  var opt=sel.options[sel.selectedIndex];
  document.getElementById('reqCost').textContent=(opt&&opt.dataset.cost)?(opt.dataset.cost+' 分'):'';
}
function submitRequest(){
  if(reqBusy||sessionRole!=='kid')return;
  var sel=document.getElementById('reqItem');
  var it=null;
  for(var i=0;i<ad.shopItems.length;i++){if(ad.shopItems[i].id===sel.value){it=ad.shopItems[i];break}}
  if(!it){toast('暂无奖励项，请让家长先配置','err');return}
  var note=document.getElementById('reqNote').value.trim();
  reqBusy=true;
  var btn=document.getElementById('reqSubmit');
  btn.disabled=true;
  toast('正在提交申请…');
  pullRequests().then(function(obj){
    if(obj===null){ // 网络失败：不动云端，避免误创建覆盖
      reqBusy=false;btn.disabled=false;
      toast('网络异常，提交失败，请重试','err');
      return;
    }
    var list=obj[currentUser]||[];
    list.unshift({id:'rq_'+Date.now(),kidName:sessionNickname(),shopItemId:it.id,itemName:it.name,icon:it.icon||'',cost:it.cost,note:note,status:'pending',createdTime:Date.now(),handledTime:null});
    obj[currentUser]=list;
    pushRequests(obj).then(function(ok){
      reqBusy=false;btn.disabled=false;
      if(ok){
        cm('mReq');
        toast('已提交申请，等待家长审批','ok');
      }else{
        toast('提交失败，请重试','err');
      }
    });
  });
}

// —— 家长端：待审批提醒 & 审批 ——
// 登录/切页签时调用：拉取申请，刷新首页提醒条
function checkRequests(){
  if(sessionRole!=='parent')return;
  pullRequests().then(function(obj){
    if(obj===null)return; // 拉取失败：保持现状，不打扰
    pendingReqs=(obj[currentUser]||[]).filter(function(q){return q.status==='pending'});
    renderReqAlert();
  });
}
function renderReqAlert(){
  var el=document.getElementById('reqAlert');
  if(!el)return;
  if(sessionRole!=='parent'||!pendingReqs.length){el.style.display='none';return}
  el.style.display='';
  el.textContent='有 '+pendingReqs.length+' 条兑换申请待审批 ›';
}
function openApproval(){
  if(sessionRole!=='parent')return;
  document.getElementById('mReqAp').classList.add('show');
  loadApproval();
}
function loadApproval(){
  if(sessionRole!=='parent')return;
  pullRequests().then(function(obj){
    if(obj===null){toast('网络异常，加载失败','err');return}
    approvalList=obj[currentUser]||[];
    pendingReqs=approvalList.filter(function(q){return q.status==='pending'});
    renderApproval();
    renderReqAlert();
  });
}
function renderApproval(){
  var box=document.getElementById('reqApList');
  if(!box)return;
  var list=(approvalList||[]).slice().sort(function(a,b){return (b.createdTime||0)-(a.createdTime||0)});
  var pend=list.filter(function(q){return q.status==='pending'});
  var done=list.filter(function(q){return q.status!=='pending'});
  var html='';
  if(!pend.length){
    html+='<div class="es" style="padding:16px 0">'+esBricks()+'<div class="et">暂无待审批申请</div></div>';
  }
  for(var i=0;i<pend.length;i++){
    var q=pend[i];
    html+='<div class="ri" style="flex-wrap:wrap"><span class="cat-dot" style="background:var(--yellow)"></span>'
      +'<div class="inf"><div class="nm">'+escHtml(q.kidName||'孩子')+' · '+escHtml(q.itemName)+'</div>'
      +'<div class="tm">'+fmtTs(q.createdTime)+(q.note?(' · '+escHtml(q.note)):'')+'</div></div>'
      +'<div class="sc2 e">-'+q.cost+'</div>'
      +'<div style="width:100%;display:flex;gap:8px;justify-content:flex-end;margin-top:6px">'
      +'<button class="ap-btn ok" onclick="approveRequest(\''+q.id+'\')">通过</button>'
      +'<button class="ap-btn no" onclick="rejectRequest(\''+q.id+'\')">拒绝</button>'
      +'</div></div>';
  }
  if(done.length)html+='<div class="sec-h" style="margin-top:16px"><div class="st-t">已处理</div></div>';
  for(var j=0;j<done.length;j++){
    var d2=done[j];
    var chip=d2.status==='approved'?'<span class="rq-chip a">已通过</span>':'<span class="rq-chip r">已拒绝</span>';
    html+='<div class="ri req-done"><span class="cat-dot" style="background:var(--ink3)"></span>'
      +'<div class="inf"><div class="nm">'+escHtml(d2.kidName||'孩子')+' · '+escHtml(d2.itemName)+'</div>'
      +'<div class="tm">'+fmtTs(d2.handledTime||d2.createdTime)+'</div></div>'+chip+'</div>';
  }
  box.innerHTML=html;
}
// 通过：校验积分 → 先更新 requests.json 状态，成功后再本地扣分 + 兑换记录 + 桶同步
function approveRequest(id){
  if(sessionRole!=='parent'||reqBusy)return;
  reqBusy=true;
  toast('正在处理…');
  pullRequests().then(function(obj){
    if(obj===null){reqBusy=false;toast('网络异常，操作失败，请重试','err');return}
    var list=obj[currentUser]||[];
    var hit=null;
    for(var i=0;i<list.length;i++){if(list[i].id===id&&list[i].status==='pending'){hit=list[i];break}}
    if(!hit){reqBusy=false;toast('该申请已处理或不存在','err');loadApproval();return}
    if(ad.totalPoints<hit.cost){reqBusy=false;toast('积分不足，无法通过该申请','err');return}
    hit.status='approved';
    hit.handledTime=Date.now();
    pushRequests(obj).then(function(ok){
      reqBusy=false;
      if(!ok){toast('同步失败，请重试','err');return}
      // 云端状态已落定：本地扣分 + 生成兑换记录（走现有 sd 同步家长桶）
      // 新增 source/requestId：来源标注 + 关联申请单（家长删除兑换时联动清理）
      ad.totalPoints-=hit.cost;
      ad.exchanges.push({id:'ex_'+Date.now(),date:today(),timestamp:Date.now(),shopItemId:hit.shopItemId||'',name:hit.itemName,icon:hit.icon||'',cost:hit.cost,note:hit.note||'',source:'kid_request',requestId:hit.id});
      sd(ad);
      toast('已通过申请，扣除 '+hit.cost+' 分','ok');
      render();
      loadApproval();
    });
  });
}
// 拒绝：仅更新 requests.json 状态，积分与记录无任何变化
function rejectRequest(id){
  if(sessionRole!=='parent'||reqBusy)return;
  reqBusy=true;
  toast('正在处理…');
  pullRequests().then(function(obj){
    if(obj===null){reqBusy=false;toast('网络异常，操作失败，请重试','err');return}
    var list=obj[currentUser]||[];
    var hit=null;
    for(var i=0;i<list.length;i++){if(list[i].id===id&&list[i].status==='pending'){hit=list[i];break}}
    if(!hit){reqBusy=false;toast('该申请已处理或不存在','err');loadApproval();return}
    hit.status='rejected';
    hit.handledTime=Date.now();
    pushRequests(obj).then(function(ok){
      reqBusy=false;
      if(!ok){toast('同步失败，请重试','err');return}
      toast('已拒绝该申请');
      loadApproval();
    });
  });
}



// ===== 学习报告（#8）：周/月积分趋势（纯 CSS 柱状）+ 加分构成 + 刷题打卡与兑换统计 =====
var reportRange='week'; // 'week' | 'month' | 'year' | 'custom'（内存态，刷新重置）
var rdStart=''; // 当前报告范围起点（YYYY-MM-DD），明细弹窗按此过滤
var rdEnd='';   // 当前报告范围终点（明细弹窗过滤上限），空=今天
var reportCustom={start:'',end:''}; // 自定义统计区间（内存态）
function rdEndDate(){return rdEnd||today()}
function setReportRange(r){ // custom 打开区间选择弹窗，确认后再渲染；其余直接切换渲染
  if(r!=='week'&&r!=='month'&&r!=='year'&&r!=='custom')r='week';
  reportRange=r;
  if(r==='custom'){openReportCustom();return}
  renderReport();
}
function openReportCustom(){ // 回填当前自定义区间（默认本年 1/1 ~ 今天）
  var d=new Date(),f=function(x){return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  var defStart=reportCustom.start||d.getFullYear()+'-01-01';
  var defEnd=reportCustom.end||f(d);
  document.getElementById('rcStart').value=defStart;
  document.getElementById('rcEnd').value=defEnd;
  document.getElementById('mReportCustom').classList.add('show');
}
function applyReportCustom(){
  var s=document.getElementById('rcStart').value,e=document.getElementById('rcEnd').value;
  if(!s||!e){toast('请选择开始和结束日期','err');return}
  if(s>e){toast('开始日期不能晚于结束日期','err');return}
  reportCustom={start:s,end:e};
  cm('mReportCustom');
  renderReport();
}
function renderReportTabs(){
  var el=document.getElementById('reportRangeTabs');
  if(!el)return;
  var defs=[['week','本周'],['month','本月'],['year','本年'],['custom','自定义']];
  var h='';
  for(var i=0;i<defs.length;i++){
    h+='<div class="ftb'+(reportRange===defs[i][0]?' on':'')+'" onclick="setReportRange(\''+defs[i][0]+'\')">'+defs[i][1]+'</div>';
  }
  el.innerHTML=h;
}
// —— 报告构成辅助：识别系统奖励/系统扣费（老版本答题流水无 itemId，需按记录名兜底识别）——
function rdIsQuizReward(r){var iid=r.itemId||'',nm=r.name||'';return iid==='quiz_reward'||iid==='quiz_streak_reward'||nm==='答题获取'||nm.indexOf('连续刷题')===0}
function rdIsCkReward(r){var iid=r.itemId||'';return iid==='ck_reward'||iid==='ck_bonus'||iid==='ck_makeup'||iid==='ck_must_bonus'} /* 打卡类奖励：确认/全勤/必打卡档/补卡，报告里合并为一项 */
function rdIsSystem(r){return rdIsQuizReward(r)||rdIsCkReward(r)||r.itemId==='quiz_card_buy'}
function rdSortDesc(recs){ // 明细统一排序：日期倒序，同日按时间倒序
  recs.sort(function(a,b){return a.date===b.date?((b.timestamp||0)-(a.timestamp||0)):(a.date<b.date?1:-1)});
  return recs;
}
function kidAchieveCard(){ // 孩子端报告顶部「我的成就」：本周星数 / 连续打卡 / 等级 / 累计星数（成就感视角）
  var start=new Date();start.setDate(start.getDate()-6);
  var f=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  var startStr=f(start);
  var recs=(ad.records||[]).filter(function(r){return r.date>=startStr});
  var up=recs.filter(function(r){return r.score>0}).reduce(function(s,r){return s+r.score},0);
  return '<div class="sec" style="margin-top:16px"><div class="sec-h"><div class="st-t">我的成就</div></div>'
    +'<div class="qs rp-grid">'
    +'<div class="sc"><div class="sv num" style="color:var(--green)">+'+up+'</div><div class="sl">本周获得</div></div>'
    +'<div class="sc"><div class="sv num">'+ckStreak()+'</div><div class="sl">连续打卡</div></div>'
    +'</div></div>';
}
function renderReport(){
  var body=document.getElementById('reportBody');
  if(!body)return;
  renderReportTabs();
  if(!ad){body.innerHTML='';return} // 孩子端开放只读查看：数据来自家长桶（syncPull 已拉取）
  // 计算日期范围（custom 用自定义区间，其余快捷区间终点=今天）
  var startD=new Date();
  if(reportRange==='week')startD.setDate(startD.getDate()-6);
  else if(reportRange==='year')startD=new Date(startD.getFullYear(),0,1);
  else if(reportRange==='custom'&&reportCustom.start){var ps=new Date(reportCustom.start+'T00:00:00');if(!isNaN(ps))startD=ps}
  else startD.setDate(1);
  var f=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  var endD=new Date();
  if(reportRange==='custom'&&reportCustom.end){var pe=new Date(reportCustom.end+'T00:00:00');if(!isNaN(pe))endD=pe}
  var startStr=f(startD),endStr=f(endD);
  if(startStr>endStr){var tmpS=startStr;startStr=endStr;endStr=tmpS} // 兜底倒挂
  rdStart=startStr;rdEnd=endStr; // 明细弹窗按此区间过滤
  // 净分序列：跨度>62天按月聚合（本年/长自定义），否则逐日
  var spanDays=Math.round((new Date(endStr+'T00:00:00')-new Date(startStr+'T00:00:00'))/86400000)+1;
  var byMonth=spanDays>62;
  var dl2=[],netBy={},guard=0;
  (function(){var d=new Date(startStr+'T00:00:00');
    while(guard++<400){
      var key=byMonth?(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')):f(d);
      if(dl2.indexOf(key)<0)dl2.push(key);
      var last=byMonth?(key>=endStr.slice(0,7)):(key>=endStr);
      if(last)break;
      if(byMonth)d.setMonth(d.getMonth()+1);else d.setDate(d.getDate()+1);
    }
  })();
  for(i=0;i<dl2.length;i++)netBy[dl2[i]]=0;
  var recs=ad.records.filter(function(r){return r.date>=startStr&&r.date<=endStr});
  var exs=ad.exchanges.filter(function(e){return e.date>=startStr&&e.date<=endStr});
  var keyOf=byMonth?function(ds){return ds.slice(0,7)}:function(ds){return ds}; // 月聚合：按 YYYY-MM 归入
  // 加分/扣分构成：手动记录按分类；答题奖励、打卡奖励单独成项；系统购买类（补签卡）不计入构成
  var catBy={},downBy={},quizPts=0,ckPts=0;
  for(i=0;i<recs.length;i++){
    var r0=recs[i],kk=keyOf(r0.date);
    if(kk in netBy)netBy[kk]+=r0.score;
    if(r0.score>0){
      if(rdIsQuizReward(r0))quizPts+=r0.score; // 答题奖励单独成项（老流水无 itemId 也按名称识别）
      else if(rdIsCkReward(r0))ckPts+=r0.score; // 打卡奖励单独成项
      else{var c0=r0.category||'其他';catBy[c0]=(catBy[c0]||0)+r0.score} // 手动加分按分类
    }else if(r0.score<0&&!rdIsSystem(r0)){ // 扣分构成只统计人工扣分（补签卡购买为系统扣费，不计入）
      var c1=r0.category||'其他';downBy[c1]=(downBy[c1]||0)+r0.score;
    }
  }
  // —— 柱状趋势图（逐日或按月）——
  var maxAbs=1;
  for(i=0;i<dl2.length;i++)maxAbs=Math.max(maxAbs,Math.abs(netBy[dl2[i]]));
  var chart='<div class="rp-chart">';
  for(i=0;i<dl2.length;i++){
    var v=netBy[dl2[i]];
    var hh=Math.max(3,Math.round(Math.abs(v)/maxAbs*100));
    var cls=v>0?' u':(v<0?' d':'');
    var bg=v===0?';background:var(--line)':'';
    var tap=byMonth?'':' onclick="openRdDay(\''+dl2[i]+'\')"'; // 月聚合柱不可点开单日明细
    chart+='<div class="rp-col"'+tap+' title="'+dl2[i]+' · '+(v>0?'+':'')+v+' 分"><i class="rp-bar'+cls+'" style="height:'+hh+'%'+bg+'"></i></div>';
  }
  chart+='</div><div class="rp-x">';
  var step=(reportRange==='week'||byMonth)?1:Math.max(1,Math.ceil(dl2.length/8));
  for(i=0;i<dl2.length;i++){
    var show=(reportRange==='week')||byMonth||(i%step===0)||(i===dl2.length-1);
    var lab=byMonth?(parseInt(dl2[i].slice(5),10)+'月'):parseInt(dl2[i].split('-')[2],10);
    chart+='<span class="rp-xl">'+(show?lab:'')+'</span>';
  }
  chart+='</div>';
  // —— 加分构成条：手动分类 + 答题奖励 + 打卡奖励 ——
  var catsArr=[];
  for(var k in catBy)catsArr.push({n:k,p:catBy[k],c:catColor(k),sys:''});
  if(quizPts>0)catsArr.push({n:'答题奖励',p:quizPts,c:'var(--blue)',sys:1});
  if(ckPts>0)catsArr.push({n:'打卡奖励',p:ckPts,c:'var(--yellow)',sys:1});
  catsArr.sort(function(a,b){return b.p-a.p});
  var maxCat=catsArr.length?catsArr[0].p:1;
  var catHtml='';
  for(i=0;i<catsArr.length;i++){
    var oc=catsArr[i].sys?(catsArr[i].n==='答题奖励'?'openRdQuizR()':'openRdCkR()'):('openRdCat(\''+catsArr[i].n+'\')');
    catHtml+='<div class="rp-row" onclick="'+oc+'"><span class="rp-cat">'+escHtml(catsArr[i].n)+'</span>'
      +'<span class="rp-track"><i style="width:'+Math.round(catsArr[i].p/maxCat*100)+'%;background:'+catsArr[i].c+'"></i></span>'
      +'<span class="rp-val num">+'+catsArr[i].p+'</span></div>';
  }
  if(!catHtml)catHtml='<div class="es" style="padding:16px 0"><div class="et">该时间段暂无加分记录</div></div>';
  // —— 扣分构成条（人工扣分按分类，红条）——
  var downsArr=[];
  for(var k2 in downBy)downsArr.push({n:k2,p:downBy[k2]});
  downsArr.sort(function(a,b){return a.p-b.p}); // 扣分最多的在前（负值最小）
  var maxDown=downsArr.length?Math.abs(downsArr[0].p):1;
  var downHtml='';
  for(i=0;i<downsArr.length;i++){
    downHtml+='<div class="rp-row" onclick="openRdCatD(\''+downsArr[i].n+'\')"><span class="rp-cat">'+escHtml(downsArr[i].n)+'</span>'
      +'<span class="rp-track"><i style="width:'+Math.round(Math.abs(downsArr[i].p)/maxDown*100)+'%;background:var(--red)"></i></span>'
      +'<span class="rp-val num" style="color:var(--red)">'+downsArr[i].p+'</span></div>';
  }
  if(!downHtml)downHtml='<div class="es" style="padding:16px 0"><div class="et">该时间段暂无扣分记录</div></div>';
  // —— 刷题与打卡（累计口径）——
  var ans=0,ansPts=0;
  for(i=0;i<ad.records.length;i++){
    if(ad.records[i].itemId==='quiz_reward'){ans++;ansPts+=ad.records[i].score}
  }
  var wrongN=rdWrongVisibleCount(); // 孩子端读桶、家长端读本机键；遍历已有 bankIds 计数，不依赖题库加载
  var stk=(ad.quizStreak&&ad.quizStreak.count)||0;
  var best=(ad.quizStreak&&ad.quizStreak.best)||0;
  // —— 兑换（所选范围）——
  var exCost=0;
  for(i=0;i<exs.length;i++)exCost+=exs[i].cost||0;
  body.innerHTML=
    (sessionRole==='kid'?kidAchieveCard():'')
    +'<div class="sec" style="margin-top:16px"><div class="sec-h"><div class="st-t">'+(byMonth?'每月净积分':'每日净积分')+' · '+startStr.replace(/-/g,'/')+' ~ '+endStr.replace(/-/g,'/')+'</div></div>'
    +chart
    +'<div class="rp-lg"><span class="rp-li"><i class="rp-bar u" style="width:10px;height:10px"></i>净加分</span><span class="rp-li"><i class="rp-bar d" style="width:10px;height:10px"></i>净扣分</span></div></div>'
    +'<div class="sec"><div class="sec-h"><div class="st-t">加分构成</div></div><div class="rp-cats">'+catHtml+'</div></div>'
    +'<div class="sec"><div class="sec-h"><div class="st-t">扣分构成</div></div><div class="rp-cats">'+downHtml+'</div></div>'
    +'<div class="sec"><div class="sec-h"><div class="st-t">刷题与打卡（累计，点击查看明细）</div></div><div class="qs rp-grid">'
      +'<div class="sc rp-tap" onclick="openRdQuiz()"><div class="sv num">'+ans+'</div><div class="sl">累计答对</div></div>'
      +'<div class="sc rp-tap" onclick="openRdQuiz()"><div class="sv num">'+ansPts+'</div><div class="sl">答题积分</div></div>'
      +'<div class="sc rp-tap" onclick="openRdWrong()"><div class="sv num">'+wrongN+'</div><div class="sl">待复习错题</div></div>'
      +'<div class="sc rp-tap" onclick="openRdStreak()"><div class="sv num">'+stk+'</div><div class="sl">连续'+(best?' / 最佳'+best:'')+'</div></div>'
    +'</div></div>'
    +'<div class="sec"><div class="sec-h"><div class="st-t">兑换（所选范围，点击查看明细）</div></div><div class="qs" style="padding:0">'
      +'<div class="sc rp-tap" onclick="openRdEx()"><div class="sv num">'+exs.length+'</div><div class="sl">兑换次数</div></div>'
      +'<div class="sc rp-tap" onclick="openRdEx()"><div class="sv num">'+exCost+'</div><div class="sl">消耗积分</div></div>'
    +'</div></div>';
}

// ===== 报告明细（#8 增强）：点击报告任一柱/分类/统计卡 → 弹窗查看对应明细 =====
function rdShow(title,html){
  document.getElementById('mRdTitle').textContent=title;
  var box=document.getElementById('mRdBody');
  box.innerHTML=html;
  // 报告明细只读（问题①）：移除行内删除/编辑入口，家长端在此也仅可查看
  var btns=box.querySelectorAll('.dl,.ed,.x');
  for(var i=0;i<btns.length;i++)btns[i].parentNode.removeChild(btns[i]);
  document.getElementById('mRd').classList.add('show');
}
// 某日明细：当日全部积分记录 + 兑换流水（时间倒序）
function openRdDay(ds){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var items=[],i;
  for(i=0;i<ad.records.length;i++)if(ad.records[i].date===ds)items.push({t:'r',d:ad.records[i]});
  for(i=0;i<ad.exchanges.length;i++)if(ad.exchanges[i].date===ds)items.push({t:'e',d:ad.exchanges[i]});
  items.sort(function(a,b){return (b.d.timestamp||0)-(a.d.timestamp||0)});
  var h='';
  if(!items.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">该日暂无记录</div></div>';
  for(i=0;i<items.length;i++)h+=items[i].t==='r'?renderRecord(items[i].d,ds,true):renderExchange(items[i].d,ds,true);
  rdShow(fd(ds)+' · 当日明细',h);
}
// 某分类加分明细：报告范围内该分类的全部手动加分记录（答题/打卡等系统奖励不混入）
function openRdCat(cat){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var recs=ad.records.filter(function(r){return r.date>=rdStart&&r.date<=rdEndDate()&&r.score>0&&(r.category||'其他')===cat&&!rdIsSystem(r)});
  rdSortDesc(recs);
  var h='';
  if(!recs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">该时间段内「'+escHtml(cat)+'」暂无加分</div></div>';
  for(var i=0;i<recs.length;i++)h+=renderRecord(recs[i],'',true);
  rdShow(cat+' · 加分明细',h);
}
// 答题奖励明细（所选范围）：答题得分 + 连续刷题里程碑奖励
function openRdQuizR(){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var recs=ad.records.filter(function(r){return r.date>=rdStart&&r.date<=rdEndDate()&&r.score>0&&rdIsQuizReward(r)});
  rdSortDesc(recs);
  var h='';
  if(!recs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">该时间段内暂无答题奖励</div></div>';
  for(var i=0;i<recs.length;i++)h+=renderRecord(recs[i],'',true);
  rdShow('答题奖励 · 加分明细',h);
}
// 打卡奖励明细（所选范围）：打卡确认 + 全勤 + 必打卡档 + 补卡（合并展示）
function openRdCkR(){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var recs=ad.records.filter(function(r){return r.date>=rdStart&&r.date<=rdEndDate()&&r.score>0&&rdIsCkReward(r)});
  rdSortDesc(recs);
  var h='';
  if(!recs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">该时间段内暂无打卡奖励</div></div>';
  for(var i=0;i<recs.length;i++)h+=renderRecord(recs[i],'',true);
  rdShow('打卡奖励 · 加分明细（含补卡）',h);
}
// 某分类扣分明细（所选范围）：该分类的全部人工扣分记录
function openRdCatD(cat){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var recs=ad.records.filter(function(r){return r.date>=rdStart&&r.date<=rdEndDate()&&r.score<0&&(r.category||'其他')===cat&&!rdIsSystem(r)});
  rdSortDesc(recs);
  var h='';
  if(!recs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">该时间段内「'+escHtml(cat)+'」暂无扣分</div></div>';
  for(var i=0;i<recs.length;i++)h+=renderRecord(recs[i],'',true);
  rdShow(cat+' · 扣分明细',h);
}
// 答题积分明细：全部 quiz_reward 流水（累计口径）
function openRdQuiz(){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var recs=ad.records.filter(function(r){return r.itemId==='quiz_reward'});
  rdSortDesc(recs);
  var h='';
  if(!recs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">还没有答题积分记录</div></div>';
  for(var i=0;i<recs.length;i++)h+=renderRecord(recs[i],'',true);
  rdShow('答题积分明细（累计 '+recs.length+' 次）',h);
}
// —— 报告侧错题数据源：家长端=本机账号键（qzAccStore，随刷题实时落盘）；孩子端=账号桶只读字段
//（孩子端 syncPull 已拉到桶 quizWrong/quizExcluded/quizWrongMeta，但本机无 sp_quiz__ 键，直接读桶）
function rdWrongSource(){
  if(sessionRole==='kid'&&ad){
    var isObj=function(v){return !!v&&typeof v==='object'&&Object.prototype.toString.call(v)!=='[object Array]'};
    return {
      wrong:isObj(ad.quizWrong)?ad.quizWrong:{},
      excluded:isObj(ad.quizExcluded)?ad.quizExcluded:{},
      meta:isObj(ad.quizWrongMeta)?ad.quizWrongMeta:{}
    };
  }
  if(typeof qzAccStore!=='function')return {wrong:{},excluded:{},meta:{}};
  var st=qzAccStore();
  return {wrong:st.wrong,excluded:st.excluded,meta:st.wrongMeta};
}
// 报告侧「待复习错题」计数：遍历数据源已有 bankIds（不依赖 QZ_BANKS/题库缓存是否加载，
// 修复「未进刷题页直接看报告时计数/明细恒为 0」的问题）
function rdWrongVisibleCount(){
  var src=rdWrongSource(),n=0;
  for(var bid in src.wrong){
    var arr=src.wrong[bid];
    if(Object.prototype.toString.call(arr)!=='[object Array]')continue;
    var ex=src.excluded&&src.excluded[bid];
    var exs=(Object.prototype.toString.call(ex)==='[object Array]')?new Set(ex):null;
    for(var k=0;k<arr.length;k++){
      var i=arr[k];
      if(typeof i!=='number'||i<0||!isFinite(i))continue;
      if(exs&&exs.has(i))continue;
      n++;
    }
  }
  return n;
}
// 确保题库清单与未缓存题库加载完成（qzLoadIndex/qzLoadBank 均为纯拉取+缓存，无刷题状态副作用，家长/孩子端通用）
function rdEnsureBanks(){
  var pre=(typeof QZ_BANKS!=='undefined'&&QZ_BANKS.length)?Promise.resolve():(typeof qzLoadIndex==='function'?qzLoadIndex():Promise.resolve());
  return pre.then(function(){
    if(typeof QZ_BANKS==='undefined'||typeof qzLoadBank!=='function')return;
    var pend=[];
    for(var j=0;j<QZ_BANKS.length;j++){
      var mm=QZ_BANKS[j];
      if(!QZ_BANK_CACHE[mm.id]&&!mm._unavailable)pend.push(qzLoadBank(mm.id));
    }
    return Promise.all(pend);
  });
}
// 待复习错题清单：跨题库（题名 + 出处题库 + 复习进度）；家长/孩子端均可只读查看。
// 修复（问题③）：旧实现同步遍历 builtin+QZ_BANKS 且跳过未加载题库 —— 未进刷题页直接点开时
// 题库缓存为空，全部被 continue 跳过 → 恒显示 0 题；现改为先异步补齐题库再按数据源渲染。
function openRdWrong(){
  if(sessionRole!=='parent'&&sessionRole!=='kid')return;
  var src=rdWrongSource();
  var total=rdWrongVisibleCount();
  rdShow('待复习错题（'+total+' 题）','<div class="es" style="padding:24px 0"><div class="et">正在加载错题…</div></div>');
  rdEnsureBanks().then(function(){
    var mo=document.getElementById('mRd');
    if(!mo||!mo.classList.contains('show'))return; // 用户已关闭弹窗：放弃本次填充
    var h='',shown=0;
    for(var bid in src.wrong){
      var arr=src.wrong[bid];
      if(Object.prototype.toString.call(arr)!=='[object Array]')continue;
      var bank=(bid==='builtin')?QZ_BUILTIN_BANK:QZ_BANK_CACHE[bid];
      if(!bank||!bank.questions)continue; // 题库加载失败：该部分暂不展示（计数仍以数据为准）
      var ex=src.excluded&&src.excluded[bid];
      var exs=(Object.prototype.toString.call(ex)==='[object Array]')?new Set(ex):null;
      var ws=arr.slice().sort(function(a,b){return a-b});
      for(var m=0;m<ws.length;m++){
        var idx=ws[m];
        if(typeof idx!=='number'||idx<0||idx>=bank.questions.length)continue;
        if(exs&&exs.has(idx))continue;
        shown++;
        var d=bank.questions[idx];
        var meta=src.meta&&src.meta[bid];
        var stk=(meta&&typeof meta[idx]==='number')?meta[idx]:0;
        h+='<div class="ri"><span class="cat-dot" style="background:var(--red)" aria-hidden="true"></span>'
          +'<div class="inf"><div class="nm">'+escHtml(d.t||'未命名题目')+'</div>'
          +'<div class="tm">出自：'+escHtml(bank.name||'')+(stk>0?' · 复习 '+stk+'/2':'')+'</div></div></div>';
      }
    }
    if(!total)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">错题集已清空，太棒了！</div></div>';
    else if(!shown)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">部分题库加载失败，请稍后重试</div></div>';
    rdShow('待复习错题（'+total+' 题）',h);
  }).catch(function(){
    var mo=document.getElementById('mRd');
    if(mo&&mo.classList.contains('show'))rdShow('待复习错题（'+total+' 题）','<div class="es" style="padding:24px 0"><div class="et">加载失败，请稍后重试</div></div>');
  });
}
// 打卡积分明细：里程碑奖励 + 补签卡购买流水
function openRdStreak(){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var recs=ad.records.filter(function(r){return r.itemId==='quiz_streak_reward'||r.itemId==='quiz_card_buy'});
  recs.sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0)});
  var s=(ad.quizStreak&&ad.quizStreak.count)||0;
  var best=(ad.quizStreak&&ad.quizStreak.best)||0;
  var h='';
  if(!recs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">暂无打卡相关积分流水</div></div>';
  for(var i=0;i<recs.length;i++)h+=renderRecord(recs[i],recs[i].date,true);
  rdShow('打卡积分明细 · 连续 '+s+' 天 / 最佳 '+best+' 天',h);
}
// 兑换明细：报告范围内全部兑换/储蓄流水
function openRdEx(){
  if(!ad)return; // 报告明细家长/孩子均可查看（只读，行内无编辑入口）
  var exs=ad.exchanges.filter(function(e){return e.date>=rdStart&&e.date<=rdEndDate()});
  rdSortDesc(exs);
  var h='';
  if(!exs.length)h='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">该时间段内暂无兑换</div></div>';
  for(var i=0;i<exs.length;i++)h+=renderExchange(exs[i],'',true);
  rdShow('兑换明细（'+rdStart.replace(/-/g,'/')+' ~ '+rdEndDate().replace(/-/g,'/')+'）',h);
}

/* ===== 数据体检 + 同步通道状态（家长端）：把"事后救火"变成"可自查" ===== */
function dataAudit(){ // 返回检查项列表：{name,ok,detail}
  var out=[];
  var acc=loadBucket(currentUser)||{};
  var recs=acc.records||[];
  var del=acc.del||{};
  /* ① 总分恒等于明细加总 */
  var sum=rdSumScore(acc);
  out.push({name:'总分与明细一致',ok:(acc.totalPoints||0)===sum,detail:'当前 '+(acc.totalPoints||0)+' · 明细加总 '+sum});
  /* ② 已删除记录不应残留在账本里（否则"总分含、明细看不见"） */
  var ghost=0;
  for(var i=0;i<recs.length;i++){var r=recs[i];if(r&&r.id&&del['r:'+r.id])ghost++;}
  out.push({name:'无已删除残留记录',ok:ghost===0,detail:ghost?(ghost+' 条已删除记录仍在账本中'):'正常'});
  /* ③ 必打卡：已标记扣分但账本缺流水 */
  var b=ckBucket(),missing=0,miss=[];
  for(var ds in b){
    if(ds==='_cfg')continue;
    var day=b[ds];
    for(var id in day){
      var st=day[id];
      if(st&&st.m===1&&!recs.some(function(x){return x&&x.id==='ckm_'+ds+'_'+id})){
        missing++;
        if(miss.length<3)miss.push(ds+' '+id);
      }
    }
  }
  out.push({name:'必打卡扣分记录齐全',ok:missing===0,detail:missing?(missing+' 条缺扣分流水'+(miss.length?('（如 '+miss.join('、')+'）'):'')):'正常'});
  /* ④ 打卡完成但账本缺加分流水（删任务/同步失败都可能造成；进打卡页会自动补回） */
  var missAward=0,missList=[];
  for(var ds3 in b){
    if(ds3==='_cfg')continue;
    var day3=b[ds3]||{};
    for(var id3 in day3){
      if(id3==='_bonus'||id3==='_mbonus')continue;
      var st3=day3[id3];
      if(!(st3&&st3.d&&st3.r))continue;
      var rid3=(st3.mk!=null?'ckmk_':'ck_')+ds3+'_'+id3;
      if(!recs.some(function(x){return x&&x.id===rid3})){
        missAward++;
        if(missList.length<3)missList.push(ds3+' '+id3);
      }
    }
  }
  out.push({name:'打卡加分记录齐全',ok:missAward===0,detail:missAward?(missAward+' 条完成记录缺加分流水（进打卡页会自动补回）'):'正常'});
  /* ⑤ 数据量级：流水条数 + 本机账本估算大小 + 1MB 同步门槛预警（始终 ok，仅作提示，不参与一键修复） */
  var nRec=(acc.records||[]).length, nEx=(acc.exchanges||[]).length;
  var bytes=0;
  try{bytes=unescape(encodeURIComponent(JSON.stringify(acc))).length}catch(e){}
  var scale=bytes<1024?(bytes+' B'):(bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(2)+' MB');
  var warn=bytes>=800*1024;
  out.push({name:'数据量级',ok:true,detail:'流水 '+nRec+' 条 · 兑换 '+nEx+' 条 · 账本约 '+scale+(warn?' · ⚠ 已接近 1MB 同步门槛，建议归档历史流水':' · 距 1MB 同步门槛还有余量')});
  return out;
}
function renderChannelStates(){ // 各同步通道状态一览（家长端排查用）
  var el=document.getElementById('chanList');
  if(!el)return;
  var list=[
    {n:'账本',bad:!!syncErr,txt:syncErr||(syncStatus==='loading'?'同步中…':(hasPendingSync()?'有改动待补推':'已同步'))},
    {n:'打卡',bad:!!ckSyncErr,txt:ckSyncErr||(hasCkPending()?'有改动待补推':'已同步')},
    {n:'专注',bad:!!fxSyncErr,txt:fxSyncErr||(hasFxPending()?'有改动待补推':'已同步')},
    {n:'兑换请求',bad:false,txt:'按需拉取'}
  ];
  var h='<div style="font-size:12px;color:var(--dim);font-weight:700;margin-bottom:4px">同步通道</div>';
  for(var i=0;i<list.length;i++) h+='<div class="sync-line">'+(list[i].bad?'🔴 ':'🟢 ')+list[i].n+' — '+escHtml(list[i].txt)+'</div>';
  el.innerHTML=h;
}
function dataAuditRun(){
  var items=dataAudit();
  var h='',bad=0;
  for(var i=0;i<items.length;i++){
    if(!items[i].ok)bad++;
    h+='<div class="sync-line">'+(items[i].ok?'✅ ':'⚠️ ')+items[i].name+' — '+escHtml(items[i].detail)+'</div>';
  }
  h+='<div class="sync-hint" style="margin-top:8px">'+(bad?('发现 '+bad+' 项异常，可点「一键修复」处理。'):'全部正常 ✅')+'</div>';
  var box=document.getElementById('auditList');
  if(box)box.innerHTML=h;
  renderChannelStates();
  toast(bad?('体检完成：'+bad+' 项异常'):'体检完成：一切正常',bad?'err':'ok');
}
function dataFixRun(){ // 一键修复：重算总分 + 清理已删除残留 + 补记缺失扣分流水 + 推送各通道
  if(sessionRole!=='parent'){toast('仅家长端可修复','err');return}
  var fixed=[];
  var acc=loadBucket(currentUser);
  if(acc){
    var before=acc.totalPoints||0;
    var del=acc.del||{};
    acc.records=(acc.records||[]).filter(function(r){return !(r&&r.id&&del['r:'+r.id])});
    acc.exchanges=(acc.exchanges||[]).filter(function(e){return !(e&&e.id&&del['e:'+e.id])});
    acc.totalPoints=rdSumScore(acc);
    try{localStorage.setItem(userKey(currentUser),JSON.stringify(acc));ad=acc;fixed.push('总分重算 '+before+' → '+acc.totalPoints);}catch(e){}
  }
  try{ckMustSweep(new Date());fixed.push('已重新结算必打卡');}catch(e){}
  markPendingSync();
  retryAllChannels();
  dataAuditRun();
  toast(fixed.length?('已处理：'+fixed.join('；')):'已执行修复流程','ok');
}
function retryAllChannels(){ // 触发各通道拉取与推送
  if(sessionRole!=='parent')return;
  try{syncPull(currentUser);}catch(e){}
  try{ckSyncPush();}catch(e){}
  try{fxSyncPush();}catch(e){}
  toast('已触发各通道同步','ok');
}

/* ===== 云端历史恢复：每次同步都会在 GitHub 产生一个历史版本，用于找回误删的记录 ===== */
function ghCommits(file, per){
  var api='https://api.github.com/repos/'+GH_REPO+'/commits?path='+encodeURIComponent(file)+'&per_page='+(per||15);
  return fetch(api,{headers:{'Authorization':'token '+getSyncToken()}}).then(function(r){
    if(!r.ok)return r.json().then(function(j){throw {code:r.status,msg:(j&&j.message)||''}}).catch(function(e){throw (e&&e.code)?e:{code:r.status,msg:''}});
    return r.json();
  }).then(function(list){
    return (list||[]).map(function(c){
      var d=(c.commit&&c.commit.author&&c.commit.author.date)||'';
      return { sha:c.sha, date:d, msg:(c.commit&&c.commit.message)||'' };
    });
  });
}
function ghReadAtSha(file, sha){
  var api='https://api.github.com/repos/'+GH_REPO+'/contents/'+file+'?ref='+sha;
  return fetch(api,{headers:{'Authorization':'token '+getSyncToken()}}).then(function(r){
    if(!r.ok)throw {code:r.status};
    return r.json();
  }).then(function(meta){
    if(!meta||!meta.content)return null;
    try{return JSON.parse(b64ToUtf8(meta.content))}catch(e){return null}
  });
}
function ghHistoryScan(){ // 扫描账本文件的最近提交
  if(!currentUser){toast('请先登录','err');return}
  if(!getSyncToken()){toast('请先配置同步令牌','err');return}
  var box=document.getElementById('ghHistList');
  if(box)box.innerHTML='<div class="sync-hint">正在扫描云端历史…</div>';
  ghCommits(GH_FILE,15).then(function(list){
    if(!list.length){if(box)box.innerHTML='<div class="sync-hint">云端暂无历史版本</div>';return}
    var h='';
    list.forEach(function(c,i){
      var t=c.date?c.date.slice(0,16).replace('T',' '):'—';
      h+='<div class="sync-line" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +'<span style="flex:1;min-width:150px">'+t+' · '+(c.msg?escHtml(c.msg.slice(0,24)):'')+'</span>'
        +'<button class="bn bn-q" style="height:30px;padding:0 10px;font-size:12px" onclick="ghHistPreview(\''+c.sha+'\',\''+t+'\')">查看</button>'
        +'<button class="bn bn-p" style="height:30px;padding:0 10px;font-size:12px" onclick="ghHistRestore(\''+c.sha+'\')">补回缺失</button>'
        +'</div>';
    });
    if(box)box.innerHTML='<div class="sync-hint" style="margin-bottom:6px">选择历史版本可查看当时的数据并把「当前缺失的记录」补回来（不会覆盖现有数据）</div>'+h;
  }).catch(function(e){
    if(box)box.innerHTML='<div class="sync-hint" style="color:var(--red-deep)">扫描失败：'+(e&&e.code?('HTTP '+e.code):'网络异常')+'</div>';
  });
}
function ghHistPreview(sha,t){ // 查看某历史版本该账号的记录数与总分
  ghReadAtSha(GH_FILE,sha).then(function(all){
    var v=all&&all[currentUser];
    if(!v||!v.records){toast('该版本没有当前账号的数据','err');return}
    var recs=v.records||[],exs=v.exchanges||[];
    var sum=recs.reduce(function(a,r){return a+((r&&r.score)||0)},0)-exs.reduce(function(a,e){return a+((e&&e.cost)||0)},0);
    var box=document.getElementById('ghHistList');
    var tip=document.createElement('div');
    tip.className='sync-hint';
    tip.innerHTML='<b>'+t+'</b>：记录 '+recs.length+' 条 · 兑换 '+exs.length+' 条 · 当时总分 '+sum;
    if(box)box.insertBefore(tip,box.firstChild);
  }).catch(function(){toast('读取该版本失败','err')});
}
function ghHistRestore(sha){ // 把该历史版本里「当前缺失」的记录补回来（不覆盖、不复活已删除的墓碑记录）
  if(sessionRole!=='parent'){toast('仅家长端可操作','err');return}
  if(!currentUser)return;
  ghReadAtSha(GH_FILE,sha).then(function(all){
    var v=all&&all[currentUser];
    if(!v||!v.records){toast('该版本没有当前账号的数据','err');return}
    var cur=loadBucket(currentUser)||{records:[],exchanges:[],totalPoints:0,del:{}};
    cur.del=cur.del||{};
    var have={},haveE={};
    (cur.records||[]).forEach(function(r){if(r&&r.id)have[r.id]=1});
    (cur.exchanges||[]).forEach(function(e){if(e&&e.id)haveE[e.id]=1});
    var addR=0,addE=0;
    (v.records||[]).forEach(function(r){
      if(!r||!r.id)return;
      if(have[r.id])return;
      if(cur.del['r:'+r.id])return; /* 用户主动删除过的不复活 */
      cur.records.push(r);have[r.id]=1;addR++;
    });
    (v.exchanges||[]).forEach(function(e){
      if(!e||!e.id)return;
      if(haveE[e.id])return;
      if(cur.del['e:'+e.id])return;
      cur.exchanges.push(e);haveE[e.id]=1;addE++;
    });
    if(!addR&&!addE){toast('该版本没有可补回的记录','ok');return}
    cur.totalPoints=rdSumScore(cur);
    try{localStorage.setItem(userKey(currentUser),JSON.stringify(cur))}catch(err){toast('本地存储空间不足','err');return}
    ad=cur;
    markPendingSync();
    render();
    if(typeof syncPush==='function')syncPush(cur);
    toast('已补回 '+addR+' 条记录、'+addE+' 条兑换（总分 '+cur.totalPoints+'）','ok');
  }).catch(function(){toast('读取该版本失败','err')});
}

// ===== 本地备份（#2）：导出当前账号账本+刷题进度+自定义题库为 JSON；导入覆盖本机并上云 =====
function exportBackup(){
  if(!currentUser){toast('请先登录','err');return}
  var payload={
    app:'star-points',version:1,
    exportedAt:new Date().toISOString(),
    phone:currentUser,
    users:getUsers(),
    bucket:loadBucket(currentUser),
    checkin:(function(){try{return JSON.parse(localStorage.getItem('sp_ck__'+currentUser))||null}catch(e){return null}})(),
    focus:(function(){try{var r={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('sp_fx__'+currentUser+':')===0)r[k]=localStorage.getItem(k)}return r}catch(e){return null}})(),
    quiz:(typeof qzAccStore==='function')?qzAccStore():null,
    customBanks:(typeof qzCustomBanks==='function')?qzCustomBanks():null
  };
  try{
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='star-points-backup-'+today()+'.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
    toast('已导出备份文件','ok');
  }catch(e){toast('导出失败','err')}
}
function importBackupFile(inp){
  var f=inp.files&&inp.files[0];
  inp.value='';
  if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    var obj=null;
    try{obj=JSON.parse(rd.result)}catch(e){}
    if(!obj||obj.app!=='star-points'||!obj.bucket||typeof obj.bucket!=='object'){toast('备份文件格式不正确','err');return}
    sc2('导入备份','将用备份覆盖当前账号「'+currentUser+'」的本机数据（含打卡、专注成绩、刷题进度与自定义题库），并同步到云端。确定继续吗？',function(){
      try{localStorage.setItem(userKey(currentUser),JSON.stringify(obj.bucket))}
      catch(e){toast('导入失败：存储空间不足','err');return}
      /* 打卡 / 专注：一并恢复（此前只恢复账本+刷题+题库） */
      if(obj.checkin&&typeof obj.checkin==='object'){
        try{localStorage.setItem('sp_ck__'+currentUser,JSON.stringify(obj.checkin))}catch(e){}
      }
      if(obj.focus&&typeof obj.focus==='object'){
        for(var fk in obj.focus){try{localStorage.setItem(fk,obj.focus[fk])}catch(e){}}
      }
      if(obj.quiz&&typeof obj.quiz==='object'&&(typeof qzAccKey==='function')){
        try{localStorage.setItem(qzAccKey(),JSON.stringify(obj.quiz))}catch(e){}
      }
      if(Object.prototype.toString.call(obj.customBanks)==='[object Array]'&&typeof qzSaveCustomBanks==='function'){
        qzSaveCustomBanks(obj.customBanks);
        if(typeof qzRefreshCustomBanks==='function')qzRefreshCustomBanks();
      }
      if(Object.prototype.toString.call(obj.users)==='[object Array]'&&obj.users.length)saveUsers(obj.users);
      ad=ld();
      if(typeof qzReloadForAccount==='function')qzReloadForAccount();
      renderAll(ad);
      sd(ad); // 恢复的数据推上云，其他设备可用
      toast('备份已恢复并同步','ok');
    });
  };
  rd.onerror=function(){toast('读取文件失败','err')};
  rd.readAsText(f);
}

// Date picker functions
function openDatePicker(){
  dpMonth=new Date();
  dpSelectedStart=null;
  dpSelectedEnd=null;
  renderCalendars();
  document.getElementById('datePicker').classList.add('show');
}

function closeDatePicker(){
  document.getElementById('datePicker').classList.remove('show');
}

function renderCalendars(){
  document.getElementById('singleCalendar').innerHTML=renderMonthCalendar(dpMonth);
}

function renderMonthCalendar(month){
  var year=month.getFullYear();
  var m=month.getMonth();
  var months=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  var weekDays=['日','一','二','三','四','五','六'];
  var firstDay=new Date(year,m,1);
  var startDay=firstDay.getDay();
  var daysInMonth=new Date(year,m+1,0).getDate();
  var daysInPrevMonth=new Date(year,m,0).getDate();
  var todayStr=today();
  var html='<div class="dp-header"><div class="dp-month">'+year+'年 '+months[m]+'</div><div class="dp-nav">';
  html+='<button class="dp-navbtn" onclick="prevMonth()">‹</button>';
  html+='<button class="dp-navbtn" onclick="nextMonth()">›</button>';
  html+='</div></div>';
  html+='<div class="dp-week">';
  for(var i=0;i<7;i++) html+='<div class="dp-weekday">'+weekDays[i]+'</div>';
  html+='</div>';
  html+='<div class="dp-days">';
  var totalCells=Math.ceil((startDay+daysInMonth)/7)*7;
  for(var i=0;i<totalCells;i++){
    var dayNum=i-startDay+1;
    var cellMonth=m;
    var cellYear=year;
    if(dayNum<=0){cellMonth=m-1;if(cellMonth<0){cellMonth=11;cellYear++}dayNum=daysInPrevMonth+dayNum}
    else if(dayNum>daysInMonth){cellMonth=m+1;if(cellMonth>11){cellMonth=0;cellYear++}dayNum=dayNum-daysInMonth}
    var dateStr=cellYear+'-'+String(cellMonth+1).padStart(2,'0')+'-'+String(dayNum).padStart(2,'0');
    var classes='dp-day';
    if(cellMonth!==m) classes+=' other';
    if(dateStr===todayStr) classes+=' today';
    if(dpSelectedStart&&dateStr===dpSelectedStart) classes+=' selected';
    if(dpSelectedEnd&&dateStr===dpSelectedEnd) classes+=' selected';
    if(dpSelectedStart&&dpSelectedEnd&&dateStr>dpSelectedStart&&dateStr<dpSelectedEnd) classes+=' inrange';
    else if(dpSelectedStart&&!dpSelectedEnd&&dateStr>dpSelectedStart) classes+=' inrange';
    html+='<div class="'+classes+'" onclick="selectDate(\''+dateStr+'\')">'+dayNum+'</div>';
  }
  html+='</div>';
  return html;
}

function prevMonth(){dpMonth.setMonth(dpMonth.getMonth()-1);renderCalendars()}
function nextMonth(){dpMonth.setMonth(dpMonth.getMonth()+1);renderCalendars()}

function selectDate(dateStr){
  if(!dpSelectedStart||(dpSelectedStart&&dpSelectedEnd)){
    dpSelectedStart=dateStr;
    dpSelectedEnd=null;
  }else{
    if(dateStr<dpSelectedStart){dpSelectedEnd=dpSelectedStart;dpSelectedStart=dateStr}
    else{dpSelectedEnd=dateStr}
    dateRangeStart=dpSelectedStart;
    dateRangeEnd=dpSelectedEnd;
    closeDatePicker();
    renderRecords();
    return;
  }
  renderCalendars();
}

// 顶栏：滚动时才浮现白底 + 1px 描边
window.addEventListener('scroll',function(){
  var h=document.getElementById('mainHeader');
  if(h)h.classList.toggle('scrolled',window.scrollY>4);
},{passive:true});

// 顶栏高度随视口变化：同步刷题页吸顶条偏移
window.addEventListener('resize',function(){typeof qzSetStickyTop==='function'&&qzSetStickyTop()},{passive:true});
