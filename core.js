var SK='***';
var USER_KEY='star_users';
var CURR_KEY='star_current';
/* ===== 云端同步配置 =====
   数据仓库（私有）：wxx-1006/star-points-data，数据文件 sync-data.json。
   token 运行时输入：用户在设置页填入 Fine-grained token，仅存本机 localStorage，
   严禁硬编码。无 token 时同步静默跳过（色点灰），本地功能不受影响。 */
var GH_REPO='wxx-1006/star-points-data';
var GH_FILE='sync-data.json';
var GH_API='https://api.github.com/repos/'+GH_REPO+'/contents/'+GH_FILE;
var TOKEN_KEY='sp_gh_token';
var KID_KEY='sp_kid_session'; // 孩子端本机会话 {parentPhone,nickname}，不入 star_users、不上云
var syncSHA='';
var dataVersion=0;    // 本地数据写版本：sd() 每次写 +1，用于丢弃迟到的过期同步快照
var currentUser=null;
var ad=null;            // 当前账号数据桶；init 首次 syncPull 返回前为 null（显式声明，避免读 ad 抛 ReferenceError）
var sessionRole=null;   // 'parent' | 'kid' | null（未登录）。kid=只读视角：不写桶、绝不 syncPush
var loginRole='parent'; // 登录页当前选中角色（'parent' | 'kid'）
var pendingLogin=null;  // PIN 验证期间挂起的家长身份 {phone,name}
var syncStatus='off'; // off(未配置/灰) | loading(黄) | synced(绿) | error(红)
var syncErr='';       // 最近一次同步失败提示，显示在设置页「云端同步」状态行
function getSyncToken(){try{return localStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}}
function getUsers(){try{var r=localStorage.getItem(USER_KEY);if(r)return JSON.parse(r)}catch(e){}return[]}
function saveUsers(u){try{localStorage.setItem(USER_KEY,JSON.stringify(u))}catch(e){}}
function getCurrentPhone(){try{return localStorage.getItem(CURR_KEY)||null}catch(e){}return null}
function setCurrentPhone(p){try{localStorage.setItem(CURR_KEY,p)}catch(e){}}
function userKey(phone){return SK+'_'+phone}
function ld(){var phone=currentUser;if(!phone)return gd();try{var r=localStorage.getItem(userKey(phone));if(r){var b=JSON.parse(r);if(b&&b.del){ // 载入时按删除墓碑过滤，清理由旧版本同步复活的流水
  b.records=(b.records||[]).filter(function(x){return !(x&&x.id&&b.del['r:'+x.id])});
  b.exchanges=(b.exchanges||[]).filter(function(x){return !(x&&x.id&&b.del['e:'+x.id])});
}return b}}catch(e){}return gd()}
function rdSumScore(d){ // 总分唯一口径：Σrecords.score − Σexchanges.cost（与同步合并重算一致；跳过删除墓碑，保证与可见明细一致）
  var tp=0,i,rs=d&&d.records,es=d&&d.exchanges,del=(d&&d.del)||{};
  if(rs)for(i=0;i<rs.length;i++){var r=rs[i];if(r&&(!r.id||!del['r:'+r.id]))tp+=(r.score)||0;}
  if(es)for(i=0;i<es.length;i++){var e=es[i];if(e&&(!e.id||!del['e:'+e.id]))tp-=(e.cost)||0;}
  return tp;
}
/* ★ 总分是【派生值】，不是独立存储值：唯一口径 = Σrecords.score − Σexchanges.cost（已删除记录不计）。
   业务代码请只写流水（records/exchanges），总分行上的 += / -= 仅作即时显示用，
   保存时一律由本函数重算——历史上多次"总分对不上"都源于同一处被改了两遍。 */
var gCfgSnap='';
function sd(d){if(sessionRole==='kid')return;var phone=currentUser;if(!phone)return;
  try{
    var confNow=JSON.stringify([d.wish||null,d.shopItems||null,d.upItems||null,d.downItems||null]);
    if(gCfgSnap&&gCfgSnap!==confNow)d.cfgAt=Date.now(); /* 配置变更打时间戳：多设备合并时据此取新侧 */
    gCfgSnap=confNow;
  }catch(e){}
  var del=d.del||{}; // 删除墓碑清理：已删记录不留在账本里（防"总分含、明细看不见"的幽灵记录）
  if(d.records)d.records=d.records.filter(function(r){return !(r&&r.id&&del['r:'+r.id])});
  if(d.exchanges)d.exchanges=d.exchanges.filter(function(e){return !(e&&e.id&&del['e:'+e.id])});
  d.totalPoints=rdSumScore(d); // 每次保存按流水重算总分：消除增量加减/重复补记导致的总分漂移
  dataVersion++;try{localStorage.setItem(userKey(phone),JSON.stringify(d))}catch(e){};syncPush(d)}
function migrateOldData(phone){try{var old=localStorage.getItem(SK);if(old&&phone){var parsed=JSON.parse(old);if(parsed.records&&parsed.records.length>0){localStorage.setItem(userKey(phone),JSON.stringify(parsed));toast('已迁移历史数据')}}}catch(e){}}

