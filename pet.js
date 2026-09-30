// ===== 电子宠物「团子」（孩子端专属页签） =====
// 功能：可爱动画小猫（SVG+CSS 动画：呼吸/眨眼/摇尾/自己走动跳跃/撸猫/进食/爬架），
//   背单词赚猫币（人教版新课标四年级上下册词库；拼写/中文选英文/英文选中文 三种模式；
//   答对 +3 猫币、答错 -2 猫币，猫币不为负），猫币在猫咪商店购物：
//   猫粮 20/袋 · 猫罐头 20 · 猫条 15 · 玩具 20~80 · 猫爬架 100（一次性）。
//   喂食会从语言库随机飘出心情弹幕；小猫随累计食量长大（4 个阶段），
//   每天胃口随阶段变大（0.25 → 1 袋/天）；隔天未开粮/未喂，进页面触发低落欢迎语。
// 数据：按账号存本机 localStorage 'sp_pet__<phone>'（孩子端与刷题数据同级，不上云）。
// 命名：所有函数加 pt 前缀，避免与账本/刷题全局函数冲突。

// ---------- 常量 ----------
var PET_KEY_PREFIX = 'sp_pet__';
var PT_RIGHT = 3, PT_WRONG = 2, PT_ROUND = 10;   // 答对+3 / 答错-2 / 每轮10题
var PT_FOOD_MEAL = 0.25;                          // 每次喂猫粮吃 1/4 袋
// 成长阶段：need=进入该阶段累计吃袋数；app=每天胃口（袋）；size=显示缩放
var PT_STAGES = [
  { name: '小奶猫', need: 0,   app: 0.25, size: 0.8  },
  { name: '小小猫', need: 2.5, app: 0.5,  size: 0.9  },
  { name: '少年猫', need: 8,   app: 0.75, size: 1.0  },
  { name: '大猫',   need: 20,  app: 1,    size: 1.12 }
];
var PT_SHOP = [
  { id: 'food',  name: '猫粮（1袋）', cost: 20,  type: 'stack', desc: '主食。每次喂 1/4 袋，小猫每天都要吃' },
  { id: 'can',   name: '猫罐头',      cost: 20,  type: 'stack', desc: '豪华大餐，吃完整只猫都精神了' },
  { id: 'strip', name: '猫条',        cost: 15,  type: 'stack', desc: '一口一个幸福的小零食' },
  { id: 'yarn',  name: '毛线球',      cost: 20,  type: 'toy',   desc: '滚来滚去抓不停' },
  { id: 'ball',  name: '小皮球',      cost: 30,  type: 'toy',   desc: '弹跳追逐最开心' },
  { id: 'wand',  name: '逗猫棒',      cost: 50,  type: 'toy',   desc: '跳高高必备神器' },
  { id: 'mouse', name: '玩偶老鼠',    cost: 80,  type: 'toy',   desc: '要叼着到处跑的宝贝' },
  { id: 'tree',  name: '猫爬架',      cost: 100, type: 'tree',  desc: '猫大王专属座驾，放进了房间里' }
];

// ---------- 单词库（人教版新课标 英语 四年级上册 / 下册，三年级起点） ----------
// 结构：[英文, 中文]，按单元分组；拼写/选择题都从这里出题。
var PT_WB = {
  '四上': {
    'U1 My classroom': [['classroom','教室'],['window','窗户'],['blackboard','黑板'],['light','电灯'],['picture','图画'],['door','门'],['computer','计算机'],['fan','风扇'],['wall','墙壁'],['floor','地板'],['really','真正地'],['near','距离近'],['TV','电视'],['clean','打扫'],['help','帮助']],
    'U2 My schoolbag': [['schoolbag','书包'],['maths book','数学书'],['English book','英语书'],['Chinese book','语文书'],['storybook','故事书'],['candy','糖果'],['notebook','笔记本'],['toy','玩具'],['key','钥匙'],['lost','丢失'],['cute','可爱的']],
    'U3 My friends': [['strong','强壮的'],['friendly','友好的'],['quiet','安静的'],['hair','头发'],['shoe','鞋'],['glasses','眼镜'],['his','他的'],['her','她的'],['right','正确的']],
    'U4 My home': [['bedroom','卧室'],['living room','客厅'],['study','书房'],['kitchen','厨房'],['bathroom','卫生间'],['bed','床'],['phone','电话'],['table','桌子'],['sofa','沙发'],['fridge','冰箱'],['find','找到'],['them','他们（宾格）']],
    'U5 Dinner\'s ready': [['beef','牛肉'],['chicken','鸡肉'],['noodles','面条'],['soup','汤'],['vegetable','蔬菜'],['chopsticks','筷子'],['bowl','碗'],['fork','叉子'],['knife','刀'],['spoon','勺子'],['dinner','晚餐']],
    'U6 Meet my family': [['family','家庭'],['parents','父母'],['cousin','表兄弟姐妹'],['uncle','叔父；伯父'],['aunt','姑母；姨母'],['baby brother','婴儿小弟弟'],['doctor','医生'],['cook','厨师'],['driver','司机'],['farmer','农民'],['nurse','护士'],['people','人们'],['little','小的'],['puppy','小狗'],['job','工作'],['basketball','篮球']]
  },
  '四下': {
    'U1 My school': [['first floor','一楼'],['second floor','二楼'],['teacher\'s office','教师办公室'],['library','图书馆'],['playground','操场'],['computer room','计算机房'],['art room','美术教室'],['music room','音乐教室'],['next to','紧邻'],['homework','作业'],['class','班级；课'],['forty','四十']],
    'U2 What time is it?': [['breakfast','早餐'],['English class','英语课'],['lunch','午餐'],['music class','音乐课'],['PE class','体育课'],['over','结束'],['now','现在'],["o'clock",'……点钟'],['kid','小孩'],['time','时间'],['hurry up','快点'],['just a minute','稍等一会儿']],
    'U3 Weather': [['cold','寒冷的'],['cool','凉爽的'],['warm','温暖的'],['hot','炎热的'],['sunny','晴朗的'],['windy','多风的'],['cloudy','多云的'],['snowy','下雪的'],['rainy','阴雨的'],['degree','度数'],['world','世界'],['weather','天气']],
    'U4 At the farm': [['tomato','西红柿'],['potato','马铃薯'],['green beans','豆角'],['carrot','胡萝卜'],['horse','马'],['cow','奶牛'],['sheep','绵羊'],['hen','母鸡'],['farm','农场'],['these','这些'],['those','那些'],['animal','动物'],['garden','花园']],
    'U5 My clothes': [['hat','帽子'],['sunglasses','太阳镜'],['scarf','围巾'],['gloves','手套'],['umbrella','伞'],['coat','外衣'],['sweater','毛衣'],['jacket','夹克'],['shirt','衬衫'],['skirt','裙子'],['dress','连衣裙'],['pants','裤子'],['socks','袜子'],['shorts','短裤'],['whose','谁的']],
    'U6 Shopping': [['big','大的'],['small','小的'],['long','长的'],['short','矮的'],['expensive','昂贵的'],['cheap','便宜的'],['nice','好的'],['pretty','美观的'],['size','尺码'],['try on','试穿'],['how much','多少钱']]
  }
};

