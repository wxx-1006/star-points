// ===== 数据同步 (GitHub Contents API，私有仓库 star-points-data) =====
// 状态机（用户胶囊 6px 色点 + 设置页状态行）：
//   off    灰 = 未配置 token，同步静默跳过，本地照常
//   loading 黄 = 同步请求进行中
//   empty  灰 = 已配置，但云端暂无数据文件（新仓库首次使用，正常态），本地照常
//   synced  绿 = 最近一次同步成功
//   error   红 = token 无效(401)/无权限 或 网络失败；本地数据不受影响
// 冲突策略：推送前做记录级合并（mergeAccountData）——两台设备先后各记一笔不再互相覆盖；
//   推送失败自动标记待重试（sp_sync_pending），网络恢复/重新打开应用/切换页签时补推。
// ===== 同步待重试队列（#3）：推送失败 → 标记；成功 → 清除；网络恢复/成功拉取后补推 =====
var SYNC_PENDING_KEY='sp_sync_pending';
function markPendingSync(){try{localStorage.setItem(SYNC_PENDING_KEY,'1')}catch(e){}}
function clearPendingSync(){try{localStorage.removeItem(SYNC_PENDING_KEY)}catch(e){}}
function hasPendingSync(){try{return localStorage.getItem(SYNC_PENDING_KEY)==='1'}catch(e){return false}}
// 补推当前账号数据：仅在家长端、账本就绪、已配置 token 时执行（各守卫不满足时静默跳过）
function retryPendingSync(){
  if(!hasPendingSync())return;
  if(!currentUser||sessionRole!=='parent'||!ad)return;
  if(!getSyncToken())return;
  syncPush(ad);
}
// 网络恢复即补推
window.addEventListener('online',function(){retryPendingSync()});
// ===== 记录级合并（#1）：替代「后写整体覆盖」=====
// records/exchanges 按 id 并集（同 id 本地为准）；刷题三表按 bankId 并集；
// 错题复习进度同题取大者；打卡取 count/best/补签卡较大者（last 取较新、里程碑并集）；
// 徽章并集（获得时间取早）；totalPoints 按合并后流水重算；PIN/姓名等账号字段本地优先。
function mergeArrMaps(a,b){
  var isArr=function(v){return Object.prototype.toString.call(v)==='[object Array]'};
  var isObj=function(v){return !!v&&typeof v==='object'&&!isArr(v)};
  if(!isObj(b))return (a&&!isArr(a)&&typeof a==='object')?a:{};
  if(!a||isArr(a)||typeof a!=='object')a={};
  for(var k in b){
    if(!isArr(b[k]))continue;
    var av=isArr(a[k])?a[k].slice():[];
    var set={};var i;
    for(i=0;i<av.length;i++)set[av[i]]=1;
    for(i=0;i<b[k].length;i++){var v=b[k][i];if(!(v in set)){av.push(v);set[v]=1}}
    av.sort(function(x,y){return x-y});
    a[k]=av;
  }
  return a;
}
// wrongMeta（错题复习进度）：同题库按题取较大进度值
function mergeNumMaps(a,b){
  var isArr=function(v){return Object.prototype.toString.call(v)==='[object Array]'};
  var isObj=function(v){return !!v&&typeof v==='object'&&!isArr(v)};
  if(!isObj(b))return (a&&!isArr(a)&&typeof a==='object')?a:{};
  if(!a||isArr(a)||typeof a!=='object')a={};
  for(var k in b){
    if(!isArr(b[k]))continue;
    var av=isArr(a[k])?a[k].slice():[];
    for(var i=0;i<b[k].length;i++){
      var v=typeof b[k][i]==='number'?b[k][i]:0;
      av[i]=(typeof av[i]==='number')?Math.max(av[i],v):v;
    }
    a[k]=av;
  }
  return a;
}
function mergeStreak(a,b){
  if(!b||typeof b!=='object'||Object.prototype.toString.call(b)==='[object Array]')return (a&&typeof a==='object'&&Object.prototype.toString.call(a)!=='[object Array]')?a:{};
  if(!a||typeof a!=='object'||Object.prototype.toString.call(a)==='[object Array]')a={};
  a.count=Math.max(a.count||0,b.count||0);
  a.best=Math.max(a.best||0,b.best||0);
  a.cards=Math.max(a.cards||0,b.cards||0);
  if((b.last||'')>(a.last||''))a.last=b.last;
  var ms={},k;
  if(b.ms&&typeof b.ms==='object'&&Object.prototype.toString.call(b.ms)!=='[object Array]')for(k in b.ms)ms[k]=1;
  if(a.ms&&typeof a.ms==='object'&&Object.prototype.toString.call(a.ms)!=='[object Array]')for(k in a.ms)ms[k]=1;
  a.ms=ms;
  return a;
}
function mergeAccountData(loc,rem){
  var isArr=function(v){return Object.prototype.toString.call(v)==='[object Array]'};
  var m;
  try{m=JSON.parse(JSON.stringify(loc))}catch(e){return {data:loc,changed:false}}
  if(!rem||typeof rem!=='object'||isArr(rem))return {data:m,changed:false};
  var changed=false,i,ids={};
  // —— 删除墓碑并集：被删除的流水 id 不再因另一设备的旧副本而「复活」——
  var del={},tombChange=false,dk;
  var ld0=(m.del&&typeof m.del==='object')?m.del:{},rd0=(rem.del&&typeof rem.del==='object')?rem.del:{};
  for(dk in ld0)del[dk]=ld0[dk];
  for(dk in rd0){if(del[dk]===undefined){del[dk]=rd0[dk];tombChange=true}}
  m.del=del;
  // —— records 并集（同 id 本地为准；墓碑中的 id 不参与合并）——
  m.records=isArr(m.records)?m.records:[];
  var beforeLen=m.records.length;
  m.records=m.records.filter(function(r){return !(r&&r.id&&del['r:'+r.id])});
  if(m.records.length!==beforeLen)changed=true;
  ids={};
  for(i=0;i<m.records.length;i++)ids[m.records[i].id]=1;
  var rr=isArr(rem.records)?rem.records:[];
  for(i=0;i<rr.length;i++){var r0=rr[i];if(r0&&r0.id&&!ids[r0.id]&&!del['r:'+r0.id]){m.records.push(r0);ids[r0.id]=1;changed=true}}
  // —— exchanges 并集（同样尊重墓碑）——
  m.exchanges=isArr(m.exchanges)?m.exchanges:[];
  var beforeLen2=m.exchanges.length;
  m.exchanges=m.exchanges.filter(function(e){return !(e&&e.id&&del['e:'+e.id])});
  if(m.exchanges.length!==beforeLen2)changed=true;
  ids={};
  for(i=0;i<m.exchanges.length;i++)ids[m.exchanges[i].id]=1;
  var re0=isArr(rem.exchanges)?rem.exchanges:[];
  for(i=0;i<re0.length;i++){var e0=re0[i];if(e0&&e0.id&&!ids[e0.id]&&!del['e:'+e0.id]){m.exchanges.push(e0);ids[e0.id]=1;changed=true}}
  if(tombChange)changed=true;
  // —— 流水排序 + 总分重算（totalPoints 恒 = Σrecords.score − Σexchanges.cost）——
  var byTime=function(a,b){if(a.date!==b.date)return a.date<b.date?-1:1;return (a.timestamp||0)-(b.timestamp||0)};
  m.records.sort(byTime);m.exchanges.sort(byTime);
  var tp=0;
  for(i=0;i<m.records.length;i++)tp+=(m.records[i]&&m.records[i].score)||0;
  for(i=0;i<m.exchanges.length;i++)tp-=(m.exchanges[i]&&m.exchanges[i].cost)||0;
  if(tp!==m.totalPoints){m.totalPoints=tp;changed=true}
  // —— 刷题与成就数据并集（前后 JSON 比对判定变化）——
  var before=JSON.stringify([m.quizDone||null,m.quizWrong||null,m.quizExcluded||null,m.quizWrongMeta||null,m.quizStreak||null]);
  m.quizDone=mergeArrMaps(m.quizDone,rem.quizDone);
  m.quizWrong=mergeArrMaps(m.quizWrong,rem.quizWrong);
  m.quizExcluded=mergeArrMaps(m.quizExcluded,rem.quizExcluded);
  m.quizWrongMeta=mergeNumMaps(m.quizWrongMeta,rem.quizWrongMeta);
  m.quizStreak=mergeStreak(m.quizStreak,rem.quizStreak);
  var after=JSON.stringify([m.quizDone||null,m.quizWrong||null,m.quizExcluded||null,m.quizWrongMeta||null,m.quizStreak||null]);
  if(before!==after)changed=true;
  // —— 配置类字段（记分项/兑换项/愿望/盲盒周标记）：此前完全没合并，导致"手机设了平板看不到、盲盒能重复抽" ——
  //    规则：按配置最后修改时间 cfgAt 取较新的一侧整块覆盖（配置是"谁最后改谁说了算"，不做逐项并集）
  var CONF_KEYS=['wish','shopItems','upItems','downItems'];
  var lAt=m.cfgAt||0, rAt=rem.cfgAt||0;
  if(rAt>lAt){
    for(var ci=0;ci<CONF_KEYS.length;ci++){
      var k2=CONF_KEYS[ci];
      if(rem[k2]===undefined)continue;
      if(JSON.stringify(m[k2])!==JSON.stringify(rem[k2])){
        try{m[k2]=JSON.parse(JSON.stringify(rem[k2]))}catch(e){}
        changed=true;
      }
    }
    m.cfgAt=rAt;
  }
  /* 盲盒「本周已抽」标记：周编号单调递增，一律取更大者（防多设备各抽一次） */
  if(rem.ckBlindWeek&&(!m.ckBlindWeek||rem.ckBlindWeek>m.ckBlindWeek)){m.ckBlindWeek=rem.ckBlindWeek;changed=true}
  if(rem.ckBlindAt&&(!m.ckBlindAt||rem.ckBlindAt>(m.ckBlindAt||0))){m.ckBlindAt=rem.ckBlindAt;}
  // —— 账号字段：本地优先，缺失补云端 ——
  var fill=function(k){if((m[k]===undefined||m[k]===null||m[k]==='')&&rem[k]!==undefined&&rem[k]!==null&&rem[k]!==''){m[k]=rem[k];changed=true}};
  fill('ownerName');fill('pinSalt');fill('pinHash');fill('role');
  return {data:m,changed:changed};
}
function utf8ToB64(str){return btoa(unescape(encodeURIComponent(str)))}
function b64ToUtf8(b64){return decodeURIComponent(escape(atob(b64)))}
function ghPutBody(msg,contentB64,sha){ // GitHub Contents API：更新已有文件才带 sha；新建文件绝不能带空 sha（否则 422，曾导致新建通道文件失败）
  var b={message:msg,content:contentB64};
  if(sha)b.sha=sha;
  return JSON.stringify(b);
}