// ===== 家长 PIN 与角色（新增能力，不动现有字段/键） =====
// 存储位置：账号数据桶（SK_<phone>）新增 pinHash/pinSalt/role 三个字段，
// 随 sd() 一起同步上云 → 新设备 syncPull 后即可校验 PIN。
// hash：纯 JS SHA-256(salt + pin)，同步实现，node/jsdom/浏览器均可用。
function sha256hex(ascii){
  function rightRotate(v,a){return (v>>>a)|(v<<(32-a));}
  var mathPow=Math.pow,maxWord=mathPow(2,32),result='',words=[],asciiBitLength=ascii.length*8;
  var hash=sha256hex.h=sha256hex.h||[],k=sha256hex.k=sha256hex.k||[],primeCounter=k.length;
  var isComposite={},i,j;
  for(var candidate=2;primeCounter<64;candidate++){
    if(!isComposite[candidate]){
      for(i=0;i<313;i+=candidate)isComposite[i]=candidate;
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii.length%64-56)ascii+='\x00';
  for(i=0;i<ascii.length;i++){
    j=ascii.charCodeAt(i);
    if(j>>8)return ''; // 仅支持 ASCII 输入（盐为十六进制随机串，pin 为数字）
    words[i>>2]|=j<<((3-i)%4)*8;
  }
  words[words.length]=(asciiBitLength/maxWord)|0;
  words[words.length]=asciiBitLength;
  for(j=0;j<words.length;){
    var w=words.slice(j,j+=16),oldHash=hash;
    hash=hash.slice(0,8);
    for(i=0;i<64;i++){
      var w15=w[i-15],w2=w[i-2];
      var a=hash[0],e=hash[4];
      var temp1=hash[7]
        +(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))
        +((e&hash[5])^((~e)&hash[6]))
        +k[i]
        +(w[i]=(i<16)?w[i]:(w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))+w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0);
      var temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
    }
    for(i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;
  }
  for(i=0;i<8;i++){
    for(j=3;j+1;j--){
      var b=(hash[i]>>(j*8))&255;
      result+=((b<16)?0:'')+b.toString(16);
    }
  }
  return result;
}
function genSalt(){var s='';for(var i=0;i<8;i++)s+=Math.floor(Math.random()*16).toString(16);return s}
// 直读本地数据桶（不经 currentUser），供登录前 PIN 校验使用
function loadBucket(phone){try{var r=localStorage.getItem(userKey(phone));if(r)return JSON.parse(r)}catch(e){}return null}
function readKidSession(){try{var r=localStorage.getItem(KID_KEY);if(r)return JSON.parse(r)}catch(e){}return null}
function clearKidSession(){try{localStorage.removeItem(KID_KEY)}catch(e){}}
// 判断账号是否已有 PIN：先看本地桶；本地没有且配置了 token 时拉一次云端再查
// （syncPull 会把 allData[phone] 缓存进本地桶，故拉完重读即可）。返回 Promise<boolean>
function ensurePinKnown(phone){
  var b=loadBucket(phone);
  if(b&&b.pinHash)return Promise.resolve(true);
  if(!getSyncToken())return Promise.resolve(false);
  return syncPull(phone).then(function(){
    var b2=loadBucket(phone);
    return !!(b2&&b2.pinHash);
  });
}
var du=[
{id:'up_1',name:'按时完成作业',score:5,category:'学习'},
{id:'up_2',name:'完成额外作业',score:5,category:'学习',unit:'项'},
{id:'up_3',name:'作业全对/优秀',score:10,category:'学习'},
{id:'up_4',name:'被老师表扬',score:10,category:'学习'},
{id:'up_5',name:'主动预习',score:5,category:'学习'},
{id:'up_6',name:'主动复习',score:5,category:'学习'},
{id:'up_7',name:'阅读课外书(≥20分钟)',score:8,category:'学习'},
{id:'up_8',name:'读完一本书并分享',score:15,category:'学习'},
{id:'up_9',name:'学会新技能并分享',score:10,category:'学习'},
{id:'up_10',name:'考试进步',score:15,category:'学习'},
{id:'up_11',name:'考试满分/前3名',score:20,category:'学习'},
{id:'up_12',name:'背课文/单词达标',score:5,category:'学习'},
{id:'up_13',name:'练字认真(≥15分钟)',score:5,category:'学习'},
{id:'up_14',name:'整理错题本',score:8,category:'学习'},
{id:'up_15',name:'按时起床(不赖床)',score:3,category:'生活'},
{id:'up_16',name:'自己穿衣',score:5,category:'生活'},
{id:'up_17',name:'自己刷牙洗脸',score:3,category:'生活'},
{id:'up_18',name:'自己整理书包',score:5,category:'生活'},
{id:'up_19',name:'整理书桌',score:5,category:'生活'},
{id:'up_20',name:'收拾玩具/房间',score:5,category:'生活'},
{id:'up_21',name:'自己叠被子',score:3,category:'生活'},
{id:'up_22',name:'按时上床睡觉',score:3,category:'生活'},
{id:'up_23',name:'独立睡觉',score:10,category:'生活'},
{id:'up_24',name:'好好吃饭(不挑食)',score:5,category:'饮食'},
{id:'up_25',name:'主动喝水(≥4杯)',score:3,category:'饮食'},
{id:'up_26',name:'光盘行动',score:3,category:'饮食'},
{id:'up_27',name:'尝试新食物',score:8,category:'饮食'},
{id:'up_28',name:'饭后收拾碗筷',score:3,category:'饮食'},
{id:'up_29',name:'主动说礼貌用语',score:3,category:'品德'},
{id:'up_30',name:'分享玩具/食物',score:5,category:'品德'},
{id:'up_31',name:'诚实承认错误',score:10,category:'品德'},
{id:'up_32',name:'帮助家人',score:5,category:'品德'},
{id:'up_33',name:'帮助同学/朋友',score:8,category:'品德'},
{id:'up_34',name:'耐心等待不插队',score:3,category:'品德'},
{id:'up_35',name:'控制情绪不哭闹',score:10,category:'品德'},
{id:'up_36',name:'遵守约定/规则',score:5,category:'品德'},
{id:'up_37',name:'主动道歉',score:5,category:'品德'},
{id:'up_38',name:'爱护公共物品',score:5,category:'品德'},
{id:'up_39',name:'户外运动≥30分钟',score:8,category:'运动'},
{id:'up_40',name:'户外运动≥1小时',score:12,category:'运动'},
{id:'up_41',name:'认真做眼保健操',score:3,category:'运动'},
{id:'up_42',name:'注意护眼',score:3,category:'运动'},
{id:'up_43',name:'学会新运动技能',score:15,category:'运动'},
{id:'up_44',name:'按约定时间使用电子产品',score:3,category:'电子产品'},
{id:'up_45',name:'到点主动关掉平板',score:5,category:'电子产品'},
{id:'up_46',name:'练习乐器≥20分钟',score:8,category:'兴趣'},
{id:'up_47',name:'练习乐器≥40分钟',score:12,category:'兴趣'},
{id:'up_48',name:'完成一幅画',score:10,category:'兴趣'},
{id:'up_49',name:'完成手工/搭建作品',score:15,category:'兴趣'},
{id:'up_50',name:'兴趣班表现积极',score:5,category:'兴趣'},
{id:'up_51',name:'兴趣班获奖/表扬',score:15,category:'兴趣'},
{id:'up_52',name:'主动创作',score:10,category:'兴趣'},
{id:'up_53',name:'帮忙摆碗筷',score:3,category:'家务'},
{id:'up_54',name:'帮忙收碗筷/擦桌子',score:5,category:'家务'},
{id:'up_55',name:'帮忙择菜/洗菜',score:5,category:'家务'},
{id:'up_56',name:'帮忙扫地/拖地',score:8,category:'家务'},
{id:'up_57',name:'帮忙倒垃圾',score:3,category:'家务'},
{id:'up_58',name:'帮忙晾/收衣服',score:5,category:'家务'},
{id:'up_59',name:'帮忙浇花',score:3,category:'家务'},
{id:'up_60',name:'照顾弟弟妹妹',score:8,category:'家务'},
{id:'up_61',name:'整理衣柜/叠衣服',score:10,category:'家务'},
{id:'up_62',name:'帮忙洗车',score:10,category:'家务'}
];
var dwn=[
{id:'down_1',name:'赖床/叫多次不起',score:3,category:'生活'},
{id:'down_2',name:'挑食/只吃喜欢的菜',score:3,category:'饮食'},
{id:'down_3',name:'吃饭拖拉(>40分钟)',score:5,category:'饮食'},
{id:'down_4',name:'浪费食物',score:5,category:'饮食'},
{id:'down_5',name:'饭前吃零食',score:5,category:'饮食'},
{id:'down_6',name:'不做眼保健操',score:3,category:'运动'},
{id:'down_7',name:'一整天不运动',score:5,category:'运动'},
{id:'down_8',name:'坐姿不对提醒不改',score:3,category:'运动'},
{id:'down_9',name:'电子产品超时',score:5,category:'电子产品'},
{id:'down_10',name:'到点不关还讨价还价',score:8,category:'电子产品'},
{id:'down_11',name:'偷玩电子产品',score:10,category:'电子产品'},
{id:'down_12',name:'发脾气/摔东西',score:8,category:'品德'},
{id:'down_13',name:'说粗话/骂人',score:8,category:'品德'},
{id:'down_14',name:'撒谎/隐瞒',score:10,category:'品德'},
{id:'down_15',name:'未经允许拿别人东西',score:8,category:'品德'},
{id:'down_16',name:'欺负弟弟妹妹/同学',score:10,category:'品德'},
{id:'down_17',name:'缺勤兴趣班(无正当理由)',score:5,category:'兴趣'}
];
var dsh=[
{id:'shop_1',name:'看动画片30分钟',cost:15,icon:'📺',desc:'周末可用'},
{id:'shop_2',name:'选今晚的晚餐菜',cost:20,icon:'🍳',desc:'有一定决定权'},
{id:'shop_3',name:'多玩15分钟平板',cost:20,icon:'📱',desc:'在基础时间上加'},
{id:'shop_4',name:'买小零食/小玩具(≤10元)',cost:25,icon:'🍬',desc:'超市自选'},
{id:'shop_5',name:'选睡前故事',cost:10,icon:'📖',desc:'从书架上自己选'},
{id:'shop_6',name:'决定周末早餐',cost:15,icon:'🥐',desc:'披萨/煎饼/三明治等'},
{id:'shop_7',name:'晚睡30分钟(周末)',cost:20,icon:'🌙',desc:'周末特例'},
{id:'shop_8',name:'选全家电影',cost:25,icon:'🎬',desc:'家庭电影夜'},
{id:'shop_9',name:'买一本喜欢的书',cost:50,icon:'📚',desc:'书店/网店自选'},
{id:'shop_10',name:'买小玩具(≤30元)',cost:80,icon:'🧸',desc:'生日/节日除外'},
{id:'shop_11',name:'去游乐场玩一次',cost:100,icon:'🎢',desc:'周末家庭活动'},
{id:'shop_12',name:'邀请好朋友来玩',cost:60,icon:'👫',desc:'需要提前约定'},
{id:'shop_13',name:'买贴纸/盲盒',cost:40,icon:'🎯',desc:'文具店自选'},
{id:'shop_14',name:'去肯德基/麦当劳',cost:70,icon:'🍟',desc:'全家一起'},
{id:'shop_15',name:'买彩笔/画具',cost:60,icon:'🎨',desc:'美术用品'},
{id:'shop_16',name:'去儿童乐园',cost:90,icon:'🏰',desc:'室内蹦床/淘气堡'},
{id:'shop_17',name:'买大玩具(≤100元)',cost:300,icon:'🎁',desc:'需要提前申请'},
{id:'shop_18',name:'去动物园/科技馆',cost:200,icon:'🦁',desc:'全家出行'},
{id:'shop_19',name:'去水上乐园',cost:250,icon:'🏊',desc:'夏季限定'},
{id:'shop_20',name:'买乐高/拼装玩具',cost:350,icon:'🧩',desc:'按预算调整'},
{id:'shop_21',name:'旅行选择权',cost:500,icon:'✈️',desc:'参与目的地决策'},
{id:'shop_22',name:'实现一个小愿望',cost:400,icon:'🌟',desc:'合理范围内'},
{id:'shop_23',name:'买运动鞋/新衣服',cost:280,icon:'👟',desc:'商场自选'},
{id:'shop_24',name:'参加付费体验课',cost:200,icon:'🔬',desc:'陶艺/烘焙/科学实验'}
];