// ---------- 语言库（随机弹幕） ----------
var PT_TALK = {
  greet: ['喵呜～主人来啦！','今天也要一起玩哦！','喵～想你了，摸摸我嘛','喵喵！我看到你啦','嘿嘿，主人来啦，快陪我玩'],
  greetHint: ['今天还没喂我哦，肚子有点饿了…','喵～碗碗好像空了一半','主人，饭饭时间到啦！'],
  greetSad: ['主人你终于来了，我以为你把我忘了，嘤嘤嘤……','呜……一个人待了一整天，好想你','肚子咕咕叫了两天了……喵呜','喵呜……碗里什么都没有了'],
  hungry: ['猫粮碗空空哒，我要饿扁了……','主人，快去背单词给我赚猫粮吧！','喵呜——救救小猫，没有存粮啦','闻不到饭饭的味道了……'],
  pet: ['呼噜呼噜～好舒服','再摸摸头，就一下下','喵～你是全世界最好的主人','唔，下巴也可以挠挠','呼噜……我要睡着了啦','嘿嘿，被摸得好开心','喵呜～今天的抚摸额度还有效','蹭蹭你的手手'],
  feedFood: ['真开心，又可以吃美食了！','咔嚓咔嚓～猫粮真香','谢谢主人，我吃饱饱','咀嚼中……幸福中……','喵！今天的饭饭好香'],
  feedCan: ['主人你真好！','哇！是猫罐头！我最爱你了！','罐头是世界上最好吃的东西！','咕噜咕噜——大口吃罐头','这也太好吃了吧！喵！'],
  feedStrip: ['猫条！我的最爱！','舔舔舔——根本停不下来','喵～一口一个幸福','唰——猫条被我吃光啦','再来一根好不好嘛～'],
  play: ['抓到啦！它是我哒','跳高高！我是跳跃小能手','再来再来，陪我还想玩','喵呜——看我的冲刺！','嘿嘿，这个玩具超好玩','扑！抓住你啦'],
  climb: ['站得高高的，我就是猫大王','爬爬架最棒了，蹭蹭','喵～俯瞰我的领地','这里是本喵的宝座！'],
  idle: ['喵～','今天心情不错','尾巴摇摇，好运来到','打个哈欠……好困呀','窗外的鸟在看我看我','晒太阳真舒服','喵呜～呼噜呼噜','（盯着你的零食袋看）'],
  quizRight: ['又答对啦，罐头在向我招手！','喵！主人好聪明','太棒啦，猫币滚滚来','答对了！今晚加餐！'],
  quizWrong: ['没关系，再想想嘛','喵呜……错了也爱主人','差一点点，再来！','没事没事，学习要慢慢来'],
  buy: ['哇，是给我的吗！','谢谢主人！最喜欢你啦','新东西的味道！喵！'],
  levelup: ['我长大了一点点！','喵呜——我变成大孩子啦！','又长大了，胃口也变大咯！']
};

// ---------- 小图标（内联 SVG） ----------
var PT_ICO = {
  food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6l2-3h6l2 3z" fill="#D89A45"/><rect x="5" y="6" width="14" height="15" rx="3" fill="#E8B15C"/><path d="M5 9.5h14" stroke="#C98A4B" stroke-width="1.4"/><circle cx="12" cy="15" r="3.4" fill="#FFF6E6"/><path d="M10.6 15h2.8" stroke="#C98A4B" stroke-width="1.2" stroke-linecap="round"/></svg>',
  can: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="14" rx="2.5" fill="#9BB7CE"/><ellipse cx="12" cy="6.5" rx="6" ry="2.2" fill="#C6D8E6"/><rect x="6" y="10.5" width="12" height="4.5" fill="#F2708A"/><rect x="8" y="12" width="8" height="1.6" rx="0.8" fill="#FFE3EA"/></svg>',
  strip: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="15" height="8" rx="4" fill="#F4B942"/><circle cx="7.5" cy="13" r="1.5" fill="#FFF"/><circle cx="11" cy="13" r="1.5" fill="#FFF"/><path d="M18 10.5l3-1.5-1 3 1 3-3-1.5z" fill="#F4B942"/></svg>',
  yarn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="12" r="8" fill="#F2708A"/><path d="M4 10c4 2 9 2 13-1M4.5 15c4-1 8-1 11.5 1M11 4c-3 4-3 12 0 16" stroke="#D14B6B" stroke-width="1.5" fill="none"/><path d="M18 14q4 1 4-2" stroke="#D14B6B" stroke-width="1.5" fill="none"/></svg>',
  ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" fill="#6FA6D8"/><path d="M3.6 12h16.8M12 3.6c-4 5-4 11.8 0 16.8" stroke="#3C72A4" stroke-width="1.5" fill="none"/></svg>',
  wand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20L15 9" stroke="#8F6210" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="7" r="3.4" fill="#F4B942"/><path d="M20.5 10.5l1.5 1.5M21 4.5l1.6-1.2" stroke="#EE6F5F" stroke-width="1.7" stroke-linecap="round"/></svg>',
  mouse: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="10.5" cy="14" rx="7" ry="5" fill="#B7AFA4"/><circle cx="6.5" cy="9" r="2.6" fill="#B7AFA4"/><circle cx="11.5" cy="9" r="2.6" fill="#B7AFA4"/><path d="M17 14q4.5 1 4-3.5" stroke="#8F8578" stroke-width="1.5" fill="none"/><circle cx="7.8" cy="13" r="1" fill="#4A4238"/></svg>',
  tree: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="11" y="4" width="2.4" height="16" rx="1" fill="#D9B98C"/><rect x="4" y="18" width="16" height="3" rx="1.5" fill="#F3E3C8" stroke="#E0C9A5" stroke-width="0.6"/><rect x="6" y="11" width="12" height="3" rx="1.5" fill="#F3E3C8" stroke="#E0C9A5" stroke-width="0.6"/><rect x="8.5" y="4" width="7.5" height="3" rx="1.5" fill="#F3E3C8" stroke="#E0C9A5" stroke-width="0.6"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#F4B942" stroke="#D89A28" stroke-width="1.6"/><ellipse cx="12" cy="13.8" rx="3.4" ry="2.7" fill="#8F6210"/><circle cx="8.6" cy="10" r="1.3" fill="#8F6210"/><circle cx="12" cy="8.8" r="1.3" fill="#8F6210"/><circle cx="15.4" cy="10" r="1.3" fill="#8F6210"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4" width="15" height="16" rx="2" fill="#6FA6D8"/><path d="M12 4v16" stroke="#FFF" stroke-width="1.6"/><path d="M7 8.5h3M7 11h3M14 8.5h3M14 11h3" stroke="#EAF2FA" stroke-width="1.3" stroke-linecap="round"/></svg>',
  bowlIco: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="10" rx="7.6" ry="2.4" fill="#C98A4B"/><path d="M4.4 10h15.2a7.6 6.4 0 01-15.2 0z" fill="#EE6F5F"/><ellipse cx="12" cy="17.2" rx="4.4" ry="1.4" fill="#C9503F"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5L8 5h8l1.5 3.5" fill="none" stroke="#C9503F" stroke-width="1.7" stroke-linecap="round"/><rect x="5" y="8.5" width="14" height="12" rx="3" fill="#EE6F5F"/><path d="M9.5 12.5a2.5 2 0 015 0" stroke="#FFE3DF" stroke-width="1.6" fill="none"/></svg>'
};

