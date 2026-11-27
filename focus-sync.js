// ===== 专注训练最佳成绩云同步（sync-focus.json，双端可推；逐游戏更快纪录者胜） =====
// 成绩键由 focus.html 写入：sp_fx__<phone>:<相对键>（如 sp_fx__<phone>:p24.best.single）。
// 同一账号家长端/孩子端共用同一前缀（孩子端 currentUser=家长手机号）→ 本地即互通；
// 云端按手机号分桶，合并时含 ms 的值取更快（小）者，跨设备破纪录永不丢失。
var GH_FX_API='https://api.github.com/repos/'+GH_REPO+'/contents/sync-focus.json';
var FX_PENDING_KEY='sp_fx_sync_pending';
var fxSyncSHA='',fxSyncTimer=null,fxSyncBusy=false,fxSyncErr='';
function fxBucket(){ // 收集当前账号的专注成绩键
  var out={},pre='sp_fx__'+currentUser+':',i,k;
  try{
    for(i=0;i<localStorage.length;i++){
      k=localStorage.key(i);
      if(k&&k.indexOf(pre)===0){out[k.slice(pre.length)]=localStorage.getItem(k)}
    }
  }catch(e){}
  return out;
}
function fxSaveBucket(b){ // 写回各键（值保持字符串原样）
  var pre='sp_fx__'+currentUser+':',k;
  try{
    for(k in b){if(b[k]!==null&&b[k]!==undefined)localStorage.setItem(pre+k,b[k])}
  }catch(e){}
}
function fxValBetter(a,b){ // 单键合并：含 ms 取更快（小）者；否则按 at 新者胜
  var va=null,vb=null;
  try{va=JSON.parse(a)}catch(e){}
  try{vb=JSON.parse(b)}catch(e){}
  if(va&&typeof va==='object'&&vb&&typeof vb==='object'){
    if(typeof va.ms==='number'&&typeof vb.ms==='number')return va.ms<=vb.ms?a:b;
    return (va.at||0)>=(vb.at||0)?a:b;
  }
  return b;
}
function fxMergeAll(local,remote){ // 逐键并集合并
  var out={},k,changed=false;
  for(k in local){out[k]=local[k]}
  for(k in remote){
    if(out[k]===undefined){out[k]=remote[k];changed=true}
    else if(k==='history'){ /* 历史成绩：两设备并集去重（按条目唯一 id），新的在前，上限 300 */
      var la=[],ra=[];
      try{la=JSON.parse(out[k])||[]}catch(e){}
      try{ra=JSON.parse(remote[k])||[]}catch(e){}
      if(!Array.isArray(la))la=[];if(!Array.isArray(ra))ra=[];
      var seen={},u1=[],i;
      for(i=0;i<la.length;i++){var r1=la[i];if(r1&&r1.u){seen[r1.u]=1}u1.push(r1)}
      for(i=0;i<ra.length;i++){var r2=ra[i];if(r2&&r2.u&&!seen[r2.u]){u1.push(r2);changed=true}}
      u1.sort(function(a,b){return (b.ts||0)-(a.ts||0)||String(b.tm||'').localeCompare(String(a.tm||''))||String(b.u||'').localeCompare(String(a.u||''))});
      if(u1.length>300)u1=u1.slice(0,300);
      var ser=JSON.stringify(u1);
      if(ser!==out[k]){out[k]=ser;changed=true}
    }
    else{var better=fxValBetter(out[k],remote[k]);if(better!==out[k]){out[k]=better;changed=true}}
  }
  return {data:out,changed:changed};
}
function markFxPending(){try{localStorage.setItem(FX_PENDING_KEY,'1')}catch(e){}}
function clearFxPending(){try{localStorage.removeItem(FX_PENDING_KEY)}catch(e){}}
function hasFxPending(){try{return localStorage.getItem(FX_PENDING_KEY)==='1'}catch(e){return false}}
function fxQueue(){ // 破纪录防抖上云（2 秒）
  if(!currentUser||!getSyncToken())return;
  markFxPending();
  if(fxSyncTimer)clearTimeout(fxSyncTimer);
  fxSyncTimer=setTimeout(fxSyncPush,2000);
}
function fxSyncPush(){
  if(fxSyncTimer){clearTimeout(fxSyncTimer);fxSyncTimer=null}
  if(fxSyncBusy||!hasFxPending()||!currentUser||!getSyncToken()){fxUpdateSyncUI();return}
  fxSyncBusy=true;fxUpdateSyncUI();
  syncChannelPush({
    api:GH_FX_API, msg:'fx-sync:'+currentUser, maxRetry:3,
    local:function(){return fxBucket()},
    merge:function(local,remoteAll){
      var merged=fxMergeAll(local,remoteAll[currentUser]||{});
      fxSaveBucket(merged.data);
      var all={};for(var k in remoteAll)all[k]=remoteAll[k];
      all[currentUser]=merged.data;
      return {all:all,merged:merged.data};
    }
  }).then(function(res){
    fxSyncBusy=false;
    if(res.ok){fxSyncErr='';clearFxPending()}
    else{markFxPending();fxSyncErr=res.code?('同步失败（HTTP '+res.code+(res.msg?'：'+res.msg:'')+'）'):'网络异常，稍后自动重试'}
    fxUpdateSyncUI();
  });
}
function fxSyncPull(){
  if(!currentUser||!getSyncToken()){fxUpdateSyncUI();return Promise.resolve(false);}
  return fetch(GH_FX_API,{headers:{'Authorization':'token '+getSyncToken()}})
    .then(function(r){
      if(!r.ok){fxSyncErr='拉取失败（HTTP '+r.status+'）';fxUpdateSyncUI();if(hasFxPending())fxSyncPush();return false;}
      return r.json().then(function(meta){
        fxSyncSHA=meta.sha||'';
        if(!meta.content){fxUpdateSyncUI();if(hasFxPending())fxSyncPush();return false;}
        var all={};try{all=JSON.parse(b64ToUtf8(meta.content))}catch(e){}
        var merged=fxMergeAll(fxBucket(),all[currentUser]||{});
        fxSaveBucket(merged.data);
        fxSyncErr='';
        fxUpdateSyncUI();
        if(hasFxPending())fxSyncPush();
        return merged.changed; /* 云端吸收了新成绩 → 调用方重载 iframe 让用户立即看到 */
      });
    })
    .catch(function(){fxSyncErr='网络异常，稍后自动重试';fxUpdateSyncUI();if(hasFxPending())fxSyncPush();return false;});
}
function fxUpdateSyncUI(){ // 专注页同步状态行：仅异常时提示（未配置令牌/失败），已同步为正常态不打扰
  var el=document.getElementById('fxSyncBar');
  if(!el)return;
  var txt='';
  if(fxSyncBusy){txt='专注成绩同步中…';}
  else if(!getSyncToken()){txt='专注成绩仅存本机：本机未配置同步令牌，多设备无法互通';}
  else if(fxSyncErr){txt='专注成绩同步异常：'+fxSyncErr;}
  el.textContent=txt;
  el.style.display=txt?'':'none';
}
window.addEventListener('online',function(){if(hasFxPending())fxSyncPush()});
setInterval(function(){
  if(hasFxPending()&&!fxSyncBusy){fxSyncPush();return}
  if(curTab==='focus'&&currentUser&&getSyncToken()){ /* 停留在专注页时定期对齐云端成绩 */
    fxSyncPull().then(function(changed){
      var f=document.getElementById('focusFrame');
      if(changed&&f)f.src='focus.html?acct='+encodeURIComponent(currentUser)+'&t='+Date.now();
    });
  }
},60000);
// 专注页 iframe 内破纪录 → 防抖上云
window.addEventListener('message',function(e){
  if(!e.data)return;
  if(e.data.type==='focus-best-updated')fxQueue();
});
document.addEventListener('visibilitychange',function(){ // 切回页面立即对齐（换设备查看场景）
  if(document.hidden)return;
  if(hasFxPending()&&!fxSyncBusy)fxSyncPush();
  if(curTab==='focus')fxShow();
});
// —— 专注页：拉云端合并成绩 → 重载 iframe（focus.html 按账号前缀读成绩） ——
var FX_GAMES=[['schulte','舒尔特方格'],['track','视觉追踪'],['stroop','色词干扰'],['p24','24点'],['memory','记忆翻牌'],['corsi','空间方块'],['switch','快速切换'],['cancel','符号划消']];
function fxFrameHeight(){ // 按实际固定 UI（导航条）精确计算 iframe 高度，避免页面出现滚动条
  var tb=document.getElementById('tbMain'),kt=document.getElementById('kidTb');
  var bar=null;
  if(kt&&kt.style.display!=='none')bar=kt;
  else if(tb&&tb.style.display!=='none')bar=tb;
  var barH=bar?bar.offsetHeight:56;
  return Math.max(420,window.innerHeight-barH-16);
}
function fxShow(){
  if(!currentUser)return;
  var f=document.getElementById('focusFrame');
  if(f)f.style.height=fxFrameHeight()+'px'; /* 固定高度（一屏减导航）；内部适配由 focus.html 自缩放完成 */
  var vb=document.getElementById('fxVisBtn');
  if(vb)vb.style.display=sessionRole==='parent'?'':'none';
  fxUpdateSyncUI();
  fxSyncPull().then(function(){
    if(f)f.src='focus.html?acct='+encodeURIComponent(currentUser)+'&role='+(sessionRole==='kid'?'kid':'parent')+'&t='+Date.now();
    fxUpdateSyncUI();
  });
}
function fxVisKey(){return 'sp_fx__'+currentUser+':visible.tabs'}
function fxVisOpen(){ // 家长端：勾选孩子端可见的练习页签
  if(sessionRole!=='parent')return;
  var cur=null;
  try{var raw=localStorage.getItem(fxVisKey());if(raw){var v=JSON.parse(raw);if(v&&v.tabs)cur=v.tabs}}catch(e){}
  var h='<div class="ck-cfg-tip">勾选的练习会在孩子端「专注」页签显示；不勾=对孩子隐藏。家长端始终显示全部。配置会同步到所有设备。</div>';
  for(var i=0;i<FX_GAMES.length;i++){
    var gid=FX_GAMES[i][0],nm=FX_GAMES[i][1],on=!cur||cur.indexOf(gid)>=0; /* 未配置=默认全开 */
    h+='<label class="fx-vis-row'+(on?' on':'')+'"><input type="checkbox" value="'+gid+'"'+(on?' checked':'')+' onchange="this.parentNode.classList.toggle(\'on\',this.checked)">'+nm+'</label>';
  }
  document.getElementById('fxVisBody').innerHTML=h;
  document.getElementById('mFxVis').classList.add('show');
}
function fxVisClose(){document.getElementById('mFxVis').classList.remove('show')}
function fxVisSave(){
  var cbs=document.querySelectorAll('#fxVisBody input:checked'),tabs=[];
  for(var i=0;i<cbs.length;i++)tabs.push(cbs[i].value);
  try{localStorage.setItem(fxVisKey(),JSON.stringify({tabs:tabs,at:Date.now()}))}catch(e){}
  fxQueue(); /* 配置随 sync-focus.json 云同步 */
  fxVisClose();
  toast(tabs.length?('已开放 '+tabs.length+' 个练习给孩子端'):'已对孩子端隐藏全部练习','ok');
}