/* ===== 统一同步通道（所有云端文件共用一套流程）=====
   此前账本/打卡/专注/请求各写一套 GET→合并→PUT→重试，复制粘贴导致空 sha、409 冲突、
   覆盖丢失等事故在每条通道重复发生。现统一为：
     ghApiGet / ghApiPut        —— 底层读写（含 404、空 sha 规避、错误 message 提取）
     syncChannelPush           —— 通用推送：GET → 合并 → PUT → 409 重新拉取合并后重试
     syncChannelPull           —— 通用拉取：GET → 合并 → 交业务落盘
   业务只需提供 merge(localAll, remoteAll) → { all, merged } 与文案。 */
function ghApiGet(api){
  return fetch(api,{headers:{'Authorization':'token '+getSyncToken()}})
    .then(function(r){
      if(r.status===404)return {sha:'',obj:null,notFound:true}; /* 文件尚未创建 */
      if(!r.ok){
        return r.json().then(function(j){throw {code:r.status,msg:(j&&j.message)||''}})
          .catch(function(e){throw (e&&e.code)?e:{code:r.status,msg:''}});
      }
      return r.json().then(function(meta){
        var obj=null;
        if(meta.content){try{obj=JSON.parse(b64ToUtf8(meta.content))}catch(e){obj=null}}
        return {sha:meta.sha||'',obj:obj};
      });
    });
}
function ghApiPut(api,obj,sha,msg){
  return fetch(api,{method:'PUT',headers:{'Authorization':'token '+getSyncToken(),'Content-Type':'application/json'},body:ghPutBody(msg,utf8ToB64(JSON.stringify(obj)),sha)})
    .then(function(r){
      if(r.ok)return {ok:true,code:200,msg:''};
      return r.json().then(function(j){return {ok:false,code:r.status,msg:(j&&j.message)||''}})
        .catch(function(){return {ok:false,code:r.status,msg:''}});
    });
}
/* 通用推送：opts={api,msg,local():整份本地数据,merge(localAll,remoteAll):{all,merged,...},maxRetry,onBusy}
   返回 Promise<{ok,code,msg,merged,extra}> */