// ---------- 样式 ----------
function ptInjectStyle() {
  if (document.getElementById('petStyle')) return;
  var css = `
/* —— 电子宠物（孩子端）—— */
.tico-pet{position:relative;width:18px;height:16px;display:block}
.tico-pet::before{content:'';position:absolute;left:4px;bottom:0;width:10px;height:8px;border-radius:50% 50% 46% 46%;background:currentColor}
.tico-pet::after{content:'';position:absolute;top:0;left:2px;width:3.6px;height:3.6px;border-radius:999px;background:currentColor;box-shadow:10.4px 0 currentColor,3.4px -4px currentColor,7px -4px currentColor}
#p-pet{padding-bottom:6px}
.pet-wrap{max-width:560px;margin:0 auto}
.pet-hd{margin:12px 16px 0;background:var(--card);border:var(--bd);border-radius:var(--r-m);box-shadow:var(--sh-card);padding:14px 16px;display:flex;gap:12px;align-items:center}
.pet-hd-main{flex:1;min-width:0}
.pet-name{font:var(--f-h2);display:flex;align-items:center;gap:8px}
.pet-stage-chip{font:var(--f-mini);font-weight:700;color:var(--yel-deep);background:var(--yellow-l);border-radius:var(--r-full);padding:3px 8px;white-space:nowrap}
.pet-grow{height:8px;background:var(--fill);border-radius:var(--r-full);margin-top:10px;overflow:hidden}
.pet-grow i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--yellow),var(--red));border-radius:var(--r-full);transition:width .6s}
.pet-grow-t{font:var(--f-cap);color:var(--ink2);margin-top:6px}
.pet-coin{flex-shrink:0;text-align:center;background:var(--yellow-l);border-radius:var(--r-m);padding:10px 14px;min-width:78px;position:relative}
.pet-coin svg{width:22px;height:22px;margin:0 auto 2px;display:block}
.pet-coin b{font:var(--f-display);color:var(--yel-deep);display:block}
.pet-coin span{font:var(--f-cap);color:var(--ink2)}
.pt-delta{position:absolute;left:50%;top:6px;transform:translateX(-50%);font:800 14px/1 var(--ff);pointer-events:none;animation:ptCoinFloat 1s ease-out forwards}
.pt-delta.up{color:var(--grn-deep)}.pt-delta.down{color:var(--red-deep)}
@keyframes ptCoinFloat{0%{opacity:0;transform:translate(-50%,8px)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px)}}
.pet-room{position:relative;margin:12px 16px 0;height:320px;border-radius:var(--r-l);overflow:hidden;border:var(--bd);box-shadow:var(--sh-card);background:linear-gradient(180deg,#FDEBD2 0%,#FADFC4 60%,#E9C99E 60%,#E0BA8A 100%)}
.pet-window{position:absolute;top:18px;right:20px;width:88px;height:64px;border-radius:14px;background:linear-gradient(180deg,#BFE0F5,#EAF5FC);border:4px solid #FFF8EC;box-shadow:0 2px 6px rgba(120,80,40,.1);overflow:hidden}
.pet-window::before{content:'';position:absolute;top:8px;right:10px;width:20px;height:20px;border-radius:999px;background:#FFD98A;box-shadow:0 0 0 4px rgba(255,217,138,.4)}
.pet-window::after{content:'';position:absolute;bottom:12px;left:10px;width:34px;height:9px;border-radius:999px;background:#fff;opacity:.9;box-shadow:14px -8px 0 -2px #fff}
.pet-rug{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:180px;height:38px;border-radius:50%;background:#F2B8A0;opacity:.7}
.pet-bowl{position:absolute;left:5%;bottom:14%;width:58px;height:26px}
.pet-bowl .b-food{position:absolute;top:1px;left:7px;right:7px;height:12px;border-radius:8px;background:#C98A4B;display:none}
.pet-bowl .b-food::after{content:'';position:absolute;top:3px;left:5px;width:5px;height:5px;border-radius:999px;background:#A96B32;box-shadow:10px 1px 0 #A96B32,20px -1px 0 #A96B32,30px 1px 0 #A96B32}
.pet-bowl .b-body{position:absolute;bottom:0;left:0;right:0;height:17px;background:#fff;border-radius:6px 6px 16px 16px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.06)}
.pet-bowl.empty .b-body{background:#F3EADA}
.pet-tree{position:absolute;right:3%;bottom:12%;width:86px;height:172px;display:none}
.pet-room.withtree .pet-tree{display:block}
.pet-tree .post{position:absolute;left:35px;bottom:0;width:16px;height:136px;background:#D9B98C;border-radius:8px;box-shadow:inset -5px 0 0 rgba(0,0,0,.08)}
.pet-tree .pl{position:absolute;background:#F5E6CB;border-radius:7px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.06)}
.pet-tree .pl1{bottom:0;left:0;width:86px;height:13px}
.pet-tree .pl2{bottom:64px;left:-5px;width:72px;height:11px}
.pet-tree .pl3{top:26px;left:12px;width:62px;height:11px}
.pet-tree .ball{position:absolute;top:6px;left:22px;width:22px;height:22px;border-radius:999px;background:#F2708A;box-shadow:inset -3px -3px 0 rgba(0,0,0,.12)}
.pet-actor{position:absolute;bottom:11.5%;left:40px;width:132px;transition:left 2.6s ease-in-out;will-change:left}
.pet-actor .pt-svg{display:block;width:132px;height:104px;filter:drop-shadow(0 5px 4px rgba(120,80,40,.16));cursor:pointer;-webkit-tap-highlight-color:transparent}
.pt-svg.flip{transform:scaleX(-1)}
.pet-bubble{position:absolute;bottom:112px;left:50%;transform:translateX(-50%);max-width:210px;width:max-content;background:#fff;border:2px solid #F0C9A0;border-radius:14px;padding:8px 11px;font:600 12px/1.5 var(--ff);color:#6B4F35;text-align:center;opacity:0;transition:opacity .25s;pointer-events:none;box-shadow:0 4px 10px rgba(120,80,40,.12);z-index:3}
.pet-bubble::after{content:'';position:absolute;bottom:-7px;left:50%;margin-left:-6px;width:11px;height:11px;background:#fff;border-right:2px solid #F0C9A0;border-bottom:2px solid #F0C9A0;transform:rotate(45deg)}
.pet-bubble.show{opacity:1}
.pt-heart{position:absolute;font-size:17px;color:#F2708A;font-style:normal;pointer-events:none;z-index:4;animation:ptHeartUp 1.15s ease-out forwards;text-shadow:0 1px 0 #fff}
@keyframes ptHeartUp{0%{opacity:0;transform:translateY(8px) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translateY(-58px) scale(1.15) rotate(14deg)}}
/* 猫咪各部位动画 */
.pt-svg g,.pt-svg ellipse,.pt-svg path,.pt-svg circle,.pt-svg polygon,.pt-svg rect{transform-box:fill-box}
.pt-all{transform-origin:50% 85%}
.pt-svg.walk .pt-all{animation:ptBob .4s ease-in-out infinite alternate}
@keyframes ptBob{from{transform:translateY(0)}to{transform:translateY(-3.5px)}}
.pt-body{transform-origin:50% 100%;animation:ptBreath 2.6s ease-in-out infinite alternate}
@keyframes ptBreath{from{transform:scaleY(1)}to{transform:scaleY(1.04)}}
.pt-tail{transform-origin:12% 92%;animation:ptTail 1.7s ease-in-out infinite alternate}
@keyframes ptTail{from{transform:rotate(-7deg)}to{transform:rotate(11deg)}}
.pt-eye{transform-origin:center;animation:ptBlink 4.4s infinite}
@keyframes ptBlink{0%,92%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.08)}}
.pt-happy-eyes{display:none}
.pt-svg.hjoy .pt-eye{display:none}
.pt-svg.hjoy .pt-happy-eyes{display:block}
.pt-svg.hjoy .pt-all{animation:ptWiggle .55s ease-in-out 2}
@keyframes ptWiggle{0%,100%{transform:rotate(0)}30%{transform:rotate(-3deg)}70%{transform:rotate(3deg)}}
/* 跳跃/爬架动画作用在 .pt-all 内层组：不干扰根节点的 flip 翻转变换 */
.pt-svg.jump .pt-all{animation:ptJump .72s cubic-bezier(.32,.62,.42,1)}
@keyframes ptJump{0%{transform:translateY(0)}36%{transform:translateY(-50px)}72%{transform:translateY(-4px)}86%{transform:translateY(0) scaleY(.94)}100%{transform:translateY(0)}}
.pt-svg.eat .pt-head{transform-origin:60% 85%;animation:ptEat .5s ease-in-out 3 alternate}
@keyframes ptEat{from{transform:translateY(0)}to{transform:translateY(9px) rotate(7deg)}}
.pt-svg.climb .pt-all{animation:ptClimb 2.3s ease-in-out}
@keyframes ptClimb{0%{transform:translateY(0)}42%{transform:translateY(-86px)}56%{transform:translateY(-86px)}90%{transform:translateY(0)}100%{transform:translateY(0)}}
.pt-svg.sad .pt-earL{transform:rotate(-24deg)}
.pt-svg.sad .pt-earR{transform:rotate(24deg)}
.pt-svg.sad .pt-tail{animation:none;transform:rotate(16deg)}
.pt-svg.sad .pt-body{animation:none}
.pt-svg.sad .pt-all{transform:translateY(2px)}
/* hjoy（撸猫开心）规则置于 walk/jump 之后：同时触发时优先开心动画 */
/* 操作按钮 / 仓库 / 玩具 */
.pet-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 16px 0}
.pet-act{border:var(--bd);background:var(--card);border-radius:var(--r-m);padding:10px 4px 9px;display:flex;flex-direction:column;align-items:center;gap:4px;font:600 12px/1.2 var(--ff);color:var(--ink);cursor:pointer;box-shadow:var(--sh-card);transition:transform .15s}
.pet-act:active{transform:scale(.94)}
.pet-act svg{width:26px;height:26px}
.pet-act.hot{background:var(--red);color:#fff;border-color:transparent;box-shadow:var(--sh-cta)}
.pet-inv{display:flex;gap:8px;margin:10px 16px 0;flex-wrap:wrap}
.pet-chip{display:flex;align-items:center;gap:6px;background:var(--card);border:var(--bd);border-radius:var(--r-full);padding:6px 12px;font:600 12px/1 var(--ff);color:var(--ink2);box-shadow:var(--sh-card)}
.pet-chip svg{width:16px;height:16px}
.pet-chip b{color:var(--ink)}
.pet-toys{display:flex;gap:8px;margin:10px 16px 0;flex-wrap:wrap}
.pet-toy{display:flex;align-items:center;gap:6px;background:var(--green-l);border:1px solid transparent;border-radius:var(--r-full);padding:7px 13px;font:600 12px/1 var(--ff);color:var(--grn-deep);cursor:pointer;transition:transform .15s}
.pet-toy:active{transform:scale(.93)}
.pet-toy svg{width:16px;height:16px}
/* 弹窗内列表（商店/喂食/玩耍） */
.pet-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.pet-item:last-child{border-bottom:none}
.pet-ico{width:44px;height:44px;border-radius:12px;background:var(--fill);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pet-ico svg{width:30px;height:30px}
.pet-inf{flex:1;min-width:0}
.pet-nm{font:700 14px/1.3 var(--ff);color:var(--ink)}
.pet-desc{font:var(--f-cap);color:var(--ink2);margin-top:2px}
.pet-cost{font:700 12px/1 var(--ff);color:var(--yel-deep);margin-top:5px;display:flex;align-items:center;gap:4px}
.pet-cost svg{width:13px;height:13px}
.pet-buy{border:none;border-radius:var(--r-full);background:var(--red);color:#fff;font:700 12px/1 var(--ff);padding:9px 14px;cursor:pointer;box-shadow:var(--sh-cta);transition:transform .15s;flex-shrink:0}
.pet-buy:active{transform:scale(.93)}
.pet-buy:disabled{background:var(--fill);color:var(--ink3);box-shadow:none}
.pet-buy.owned{background:var(--green-l);color:var(--grn-deep)}
.pet-shop-hd{display:flex;justify-content:space-between;align-items:center;padding:2px 0 4px}
.pet-shop-hd .bal{display:flex;align-items:center;gap:5px;font:700 14px/1 var(--ff);color:var(--yel-deep)}
.pet-shop-hd .bal svg{width:16px;height:16px}
.pet-empty{padding:26px 0;text-align:center;font:var(--f-item);color:var(--ink2)}
/* 背单词 */
.pet-modes{display:grid;gap:10px;padding-top:4px}
.pet-qmode{border:var(--bd);background:var(--fill);border-radius:var(--r-m);padding:14px;text-align:left;cursor:pointer;font-family:var(--ff);transition:transform .15s}
.pet-qmode:active{transform:scale(.98)}
.pet-qmode b{display:block;font:700 15px/1.3 var(--ff);color:var(--ink)}
.pet-qmode span{font:var(--f-cap);color:var(--ink2)}
.pet-q-top{display:flex;justify-content:space-between;align-items:center;font:600 12px/1 var(--ff);color:var(--ink2);margin-bottom:10px}
.pet-q-prog{background:var(--fill);height:6px;border-radius:var(--r-full);overflow:hidden;margin-bottom:14px}
.pet-q-prog i{display:block;height:100%;background:var(--yellow);border-radius:var(--r-full);transition:width .3s}
.pet-q-word{background:var(--fill);border-radius:var(--r-m);padding:18px 12px;text-align:center;font:800 24px/1.3 var(--ff);color:var(--ink);word-break:break-word}
.pet-q-word small{display:block;font:500 11px/1.5 var(--ff);color:var(--ink3);margin-top:6px}
.pet-q-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.pet-opt{border:2px solid var(--line);background:var(--card);border-radius:var(--r-m);padding:13px 8px;font:600 14px/1.3 var(--ff);color:var(--ink);cursor:pointer;transition:transform .15s,border-color .15s;word-break:break-word;font-family:var(--ff)}
.pet-opt:active{transform:scale(.97)}
.pet-opt.right{border-color:var(--green);background:var(--green-l);color:var(--grn-deep)}
.pet-opt.wrong{border-color:var(--red);background:var(--red-l);color:var(--red-deep)}
.pet-q-input{display:flex;gap:8px;margin-top:14px}
.pet-q-input input{flex:1;min-width:0;height:46px;padding:0 12px;border-radius:var(--r-s);border:1.5px solid transparent;background:var(--fill);font:600 16px/1 var(--ff);color:var(--ink);outline:none}
.pet-q-input input:focus{border-color:var(--yellow)}
.pet-go{border:none;border-radius:var(--r-s);background:var(--red);color:#fff;font:700 14px/1 var(--ff);padding:0 18px;height:46px;cursor:pointer;box-shadow:var(--sh-cta);flex-shrink:0}
.pet-q-fb{min-height:40px;margin-top:10px;text-align:center;font:700 13px/1.45 var(--ff)}
.pet-q-fb.ok{color:var(--grn-deep)}
.pet-q-fb.no{color:var(--red-deep)}
.pet-q-fb small{display:block;font:500 12px/1.5 var(--ff);color:var(--ink2)}
.pet-result{text-align:center;padding:16px 0 4px}
.pet-result .big{font:var(--f-display);color:var(--ink)}
.pet-result .sub{font:var(--f-item);color:var(--ink2);margin-top:8px}
.pet-result .up{color:var(--grn-deep);font-weight:700}
.pet-result .down{color:var(--red-deep);font-weight:700}
.pet-result-btns{display:grid;gap:8px;margin-top:16px}
.bn-pet{width:100%;height:46px;border:none;border-radius:var(--r-m);font:700 15px/1 var(--ff);cursor:pointer;transition:transform .15s}
.bn-pet:active{transform:scale(.97)}
.bn-pet.p{background:var(--red);color:#fff;box-shadow:var(--sh-cta)}
.bn-pet.q{background:var(--fill);color:var(--ink)}`;
  var stl = document.createElement('style');
  stl.id = 'petStyle';
  stl.textContent = css;
  document.head.appendChild(stl);
}