function gd(){return{totalPoints:0,records:[],exchanges:[],upItems:JSON.parse(JSON.stringify(du)),downItems:JSON.parse(JSON.stringify(dwn)),shopItems:JSON.parse(JSON.stringify(dsh))}}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

function minRecordDate(){
  var d=new Date();
  d.setDate(d.getDate()-6);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function fd(ds){var d=new Date(ds);var m=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];var w=['周日','周一','周二','周三','周四','周五','周六'];return d.getFullYear()+'年'+m[d.getMonth()]+d.getDate()+'日 '+w[d.getDay()]}
function fdt(ts){var d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
// toast：深底白字，成功左侧绿点 / 失败左侧红点
function toast(m,type){var t=document.getElementById('toast');t.classList.remove('ok','err');if(type)t.classList.add(type);document.getElementById('toTx').textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000)}
var pc=null;
function sc2(t,x,c){document.getElementById('ct2t').textContent=t;document.getElementById('ct2x').textContent=x;pc=c;document.getElementById('ct2b').classList.toggle('bn-dg',t.indexOf('删除')>=0);document.getElementById('cd2').classList.add('show')}
function cc(){document.getElementById('cd2').classList.remove('show');pc=null}
function ec(){if(pc)pc();cc()}

// 类别色点固定映射（§3.4）
function catColor(c){var m={'学习':'var(--blue)','生活':'var(--green)','饮食':'var(--yellow)','品德':'var(--red)','运动':'var(--green)','电子产品':'var(--blue)','兴趣':'var(--yellow)','家务':'var(--ink2)'};return m[c]||'var(--ink2)'}
// 空状态积木插画（§4.13）
function esBricks(){return '<div class="es-bricks" aria-hidden="true"><span class="b b1"></span><span class="b b2"></span><span class="b b3"></span></div>'}
// 头像四色轮换（red/blue/green/yellow 按序）
var AVCOLORS=['var(--red)','var(--blue)','var(--green)','var(--yellow)'];