function syncChannelPush(opts){
  var tries=0;
  function attempt(){
    tries++;
    return ghApiGet(opts.api).then(function(g){
      var remoteAll=g.obj||{};
      var m=opts.merge(opts.local?opts.local():null,remoteAll)||{};
      return ghApiPut(opts.api,m.all,g.sha,opts.msg).then(function(p){
        if(p.ok)return {ok:true,code:200,msg:'',merged:m.merged,extra:m};
        if(p.code===409&&tries<(opts.maxRetry||3))return attempt(); /* sha 冲突：重新拉最新内容合并后再推 */
        return {ok:false,code:p.code,msg:p.msg,merged:m.merged,extra:m};
      });
    }).catch(function(e){
      return {ok:false,code:(e&&e.code)||0,msg:(e&&e.msg)||'网络异常，稍后自动重试'};
    });
  }
  return attempt();
}
/* 通用拉取：opts={api,merge(localAll,remoteAll):{all,merged,...},onResult(res)} */
function syncChannelPull(opts){
  return ghApiGet(opts.api).then(function(g){
    var remoteAll=g.obj||{};
    var m=opts.merge(opts.local?opts.local():null,remoteAll)||{};
    if(opts.onResult)opts.onResult(m,g);
    return m;
  }).catch(function(e){
    if(opts.onError)opts.onError(e);
    return null;
  });
}
function syncPull(phone){
  var token=getSyncToken();
  var verAtReq=dataVersion; // 请求发起时的本地写版本，用于过期响应守卫
  if(!token){ // 未配置：跳过，不报错
    syncStatus='off';syncErr='';
    updateSyncUI();
    return Promise.resolve(ld());
  }
  syncStatus='loading';syncErr='';
  updateSyncUI();
  return fetch(GH_API,{headers:{'Authorization':'token '+token}})
    .then(function(r){
      if(r.status===401){ // token 无效
        syncStatus='error';syncErr='token 无效或无权限，请到设置页重新填写';
        updateSyncUI();
        return ld();
      }
      if(r.status===404){ // 云端数据文件尚未创建（新仓库首次使用，正常态）：不报错，本地照常
        syncStatus='empty';syncErr='';
        updateSyncUI();
        retryPendingSync(); // 云端为空 → 有待推改动时立即补推（快速建立云端首份数据）
        return ld();
      }
      if(!r.ok){
        syncStatus='error';syncErr='同步失败（HTTP '+r.status+'）';
        updateSyncUI();
        return ld();
      }
      return r.json().then(function(meta){
        syncSHA=meta.sha||'';
        // 过期响应守卫：请求期间本地已发生写入（如快速记分/兑换），云端快照已过期，
        // 跳过缓存与应用，直接返回本地最新数据（下次拉取会自动补齐），避免旧数据覆盖新状态
        if(dataVersion!==verAtReq){
          syncStatus='synced';syncErr='';
          updateSyncUI();
          retryPendingSync(); // 拉取成功=网络可用：有待推改动时补推
          return ld();
        }
        if(meta.content){
          try{
            var content=b64ToUtf8(meta.content);
            var allData=JSON.parse(content);
            if(allData && allData[phone]){
              // 一律记录级合并（并集+墓碑+总分重算），绝不简单覆盖本地——本地未推的改动不会因 pull 丢失
              var lb=null;
              try{lb=JSON.parse(localStorage.getItem(userKey(phone)))}catch(e){lb=null}
              if(lb&&typeof lb==='object'){localStorage.setItem(userKey(phone),JSON.stringify(mergeAccountData(lb,allData[phone]).data))}
              else{localStorage.setItem(userKey(phone),JSON.stringify(allData[phone]))}
            }
          }catch(e){}
        }
        syncStatus='synced';syncErr='';
        updateSyncUI();
        retryPendingSync(); // 拉取成功=网络可用：有待推改动时补推
        return ld();
      });
    })
    .catch(function(){
      // 网络失败：本地数据不受影响
      syncStatus='error';syncErr='网络异常，同步失败，本地数据不受影响';
      updateSyncUI();
      return ld();
    });
}
function syncPush(data){
  if(sessionRole==='kid')return; // 孩子端只拉不推：任何路径都不会触发写云端
  if(!currentUser)return;
  var token=getSyncToken();
  if(!token){ // 未配置：跳过，不报错
    syncStatus='off';syncErr='';
    updateSyncUI();
    return;
  }
  syncStatus='loading';
  updateSyncUI();
  syncChannelPush({
    api:GH_API, msg:'sync:'+currentUser, maxRetry:3,
    local:function(){return data},
    merge:function(local,remoteAll){
      /* 记录级合并：远端同账号数据与本地并集（两台设备先后各记一笔不再互相覆盖） */
      var remote=(remoteAll&&typeof remoteAll==='object'&&Object.prototype.toString.call(remoteAll)!=='[object Array]')?remoteAll[currentUser]:null;
      var merged=mergeAccountData(local,remote);
      var all={};for(var k in remoteAll)all[k]=remoteAll[k];
      all[currentUser]=merged.data;
      return {all:all,merged:merged.data,changed:merged.changed};
    }
  }).then(function(res){
    if(res.ok){
      syncStatus='synced';syncErr='';clearPendingSync();
      if(res.extra&&res.extra.changed){ // 合并吸收了远端独有数据：回写本地并刷新界面
        try{localStorage.setItem(userKey(currentUser),JSON.stringify(res.merged))}catch(e){}
        if(ad===data)ad=res.merged;
        render();
      }
    }else{
      syncStatus='error';
      syncErr=(res.code===401)?'token 无效或无权限，请到设置页重新填写'
            :(res.code===403||res.code===404)?'token 权限不足：请检查是否勾选了 star-points-data 仓库且 Contents 为 Read and write'
            :(res.code?'同步失败（HTTP '+res.code+'），本地数据不受影响':'网络异常，同步失败，本地数据不受影响');
      markPendingSync();
    }
    updateSyncUI();
  });
}
// 同步状态合并进用户胶囊：6px 色点（绿=已同步，黄=同步中，红=失败，灰=未配置）
function updateSyncUI(){
  var el=document.getElementById('syncStatus');
  if(!el)return;
  var c='sync-dot';
  if(syncStatus==='loading')c+=' wait';
  else if(syncStatus==='synced')c+=' ok';
  else if(syncStatus==='error')c+=' err';
  else c+=' off';
  el.className=c;
  renderSyncSettings();
  ckBlindPoolRender();
}
// ===== 设置页「云端同步」区块 =====
function renderSyncSettings(){
  var line=document.getElementById('syncStateLine');
  if(!line)return;
  var inp=document.getElementById('syncTokenInput');
  var token=getSyncToken();
  // 回填已保存 token（密码框掩码显示）；输入框聚焦时不回填，避免打断输入
  if(inp && document.activeElement!==inp){
    var cur=inp.value.trim();
    if(cur!==token) inp.value=token;
  }
  var dot='off',txt='';
  if(!token){
    dot='off';txt='未配置：填入 token 后即可多设备同步';
  }else if(syncStatus==='loading'){
    dot='wait';txt='已配置 · 同步中…';
  }else if(syncStatus==='synced'){
    dot='ok';txt='已配置 · 最近同步成功'+(hasPendingSync()?' · 有改动待补推':'');
  }else if(syncStatus==='empty'){
    dot='off';txt='已配置 · 云端暂无数据，首次记分后自动创建';
  }else if(syncStatus==='error'){
    dot='err';txt=syncErr||'同步失败';
  }else{
    dot='ok';txt='已配置';
  }
  line.innerHTML='<span class="sync-dot '+dot+'"></span><span class="sync-line-t">'+txt+'</span>';
}
// 保存 token：写入 localStorage 并立即触发一次 syncPull 验证
function saveSyncToken(){
  var inp=document.getElementById('syncTokenInput');
  var v=inp.value.trim();
  if(!v){toast('请输入 GitHub token','err');return}
  try{localStorage.setItem(TOKEN_KEY,v)}catch(e){toast('保存失败','err');return}
  toast('已保存，正在验证同步…','ok');
  if(currentUser){
    syncPull(currentUser).then(function(data){
      ad=data;
      qzApplyBucketQuiz(data); // 刷题进度/错题/剔除随桶应用（旧桶无字段时按缺失处理）
      render();
      retryPendingSync(); // token 修复/首次配置后立即补推待同步改动
    });
  }else{
    syncStatus='off';syncErr='';updateSyncUI();
  }
}
function doSync(){
  if(!currentUser)return;
  syncPull(currentUser).then(function(data){
    ad=data;
    qzApplyBucketQuiz(data);
    render();
  });
}