// ---------- 小猫 SVG（默认面向左） ----------
function ptCatSvg() {
  return `<svg class="pt-svg" viewBox="0 0 150 118" aria-hidden="true">
<ellipse cx="82" cy="112" rx="46" ry="6" fill="rgba(150,100,60,.14)"/>
<g class="pt-all">
  <g class="pt-tail"><path d="M116 94 C136 90 144 70 134 52" stroke="#F5A75B" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="134" cy="52" r="6.8" fill="#E8903F"/></g>
  <ellipse cx="106" cy="110" rx="14" ry="9" fill="#F5A75B"/>
  <ellipse class="pt-body" cx="82" cy="90" rx="38" ry="28" fill="#FFC98F"/>
  <path d="M70 66q4 9-1 14 M82 64q4 9-1 15 M94 66q3 8-2 13" stroke="#F09A4B" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="74" cy="99" rx="16" ry="11" fill="#FFE9C9" opacity=".85"/>
  <ellipse cx="58" cy="111" rx="9" ry="9.5" fill="#FFCE96"/>
  <ellipse cx="76" cy="112" rx="9" ry="9" fill="#FFC98F"/>
  <path d="M52 74 Q68 85 84 76" stroke="#EE6F5F" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="70" cy="82.5" r="4.4" fill="#FFD34D" stroke="#D9A82F" stroke-width="1"/>
  <g class="pt-head">
    <g class="pt-earL"><polygon points="26,36 18,4 48,20" fill="#FFC98F"/><polygon points="27,31 22,10 43,20" fill="#FFB9C8"/></g>
    <g class="pt-earR"><polygon points="94,36 102,4 72,20" fill="#FFC98F"/><polygon points="93,31 98,10 77,20" fill="#FFB9C8"/></g>
    <circle cx="60" cy="52" r="31" fill="#FFC98F"/>
    <rect x="50" y="21.5" width="4.5" height="11" rx="2.2" fill="#F09A4B"/>
    <rect x="58" y="20" width="4.5" height="11" rx="2.2" fill="#F09A4B"/>
    <rect x="66" y="21.5" width="4.5" height="11" rx="2.2" fill="#F09A4B"/>
    <g class="pt-eye"><circle cx="48" cy="52" r="4.8" fill="#453526"/><circle cx="46.6" cy="50.2" r="1.7" fill="#fff"/></g>
    <g class="pt-eye"><circle cx="72" cy="52" r="4.8" fill="#453526"/><circle cx="70.6" cy="50.2" r="1.7" fill="#fff"/></g>
    <path class="pt-happy-eyes" d="M41 52 Q48 44 55 52 M65 52 Q72 44 79 52" stroke="#453526" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="61" rx="4.6" ry="3" fill="#FFAEBE" opacity=".75"/>
    <ellipse cx="80" cy="61" rx="4.6" ry="3" fill="#FFAEBE" opacity=".75"/>
    <polygon points="57,58 63,58 60,61.6" fill="#E88098"/>
    <path d="M54 64 Q57 67.5 60 61.8 Q63 67.5 66 64" stroke="#C58B60" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M28 52 L12 49 M28 58 L13 60 M92 52 L108 49 M92 58 L107 60" stroke="rgba(150,110,70,.5)" stroke-width="1.6" stroke-linecap="round"/>
  </g>
</g>
</svg>`;
}