// ===== 登录管理 =====
// 登录页角色分段切换：家长=完整功能；孩子=只读视角（只需输入家长手机号，昵称自动匹配账本）
function setLoginRole(r){
  loginRole=r;
  document.getElementById('segParent').classList.toggle('on',r==='parent');
  document.getElementById('segKid').classList.toggle('on',r==='kid');
  document.getElementById('parentFields').style.display=r==='parent'?'':'none';
  document.getElementById('kidFields').style.display=r==='kid'?'':'none';
  if(r==='kid'){
    // 切到孩子角色：清空匹配提示，从零开始
    var h=document.getElementById('kidMatchHint');
    h.textContent='';h.className='login-hint';
  }
  hidePinStep();
}
// ===== 家长登录：手机号 + PIN（密码式登录）=====
// 流程：手机号输入满 11 位/失焦 → 静默检测（本地桶 → 有 token 时拉云端桶）区分
// 老用户（有 pinHash，输 PIN 验证）/ 老老账号（有桶无 pinHash，登录时补设）/ 新用户（无桶，弹注册）。
// 姓名仅在注册时设置（写入 star_users + 桶 ownerName），登录不再校验/更新姓名，
// 避免把老账号姓名覆盖为空。PIN 机制不变：sha256(salt+pin)。
// 手机号检测：输入满 11 位防抖 400ms 触发，失焦立即触发；detectSeq 丢弃过期响应
var detectTimer=null,detectSeq=0;
function setLoginDetectHint(t,cls){var h=document.getElementById('loginDetectHint');if(!h)return;h.textContent=t;h.className='login-hint'+(cls?' '+cls:'')}
function onLoginPhoneInput(){
  var v=document.getElementById('loginPhone').value.trim();
  if(v.length<11){clearTimeout(detectTimer);setLoginDetectHint('','');return}
  clearTimeout(detectTimer);
  detectTimer=setTimeout(checkLoginPhone,400);
}
function checkLoginPhone(){
  var phone=document.getElementById('loginPhone').value.trim();
  if(phone.length<11){setLoginDetectHint('','');return}
  var seq=++detectSeq;
  var b=loadBucket(phone);
  if(b&&b.pinHash){setLoginDetectHint('找到账本，输入 PIN 登录','ok');return}
  if(b&&!getSyncToken()){setLoginDetectHint('该账本尚未设置 PIN，点击登录后设置','ok');return}
  if(!b&&!getSyncToken()){setLoginDetectHint('本机无此账本；新设备请点下方「配置同步令牌」找回','nu');return}
  setLoginDetectHint('正在查找账本…','na');
  syncPull(phone).then(function(){
    if(seq!==detectSeq)return; // 过期检测：手机号已改动，丢弃本次结果
    var b2=loadBucket(phone);
    if(b2&&b2.pinHash)setLoginDetectHint('找到账本，输入 PIN 登录','ok');
    else if(b2)setLoginDetectHint('该账本尚未设置 PIN，点击登录后设置','ok');
    else if(!getSyncToken())setLoginDetectHint('本机无此账本；新设备请点下方「配置同步令牌」找回','nu');
    else setLoginDetectHint('新用户：点击登录后将创建账本','nu');
  });
}
function doLogin(){
  if(loginRole==='kid'){doKidLogin();return}
  var phone=document.getElementById('loginPhone').value.trim();
  if(!/^\d{11}$/.test(phone)){toast('请输入正确的手机号','err');return}
  var b=loadBucket(phone);
  if(!b&&getSyncToken()){
    // 本地无桶：登录前静默拉一次云端兜底，防止防抖未完成时误判为新用户
    setLoginDetectHint('正在查找账本…','na');
    syncPull(phone).then(function(){doLoginResolve(phone,loadBucket(phone),true)});
    return;
  }
  doLoginResolve(phone,b,false);
}
function doLoginResolve(phone,b,pulled){
  if(!b){openRegister(phone);return}
  if(b.pinHash){
    var pin=document.getElementById('loginPinInput').value.trim();
    if(!/^\d{4}$/.test(pin)){toast('请输入 4 位数字 PIN','err');return}
    if(b.pinSalt&&sha256hex(b.pinSalt+pin)===b.pinHash){
      finishParentEntry(phone,b.ownerName||matchLocalName(phone));
      return;
    }
    // 本地 PIN 不匹配：配置了 token 时拉云端重试一次（覆盖「其他设备改过 PIN」的本地旧桶场景）
    if(!getSyncToken()){toast('PIN 错误','err');return}
    setLoginDetectHint('正在校验 PIN…','na');
    syncPull(phone).then(function(){
      var b2=loadBucket(phone);
      if(b2&&b2.pinHash&&b2.pinSalt&&sha256hex(b2.pinSalt+pin)===b2.pinHash)finishParentEntry(phone,b2.ownerName||matchLocalName(phone));
      else toast('PIN 错误','err'); // 家庭场景：次数不设限
    });
    return;
  }
  // 桶存在但无 pinHash（老老账号）：token 可用时先拉云端刷新，避免本地旧桶误判
  if(!pulled&&getSyncToken()){
    setLoginDetectHint('正在查找账本…','na');
    syncPull(phone).then(function(){doLoginResolve(phone,loadBucket(phone),true)});
    return;
  }
  openPinInit(phone);
}
// ===== 注册（创建账本）弹窗：新用户设置姓名 + PIN =====
var regCtx=null; // {phone}
function openRegister(phone){
  var users=getUsers();
  if(!users.find(function(u){return u.phone===phone})&&users.length>=3){toast('最多支持3个账号','err');return}
  regCtx={phone:phone};
  document.getElementById('regName').value='';
  document.getElementById('regPin1').value='';
  document.getElementById('regPin2').value='';
  document.getElementById('regNotice').textContent=getSyncToken()
    ?'4 位数字 PIN 用于保护家长端，其他设备登录时输入手机号+PIN 即可，请牢记。'
    :'未配置同步，建议先在设置页配置以找回已有账本'; // 不阻断
  document.getElementById('mReg').classList.add('show');
}
function closeRegister(){regCtx=null;document.getElementById('mReg').classList.remove('show')}
function confirmRegister(){
  if(!regCtx)return;
  var phone=regCtx.phone;
  var name=document.getElementById('regName').value.trim();
  if(!name){toast('请输入孩子姓名','err');return}
  var p1=document.getElementById('regPin1').value.trim();
  var p2=document.getElementById('regPin2').value.trim();
  if(!/^\d{4}$/.test(p1)){toast('PIN 必须是 4 位数字','err');return}
  if(p1!==p2){toast('两次输入不一致','err');return}
  // 竞态保护：检测与创建之间云端桶刚出现 → 不新建，转 PIN 验证
  var b=loadBucket(phone);
  if(b&&b.pinHash){
    closeRegister();
    toast('该手机号已有账本，请输入 PIN 登录','err');
    setLoginDetectHint('找到账本，输入 PIN 登录','ok');
    return;
  }
  var salt=genSalt();
  var pinFields={pinSalt:salt,pinHash:sha256hex(salt+p1)};
  if(!b){b=gd()}
  b.pinSalt=pinFields.pinSalt;b.pinHash=pinFields.pinHash;b.role='parent';b.ownerName=name;
  try{localStorage.setItem(userKey(phone),JSON.stringify(b))}catch(e){}
  upsertUser(phone,name);
  regCtx=null;
  document.getElementById('mReg').classList.remove('show');
  finishParentEntry(phone,name);
  ensureBucketPin(phone,pinFields,name); // migrateOldData 若迁移旧全局数据覆盖了新桶，恢复 PIN 字段
  maybePinSetup(); // 兜底：正常路径桶已含 pinHash，不会弹
  pushBucketAfterEntry(); // 已配 token 时立即上云，其他设备即可用手机号+PIN 登录
}
// ===== 老老账号补设 PIN 弹窗（仅 PIN，姓名沿用桶内已有；绝不覆盖桶内已有数据）=====
var legacyCtx=null; // {phone,name}
function openPinInit(phone){
  var b=loadBucket(phone)||{};
  var name=b.ownerName||matchLocalName(phone)||'';
  legacyCtx={phone:phone,name:name};
  document.getElementById('pinInit1').value='';
  document.getElementById('pinInit2').value='';
  document.getElementById('pinInitNotice').textContent=name
    ?'账本「'+name+'」尚未设置 PIN，设置后即可用手机号+PIN 登录。'
    :'该账本尚未设置 PIN，设置后即可用手机号+PIN 登录。';
  document.getElementById('mPinInit').classList.add('show');
}
function closePinInit(){legacyCtx=null;document.getElementById('mPinInit').classList.remove('show')}
function saveInitPin(){
  if(!legacyCtx)return;
  var p1=document.getElementById('pinInit1').value.trim();
  var p2=document.getElementById('pinInit2').value.trim();
  if(!/^\d{4}$/.test(p1)){toast('PIN 必须是 4 位数字','err');return}
  if(p1!==p2){toast('两次输入不一致','err');return}
  var phone=legacyCtx.phone;
  var name=legacyCtx.name;
  // 覆盖保护：此刻桶里已有 pinHash（云端刚拉到）→ 不设置，转 PIN 验证
  var b=loadBucket(phone);
  if(b&&b.pinHash){
    closePinInit();
    toast('该账本已设置过 PIN，请输入 PIN 登录','err');
    setLoginDetectHint('找到账本，输入 PIN 登录','ok');
    return;
  }
  var salt=genSalt();
  var pinFields={pinSalt:salt,pinHash:sha256hex(salt+p1)};
  if(!b){b=gd()}
  b.pinSalt=pinFields.pinSalt;b.pinHash=pinFields.pinHash;b.role='parent';
  if(name&&!b.ownerName)b.ownerName=name;
  try{localStorage.setItem(userKey(phone),JSON.stringify(b))}catch(e){}
  if(name)upsertUser(phone,name);
  legacyCtx=null;
  document.getElementById('mPinInit').classList.remove('show');
  finishParentEntry(phone,name);
  ensureBucketPin(phone,pinFields,name);
  maybePinSetup(); // 兜底
  pushBucketAfterEntry(); // 把 pinHash 上云，其他设备可验证
}
// 迁移守卫：migrateOldData 可能把旧全局数据（SK）写入账号桶并覆盖 PIN 字段；
// 此处只补回 PIN 三字段与缺失的 ownerName，不触碰迁移来的其他数据（字段只增不改）
function ensureBucketPin(phone,pinFields,name){
  var b=loadBucket(phone);
  if(b&&b.pinHash)return;
  b=b||gd();
  b.pinSalt=pinFields.pinSalt;b.pinHash=pinFields.pinHash;b.role='parent';
  if(name&&!b.ownerName)b.ownerName=name;
  try{localStorage.setItem(userKey(phone),JSON.stringify(b))}catch(e){}
}
// 进入后按现有节奏上云：把含 pinHash 的桶推到云端（无 token 时静默跳过）
function pushBucketAfterEntry(){
  if(!getSyncToken())return;
  if(currentUser&&sessionRole==='parent'){ad=ld();sd(ad)}
}
// ===== 孩子登录：只输家长手机号，昵称自动从账本匹配 =====
// 匹配优先级：本地桶 ownerName > 本地账号名 > 「孩子」兜底。
// 账本存在性判定：本地桶有 records/exchanges 即视为存在；否则配置了 token 时
// 静默 syncPull 一次再查（syncPull 会把云端桶缓存进本地）。
function matchLocalName(phone){
  var u=getUsers().find(function(x){return x.phone===phone});
  return u?u.name:'';
}
function hasLedgerData(b){return !!(b&&(b.records||b.exchanges))}
function showKidHint(found,name){
  var h=document.getElementById('kidMatchHint');
  if(found){
    h.textContent='找到账本'+(name?('：'+name):'，可以进入');
    h.className='login-hint ok';
  }else{
    h.textContent='该手机号暂无账本，请让家长先登录一次';
    h.className='login-hint na';
  }
}
function clearKidHint(){
  var h=document.getElementById('kidMatchHint');
  h.textContent='';h.className='login-hint';
}
// 手机号输入满 11 位即触发静默匹配
function onKidPhoneInput(){
  var v=document.getElementById('kidPhone').value.trim();
  if(v.length>=11)checkKidPhone();
  else clearKidHint();
}
function checkKidPhone(){
  var phone=document.getElementById('kidPhone').value.trim();
  if(phone.length<11)return;
  var localName=matchLocalName(phone);
  var b=loadBucket(phone);
  if(b&&hasLedgerData(b)){showKidHint(true,b.ownerName||localName);return}
  if(!getSyncToken()){showKidHint(false,'');return}
  // 已配置 token：静默拉云端确认账本是否存在（复用 syncPull，只读不写）
  syncPull(phone).then(function(){
    var b2=loadBucket(phone);
    if(b2&&hasLedgerData(b2))showKidHint(true,b2.ownerName||localName);
    else showKidHint(false,'');
  });
}
// 孩子登录：不再输入昵称；账本不存在（无 token/云端无桶）则提示并阻止进入
function doKidLogin(){
  var phone=document.getElementById('kidPhone').value.trim();
  if(!phone||phone.length<11){toast('请输入正确的家长手机号','err');return}
  var localName=matchLocalName(phone);
  var b=loadBucket(phone);
  if(b&&hasLedgerData(b)){
    startKidSession(phone,b.ownerName||localName||'孩子');
    toast('已进入孩子视角（只读）','ok');
    return;
  }
  if(!getSyncToken()){toast('新设备需先配置同步令牌才能找到账本','err');ckTokOpen();return}
  toast('正在查找账本…');
  syncPull(phone).then(function(){
    var b2=loadBucket(phone);
    if(b2&&hasLedgerData(b2)){
      startKidSession(phone,b2.ownerName||localName||'孩子');
      toast('已进入孩子视角（只读）','ok');
    }else{
      toast('该手机号暂无账本，请让家长先登录一次','err');
    }
  });
}
function quickLogin(phone){
  var users=getUsers();
  var u=users.find(function(x){return x.phone===phone});
  var name=u?u.name:'';
  pendingLogin={phone:phone,name:name};
  ensurePinKnown(phone).then(function(hasPin){
    if(hasPin)showPinStep();
    else{finishParentEntry(phone,name);maybePinSetup()} // 无 PIN 历史账号：进入后强制补设
  });
}
// 家长身份落定：清理孩子会话 → 设为 parent 会话 → 进入 App。
// 注意：不再在此处调用 maybePinSetup——新流程下各登录入口保证桶内 pinHash 先于进入落定
// （注册/补设后还可能被 migrateOldData 覆盖，须先由 ensureBucketPin 恢复再判定）；
// switchUser/quickLogin 的无 PIN 分支在调用后显式补设。
function finishParentEntry(phone,name){
  clearKidSession();
  currentUser=phone;
  sessionRole='parent';
  setCurrentPhone(phone);
  if(name)upsertUser(phone,name);
  migrateOldData(phone);
  qzReloadForAccount(); // 刷题进度/错题/剔除按新账号本机键重建，防止上一账号内存态串号
  pendingLogin=null;
  hidePinStep();
  enterApp();
}
function upsertUser(phone,name){
  var users=getUsers();
  var exist=users.find(function(u){return u.phone===phone});
  if(!exist){users.push({phone:phone,name:name});saveUsers(users)}
}
// 家长端视图复位：孩子会话固定在记录页，切回家长时回落到首页
function showParentHomeView(){
  var pages=document.querySelectorAll('.pg');
  for(var i=0;i<pages.length;i++) pages[i].classList.remove('on');
  document.getElementById('p-home').classList.add('on');
  var tabs=document.querySelectorAll('.ti');
  for(var i=0;i<tabs.length;i++) tabs[i].classList.remove('on');
  document.querySelector('.tb .ti:nth-child(1)').classList.add('on');
  curTab='home';
}
function enterApp(){
  document.getElementById('loginPage').classList.remove('show');
  document.getElementById('mainHeader').style.display='';
  document.getElementById('userSwitch').style.display='';
  var users=getUsers();
  var u=users.find(function(x){return x.phone===currentUser});
  if(u){
    document.getElementById('usAvatar').textContent=u.name.charAt(0);
    document.getElementById('usName').textContent=u.name;
  }
  applyRoleUI();
  showParentHomeView(); // 家长进入一律落在首页
  // 从服务端拉取数据
  syncPull(currentUser).then(function(data){
    ad=data;
    qzApplyBucketQuiz(data); // 先应用刷题字段，确保随后 ensureOwnerName 的 sd() 携带完整刷题数据
    ensureOwnerName();
    renderAll(ad);
    if(sessionRole==='parent')checkRequests();
    retryPendingSync(); // 上次会话可能有推送失败：网络可用即补推
  });
}
// 账本名回写：把账本主人（孩子）姓名存入桶内 ownerName 字段（新增字段，不改既有字段），
// 供孩子端登录时自动匹配「找到账本：xxx」。仅在名称变化时触发一次 sd() 同步。
function ensureOwnerName(){
  if(sessionRole!=='parent')return;
  var u=getUsers().find(function(x){return x.phone===currentUser});
  if(u&&u.name&&ad&&ad.ownerName!==u.name){
    ad.ownerName=u.name;
    sd(ad);
  }
}
// ===== 孩子会话（只读视角，纯记录页） =====
function startKidSession(parentPhone,nickname){
  clearKidSession();
  try{localStorage.setItem(KID_KEY,JSON.stringify({parentPhone:parentPhone,nickname:nickname||'孩子'}))}catch(e){}
  sessionRole='kid';
  currentUser=parentPhone; // 复用家长桶做只读数据源；sd/syncPush 已被 role 守卫拦截
  document.getElementById('loginPage').classList.remove('show');
  document.getElementById('mainHeader').style.display='';
  document.getElementById('userSwitch').style.display='';
  document.getElementById('usAvatar').textContent=(nickname||'孩').charAt(0);
  document.getElementById('usName').textContent=nickname||'孩子';
  applyRoleUI();
  showKidRecordsView(); // 孩子端直接落在记录页（无首页/tabBar）
  syncPull(parentPhone).then(function(data){
    ad=data;
    renderAll(ad);
  });
}
// 孩子端视图切换：显示记录页，轻量导航（记录/商城）高亮记录
function showKidRecordsView(){
  var pages=document.querySelectorAll('.pg');
  for(var i=0;i<pages.length;i++) pages[i].classList.remove('on');
  document.getElementById('p-records').classList.add('on');
  var tabs=document.querySelectorAll('#kidTb .ti');
  for(var j=0;j<tabs.length;j++) tabs[j].classList.remove('on');
  document.getElementById('kt-records').classList.add('on');
  curTab='records';
}
// 角色相关的界面开关：孩子端隐藏 CTA/设置页签/家长 tabBar，显示孩子轻量导航（记录/商城）
function applyRoleUI(){
  var kid=sessionRole==='kid';
  document.getElementById('ctaSec').style.display=kid?'none':'';
  document.getElementById('tabSettings').style.display=kid?'none':'';
  var tb=document.getElementById('tbMain');
  if(tb)tb.style.display=kid?'none':'';
  var ktb=document.getElementById('kidTb');
  if(ktb)ktb.style.display=kid?'':'none';
  document.body.classList.toggle('kid-mode',kid);
  if(kid){
    var ra=document.getElementById('reqAlert');
    if(ra)ra.style.display='none';
  }
}
// ===== 登录页 PIN 验证步骤 =====
function showPinStep(){
  document.getElementById('loginRoleSeg').style.display='none';
  document.getElementById('parentFields').style.display='none';
  document.getElementById('kidFields').style.display='none';
  document.getElementById('loginSubmit').style.display='none';
  document.getElementById('loginQuickWrap').style.display='none';
  document.getElementById('pinStep').style.display='';
  var pin=document.getElementById('loginPin');
  pin.value='';
}
function hidePinStep(){
  document.getElementById('pinStep').style.display='none';
  if(document.getElementById('loginRoleSeg')){
    document.getElementById('loginRoleSeg').style.display='';
    document.getElementById('parentFields').style.display=loginRole==='parent'?'':'none';
    document.getElementById('kidFields').style.display=loginRole==='kid'?'':'none';
    document.getElementById('loginSubmit').style.display='';
    document.getElementById('loginQuickWrap').style.display='';
  }
  var pin=document.getElementById('loginPin');
  if(pin)pin.value='';
}
function cancelPinStep(){
  pendingLogin=null;
  hidePinStep();
}
function verifyLoginPin(){
  if(!pendingLogin)return;
  var pin=document.getElementById('loginPin').value.trim();
  if(!/^\d{4}$/.test(pin)){toast('请输入 4 位数字 PIN','err');return}
  var b=loadBucket(pendingLogin.phone);
  if(b&&b.pinHash&&b.pinSalt&&sha256hex(b.pinSalt+pin)===b.pinHash){
    finishParentEntry(pendingLogin.phone,pendingLogin.name);
  }else{
    toast('PIN 错误','err');
  }
}
// 首次进入家长端补设 PIN（新账号/无 PIN 的老账号）；已设置过则不弹
function maybePinSetup(){
  if(sessionRole!=='parent')return;
  var b=loadBucket(currentUser);
  if(b&&b.pinHash)return;
  document.getElementById('pinNew1').value='';
  document.getElementById('pinNew2').value='';
  document.getElementById('mPin').classList.add('show');
}
function saveNewPin(){
  var p1=document.getElementById('pinNew1').value.trim();
  var p2=document.getElementById('pinNew2').value.trim();
  if(!/^\d{4}$/.test(p1)){toast('PIN 必须是 4 位数字','err');return}
  if(p1!==p2){toast('两次输入不一致','err');return}
  if(!currentUser||sessionRole!=='parent')return;
  // 按桶写入而非 ad：switchUser/quickLogin 补设发生在 enterApp 异步拉取落定前，
  // ad 可能仍是上一账号数据，直接写 ad 会把别人的数据写进新账号桶（防串号）
  var b=loadBucket(currentUser)||gd();
  if(b.pinHash){toast('已设置过 PIN，请在设置页修改','err');return}
  var salt=genSalt();
  b.pinSalt=salt;
  b.pinHash=sha256hex(salt+p1);
  b.role='parent';
  ad=b;
  sd(ad); // 随账号数据同步上云，其他设备可校验
  document.getElementById('mPin').classList.remove('show');
  document.getElementById('pinNew1').value='';
  document.getElementById('pinNew2').value='';
  toast('家长 PIN 已设置','ok');
  renderSettings();
}
// 设置页「家长 PIN」管理：修改 PIN（旧 PIN + 新 PIN 两遍）
function openChangePin(){
  if(sessionRole!=='parent')return;
  var b=loadBucket(currentUser);
  if(!(b&&b.pinHash)){toast('尚未设置 PIN','err');return}
  document.getElementById('pinOld').value='';
  document.getElementById('pinNew3').value='';
  document.getElementById('pinNew4').value='';
  document.getElementById('mPinChg').classList.add('show');
}
function saveChangedPin(){
  var old=document.getElementById('pinOld').value.trim();
  var p1=document.getElementById('pinNew3').value.trim();
  var p2=document.getElementById('pinNew4').value.trim();
  if(!ad.pinHash||!ad.pinSalt){toast('尚未设置 PIN','err');return}
  if(sha256hex(ad.pinSalt+old)!==ad.pinHash){toast('旧 PIN 错误','err');return}
  if(!/^\d{4}$/.test(p1)){toast('PIN 必须是 4 位数字','err');return}
  if(p1!==p2){toast('两次输入不一致','err');return}
  var salt=genSalt();
  ad.pinSalt=salt;
  ad.pinHash=sha256hex(salt+p1);
  sd(ad);
  document.getElementById('mPinChg').classList.remove('show');
  document.getElementById('pinOld').value='';
  document.getElementById('pinNew3').value='';
  document.getElementById('pinNew4').value='';
  toast('PIN 已修改','ok');
  renderSettings();
}
function showSwitchModal(){
  var users=getUsers();
  var html='';
  for(var i=0;i<users.length;i++){
    var u=users[i];
    var isCur=(sessionRole==='parent')&&u.phone===currentUser; // 孩子视角不高亮家长账号
    html+='<div class="switch-item'+(isCur?' current':'')+'" onclick="switchUser(\''+u.phone+'\')">';
    html+='<div class="switch-avatar" style="background:'+AVCOLORS[i%4]+'">'+escHtml(u.name.charAt(0))+'</div>';
    html+='<div class="switch-info"><div class="switch-name">'+escHtml(u.name)+'</div><div class="switch-phone">'+u.phone.replace(/(\d{3})\d{4}(\d{4})/,'$1****$2')+'</div></div>';
    if(isCur)html+='<div class="switch-check">✓</div>';
    html+='</div>';
  }
  if(users.length<3)html+='<div class="switch-add" onclick="closeSwitchModal();showLoginPage()">＋ 添加新用户</div>';
  html+='<div class="switch-add quit" onclick="doLogout()">退出登录</div>';
  document.getElementById('switchList').innerHTML=html;
  document.getElementById('switchModal').classList.add('show');
}
document.getElementById('switchModal').addEventListener('click',function(e){
  if(e.target===this)closeSwitchModal();
});
function closeSwitchModal(){document.getElementById('switchModal').classList.remove('show')}
function switchUser(phone){
  closeSwitchModal();
  var users=getUsers();
  var u=users.find(function(x){return x.phone===phone});
  pendingLogin={phone:phone,name:u?u.name:''};
  // 有 PIN 的账号（含从孩子端切回）需先验证；无 PIN 直接进入（进入后补设，
  // 不再存在「重设云端已有 PIN」路径：hasPin 判定含云端拉取）
  ensurePinKnown(phone).then(function(hasPin){
    if(hasPin){
      // 挂起当前会话（孩子/另一家长），验证通过后才落定新身份
      currentUser=null;
      sessionRole=null;
      showLoginPage();
      showPinStep();
    }
    else{finishParentEntry(phone,pendingLogin.name);maybePinSetup()}
  });
}
function doLogout(){
  closeSwitchModal();
  clearKidSession();
  currentUser=null;
  sessionRole=null;
  setCurrentPhone('');
  document.getElementById('userSwitch').style.display='none';
  showLoginPage();
}
function showLoginPage(){
  document.getElementById('loginPage').classList.add('show');
  document.getElementById('mainHeader').style.display='none';
  document.getElementById('userSwitch').style.display='none';
  setLoginRole('parent'); // 重置登录卡为家长角色表单（PIN 步骤一并收起）
  renderQuickLogin();
}
function renderQuickLogin(){
  var users=getUsers();
  var html='';
  for(var i=0;i<users.length;i++){
    var u=users[i];
    html+='<div class="login-quick-item" onclick="quickLogin(\''+u.phone+'\')">';
    html+='<div class="login-quick-avatar" style="background:'+AVCOLORS[i%4]+'">'+escHtml(u.name.charAt(0))+'</div>';
    html+='<div class="login-quick-info"><div class="login-quick-name">'+escHtml(u.name)+'</div><div class="login-quick-phone">'+u.phone.replace(/(\d{3})\d{4}(\d{4})/,'$1****$2')+'</div></div>';
    html+='<div class="login-quick-enter">›</div>';
    html+='</div>';
  }
  document.getElementById('loginQuick').innerHTML=html;
}
function renderAll(data){
  ad=data;
  renderHome();
  renderRecords();
  renderSettings();
}

