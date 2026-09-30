// ===== 电子宠物「团子」（孩子端专属页签） =====
// 功能：可爱动画小猫（SVG+CSS 动画：呼吸/眨眼/摇尾/自己走动跳跃/撸猫/进食/爬架），
//   背单词赚猫币（人教版 PEP 2024 新课标版：四上 2025秋 / 四下 2026春 教材单元词汇表；
//   拼写/中文选英文/英文选中文 三种题型随机混出；答对 +3 猫币、答错 -2 猫币，
//   猫币不为负；连对 COMBO 鼓励），猫币在猫咪商店购物：
//   猫粮 20/袋 · 猫罐头 20 · 猫条 15 · 玩具 20~80 · 猫爬架 100（一次性）。
//   喂食开一餐 30 分钟：碗内才出现食物并随时间减少，小猫守碗持续进食、餐中禁喂禁玩，吃完回空；
//   喂食/玩耍会从语言库随机飘出心情弹幕；
//   小猫随累计食量长大（4 个阶段，体型随阶段变大），每天胃口随阶段变大（0.25 → 1 袋/天）；
//   每日喂食上限=阶段胃口折算餐数；隔天未开粮/未喂，进页面触发低落欢迎语。
// 数据：按账号存本机 localStorage 'sp_pet__<phone>'（孩子端与刷题数据同级，不上云）。
// 命名：所有函数加 pt 前缀，避免与账本/刷题全局函数冲突。

// ---------- 常量 ----------
var PET_KEY_PREFIX = 'sp_pet__';
var PT_RIGHT = 3, PT_WRONG = 2, PT_ROUND = 10;   // 答对+3 / 答错-2 / 每轮10题
var PT_FOOD_MEAL = 0.25;                          // 每次喂猫粮吃 1/4 袋
var PT_MEAL_MS = 30 * 60 * 1000;                  // 一餐进食时长：30 分钟（碗内食物随时间减少，吃完回空）
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

// ---------- 单词库（人教版 PEP 三年级起点 · 2024 新课标版） ----------
// 四上=2025秋版 / 四下=2026春版教材「单元词汇表」：
//   四上 U1 Helping at home / U2 My friends / U3 Places we live in / U4 Helping in the community /
//        U5 The weather and us / U6 Changing for the seasons
//   四下 U1 Class rules / U2 Family rules / U3 Time for school / U4 Going shopping /
//        U5 Farms and us / U6 On the farm
// 结构：[英文, 中文]，按单元分组；拼写/选择题都从这里出题。
// 说明：cook 在教材 U1/U4 重复出现，此处合并为一条（烹饪；煮；厨师）避免出题歧义。
var PT_WB = {
  '四上': {
    'U1 Helping at home': [['PE','体育（课）'],['job','工作；职业'],['doctor','医生'],['farmer','农场主；农民'],['nurse','护士'],['worker','工人'],['office worker','公司职员'],['factory worker','工厂工人'],['busy','忙碌的'],['tired','疲倦的'],['chore','家庭杂务'],['cook','烹饪；煮；厨师'],['clean','打扫；干净的'],['room','房间'],['also','也'],['look after','照顾'],['sweep','扫'],['floor','地板；地面'],['together','在一起；共同'],['fun','享乐；乐趣'],['helpful','有帮助的；有用的'],['people','人；人们'],['child','儿童；小孩'],['children','孩子们；儿童们']],
    'U2 My friends': [['his','他的'],['strong','强壮的'],['hair','头发'],['kind','友好的'],['quiet','文静的'],['best','最好的'],['read','阅读'],['Chinese','中文；中国人；中国的'],['play','玩耍'],['game','游戏'],['football','足球运动'],['both','两者'],['basketball','篮球运动'],['always','总是']],
    'U3 Places we live in': [['afternoon','下午'],['there','（表示存在或发生）；在那里'],['playground','游乐场；操场'],['park','公园'],['over','在……的远端（或对面）'],['hospital','医院'],['shop','商店'],['toilet','厕所；卫生间'],['bus','公共汽车'],['stop','车站'],['library','图书馆'],['sport','体育运动'],['walk','散步；行走'],['take','（与名词连用，表示举动、动作等）；带走；运走'],['take a walk','散步'],['community','社区'],['favourite','最喜欢的'],['place','地方；场所'],['photo','照片'],['story','故事'],['buy','购买']],
    'U4 Helping in the community': [['firefighter','消防队员'],['why','为什么'],['driver','司机'],['cleaner','清洁工'],['delivery worker','快递员'],['police','警察'],['police officer','警察；警员'],['a lot of','大量；许多'],['now','现在'],['those','那些'],['bed','床'],['make the bed','铺床'],['old','过去的；年纪大的；老的'],['tell','讲述；告诉'],['everyone','每人'],['volunteer','志愿者'],['Ms','女士']],
    'U5 The weather and us': [['speak','说话；发言'],['weather','天气'],['sunny','阳光充足的'],['hot','热的'],['bad','令人不快的；坏的'],['cold','冷的'],['windy','多风的'],['cloudy','多云的'],['rainy','阴雨的'],['snowy','多雪的'],['cool','凉爽的'],['warm','温暖的'],['tomorrow','在明天'],['rain','下雨；雨'],['closed','关闭的'],['film','电影'],['idea','想法；注意'],['fly','操纵（飞行器等）；飞'],['kite','风筝'],['snowman','雪人'],['their','他们的；她们的；它们的'],['swim','游泳'],['Sydney','悉尼']],
    'U6 Changing for the seasons': [['whose','谁的'],['sweater','毛衣'],['sock','短袜'],['mine','我的'],['wear','穿；戴'],['shirt','衬衫'],['coat','大衣；外套'],['dress','连衣裙'],['which','哪一个；哪一些'],['season','季节'],['winter','冬天'],['snow','下雪；雪'],['get','（使）达到，处于'],['get together','聚会'],['spring','春天'],['summer','夏天'],['autumn','秋天'],['T-shirt','T恤衫'],['fall','落下；秋天'],['leaf','叶子'],['glove','手套'],['then','然后；那时'],['festival','节日']]
  },
  '四下': {
    'U1 Class rules': [['sorry','对不起'],['late','迟到；迟发生'],['class','课；课程；班；班级'],['hurry up','快点；赶快'],['ready','准备好'],['rule','规则；规章'],['classroom','教室'],['turn off','关掉'],['light','灯；光'],['blackboard','黑板'],['desk','书桌；办公桌'],['chair','椅子'],['tidy','整洁的；整齐的；使整洁；整理'],['music','音乐'],['wall','墙；壁'],['door','门'],['window','窗'],['fan','风扇'],['when','当……时；什么时候'],['understand','懂；理解'],['newspaper','报纸'],['hand out','分发'],['workbook','练习册；作业本']],
    'U2 Family rules': [['watch','看'],['TV','电视'],['homework','家庭作业'],['first','首先；首次；第一'],['wet','湿的；未干的'],['run','跑；奔跑'],['house','房子'],['safe','安全的'],['word','言语；单词；字'],['wash','洗'],['loud','说话太大声的；吵闹的'],['sleep','睡觉'],['bedroom','卧室'],['kitchen','厨房'],['living room','客厅；起居室'],['study','书房'],['bathroom','浴室；洗手间'],['work','（花费时间和精力）做（某事）；工作'],['think','想；思考'],['hard','努力地；费力地'],['follow','遵循，听从（忠告、指示等）'],['feel','觉得；感到']],
    'U3 Time for school': [['over','结束（的）'],['kid','小孩'],['dinner','（中午或晚上吃的）正餐'],['art','美术；艺术'],['lunch','午餐'],['maths','数学'],['get up','起床'],['go to school','上学'],['go home','回家'],['go to bed','上床睡觉'],['want','想要'],['clock','时钟'],['just','只是；仅仅；正要'],['minute','分钟']],
    'U4 Going shopping': [['trousers','裤子'],['pair','（由连在一起的相似两部分构成的）一条，一副'],['clothes','衣服；服装'],['shorts','短裤'],['jacket','夹克衫'],['skirt','裙子'],['dear','天哪'],['expensive','昂贵的；价格高的'],['take','买下'],['cheap','便宜的'],['shoe','鞋'],['beautiful','美丽的'],['hat','帽子'],['sunglasses','太阳镜；墨镜'],['free','免费的'],['large','（服装、食物、日用品等）大型号的'],['size','尺码；号'],['list','清单；目录'],['try on','试穿'],['any','任何的；任一的']],
    'U5 Farms and us': [['cow','奶牛'],['horse','马'],['sheep','绵羊'],['pig','猪'],['chicken','鸡；鸡肉'],['tomato','西红柿'],['bee','蜜蜂'],['mouse','老鼠'],['carrot','胡萝卜'],['potato','土豆'],['green bean','四季豆'],['can','（盛食品或饮料的）金属罐'],['a box of','一盒，一箱（东西）']],
    'U6 On the farm': [['feed','给（人或动物）食物；饲养'],['pass','给；递'],['pick','采；摘'],['milk','挤奶'],['knife','刀'],['fork','餐叉'],['chopstick','（常用复数）筷子'],['waste','浪费；废品'],['food','菜肴；食物'],['delicious','美味的；可口的'],['clear the table','收拾餐桌'],['bowl','碗'],['spoon','勺；匙；调羹'],['set the table','摆放餐具'],['supermarket','超市'],['by oneself','（某人）独立地；单独'],['week','周；星期'],['salad','蔬菜沙拉'],['ad','广告']]
  }
};