// ---------- 状态 ----------
var ptS = null;          // 宠物状态（按账号本机存取）
var ptBusy = false;      // 走位/动作编排中
var ptNextAct = 4;       // 距下一次自主活动的秒数
var ptBubbleTimer = null;
var ptLoadedKey = '';

function ptAccKey() { return PET_KEY_PREFIX + (currentUser || 'anon'); }
function ptDefault() {
  return { v: 1, coins: 30, food: 0.5, cans: 0, strips: 0, toys: [], tree: false, eaten: 0, lastFeed: '', lastVisit: today(), created: today(), hungryDays: 0 };
}
function ptLoad() {
  var key = ptAccKey();
  if (ptLoadedKey === key && ptS) return ptS; // 同一账号：沿用内存状态（含本次会话累计）
  ptLoadedKey = key;
  var o = null;
  try { var r = localStorage.getItem(key); if (r) o = JSON.parse(r); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') o = ptDefault();
  // 兜底补齐新字段（老结构兼容）
  var d = ptDefault();
  for (var k in d) if (o[k] === undefined) o[k] = d[k];
  if (Object.prototype.toString.call(o.toys) !== '[object Array]') o.toys = [];
  ptS = o;
  ptRoll();      // 补结算离线天数（猫粮消耗/挨饿）
  ptSave();
  return ptS;
}
function ptSave() {
  try { localStorage.setItem(ptAccKey(), JSON.stringify(ptS)); } catch (e) {}
}
function ptDaysBetween(a, b) {
  if (!a || !b) return 0;
  var da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(0, Math.floor((db - da) / 86400000));
}
function ptStage() {
  var s = PT_STAGES[0];
  for (var i = 0; i < PT_STAGES.length; i++) if (ptS.eaten >= PT_STAGES[i].need) s = PT_STAGES[i];
  return s;
}
function ptR2(n) { return Math.round(n * 100) / 100; }
// 离线结算：每过一天吃掉「当日胃口」，存粮不足记挨饿天数（进页面触发低落语）
function ptRoll() {
  var t = today();
  if (ptS.lastVisit === t) return;
  var gap = ptDaysBetween(ptS.lastVisit, t);
  var app = ptStage().app;
  for (var i = 0; i < gap; i++) {
    var eat = Math.min(ptS.food, app);
    ptS.food = ptR2(Math.max(0, ptS.food - eat));
    ptS.eaten = ptR2(ptS.eaten + eat);
    if (eat <= 0) ptS.hungryDays++;
  }
  ptS.lastVisit = t;
}

// ---------- 页面骨架（构建一次，随后只刷新数据） ----------
function ptBuild() {
  ptInjectStyle();
  var host = document.getElementById('p-pet');
  if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  host.innerHTML = `<div class="pet-wrap">
  <div class="pet-hd">
    <div class="pet-hd-main">
      <div class="pet-name">团子 <span class="pet-stage-chip" id="ptStageChip">小奶猫</span></div>
      <div class="pet-grow"><i id="ptGrowBar"></i></div>
      <div class="pet-grow-t" id="ptGrowT"></div>
    </div>
    <div class="pet-coin" id="ptCoinBox">
      ${PT_ICO.coin}<b id="ptCoins">0</b><span>猫币</span>
    </div>
  </div>
  <div class="pet-room" id="ptRoom">
    <div class="pet-window" aria-hidden="true"></div>
    <div class="pet-rug" aria-hidden="true"></div>
    <div class="pet-bowl empty" id="ptBowl" aria-hidden="true"><div class="b-food"></div><div class="b-body"></div></div>
    <div class="pet-tree" aria-hidden="true"><div class="ball"></div><div class="pl pl3"></div><div class="post"></div><div class="pl pl2"></div><div class="pl pl1"></div></div>
    <div class="pet-actor" id="ptActor">
      <div class="pet-bubble" id="ptBubble"></div>
      <span id="ptHearts"></span>
      ${ptCatSvg()}
    </div>
  </div>
  <div class="pet-acts">
    <button class="pet-act hot" onclick="ptOpenQuiz()">${PT_ICO.book}背单词</button>
    <button class="pet-act" onclick="ptOpenFeed()">${PT_ICO.bowlIco}喂食</button>
    <button class="pet-act" onclick="ptOpenPlay()">${PT_ICO.yarn}玩耍</button>
    <button class="pet-act" onclick="ptOpenShop()">${PT_ICO.bag}猫商店</button>
  </div>
  <div class="pet-inv" id="ptInv"></div>
  <div class="pet-toys" id="ptToys"></div>
</div>`;
  var svg = host.querySelector('.pt-svg');
  if (svg) svg.addEventListener('pointerdown', ptTap);
}

// ---------- 渲染 ----------
function ptRender() {
  var stg = ptStage(), idx = PT_STAGES.indexOf(stg), next = PT_STAGES[idx + 1];
  document.getElementById('ptCoins').textContent = ptS.coins;
  document.getElementById('ptStageChip').textContent = stg.name;
  var pct = next ? Math.min(100, Math.round((ptS.eaten - stg.need) / (next.need - stg.need) * 100)) : 100;
  document.getElementById('ptGrowBar').style.width = pct + '%';
  var days = ptDaysBetween(ptS.created, today()) + 1;
  document.getElementById('ptGrowT').textContent = next
    ? '陪伴第 ' + days + ' 天 · 每天吃 ' + stg.app + ' 袋 · 再吃 ' + ptR2(next.need - ptS.eaten) + ' 袋长大'
    : '陪伴第 ' + days + ' 天 · 每天吃 ' + stg.app + ' 袋 · 已经完全长大啦';
  document.getElementById('ptBowl').className = 'pet-bowl' + (ptS.food > 0 ? '' : ' empty');
  var room = document.getElementById('ptRoom');
  if (room) room.classList.toggle('withtree', !!ptS.tree);
  var inv = document.getElementById('ptInv');
  inv.innerHTML = '<span class="pet-chip">' + PT_ICO.food + '猫粮 <b>' + ptR2(ptS.food) + '</b> 袋</span>'
    + '<span class="pet-chip">' + PT_ICO.can + '罐头 <b>' + ptS.cans + '</b></span>'
    + '<span class="pet-chip">' + PT_ICO.strip + '猫条 <b>' + ptS.strips + '</b></span>'
    + (ptS.tree ? '<span class="pet-chip">' + PT_ICO.tree + '猫爬架</span>' : '');
  var toys = document.getElementById('ptToys');
  var h = '';
  for (var i = 0; i < ptS.toys.length; i++) {
    var it = PT_SHOP.filter(function (x) { return x.id === ptS.toys[i]; })[0];
    if (it) h += '<button class="pet-toy" onclick="ptPlayToy(\'' + it.id + '\')">' + PT_ICO[it.id] + '玩 ' + it.name.replace('玩偶', '') + '</button>';
  }
  if (ptS.tree) h += '<button class="pet-toy" onclick="ptClimb()">' + PT_ICO.tree + '爬爬架</button>';
  toys.innerHTML = h;
  // 心情外观：挨饿/隔天未喂 → 耷拉耳朵
  var svg = document.querySelector('#p-pet .pt-svg');
  if (svg) svg.classList.toggle('sad', ptIsSad() && !ptBusy);
}
function ptIsSad() {
  var base = ptS.lastFeed || ptS.created;
  var gap = ptDaysBetween(base, today());
  return (ptS.lastFeed && gap >= 2) || (!ptS.lastFeed && gap >= 1) || ptS.food <= 0 && ptS.hungryDays > 0;
}
function ptSetCoins(n, deltaEl) {
  var before = ptS.coins;
  ptS.coins = Math.max(0, ptS.coins + n); // 猫币不为负
  ptSave();
  ptRender();
  if (n !== 0 && deltaEl !== false) ptCoinFloat(n);
  return ptS.coins - before;
}
function ptCoinFloat(n) {
  var box = document.getElementById('ptCoinBox');
  if (!box) return;
  var d = document.createElement('i');
  d.className = 'pt-delta ' + (n > 0 ? 'up' : 'down');
  d.textContent = (n > 0 ? '+' + n : '-' + Math.abs(n));
  box.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1100);
}