var curTab='home';
var sectionState={}; // 设置页折叠状态（内存变量，照 v3：刷新后重置，不用 localStorage）
var scoreType='up';
var dateRangeStart=minRecordDate(); // 记录页默认筛选：近一周（今天-6 ~ 今天），仅初始化一次，用户改后以用户为准
var dateRangeEnd=today();
var curTypeFilter='所有';
var selectedDay=null;   // 周概览选中的日期：联动记录分数默认日期 & 首页当日记录视图（null=今天）

// Date picker state
var dpMonth=new Date();
var dpSelectedStart=null;
var dpSelectedEnd=null;

function st(tab){
  if(sessionRole==='kid'){
    // 孩子端页签：记录 / 商城 / 打卡 / 专注 / 报告（刷题仍仅家长端开放，孩子端无入口，此处双保险拦截）
    if(tab==='quiz')return;
    if(tab!=='records'&&tab!=='shop'&&tab!=='checkin'&&tab!=='focus'&&tab!=='report')return;
    if(tab==='focus')fxShow(); /* 不 return：继续走下方面板切换与页签高亮 */
    var pages=document.querySelectorAll('.pg');
    for(var i=0;i<pages.length;i++) pages[i].classList.remove('on');
    document.getElementById('p-'+tab).classList.add('on');
    var ktabs=document.querySelectorAll('#kidTb .ti');
    for(var j=0;j<ktabs.length;j++) ktabs[j].classList.remove('on');
    document.getElementById('kt-'+tab).classList.add('on');
    curTab=tab;
    if(tab==='checkin'){ckPullAt=0;ckShow();}   // 打卡页：强制拉取最新状态（超时重置+必打卡结算在云端合并后的回调里执行，避免误扣）
    if(tab==='report')renderReport(); // 先按当前数据渲染，拉取后刷新
    if(!currentUser){render();return}
    // 进入记录页/商城/报告均重新拉取：家长桶（总积分/奖励项/刷题只读字段）
    syncPull(currentUser).then(function(data){
      ad=data;
      render();
      if(tab==='shop')renderShopKid();
      if(tab==='report')renderReport(); // 孩子端报告：只读视图（明细行同样无编辑入口）
    });
    return;
  }
  // 刷题页：进度按账号存本机（sp_quiz__<phone>）并随账号桶上云 → 先备好题目列表再显示页面，
  // 避免 syncPull 返回前的窗口期内判分按钮已可点、而 qzList 仍为空
  if(tab==='checkin'){ckPullAt=0;ckReconcileAwards();ckShow();} // 打卡页：强制拉取最新状态 + 自愈补积分（超时重置+必打卡结算在云端合并后的回调里执行）
  if(tab==='focus'){fxShow();}
  if(tab==='quiz')qzShow();
  if(tab==='report')renderReport(); // 报告页：先按当前内存数据渲染，拉取完成后刷新
  var pages=document.querySelectorAll('.pg');
  for(var i=0;i<pages.length;i++) pages[i].classList.remove('on');
  var tabs=document.querySelectorAll('.ti');
  for(var i=0;i<tabs.length;i++) tabs[i].classList.remove('on');
  document.getElementById('p-'+tab).classList.add('on');
  document.querySelector('.tb .ti:nth-child('+({'home':1,'records':2,'checkin':3,'focus':4,'report':5,'settings':6}[tab]||1)+')').classList.add('on');
  curTab=tab;
  // 切换页签时同步
  if(currentUser){
    syncPull(currentUser).then(function(data){
      ad=data;
      qzApplyBucketQuiz(data); // 刷题进度/错题/剔除随桶应用（家长端；拉取被守卫跳过时同为本地数据，幂等）
      render();
      if(tab==='quiz')qzShow(); // 刷题页渲染（进度按账号存本机并随桶同步）
      if(tab==='report')renderReport();
      if(sessionRole==='parent')checkRequests(); // 家长端切页签时顺带检查待审批申请
    });
  }else{
    render();
    if(tab==='quiz')qzShow();
  }
}

function render(){
  if(ad&&sessionRole!=='kid'&&ad.totalPoints!==rdSumScore(ad)){ad.totalPoints=rdSumScore(ad);sd(ad)} // 打开即自愈：总分≠流水加总时自动校正（修复历史漂移）
  document.getElementById('hd').textContent=fd(today());
  renderHome();
  renderRecords();
  renderSettings();
  // 孩子端商城页在屏时，跟随数据刷新总积分与奖励列表
  if(sessionRole==='kid'&&curTab==='shop')renderShopKid();
  renderKidGoal();
}