// ---------- 语言库（随机弹幕） ----------
var PT_TALK = {
  greet: ['喵呜～主人来啦！','今天也要一起玩哦！','喵～想你了，摸摸我嘛','喵喵！我看到你啦','嘿嘿，主人来啦，快陪我玩'],
  greetHint: ['今天还没喂我哦，肚子有点饿了…','喵～碗碗好像空了一半','主人，饭饭时间到啦！'],
  greetSad: ['主人你终于来了，我以为你把我忘了，嘤嘤嘤……','呜……一个人待了一整天，好想你','肚子咕咕叫了两天了……喵呜','喵呜……碗里什么都没有了'],
  hungry: ['猫粮碗空空哒，我要饿扁了……','主人，快去背单词给我赚猫粮吧！','喵呜——救救小猫，没有存粮啦','闻不到饭饭的味道了……'],
  pet: ['呼噜呼噜～好舒服','再摸摸头，就一下下','喵～你是全世界最好的主人','唔，下巴也可以挠挠','呼噜……我要睡着了啦','嘿嘿，被摸得好开心','喵呜～今天的抚摸额度还有效','蹭蹭你的手手'],
  feedFood: ['真开心，又可以吃美食了！','谢谢主人，我吃饱饱','喵！今天的饭饭好香','咀嚼中……幸福中……'],
  eatWords: ['好香～','我要吃得饱饱的~','咔嚓咔嚓','真好吃！','再来一口'],
  feedCan: ['主人你真好！','哇！是猫罐头！我最爱你了！','罐头是世界上最好吃的东西！'],
  canWords: ['罐头最棒了！','咕噜咕噜','太好吃了吧！','主人你真好！','一口一个满足'],
  feedStrip: ['猫条！我的最爱！','舔舔舔——根本停不下来','喵～一口一个幸福'],
  stripWords: ['猫条！','舔舔舔～','幸福到冒泡~','根本停不下来'],
  full: ['吃饱饱！谢谢主人','摸摸我的圆肚子~','呼噜——满足~','喵呜，吃饱啦'],
  canFull: ['罐头吃完了，主人你真好！','打着饱嗝~好满足','今天是大日子！'],
  stripFull: ['猫条吃完啦，还想吃~','嘴巴甜甜的，嘿嘿','幸福来得太突然'],
  play: ['抓到啦！它是我哒','跳高高！我是跳跃小能手','再来再来，陪我还想玩','喵呜——看我的冲刺！','嘿嘿，这个玩具超好玩','扑！抓住你啦'],
  toyWords: {
    yarn: ['喵呜——毛线球！','等我抓！','抓到啦，嘿嘿'],
    ball: ['弹弹弹！','跳高高！','再来再来！'],
    wand: ['目标锁定！','喵！跳！','抓到啦！'],
    mouse: ['老鼠！别跑！','冲刺——','叼到啦！']
  },
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
/* 碗内食物：仅进食会话中出现，颜色随餐种（猫粮棕/罐头粉/猫条黄），scaleX 随剩余时间变少 */
.pet-bowl .b-fill{position:absolute;top:1px;left:6px;right:6px;height:13px;border-radius:8px;display:none;transform-origin:50% 100%;transition:transform 1.2s linear}
.pet-bowl.food .b-fill{display:block;background:#C98A4B}
.pet-bowl.food .b-fill::after{content:'';position:absolute;top:3px;left:5px;width:5px;height:5px;border-radius:999px;background:#A96B32;box-shadow:10px 1px 0 #A96B32,20px -1px 0 #A96B32,30px 1px 0 #A96B32}
.pet-bowl.can .b-fill{display:block;background:#E8A08F}
.pet-bowl.can .b-fill::after{content:'';position:absolute;top:3px;left:6px;width:6px;height:6px;border-radius:999px;background:#D17B66;box-shadow:11px 2px 0 #D17B66,20px -1px 0 #C96E58}
.pet-bowl.strip .b-fill{display:block;background:#F4B942;box-shadow:inset 0 -3px 0 #D89A28}
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
.pet-actor{position:absolute;bottom:11.5%;left:40px;width:140px;transition:left 2.6s ease-in-out;will-change:left}
.pet-actor .pt-svg{display:block;width:140px;height:116px;transition:width .9s ease,height .9s ease;filter:drop-shadow(0 5px 4px rgba(120,80,40,.16));cursor:pointer;-webkit-tap-highlight-color:transparent}
.pt-svg.flip{transform:scaleX(-1)}
.pet-bubble{position:absolute;bottom:122px;left:50%;transform:translateX(-50%);max-width:210px;width:max-content;background:#fff;border:2px solid #F0C9A0;border-radius:14px;padding:8px 11px;font:600 12px/1.5 var(--ff);color:#6B4F35;text-align:center;opacity:0;transition:opacity .25s,bottom .9s ease;pointer-events:none;box-shadow:0 4px 10px rgba(120,80,40,.12);z-index:3}
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
/* 表情切换：开心张嘴 / 难过撇嘴+垂泪 */
.pt-open,.pt-mouth-sad,.pt-tear{display:none}
.pt-svg.hjoy .pt-mouth{display:none}
.pt-svg.hjoy .pt-open{display:block}
.pt-svg.sad .pt-mouth{display:none}
.pt-svg.sad .pt-mouth-sad{display:block}
.pt-svg.sad .pt-tear{display:block;animation:ptTear 1.6s ease-in infinite}
@keyframes ptTear{0%{opacity:0;transform:translateY(0)}30%{opacity:.9}100%{opacity:0;transform:translateY(11px)}}
/* 长大：体型过渡 + 成长脉冲（作用于内层组，不干扰根节点 flip） */
.pt-svg.grow .pt-all{animation:ptGrowPulse .95s ease}
@keyframes ptGrowPulse{0%{transform:scale(1)}45%{transform:scale(1.12)}100%{transform:scale(1)}}
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
/* 操作按钮 / 仓库 / 玩具：喂食与玩耍无弹窗，点下方库存/玩具直接使用 */
.pet-acts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 16px 0}
.pet-act{border:var(--bd);background:var(--card);border-radius:var(--r-m);padding:10px 4px 9px;display:flex;flex-direction:column;align-items:center;gap:4px;font:600 12px/1.2 var(--ff);color:var(--ink);cursor:pointer;box-shadow:var(--sh-card);transition:transform .15s}
.pet-act:active{transform:scale(.94)}
.pet-act svg{width:26px;height:26px}
.pet-act.hot{background:var(--red);color:#fff;border-color:transparent;box-shadow:var(--sh-cta)}
.pet-inv{display:flex;gap:8px;margin:10px 16px 0;flex-wrap:wrap}
.pet-chip{display:flex;align-items:center;gap:6px;background:var(--card);border:var(--bd);border-radius:var(--r-full);padding:6px 12px;font:600 12px/1 var(--ff);font-family:var(--ff);color:var(--ink2);box-shadow:var(--sh-card);cursor:pointer;transition:transform .15s}
.pet-chip:active{transform:scale(.93)}
.pet-chip.zero{opacity:.55}
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
/* 背单词弹窗题目样式（题型随机混出，不再有模式选择页） */
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
.bn-pet.q{background:var(--fill);color:var(--ink)}
/* 吃饭时飘出的心情字 */
.pt-word{position:absolute;font:700 13px/1.3 var(--ff);color:#8F6210;text-shadow:0 1px 0 #fff,0 0 6px #fff;pointer-events:none;white-space:nowrap;z-index:4;animation:ptWordUp 1.75s ease-out forwards}
@keyframes ptWordUp{0%{opacity:0;transform:translateY(8px) scale(.7)}22%{opacity:1;transform:translateY(-4px) scale(1)}100%{opacity:0;transform:translateY(-48px)}}
/* 玩具特效实物：滚动的毛线球/弹跳的皮球/摆动的逗猫棒/逃跑的老鼠 */
.pt-toyfx{position:absolute;bottom:13%;width:46px;height:46px;z-index:2;pointer-events:none}
.pt-toyfx svg{width:100%;height:100%}
.pt-toyfx.roll{animation:ptFxRoll 2.7s ease-in-out forwards}
@keyframes ptFxRoll{0%{transform:translateX(0) rotate(0);opacity:1}55%{transform:translateX(118px) rotate(500deg)}78%{transform:translateX(132px) rotate(560deg)}90%{transform:translateX(116px) rotate(520deg);opacity:1}100%{transform:translateX(124px) rotate(540deg);opacity:0}}
.pt-toyfx.bounce{animation:ptFxBounce 2.6s ease-in-out forwards}
@keyframes ptFxBounce{0%{transform:translateY(0);opacity:1}12%{transform:translateY(-64px)}24%{transform:translateY(0)}36%{transform:translateY(-44px)}48%{transform:translateY(0)}60%{transform:translateY(-26px)}72%{transform:translateY(0)}90%{opacity:1}100%{transform:translateY(0);opacity:0}}
.pt-toyfx.wiggle{bottom:46%;animation:ptFxWiggle 2.4s ease-in-out forwards}
@keyframes ptFxWiggle{0%{transform:rotate(-14deg);opacity:1}25%{transform:rotate(16deg)}50%{transform:rotate(-16deg)}75%{transform:rotate(14deg)}92%{opacity:1}100%{transform:rotate(-10deg);opacity:0}}
.pt-toyfx.run{animation:ptFxRun 2.6s ease-in-out forwards}
@keyframes ptFxRun{0%{transform:translate(0,0);opacity:1}15%{transform:translate(24px,-10px)}30%{transform:translate(48px,0)}45%{transform:translate(74px,-10px)}60%{transform:translate(100px,0)}75%{transform:translate(126px,-8px)}88%{transform:translate(146px,0);opacity:1}100%{transform:translate(150px,0);opacity:0}}
/* 背单词 COMBO 连对鼓励 */
#ptMoQuiz .ml-body{position:relative}
.pt-q-combo{position:absolute;top:30px;right:14px;z-index:6;pointer-events:none;text-align:center;animation:ptComboPop 1.4s ease forwards}
.pt-q-combo b{display:block;font:800 21px/1.1 var(--ff);color:var(--red-deep);text-shadow:0 1px 0 #fff}
.pt-q-combo span{font:700 11px/1.4 var(--ff);color:var(--yel-deep)}
@keyframes ptComboPop{0%{opacity:0;transform:scale(.4)}18%{opacity:1;transform:scale(1.18)}32%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}`;
  var stl = document.createElement('style');
  stl.id = 'petStyle';
  stl.textContent = css;
  document.head.appendChild(stl);
}

// ---------- 小猫 SVG（卡哇伊大头版：默认面向左；大眼睛+爱心鼻；含开心张嘴/难过垂泪表情） ----------
function ptCatSvg() {
  return `<svg class="pt-svg" viewBox="0 0 160 132" aria-hidden="true">
<ellipse cx="86" cy="124" rx="48" ry="6.5" fill="rgba(150,100,60,.14)"/>
<g class="pt-all">
  <g class="pt-tail"><path d="M118 106 C142 104 150 82 138 62" stroke="#FFC98F" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M137 92q7 0 10-6 M141 74q6-2 7-9" stroke="#F5A75B" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="138" cy="63" r="5.5" fill="#F5A75B"/></g>
  <ellipse cx="110" cy="118" rx="13" ry="9" fill="#F7BC72"/>
  <ellipse class="pt-body" cx="86" cy="102" rx="33" ry="24" fill="#FFD9A8"/>
  <path d="M76 84q4 8-1 13 M88 82q4 8-1 13 M99 86q3 7-2 11" stroke="#F5A75B" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="80" cy="111" rx="15" ry="10.5" fill="#FFF3E0" opacity=".9"/>
  <rect x="64" y="110" width="14" height="13" rx="6.5" fill="#FFE3BD"/>
  <rect x="83" y="112" width="13" height="12" rx="6" fill="#FFD9A8"/>
  <path d="M69 118v4 M74 118v4 M88 119v4 M92 119v4" stroke="#E8B57E" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M56 86 Q74 96 92 87" stroke="#EE6F5F" stroke-width="6.5" fill="none" stroke-linecap="round"/>
  <circle cx="75" cy="94" r="5" fill="#FFD34D" stroke="#E3A93B" stroke-width="1.2"/>
  <circle cx="75" cy="96.4" r="1.1" fill="#B8860B"/>
  <g class="pt-head">
    <g class="pt-earL"><polygon points="30,36 20,2 54,16" fill="#FFD9A8"/><polygon points="32,30 26,8 48,17" fill="#FFC2D1"/></g>
    <g class="pt-earR"><polygon points="94,36 104,2 70,16" fill="#FFD9A8"/><polygon points="92,30 98,8 76,17" fill="#FFC2D1"/></g>
    <circle cx="62" cy="54" r="37" fill="#FFD9A8"/>
    <rect x="50" y="20" width="5" height="12" rx="2.5" fill="#F5A75B"/>
    <rect x="59" y="18" width="5" height="12" rx="2.5" fill="#F5A75B"/>
    <rect x="68" y="20" width="5" height="12" rx="2.5" fill="#F5A75B"/>
    <g class="pt-eye"><circle cx="46" cy="54" r="7.5" fill="#453125"/><circle cx="43.5" cy="51" r="2.7" fill="#fff"/><circle cx="48.6" cy="56.6" r="1.4" fill="#fff" opacity=".85"/></g>
    <g class="pt-eye"><circle cx="78" cy="54" r="7.5" fill="#453125"/><circle cx="75.5" cy="51" r="2.7" fill="#fff"/><circle cx="80.6" cy="56.6" r="1.4" fill="#fff" opacity=".85"/></g>
    <path class="pt-happy-eyes" d="M38 54 Q46 45 54 54 M70 54 Q78 45 86 54" stroke="#453125" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="38" cy="66" rx="6" ry="3.6" fill="#FFAEBE" opacity=".8"/>
    <ellipse cx="86" cy="66" rx="6" ry="3.6" fill="#FFAEBE" opacity=".8"/>
    <path d="M62 61c-1.8-2.4-5-1-5 1.2 0 1.8 2.6 3 5 4.6 2.4-1.6 5-2.8 5-4.6 0-2.2-3.2-3.6-5-1.2z" fill="#F08CA4"/>
    <path class="pt-mouth" d="M54 68 Q58 72 62 67.5 Q66 72 70 68" stroke="#C58B60" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <g class="pt-open"><path d="M54 67 Q62 79 70 67 Z" fill="#E2718A"/><ellipse cx="62" cy="72.6" rx="4" ry="2.3" fill="#FF9DB0"/></g>
    <path class="pt-mouth-sad" d="M54 71 Q62 66 70 71" stroke="#C58B60" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path class="pt-tear" d="M90 62q4 6 0 9q-4-3 0-9z" fill="#9CD1F2" opacity=".9"/>
    <path d="M30 52 Q20 50 10 47 M30 58 Q20 59 11 62 M94 52 Q104 50 114 47 M94 58 Q104 59 113 62" stroke="rgba(180,130,90,.55)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
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
// 交互锁：进食/玩耍编排期间禁喂禁玩（ptLockKind='eat' 时给「正在进食」提示语）
var ptLockUntil = 0, ptLockKind = '';
function ptLock(ms, kind) {
  if (Date.now() >= ptLockUntil || kind === 'eat') ptLockKind = kind;
  ptLockUntil = Math.max(ptLockUntil, Date.now() + ms);
}
function ptUnlock() { ptLockUntil = 0; ptLockKind = ''; }
function ptBlockedMsg() {
  if (ptS && ptS.meal && Date.now() < ptS.meal.e) return '猫猫正在进食哦，请等我进食完再来找我玩吧~'; // 30 分钟一餐，餐中禁喂禁玩
  if (Date.now() < ptLockUntil) return '团子还在忙，等它一下下~';
  return '';
}
function ptDefault() {
  return { v: 1, coins: 30, food: 0.5, cans: 0, strips: 0, toys: [], tree: false, eaten: 0, lastFeed: '', lastVisit: today(), created: today(), hungryDays: 0, fedToday: 0, meal: null };
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
// 离线结算：每过一天吃掉「当日胃口」，存粮不足记挨饿天数（进页面触发低落语）；跨天重置当日已喂餐数
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
  ptS.fedToday = 0;
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
    <div class="pet-bowl empty" id="ptBowl" aria-hidden="true"><div class="b-fill" id="ptBowlFill"></div><div class="b-body"></div></div>
    <div class="pet-tree" aria-hidden="true"><div class="ball"></div><div class="pl pl3"></div><div class="post"></div><div class="pl pl2"></div><div class="pl pl1"></div></div>
    <div class="pet-actor" id="ptActor">
      <div class="pet-bubble" id="ptBubble"></div>
      <span id="ptHearts"></span>
      ${ptCatSvg()}
    </div>
  </div>
  <div class="pet-acts">
    <button class="pet-act hot" onclick="ptOpenQuiz()">${PT_ICO.book}背单词</button>
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
  var cap = Math.max(1, Math.round(stg.app / PT_FOOD_MEAL)); // 每日喂食上限（餐）= 胃口折算
  var fed = Math.min(ptS.fedToday || 0, cap);
  document.getElementById('ptGrowT').textContent = '陪伴第 ' + days + ' 天 · 每天吃 ' + stg.app + ' 袋 · 今日已喂 ' + fed + '/' + cap + ' 餐'
    + (next ? ' · 再吃 ' + ptR2(next.need - ptS.eaten) + ' 袋长大' : ' · 已经完全长大啦');
  // 碗：只有进食会话中才有食物（猫粮/罐头/猫条），且随剩余时间变少；吃完/平时为空碗
  var meal = ptS.meal && Date.now() < ptS.meal.e ? ptS.meal : null;
  document.getElementById('ptBowl').className = 'pet-bowl ' + (meal ? (meal.k === 'can' ? 'can' : (meal.k === 'strip' ? 'strip' : 'food')) : 'empty');
  var fill = document.getElementById('ptBowlFill');
  if (fill) fill.style.transform = meal && (meal.e - Date.now()) / (meal.e - meal.s) < 0.97
    ? 'scaleX(' + Math.max(0.06, (meal.e - Date.now()) / (meal.e - meal.s)).toFixed(3) + ')' : '';
  var room = document.getElementById('ptRoom');
  if (room) room.classList.toggle('withtree', !!ptS.tree);
  // 库存即入口：点猫粮/罐头/猫条直接喂（无弹窗）
  var inv = document.getElementById('ptInv');
  inv.innerHTML = '<button class="pet-chip' + (ptS.food <= 0 ? ' zero' : '') + '" onclick="ptFeed(\'food\')">' + PT_ICO.food + '猫粮 <b>' + ptR2(ptS.food) + '</b> 袋</button>'
    + '<button class="pet-chip' + (ptS.cans < 1 ? ' zero' : '') + '" onclick="ptFeed(\'can\')">' + PT_ICO.can + '罐头 <b>' + ptS.cans + '</b></button>'
    + '<button class="pet-chip' + (ptS.strips < 1 ? ' zero' : '') + '" onclick="ptFeed(\'strip\')">' + PT_ICO.strip + '猫条 <b>' + ptS.strips + '</b></button>'
    + (ptS.tree ? '<span class="pet-chip">' + PT_ICO.tree + '猫爬架</span>' : '');
  var toys = document.getElementById('ptToys');
  var h = '';
  for (var i = 0; i < ptS.toys.length; i++) {
    var it = PT_SHOP.filter(function (x) { return x.id === ptS.toys[i]; })[0];
    if (it) h += '<button class="pet-toy" onclick="ptPlayToy(\'' + it.id + '\')">' + PT_ICO[it.id] + '玩 ' + it.name.replace('玩偶', '') + '</button>';
  }
  if (ptS.tree) h += '<button class="pet-toy" onclick="ptClimb()">' + PT_ICO.tree + '爬爬架</button>';
  toys.innerHTML = h;
  // 心情外观：挨饿/隔天未喂 → 耷拉耳朵+撇嘴+垂泪
  var svg = document.querySelector('#p-pet .pt-svg');
  if (svg) svg.classList.toggle('sad', ptIsSad() && !ptBusy);
  ptApplySize();
}
// 成长可视化：按阶段设置体型大小（css 过渡平滑变大），并同步气泡高度
function ptApplySize() {
  var svg = document.querySelector('#p-pet .pt-svg');
  if (!svg || !ptS) return;
  var w = Math.round(140 * ptStage().size), hh = Math.round(w * 132 / 160);
  svg.style.width = w + 'px';
  svg.style.height = hh + 'px';
  var a = ptActorEl();
  if (a) a.style.width = w + 'px';
  var b = document.getElementById('ptBubble');
  if (b) b.style.bottom = (hh + 8) + 'px';
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
    h.style.left = (15 + Math.random() * 55) + '%';
    h.style.top = (6 + Math.random() * 30) + 'px';
    layer.appendChild(h);
    setTimeout(function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; }(h), 1200);
  }
}
// 吃饭/玩耍时从猫咪头顶飘出的心情字（错落升起）
function ptWordSeq(list, n) {
  var room = document.getElementById('ptRoom');
  var a = ptActorEl();
  if (!room || !a) return;
  var x = parseFloat(a.style.left) || 0;
  for (var i = 0; i < (n || 3); i++) {
    setTimeout(function (k) {
      return function () {
        var w = document.createElement('i');
        w.className = 'pt-word';
        w.textContent = list[k % list.length];
        w.style.left = (x + 10 + Math.random() * 62) + 'px';
        w.style.bottom = (128 + Math.random() * 26) + 'px';
        room.appendChild(w);
        setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 1800);
      };
    }(i), i * 850);
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
  ptMealStep(); // 进食会话推进（到点收碗/守碗循环吃/飘字/食物渐少）
  if (ptS.meal) return; // 餐中不自主活动（一直进食）
  if (ptBusy || Date.now() < ptLockUntil) return; // 玩耍编排期间不自主活动
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
// 撸猫：点小猫本体 → 开心眯眼张嘴 + 爱心 + 随机撒娇语（进食/玩耍中不切换表情动画，避免打断）
function ptTap() {
  if (curTab !== 'pet' || sessionRole !== 'kid' || !ptS) return;
  if (Date.now() >= ptLockUntil) ptPlayFx('hjoy', 1200);
  ptHeartsBurst(3);
  ptSay(ptTalk(PT_TALK.pet));
}
// 喂食无弹窗：点库存 chip 直接喂；每日上限 = 阶段胃口折算餐数（0.25袋/餐），
// 超出提示「今天已经喂够了」。
// 进食会话：喂下后开一餐 30 分钟（PT_MEAL_MS）——碗内出现食物并随时间逐渐减少，
// 期间小猫一直守在碗边循环进食、随机飘心情字，餐中禁喂禁玩；30 分钟吃完碗回空。
// 会话随 localStorage 持久化：刷新/换页/离线期间照常计时（进页面时对齐）。
function ptFeed(kind) {
  if (!ptS) return;
  var blk = ptBlockedMsg(); // 上一餐未吃完/玩耍中：拒绝并提示（进食优先提示）
  if (blk) { toast(blk); return; }
  var cap = Math.max(1, Math.round(ptStage().app / PT_FOOD_MEAL));
  if ((ptS.fedToday || 0) >= cap) { toast('今天已经喂够了，明天再来吧~'); return; }
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
  } else return;
  var before = PT_STAGES.indexOf(ptStage());
  ptS.fedToday = (ptS.fedToday || 0) + 1;
  ptS.lastFeed = today();
  ptS.meal = { s: Date.now(), e: Date.now() + PT_MEAL_MS, k: kind }; // 开餐
  ptSave();
  ptRender();
  ptLock(4200, 'move'); // 仅走位期间锁，之后由「餐中」状态接管
  ptSay('开饭啦～这顿要吃好一会儿');
  ptWordSeq(kind === 'food' ? PT_TALK.eatWords : (kind === 'can' ? PT_TALK.canWords : PT_TALK.stripWords), 3);
  ptGo(ptBowlX() + 12, function () {
    ptUnlock();
    ptNextEatAt = 0; ptNextMealWord = 0; // 立即开始进食循环
    var after = PT_STAGES.indexOf(ptStage());
    if (after > before) { // 长大：体型脉冲 + 气泡庆祝
      var svg = document.querySelector('#p-pet .pt-svg');
      if (svg) { svg.classList.add('grow'); setTimeout(function () { svg.classList.remove('grow'); }, 1000); }
      ptSay(ptTalk(PT_TALK.levelup), true);
      toast('团子长大啦：' + ptStage().name);
      ptHeartsBurst(5);
    }
    ptRender();
  });
}
// 一餐 30 分钟的推进：到点收碗；未到点则保证猫守在碗边、循环低头吃、随机飘字、食物渐少
var ptNextEatAt = 0, ptNextMealWord = 0;
function ptMealStep() {
  var m = ptS && ptS.meal;
  if (!m) return;
  var now = Date.now();
  if (now >= m.e) { // 吃完：碗回空 + 满足语
    ptS.meal = null;
    ptSave();
    ptRender();
    ptHeartsBurst(4);
    ptSay(ptTalk(m.k === 'food' ? PT_TALK.full : (m.k === 'can' ? PT_TALK.canFull : PT_TALK.stripFull)), true);
    return;
  }
  if (!ptBusy && Date.now() >= ptLockUntil) {
    var a = ptActorEl();
    var x = parseFloat(a && a.style.left) || 0;
    if (Math.abs(x - (ptBowlX() + 12)) > 8) ptGo(ptBowlX() + 12); // 离开碗边了就回去继续吃
  }
  if (now >= ptNextEatAt) { ptNextEatAt = now + 3200; ptPlayFx('eat', 2800); } // 一直低头吃
  if (now >= ptNextMealWord) {
    ptNextMealWord = now + 8000 + Math.random() * 9000;
    var list = m.k === 'food' ? PT_TALK.eatWords : (m.k === 'can' ? PT_TALK.canWords : PT_TALK.stripWords);
    ptWordSeq([ptTalk(list)], 1);
  }
  var fill = document.getElementById('ptBowlFill'); // 食物随剩余时间变少
  if (fill) {
    var frac = (m.e - now) / (m.e - m.s);
    fill.style.transform = frac >= 0.97 ? '' : 'scaleX(' + Math.max(0.06, frac).toFixed(3) + ')';
  }
}
// 玩具无弹窗：点玩具按钮即玩——实物出现在房间里，小猫追逐/扑跳
var PT_TOYFX = {
  yarn: { cls: 'roll', chase: true },
  ball: { cls: 'bounce', chase: false },
  wand: { cls: 'wiggle', chase: false },
  mouse: { cls: 'run', chase: true }
};
function ptPlayToy(id) {
  if (!ptS) return;
  var blk = ptBlockedMsg(); // 进食中拒绝：等吃完再来玩
  if (blk) { toast(blk); return; }
  var cfg = PT_TOYFX[id];
  var room = document.getElementById('ptRoom');
  if (!cfg || !room) return;
  var a = ptActorEl();
  var x = parseFloat(a && a.style.left) || 40;
  var fx = document.createElement('div');
  fx.className = 'pt-toyfx ' + id + ' ' + cfg.cls;
  fx.innerHTML = PT_ICO[id];
  fx.style.left = Math.min(Math.max(x + (cfg.cls === 'wiggle' ? 58 : 34), 16), Math.max(16, ptRoomW() - 66)) + 'px';
  room.appendChild(fx);
  setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 2800);
  ptWordSeq(PT_TALK.toyWords[id] || PT_TALK.play, 3);
  if (cfg.chase) {
    var target = Math.min((parseFloat(fx.style.left) || 0) + 104, Math.max(16, ptRoomW() - 160));
    ptLock(4400, 'move'); // 追逐+扑跳期间锁交互
    ptGo(target, function () {
      ptPlayFx('jump', 780, function () { ptUnlock(); });
      ptHeartsBurst(3);
      ptSay(ptTalk(PT_TALK.play));
    });
  } else {
    ptLock(2300, 'move');
    ptPlayFx('jump', 780);
    setTimeout(function () {
      ptPlayFx('jump', 780, function () { ptUnlock(); });
      ptHeartsBurst(3);
      ptSay(ptTalk(PT_TALK.play));
    }, 900);
  }
}
function ptClimb() {
  if (!ptS || !ptS.tree) return;
  var blk = ptBlockedMsg();
  if (blk) { toast(blk); return; }
  ptLock(6200, 'move'); // 走位+攀爬期间锁交互
  ptGo(ptTreeX(), function () {
    ptSay(ptTalk(PT_TALK.climb));
    ptPlayFx('climb', 2350, function () { ptUnlock(); ptHeartsBurst(3); });
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

// ---------- 喂食/玩耍无弹窗：入口=库存 chip 与玩具按钮（ptFeed/ptPlayToy），此处不再提供弹窗 ----------
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
// 点「背单词」直接开考：三种题型随机混出，不再显示题型选择；连对有 COMBO 鼓励
function ptOpenQuiz() {
  if (!ptS) return;
  document.getElementById('ptMoQuiz').classList.add('show');
  ptQStart();
}
var PT_QMODES = ['spell', 'ce', 'ec'];
var PT_COMBO_WORDS = { 2: '厉害！', 3: '超棒！', 4: '太强啦！', 5: '势不可挡！' };
function ptComboWord(n) { return PT_COMBO_WORDS[Math.min(n, 5)] || '厉害！'; }
function ptQStart() {
  ptQ = { qmode: 'ce', idx: 0, right: 0, wrong: 0, combo: 0, maxCombo: 0, cur: null, answered: false, list: ptShuffle(ptFlat()).slice(0, PT_ROUND) };
  ptQRender();
}
function ptQRender() {
  var m = document.getElementById('ptMoQuiz');
  if (!ptQ || ptQ.idx >= ptQ.list.length) { ptQResult(); return; }
  var w = ptQ.list[ptQ.idx];
  ptQ.cur = w; ptQ.answered = false;
  ptQ.qmode = PT_QMODES[Math.floor(Math.random() * PT_QMODES.length)]; // 每题随机题型
  var unit = w.sem + ' · ' + w.u;
  var modeName = ptQ.qmode === 'spell' ? '拼出来' : (ptQ.qmode === 'ce' ? '选出英文' : '选出中文意思');
  var body = '<div class="pt-q-wrap"><div class="pet-q-top"><span>第 ' + (ptQ.idx + 1) + '/' + ptQ.list.length + ' 题 · 随机题型</span>'
    + '<span class="bal" style="display:flex;align-items:center;gap:4px">' + PT_ICO.coin + ptS.coins + ' 猫币</span></div>'
    + '<div class="pet-q-prog"><i style="width:' + (ptQ.idx / ptQ.list.length * 100) + '%"></i></div>';
  if (ptQ.qmode === 'spell') {
    var e = w.e, hint = '';
    for (var i = 0; i < e.length; i++) hint += (e[i] === ' ' ? '  ' : (i === 0 ? e[i] : '_')) + ' ';
    body += '<div class="pet-q-word">' + escHtml(w.c) + '<small>' + escHtml(unit) + ' · ' + modeName + '：' + escHtml(hint.trim()) + '</small></div>'
      + '<div class="pet-q-input"><input id="ptQInput" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="输入英文单词" onkeydown="if(event.key===\'Enter\')ptSpellTry()">'
      + '<button class="pet-go" onclick="ptSpellTry()">提交</button></div>'
      + '<div class="pet-q-fb" id="ptQFb"></div>';
  } else if (ptQ.qmode === 'ce') {
    var opts = ptShuffle([w.e].concat(ptDistractors(w, 'e')));
    body += '<div class="pet-q-word">' + escHtml(w.c) + '<small>' + escHtml(unit) + ' · ' + modeName + '</small></div><div class="pet-q-opts">';
    for (var j = 0; j < opts.length; j++) body += '<button class="pet-opt" onclick="ptQPick(this,' + j + ')">' + escHtml(opts[j]) + '</button>';
    ptQ.opts = opts;
    body += '</div><div class="pet-q-fb" id="ptQFb"></div>';
  } else {
    var opts2 = ptShuffle([w.c].concat(ptDistractors(w, 'c')));
    body += '<div class="pet-q-word">' + escHtml(w.e) + '<small>' + escHtml(unit) + ' · ' + modeName + '</small></div><div class="pet-q-opts">';
    for (var k = 0; k < opts2.length; k++) body += '<button class="pet-opt" onclick="ptQPick(this,' + k + ')">' + escHtml(opts2[k]) + '</button>';
    ptQ.opts = opts2;
    body += '</div><div class="pet-q-fb" id="ptQFb"></div>';
  }
  body += '</div>';
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
  var ansKey = ptNorm(ptQ.cur[ptQ.qmode === 'ce' ? 'e' : 'c']);
  var ok = ptNorm(ptQ.opts[j]) === ansKey;
  var btns = btn.parentNode.querySelectorAll('.pet-opt');
  for (var i = 0; i < btns.length; i++) {
    if (ptNorm(ptQ.opts[i]) === ansKey) btns[i].classList.add('right');
  }
  if (!ok) btn.classList.add('wrong');
  ptQJudge(ok);
}
function ptQJudge(ok) {
  var fb = document.getElementById('ptQFb');
  var remark = ptTalk(ok ? PT_TALK.quizRight : PT_TALK.quizWrong);
  if (ok) {
    ptQ.right++;
    ptQ.combo++;
    ptQ.maxCombo = Math.max(ptQ.maxCombo, ptQ.combo);
    ptSetCoins(PT_RIGHT);
    var ctext = '';
    if (ptQ.combo >= 2) { // 连对 COMBO 鼓励（角标弹出后自动消失）
      ctext = ' · 连对 ×' + ptQ.combo;
      var wrap = document.querySelector('#ptMoQuiz .pt-q-wrap');
      if (wrap) {
        wrap.insertAdjacentHTML('beforeend', '<div class="pet-q-combo"><b>COMBO ×' + ptQ.combo + '</b><span>' + ptComboWord(ptQ.combo) + '</span></div>');
        var cb = wrap.querySelector('.pet-q-combo');
        setTimeout(function () { if (cb && cb.parentNode) cb.parentNode.removeChild(cb); }, 1450);
      }
    }
    if (fb) fb.className = 'pet-q-fb ok', fb.innerHTML = '答对啦！猫币 +3' + ctext + '<small>团子：' + escHtml(remark) + '</small>';
  } else {
    ptQ.wrong++;
    ptQ.combo = 0;
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
    + '<div class="sub">答对 <b class="up">' + ptQ.right + ' 题</b> · 答错 <b class="down">' + ptQ.wrong + ' 题</b>'
    + (ptQ.maxCombo >= 2 ? ' · 最高连对 <b class="up">×' + ptQ.maxCombo + '</b>' : '') + '<br>'
    + '猫币变化：<b class="' + (net >= 0 ? 'up' : 'down') + '">' + (net >= 0 ? '+' + net : net) + '</b> · 现有 ' + ptS.coins + ' 猫币</div>'
    + '<div class="pet-result-btns">'
    + '<button class="bn-pet p" onclick="ptQStart()">再来一轮</button>'
    + '<button class="bn-pet q" onclick="ptCloseModal(\'ptMoQuiz\')">回去撸猫</button>'
    + '</div>'
    + '<div class="sub" style="margin-top:12px;font-size:11px">词库：人教版PEP（2024新版）四上+四下 · 三种题型随机 · 答对 +3 / 答错 -2 猫币</div>'
    + '</div>';
  ptQ = null;
}

// ---------- 页面进入 / 欢迎语 ----------
function ptShow() {
  if (sessionRole !== 'kid') return; // 宠物是孩子端专属
  ptBuild();
  ptLoad();
  ptMealSync(); // 离线/换页期间跨过 30 分钟的餐：收碗回空；未吃完的餐恢复进食循环
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
// 进页面时对齐进食会话：已跨过 30 分钟 → 收碗（碗回空）；仍在餐中 → 重置循环计时立即继续吃
function ptMealSync() {
  if (ptS.meal && Date.now() >= ptS.meal.e) { ptS.meal = null; ptSave(); }
  ptNextEatAt = 0;
  ptNextMealWord = 0;
}

// 页脚样式立即注入：宠物页签爪印图标在登录后即可见（不等到首次进入宠物页才注入）
ptInjectStyle();