// ---------- 弹幕（心情语言） ----------
function ptSay(text, long) {
  var b = document.getElementById('ptBubble');
  if (!b) return;
  b.textContent = text;
  b.classList.add('show');
  if (ptBubbleTimer) clearTimeout(ptBubbleTimer);
  ptBubbleTimer = setTimeout(function () { b.classList.remove('show'); }, long ? 4600 : 3000);
}
function ptTalk(list) { return list[Math.floor(Math.random() * list.length)]; }
function ptHeartsBurst(n) {
  var layer = document.getElementById('ptHearts');
  if (!layer) return;
  for (var i = 0; i < (n || 3); i++) {
    var h = document.createElement('i');
    h.className = 'pt-heart';
    h.textContent = '♥';
    h.style.left = (26 + Math.random() * 66) + 'px';
    h.style.top = (6 + Math.random() * 30) + 'px';
    layer.appendChild(h);
    setTimeout(function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; }(h), 1200);
  }
}

// ---------- 走位编排 ----------
function ptActorEl() { return document.getElementById('ptActor'); }
function ptGo(x, cb) {
  var a = ptActorEl();
  if (!a) { if (cb) cb(); return; }
  ptBusy = true;
  var cur = parseFloat(a.style.left) || 0;
  var svg = a.querySelector('.pt-svg');
  if (svg) {
    svg.classList.toggle('flip', x - cur > 2);
    svg.classList.add('walk');
  }
  var dur = Math.max(650, Math.min(3000, Math.abs(x - cur) * 45));
  a.style.transitionDuration = dur + 'ms';
  a.style.left = x + 'px';
  setTimeout(function () {
    ptBusy = false;
    if (svg) svg.classList.remove('walk');
    if (cb) cb();
  }, dur + 160);
}
function ptRoomW() {
  var r = document.getElementById('ptRoom');
  return r ? r.clientWidth : 320;
}
function ptBowlX() { return Math.round(ptRoomW() * 0.05) + 6; }
function ptTreeX() { return Math.max(ptRoomW() - 160, ptRoomW() * 0.6); }
function ptPlayFx(cls, dur, cb) {
  var svg = document.querySelector('#p-pet .pt-svg');
  if (!svg) { if (cb) cb(); return; }
  svg.classList.remove('jump', 'eat', 'climb', 'hjoy');
  void svg.offsetWidth; // 重启动画
  svg.classList.add(cls);
  setTimeout(function () { svg.classList.remove(cls); if (cb) cb(); }, dur);
}

// ---------- 自主活动（自己跑来跑去/跳来跳去/自言自语） ----------
function ptTick() {
  setTimeout(ptTick, 600);
  if (document.hidden || curTab !== 'pet' || sessionRole !== 'kid' || !ptS) return;
  if (ptBusy) return;
  ptNextAct -= 0.6;
  if (ptNextAct > 0) return;
  ptNextAct = 5 + Math.random() * 7;
  var r = Math.random();
  if (r < 0.58) {
    var w = ptRoomW();
    ptGo(Math.round(16 + Math.random() * Math.max(60, w - 170)));
  } else if (r < 0.78) {
    ptPlayFx('jump', 760);
  } else {
    ptSay(ptTalk(ptIsSad() && ptS.food <= 0 ? PT_TALK.hungry : PT_TALK.idle));
  }
}
setTimeout(ptTick, 800);

// ---------- 交互：撸猫 / 喂食 / 玩耍 / 爬架 ----------
function ptTap() {
  if (curTab !== 'pet' || sessionRole !== 'kid' || !ptS) return;
  ptPlayFx('hjoy', 1200);
  ptHeartsBurst(3);
  ptSay(ptTalk(PT_TALK.pet));
}
function ptFeed(kind) {
  ptCloseModal('ptMoFeed');
  if (!ptS) return;
  if (kind === 'food') {
    if (ptS.food < PT_FOOD_MEAL) { toast('猫粮不够啦，去猫商店买一袋吧'); return; }
    ptS.food = ptR2(ptS.food - PT_FOOD_MEAL);
    ptS.eaten = ptR2(ptS.eaten + PT_FOOD_MEAL);
  } else if (kind === 'can') {
    if (ptS.cans < 1) { toast('罐头吃完了，去猫商店补货吧'); return; }
    ptS.cans--;
  } else if (kind === 'strip') {
    if (ptS.strips < 1) { toast('猫条吃完了，去猫商店补货吧'); return; }
    ptS.strips--;
  }
  var before = PT_STAGES.indexOf(ptStage());
  ptS.lastFeed = today();
  ptSave();
  ptRender();
  ptHeartsBurst(2);
  ptGo(ptBowlX(), function () {
    ptPlayFx('eat', 1600, function () {
      var after = PT_STAGES.indexOf(ptStage());
      if (after > before) { ptSay(ptTalk(PT_TALK.levelup), true); toast('团子长大啦：' + ptStage().name); ptHeartsBurst(5); }
      else ptSay(ptTalk(kind === 'food' ? PT_TALK.feedFood : (kind === 'can' ? PT_TALK.feedCan : PT_TALK.feedStrip)));
      ptRender();
    });
  });
  if (kind === 'food') ptSay('开饭啦！咔嚓咔嚓～');
}
function ptPlayToy(id) {
  ptCloseModal('ptMoPlay');
  if (!ptS) return;
  var it = PT_SHOP.filter(function (x) { return x.id === id; })[0];
  if (!it) return;
  ptHeartsBurst(3);
  ptSay(ptTalk(PT_TALK.play));
  ptPlayFx('jump', 760, function () {
    // 玩耍后短距离冲刺一下
    var w = ptRoomW();
    var cur = parseFloat(ptActorEl().style.left) || 0;
    var target = cur < w / 2 ? Math.min(w - 150, cur + 90) : Math.max(16, cur - 90);
    ptGo(target);
  });
}
function ptClimb() {
  ptCloseModal('ptMoPlay');
  if (!ptS || !ptS.tree) return;
  ptGo(ptTreeX(), function () {
    ptSay(ptTalk(PT_TALK.climb));
    ptPlayFx('climb', 2350, function () { ptHeartsBurst(3); });
  });
}

// ---------- 商店 ----------
function ptShopRows() {
  var h = '';
  for (var i = 0; i < PT_SHOP.length; i++) {
    var it = PT_SHOP[i];
    var owned = (it.type === 'stack') ? false : (it.type === 'tree' ? ptS.tree : ptS.toys.indexOf(it.id) >= 0);
    var btn = owned
      ? '<button class="pet-buy owned" disabled>已拥有</button>'
      : '<button class="pet-buy" ' + (ptS.coins < it.cost ? 'disabled' : '') + ' onclick="ptBuy(\'' + it.id + '\')">' + it.cost + ' 币兑换</button>';
    h += '<div class="pet-item"><div class="pet-ico">' + PT_ICO[it.id] + '</div>'
      + '<div class="pet-inf"><div class="pet-nm">' + escHtml(it.name) + '</div>'
      + '<div class="pet-desc">' + escHtml(it.desc) + '</div>'
      + '<div class="pet-cost">' + PT_ICO.coin + escHtml(String(it.cost)) + ' 猫币</div></div>' + btn + '</div>';
  }
  return h;
}
function ptOpenShop() {
  if (!ptS) return;
  var m = document.getElementById('ptMoShop');
  m.querySelector('.ml-body').innerHTML =
    '<div class="pet-shop-hd"><span class="pet-desc">背单词赚猫币，来给团子买好吃的吧</span><span class="bal">' + PT_ICO.coin + ptS.coins + ' 猫币</span></div>'
    + ptShopRows();
  m.classList.add('show');
}
function ptBuy(id) {
  var it = PT_SHOP.filter(function (x) { return x.id === id; })[0];
  if (!it || ptS.coins < it.cost) return;
  ptSetCoins(-it.cost, false);
  if (it.type === 'stack') {
    if (id === 'food') ptS.food = ptR2(ptS.food + 1);
    if (id === 'can') ptS.cans++;
    if (id === 'strip') ptS.strips++;
  } else if (it.type === 'tree') ptS.tree = true;
  else ptS.toys.push(id);
  ptSave();
  ptRender();
  ptHeartsBurst(4);
  ptSay(ptTalk(PT_TALK.buy));
  toast('买到了「' + it.name + '」');
  ptOpenShop(); // 刷新商店余额/按钮态
}

// ---------- 喂食 / 玩耍 弹窗 ----------
function ptOpenFeed() {
  if (!ptS) return;
  var m = document.getElementById('ptMoFeed');
  var rows = '';
  var foods = [
    { id: 'food', n: '猫粮（喂 1/4 袋）', c: ptS.food, need: PT_FOOD_MEAL, unit: '袋' },
    { id: 'can', n: '猫罐头（喂 1 个）', c: ptS.cans, need: 1, unit: '个' },
    { id: 'strip', n: '猫条（喂 1 根）', c: ptS.strips, need: 1, unit: '根' }
  ];
  for (var i = 0; i < foods.length; i++) {
    var f = foods[i];
    var ok = f.c >= f.need - 1e-9;
    rows += '<div class="pet-item"><div class="pet-ico">' + PT_ICO[f.id] + '</div>'
      + '<div class="pet-inf"><div class="pet-nm">' + f.n + '</div>'
      + '<div class="pet-desc">库存 ' + ptR2(f.c) + ' ' + f.unit + '</div></div>'
      + '<button class="pet-buy" ' + (ok ? '' : 'disabled') + ' onclick="ptFeed(\'' + f.id + '\')">喂</button></div>';
  }
  if (ptS.food <= 0 && ptS.cans <= 0 && ptS.strips <= 0) rows += '<div class="pet-empty">库存空空啦～去背单词赚猫币，再进猫商店补货吧</div>';
  m.querySelector('.ml-body').innerHTML = rows;
  m.classList.add('show');
}
function ptOpenPlay() {
  if (!ptS) return;
  var m = document.getElementById('ptMoPlay');
  var rows = '';
  var has = false;
  for (var i = 0; i < PT_SHOP.length; i++) {
    var it = PT_SHOP[i];
    var owned = it.type === 'toy' && ptS.toys.indexOf(it.id) >= 0;
    if (!owned) continue;
    has = true;
    rows += '<div class="pet-item"><div class="pet-ico">' + PT_ICO[it.id] + '</div>'
      + '<div class="pet-inf"><div class="pet-nm">' + escHtml(it.name) + '</div>'
      + '<div class="pet-desc">' + escHtml(it.desc) + '</div></div>'
      + '<button class="pet-buy" onclick="ptPlayToy(\'' + it.id + '\')">玩</button></div>';
  }
  if (ptS.tree) {
    has = true;
    rows += '<div class="pet-item"><div class="pet-ico">' + PT_ICO.tree + '</div>'
      + '<div class="pet-inf"><div class="pet-nm">猫爬架</div><div class="pet-desc">跳上去站高高</div></div>'
      + '<button class="pet-buy" onclick="ptClimb()">爬</button></div>';
  }
  if (!has) rows = '<div class="pet-empty">还没有玩具～猫商店里有毛线球、逗猫棒在等你</div>';
  m.querySelector('.ml-body').innerHTML = rows;
  m.classList.add('show');
}
function ptCloseModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

// ---------- 背单词赚猫币 ----------
var ptQ = null; // 当前答题会话 {mode, idx, right, wrong, cur, answered}
function ptFlat() {
  var arr = [], sem, u, i;
  for (sem in PT_WB) for (u in PT_WB[sem]) for (i = 0; i < PT_WB[sem][u].length; i++)
    arr.push({ e: PT_WB[sem][u][i][0], c: PT_WB[sem][u][i][1], sem: sem, u: u });
  return arr;
}
function ptNorm(s) {
  s = String(s || '').toLowerCase();
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch >= '\uFF01' && ch <= '\uFF5E') ch = String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); // 全角→半角
    out += ch;
  }
  return out.replace(/[\s'’`·.。!！?？-]/g, '');
}
function ptShuffle(a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function ptDistractors(w, field) {
  var same = [], all = ptFlat(), i;
  var ansKey = ptNorm(w[field]);
  for (i = 0; i < all.length; i++) {
    if (ptNorm(all[i][field]) === ansKey) continue;
    if (all[i].sem === w.sem) same.push(all[i][field]);
  }
  if (same.length < 3) for (i = 0; i < all.length; i++) if (same.indexOf(all[i][field]) < 0 && ptNorm(all[i][field]) !== ansKey) same.push(all[i][field]);
  return ptShuffle(same).slice(0, 3);
}
function ptOpenQuiz() {
  if (!ptS) return;
  var m = document.getElementById('ptMoQuiz');
  m.querySelector('.ml-body').innerHTML =
    '<div class="pet-modes">'
    + '<button class="pet-qmode" onclick="ptQStart(\'spell\')"><b>拼写挑战</b><span>看中文，拼出英文单词（最难，赚币最快）</span></button>'
    + '<button class="pet-qmode" onclick="ptQStart(\'ce\')"><b>中文选英文</b><span>选出正确的英文单词</span></button>'
    + '<button class="pet-qmode" onclick="ptQStart(\'ec\')"><b>英文选中文</b><span>选出英文单词的中文意思</span></button>'
    + '</div>'
    + '<div class="pet-q-fb" style="margin-top:14px"><small>词库：人教版新课标 四年级上册 + 下册 · 答对 +3 猫币 / 答错 -2 猫币</small></div>';
  m.classList.add('show');
}
function ptQStart(mode) {
  ptQ = { mode: mode, idx: 0, right: 0, wrong: 0, cur: null, answered: false, list: ptShuffle(ptFlat()).slice(0, PT_ROUND) };
  ptQRender();
}
function ptQRender() {
  var m = document.getElementById('ptMoQuiz');
  if (!ptQ || ptQ.idx >= ptQ.list.length) { ptQResult(); return; }
  var w = ptQ.list[ptQ.idx];
  ptQ.cur = w; ptQ.answered = false;
  var unit = w.sem + ' · ' + w.u;
  var body = '<div class="pet-q-top"><span>第 ' + (ptQ.idx + 1) + '/' + ptQ.list.length + ' 题</span>'
    + '<span class="bal" style="display:flex;align-items:center;gap:4px">' + PT_ICO.coin + ptS.coins + ' 猫币</span></div>'
    + '<div class="pet-q-prog"><i style="width:' + (ptQ.idx / ptQ.list.length * 100) + '%"></i></div>';
  if (ptQ.mode === 'spell') {
    var e = w.e, hint = '';
    for (var i = 0; i < e.length; i++) hint += (e[i] === ' ' ? '  ' : (i === 0 ? e[i] : '_')) + ' ';
    body += '<div class="pet-q-word">' + escHtml(w.c) + '<small>' + escHtml(unit) + ' · 拼出来：' + escHtml(hint.trim()) + '</small></div>'
      + '<div class="pet-q-input"><input id="ptQInput" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="输入英文单词" onkeydown="if(event.key===\'Enter\')ptSpellTry()">'
      + '<button class="pet-go" onclick="ptSpellTry()">提交</button></div>'
      + '<div class="pet-q-fb" id="ptQFb"></div>';
  } else if (ptQ.mode === 'ce') {
    var opts = ptShuffle([w.e].concat(ptDistractors(w, 'e')));
    body += '<div class="pet-q-word">' + escHtml(w.c) + '<small>' + escHtml(unit) + ' · 选出英文</small></div><div class="pet-q-opts">';
    for (var j = 0; j < opts.length; j++) body += '<button class="pet-opt" onclick="ptQPick(this,' + j + ')">' + escHtml(opts[j]) + '</button>';
    ptQ.opts = opts;
    body += '</div><div class="pet-q-fb" id="ptQFb"></div>';
  } else {
    var opts2 = ptShuffle([w.c].concat(ptDistractors(w, 'c')));
    body += '<div class="pet-q-word">' + escHtml(w.e) + '<small>' + escHtml(unit) + ' · 选出中文意思</small></div><div class="pet-q-opts">';
    for (var k = 0; k < opts2.length; k++) body += '<button class="pet-opt" onclick="ptQPick(this,' + k + ')">' + escHtml(opts2[k]) + '</button>';
    ptQ.opts = opts2;
    body += '</div><div class="pet-q-fb" id="ptQFb"></div>';
  }
  m.querySelector('.ml-body').innerHTML = body;
  var inp = document.getElementById('ptQInput');
  if (inp) setTimeout(function () { inp.focus(); }, 60);
}
function ptSpellTry() {
  if (!ptQ || ptQ.answered) return;
  var inp = document.getElementById('ptQInput');
  var val = ptNorm(inp && inp.value);
  if (!val) return;
  ptQ.answered = true;
  var ok = val === ptNorm(ptQ.cur.e);
  ptQJudge(ok);
}
function ptQPick(btn, j) {
  if (!ptQ || ptQ.answered) return;
  ptQ.answered = true;
  var ok = ptNorm(ptQ.opts[j]) === ptNorm(ptQ.cur[ptQ.mode === 'ce' ? 'e' : 'c']);
  var btns = btn.parentNode.querySelectorAll('.pet-opt');
  for (var i = 0; i < btns.length; i++) {
    if (ptNorm(ptQ.opts[i]) === ptNorm(ptQ.cur[ptQ.mode === 'ce' ? 'e' : 'c'])) btns[i].classList.add('right');
  }
  if (!ok) btn.classList.add('wrong');
  ptQJudge(ok);
}
function ptQJudge(ok) {
  var fb = document.getElementById('ptQFb');
  var remark = ptTalk(ok ? PT_TALK.quizRight : PT_TALK.quizWrong);
  if (ok) {
    ptQ.right++;
    ptSetCoins(PT_RIGHT);
    if (fb) fb.className = 'pet-q-fb ok', fb.innerHTML = '答对啦！猫币 +3<small>团子：' + escHtml(remark) + '</small>';
  } else {
    ptQ.wrong++;
    ptSetCoins(-PT_WRONG);
    var ans = ptQ.cur.e + '（' + ptQ.cur.c + '）';
    if (fb) fb.className = 'pet-q-fb no', fb.innerHTML = '答错了，猫币 -2 · 正确答案：' + escHtml(ans) + '<small>团子：' + escHtml(remark) + '</small>';
  }
  ptQ.idx++;
  setTimeout(function () { if (ptQ && document.getElementById('ptMoQuiz').classList.contains('show')) ptQRender(); }, ok ? 1000 : 1700);
}
function ptQResult() {
  var m = document.getElementById('ptMoQuiz');
  var net = ptQ.right * PT_RIGHT - ptQ.wrong * PT_WRONG;
  m.querySelector('.ml-body').innerHTML =
    '<div class="pet-result"><div class="big">本轮完成！</div>'
    + '<div class="sub">答对 <b class="up">' + ptQ.right + ' 题</b> · 答错 <b class="down">' + ptQ.wrong + ' 题</b><br>'
    + '猫币变化：<b class="' + (net >= 0 ? 'up' : 'down') + '">' + (net >= 0 ? '+' + net : net) + '</b> · 现有 ' + ptS.coins + ' 猫币</div>'
    + '<div class="pet-result-btns">'
    + '<button class="bn-pet p" onclick="ptQStart(\'' + ptQ.mode + '\')">再来一轮</button>'
    + '<button class="bn-pet q" onclick="ptOpenQuiz()">换个模式</button>'
    + '<button class="bn-pet q" onclick="ptCloseModal(\'ptMoQuiz\')">回去撸猫</button>'
    + '</div></div>';
  ptQ = null;
}

// ---------- 页面进入 / 欢迎语 ----------
function ptShow() {
  if (sessionRole !== 'kid') return; // 宠物是孩子端专属
  ptBuild();
  ptLoad();
  var a = ptActorEl();
  if (a && !a.style.left) a.style.left = Math.round(ptRoomW() * 0.38) + 'px'; // 首次出现的位置
  ptRender();
  // 欢迎语：隔天没喂 → 低落；喂过但有粮没喂今天 → 温和提醒；否则正常欢迎
  var base = ptS.lastFeed || ptS.created;
  var gap = ptDaysBetween(base, today());
  var starved = ptS.hungryDays > 0 && ptS.food <= 0;
  if (gap >= 2 || (!ptS.lastFeed && gap >= 1) || starved) {
    ptSay(ptTalk(PT_TALK.greetSad), true);
    setTimeout(function () { if (ptS.food <= 0) ptSay(ptTalk(PT_TALK.hungry), true); }, 5200);
  } else if (gap === 1) {
    ptSay(ptTalk(PT_TALK.greetHint), true);
  } else {
    ptSay(ptTalk(PT_TALK.greet), true);
  }
}
