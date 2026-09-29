// ===== 刷题页：题库可配置（quiz/index.json + quiz/<bank>.json） =====
// 数据来源：进入刷题页时 fetch quiz/index.json（题库清单）→ 按需 fetch 当前题库文件；
//   取不到时回退到下方内置兜底题库（bankId=builtin），保证页面永远可用。
// 进度/错题/剔除按「账号」隔离：本机 localStorage 单键 'sp_quiz__<phone>' 存
//   {done:{bankId:[下标]},wrong:{...},excluded:{...},wrongMeta:{bankId:[复习进度]}}；
//   同时镜像进账号数据桶字段 quizDone/quizWrong/quizExcluded/quizWrongMeta（结构相同）随 sd() 上云。
//   当前题库 id 存 'sp_quiz_bank'。旧设备级键 sp_quiz_done__<bankId>/sp_quiz_wrong__<bankId>
//   由设备级标记 'sp_quiz_migrated' 做一次性迁移（迁给迁移时登录的家长账号），旧键保留不删。
// 命名说明：为避免与账本既有全局函数（如 render）冲突，刷题函数统一加 qz 前缀；
// 功能与原版一致：分类筛选、完成标记并自动跳下一题、上/下一题、随机、
// 重置（走 App 内确认框 sc2，仅重置当前题库）、进度条与统计实时更新、分类做完的空态/全部完成庆祝态。
// 增量：家长判分 —— 看答案后出现「答对了」「答错了」；答对给当前账号 +5 分（可重复得分），
// 答错不加分但同样走 sd() 链路把错题变化推上云（多设备同步），两者都标记完成并跳下一题。判分仅家长端开放。
// 增量：错题集 —— 答错自动归集（去重），头部行「错题集 (N)」按钮（与「重置进度」同排、位于其左侧）入口，
// 全局汇总所有题库的错题（N 为全部题库合计，每题标注出处题库）；集内可重做；重置进度不影响错题集。
// 增量：错题间隔复习 —— 错题答对 1 次进入「复习 1/2」（保留在集内），连续答对 2 次才移出错题集；
//   复习期间答错进度清零。复习进度按题库分键存 wrongMeta，随账号桶上云多设备同步。
// 增量：连续打卡 —— 每日首次判分（答对/答错均算刷题）自动打卡；连续 3/7/14/21/30/60/100 天发放
//   里程碑积分奖励；断签次日可用补签卡（20 积分/张）补回昨日，购买与补签均产生不可删除的系统流水。
// 增量：剔除题目 —— 题目卡「剔除」按钮（仅家长端）→ 确认后加入 excluded：
//   剔除题视同不存在（所有视图/统计分母/题号位次/错题集展示/随机范围全部排除，数据保留），
//   恢复入口在题库选择弹窗底部「已剔除题目 (N)」，剔除与恢复均按 bankId 分键、按账号上云。
// 增量：自定义题库 —— 题库弹窗内可新建/导入（JSON 文件或粘贴）/编辑/删除本机自定义题库
//   （localStorage 'sp_custom_banks'，不占用云端仓库；可通过设置页「导出备份」跨设备迁移）。
// 说明：下方 CATS / DATA 为「内置兜底题库」（来源：「100道逻辑推理题-四年级.html」原样集成），
//   与 quiz/logic-4.json 内容逐字一致；运行时数据源一律是「当前题库」（qzCats / qzData）。
var CATS = [
  { name: "经典情境", note: "经典情境推理" },
  { name: "真话假话", note: "真话与假话" },
  { name: "数学巧算", note: "数学巧算" },
  { name: "策略对策", note: "策略与对策" },
  { name: "谁是谁", note: "谁是谁·排排坐" },
  { name: "急转弯", note: "生活中的逻辑急转弯" },
  { name: "挑战压轴", note: "挑战压轴题" }
];

var DATA = [
// ============ 一、经典情境推理 ============
{ c:0, t:"三个开关一个灯", q:"一个房间里有一盏灯，门外有三个开关，其中只有一个能控制这盏灯。门关着，看不见里面亮不亮。你只能进房间一次，怎么确定每个开关分别管什么？", a:"先打开开关1，等10分钟后关掉；再打开开关2，马上进房间——灯亮着→开关2；灯不亮但灯泡摸起来发热→开关1；灯不亮又凉→开关3。热量替你多带了一次信息！" },
{ c:0, t:"烧绳子计时（30分钟）", q:"一根粗细不均匀的绳子，从一头点燃正好烧1小时（但烧得忽快忽慢）。你只有这根绳子和打火机，怎么测出30分钟？", a:"同时点燃绳子的两端！虽然粗细不均，但两端同时烧，剩余部分烧完的时刻正好是30分钟。" },
{ c:0, t:"烧绳子计时（45分钟）", q:"还是这种1小时的绳子，现在有两根，怎么测出45分钟？", a:"第一根点两端，第二根只点一端。第一根烧完时=30分钟，此时第二根还剩30分钟的量；立刻把第二根另一端也点上，剩余部分从两端烧，再过15分钟烧完。30+15=45分钟。" },
{ c:0, t:"9个球找重球", q:"9个外观一模一样的小球，其中1个比其他重。用没有砝码的天平，最少称几次一定能找出来？怎么称？", a:"2次。第一次：天平两边各放3个——平，重的在剩下3个里；不平，重的那边3个是嫌疑组。第二次：从嫌疑的3个里任取2个称——平，剩下那个是重球；不平，沉下去的是。" },
{ c:0, t:"只称一次找假药", q:"10瓶药丸，每瓶100粒。正品每粒10克，其中一瓶全是假药，每粒11克。有一台能显示克数的电子秤，只能称一次，怎么找出那瓶假药？", a:"给瓶子编号1~10，从1号瓶取1粒、2号瓶取2粒……10号瓶取10粒，一共55粒放上去称。标准总重550克，实际超重几克，就是几号瓶是假药。" },
{ c:0, t:"摸袜子", q:"抽屉里混放着10只黑袜子和10只白袜子，屋里灯坏了伸手不见五指。至少拿几只出来，才能保证凑出一双同色的？", a:"3只。最倒霉的情况是前两只是一黑一白，那么第三只无论什么颜色，都能和前两只中的一只配成同色的一双。" },
{ c:0, t:"标签全错的三个盒子", q:"三个盒子分别装着苹果、橘子、苹果+橘子混合。三个盒子的标签全部贴错了。只能从一个盒子里摸出一个水果看，怎么确定所有盒子里装的是什么？", a:"摸贴着『混合』标签的盒子。因为标签全错，它里面一定装的是纯苹果或纯橘子。比如摸出苹果，它就是苹果盒；那么贴『橘子』的盒子不能是橘子（标签错）也不能是苹果（已被占），只能是混合；剩下贴『苹果』的就是橘子。" },
{ c:0, t:"17头骆驼分家", q:"老牧民留下17头骆驼，遗嘱说：老大分1/2，老二分1/3，老三分1/9。17不能被2、3、9整除，三兄弟愁坏了。聪明的邻居牵来自己1头骆驼凑成18头，然后轻松分完了。怎么分的？", a:"18头按遗嘱分：老大9头、老二6头、老三2头，共17头，剩下那头还给邻居。妙处在于1/2+1/3+1/9=17/18<1，遗嘱本来就分不完，借1头正好补上缺口。" },
{ c:0, t:"5升桶和3升桶量出4升", q:"有一个装满8升水的水缸，只有5升和3升两个空桶（都没有刻度），怎么精确量出4升水？", a:"①装满5升桶；②用5升桶把3升桶倒满，5升桶里剩2升；③倒空3升桶，把那2升倒进3升桶；④再装满5升桶；⑤用5升桶往3升桶里倒（3升桶只差1升），倒进1升后，5升桶里正好剩4升。" },
{ c:0, t:"农夫、狼、羊和白菜", q:"农夫要带狼、羊、白菜过河，船很小，每次只能带一样。狼要吃羊，羊要吃菜，农夫不在场时不能让它们单独相处。怎么把它们都安全送过河？", a:"共7次：①带羊过去；②空手回来；③带菜过去，把羊带回来（关键一步！）；④带狼过去；⑤空手回来；⑥再带羊过去。核心思路：羊是『麻烦制造者』，让它永远不落单。" },
{ c:0, t:"四人过桥（17分钟）", q:"深夜四人要过一座桥，必须用手电筒，桥上每次最多两人。甲1分钟、乙2分钟、丙5分钟、丁10分钟。两人同行按较慢者的速度算。手电只有一个，怎么让四人17分钟内全部过桥？", a:"①甲乙先过（2分钟）；②甲把手电带回来（1分钟）；③丙丁一起过（10分钟）；④乙把手电带回来（2分钟）；⑤甲乙再一起过（2分钟）。合计2+1+10+2+2=17分钟。诀窍：让最慢的两人绑在一起过，避免他们的时间被重复计算。" },
{ c:0, t:"1000瓶水1瓶有毒", q:"有1000瓶水，其中1瓶有毒，小白鼠喝了毒水一天后就会死。要在一天后找出毒瓶，最少需要几只小白鼠？", a:"10只。把瓶子编号0~999，写成二进制（10位二进制数正好能表示0~1023）。第i位是1的瓶子，都给第i号小鼠喝一口。一天后看哪几只小鼠死了——死了的位记1，没死的记0，拼出的二进制数就是毒瓶编号。10只小鼠的生/死状态组合有2^10=1024种，覆盖1000个编号。" },
{ c:0, t:"两个鸡蛋和100层楼", q:"一栋100层楼，鸡蛋从某一层及以上扔下会摔碎，之下不会。给你2个一模一样的鸡蛋，最少扔几次能保证找出那个临界层？", a:"14次。第一个鸡蛋从14层、27层、39层、50层……扔（间隔依次减1：14,13,12,11……）。如果碎了，第二个鸡蛋就在上一个安全层之上逐层试。这样无论临界层在哪，总次数都不超过14。核心思想：第一个鸡蛋每多扔一次，第二个鸡蛋的『预算』就少一次，所以间隔要逐渐变小。" },
{ c:0, t:"蜗牛爬井", q:"一只蜗牛在10米深的井底，白天向上爬3米，晚上睡觉滑下来2米。它几天能爬出井口？", a:"8天。很多人会说10天，但错了：前7天每天净爬1米，第7天结束时在7米处；第8天白天爬3米到达10米——它直接爬出去了，不会再滑下来！" },
{ c:0, t:"三扇门换不换（蒙提霍尔问题）", q:"三扇门，一扇后面是汽车，两扇后面是山羊。你选了1号门。主持人（知道答案）打开了一扇有山羊的门——比如3号门，然后问你：要不要换成2号门？换不换赢面大？", a:"换！不换的赢面是1/3，换的赢面是2/3。想通的方法：假设你一开始选了山羊（概率2/3），这时主持人只好打开另一扇山羊门，那剩下的门必定是汽车。所以只要一开始选错（大概率事件），换了就赢。" },

// ============ 二、真话与假话 ============
{ c:1, t:"天使与恶魔的路", q:"岔路口有两条路，一条通向村庄，一条通向危险的沼泽。路口站着两个村民：一个永远说真话，一个永远说谎，但你不知道谁是哪个。只能问其中一个人一个问题，怎么找到去村庄的路？", a:"随便问其中一个人：『如果我问另一个人「这条路通向村庄吗」，他会怎么说？』然后走他说的反方向。因为：真话者会如实转述说谎者的假话；说谎者会把真话者的真话歪曲成假话。两人给出的答案都必然是错的，反向走就是正确答案。" },
{ c:1, t:"骑士与骗子", q:"岛上的人要么是骑士（只说真话），要么是骗子（只说假话）。A对你说：『我们两个人中，至少有一个是骗子。』A和B分别是什么？", a:"A是骑士，B是骗子。假设A是骗子，那这句话是假话，即『至少一个骗子』不成立——两人都是骑士，与A是骗子矛盾。所以A是骑士，这句话为真：既然A是骑士，那个『骗子』只能是B。" },
{ c:1, t:"互指说谎的三人", q:"B说：『C在说谎。』C说：『B在说谎。』A说：『B和C都在说谎。』你能确定谁说真话吗？", a:"能确定A在说谎；B和C一真一假（他俩的话互相矛盾，必定恰好一人真一人假）。既然B、C不可能都说谎，A那句『都在说谎』就一定是假话——A是骗子。B和C谁真谁假，光凭这三句话定不了，这也是答案的一部分。" },
{ c:1, t:"谁打碎了玻璃", q:"足球打碎了窗玻璃，四个孩子各说一句话，只有一人说真话。甲：『不是我。』乙：『是丙干的。』丙：『是丁干的。』丁：『丙在说谎。』是谁打碎的？", a:"是甲打碎的，丁说了真话。逐一假设：若乙真（是丙），则丙假、丁真，出现两句真话，矛盾；若丙真（是丁），则丁假——丁说『丙在说谎』为假即丙没说谎，与丙真矛盾；若甲真，则乙丙丁都假——丁假意味着丙没说谎，矛盾。只有丁真：丙假（不是丁）、乙假（不是丙）、甲假（就是甲！），完全自洽。" },
{ c:1, t:"真话城和假话城", q:"岔路口一条路通往『真话城』（居民全说真话），一条通往『假话城』（居民全说假话）。路口站了个人，不知道是哪个城的。只能问一个问题，怎么走对路？", a:"指着其中一条路问：『如果我问你「这条路通向真话城吗」，你会回答「是」吗？』回答『是』就走这条路，回答『不是』就走另一条。这种『双保险』问法会让说谎者说两次谎（负负得正），真话者和说谎者给出的答案变成一样的，而且都是真答案。" },
{ c:1, t:"两个互相评价的人", q:"A说：『B是说谎者。』B说：『A说的是真话。』他们俩谁真谁假？", a:"A说真话，B说谎。假设A是假话→B不是说谎者→B说真话→『A说的是真话』为真→A没说谎，矛盾。所以只能是A真、B假，自洽。" },
{ c:1, t:"三顶帽子", q:"三个人上山，共有3顶黑帽、2顶白帽，每人戴一顶，排成一列：最后的人能看到前面两人，中间的人能看到最前面一人，最前面的人谁都看不见。问最后的人：『知道自己帽子的颜色吗？』答：不知道。问中间的人：也不知道。可最前面的人却立刻说出了自己帽子的颜色。是什么颜色？", a:"黑色。最后的人看见前两人：若前两人都戴白帽，他就知道自己是黑帽（白帽只剩2顶），他却说不知道→前两人至少有一顶黑帽。中间人听懂了这层意思，再看最前面的人：若最前面的人戴白帽，那『至少一顶黑』的就是自己，他应该能答出黑色；他也说不知道→最前面的人戴的是黑帽。" },
{ c:1, t:"三句话辨真伪", q:"三个人各说一句：A说『我们三人都是骗子』；B说『我们三人中恰有一人是骗子』；C说『我们三人中恰有两人是骗子』。谁说真话？", a:"B说真话，A和C是骗子。若三人都骗子，A那句『我们三人都是骗子』反而成了真话，而A必须是骗子，矛盾；若C真（恰两骗子），C自己就不是骗子，矛盾。唯一自洽：恰一骗子——B说真话，A、C说谎。" },
{ c:1, t:"说谎者悖论", q:"小明写下一句话：『我现在说的这句话是假的。』这句话到底是真是假？", a:"两边都不成立：如果它是真的，那『这句话是假的』就为真，矛盾；如果它是假的，那『这句话是假的』为假，即它是真的，也矛盾。这就是著名的『说谎者悖论』——它告诉孩子：不是所有句子都能简单地分真假。可以聊聊怎么改造句子避开悖论。" },
{ c:1, t:"考试作弊案", q:"班里有考试作弊的事，四个同学各说一句话，只有一人说真话。甲：『作弊的是乙。』乙：『作弊的是丁。』丙：『反正我没作弊。』丁：『乙在冤枉我！』到底谁作弊了？", a:"作弊的是丙，只有丁说了真话。假设甲真→是乙→丙说『我没作弊』也是真的，两句真话，矛盾；假设乙真→是丁→丙『我没作弊』为真，也是两句真话，矛盾。所以甲乙都说谎：不是乙、不是丁；丙说谎→就是丙作弊；丁说『乙在冤枉我』为真。全部吻合！" },
{ c:1, t:"下一句话链", q:"甲说：『乙在说谎。』乙说：『丙在说谎。』丙说：『甲和乙都在说谎。』谁说真话？", a:"乙说真话，甲和丙说谎。假设甲真→乙说谎→丙说真话，但丙说『甲和乙都说谎』要求甲说谎，与甲真矛盾。假设丙真→甲乙都说谎→乙说『丙在说谎』为假→丙没说谎，看似一致，但甲说『乙在说谎』为假→乙没说谎，与『乙说谎』矛盾。唯一自洽：乙真→丙假→『甲乙都说谎』为假（不是都说谎）；甲说『乙在说谎』为假→甲说谎。乙是唯一说真话的人。" },
{ c:1, t:"谁13岁", q:"A说：『我13岁。』B说：『A不是13岁。』C说：『我不是13岁。』已知三人中恰有一人13岁，且恰好有一人说假话（两人说真话）。谁13岁？", a:"A是13岁，说假话的是B。逐一验证：若A是13岁→A真、B『A不是13岁』假、C（不是13岁）『我不是13岁』真——恰好一人假话，成立！若B是13岁→A假、B真、C真→零人假话，不符；若C是13岁→A假、B真、C『我不是13岁』假→两人假话，不符。唯一符合的是第一种。和孩子一起列表逐个验证，是解这类题的基本功！" },

// ============ 三、数学巧算 ============
{ c:2, t:"高斯的速算", q:"1+2+3+……+100等于多少？不许用计算器，有什么快办法？", a:"5050。首尾配对：1+100=101、2+99=101、3+98=101……共50对，50×101=5050。这是数学家高斯小时候想出来的办法，核心是『换个顺序看问题』。" },
{ c:2, t:"鸡兔同笼", q:"笼子里有鸡和兔共35个头、94只脚。鸡和兔各有几只？", a:"兔12只、鸡23只。经典解法：假设全是鸡，应有70只脚，实际94只，多出24只脚；每只兔比鸡多2只脚，24÷2=12只兔。35-12=23只鸡。" },
{ c:2, t:"几年前爸爸的年龄是儿子的5倍", q:"爸爸今年40岁，儿子今年12岁。几年前，爸爸的年龄正好是儿子的5倍？", a:"5年前。设x年前：40-x=5×(12-x)，解得x=5。验证：5年前爸爸35岁、儿子7岁，35=7×5。年龄问题的关键：两人的年龄差永远不变（28岁）。" },
{ c:2, t:"奇怪的数列", q:"找规律：1、11、21、1211、111221、下一个数是什么？", a:"312211。规律是『读出上一个数』：1读作『1个1』→11；11读作『2个1』→21；21读作『1个2、1个1』→1211；1211读作『1个1、1个2、2个1』→111221；111221读作『3个1、2个2、1个1』→312211。这叫『外观数列』。" },
{ c:2, t:"数圈圈", q:"0000=4，8888=8，1236=1，那么2581=？", a:"2。规律是数每个数字里『封闭圈』的个数：0有1个圈、8有2个圈、6有1个、9有1个；2、3、5、7、1都没有圈。2581里只有8有圈，8有2个圈，所以2581=2。" },
{ c:2, t:"八个8", q:"用8个8组成算式（可以拼成多位数），只许用加法，结果等于1000。怎么组？", a:"888+88+8+8+8=1000。验算：888+88=976，976+24=1000。" },
{ c:2, t:"两枚硬币", q:"同时抛两枚硬币，『至少有一枚正面朝上』的概率是多少？", a:"3/4。所有等可能结果：正正、正反、反正、反反，共4种；『至少一枚正面』占了前3种。易错点：很多人以为答案是1/2，忘了『正反』和『反正』是两种不同情况。" },
{ c:2, t:"涂色魔方（三面）", q:"一个3×3×3的立方体，表面全部涂成红色，然后切成27个小立方体。三面都被涂到红色的小立方体有几个？", a:"8个。三面涂色的只能是位于『角』上的块——立方体正好有8个角。" },
{ c:2, t:"涂色魔方（一面）", q:"还是那个涂色的3×3×3立方体，只有一面涂色的小立方体有几个？一个面都没涂到的呢？", a:"一面涂色的有6个——每个面的正中间那块，共6个面。一面都没涂到的只有1个——藏在最中心。顺带一提：两面涂色的有12个（每条棱中间那块）。8+12+6+1=27，全部对上了！" },
{ c:2, t:"小鸟飞了多远", q:"两地相距100千米，甲乙两列火车同时相向开出，速度都是30千米/时。一只小鸟以50千米/时的速度在两车之间来回飞。两车相遇时，小鸟一共飞了多少千米？", a:"约83.3千米。别去算来回多少趟——直接想：小鸟飞的时间=两车相遇的时间=100÷(30+30)=5/3小时，所以小鸟飞了50×5/3≈83.3千米。诀窍在『先算时间』，而不是一遍遍加路程。" },
{ c:2, t:"池塘里的浮萍", q:"池塘里的浮萍每天覆盖面积翻一倍，48天正好铺满整个池塘。浮萍铺满半个池塘是第几天？", a:"第47天。每天翻倍，反过来看：铺满的前一天正好是一半。很多人会脱口而出『24天』，这是把『翻倍增长』当成了『匀速增长』。" },
{ c:2, t:"猫抓老鼠", q:"5只猫5分钟能抓5只老鼠。那么100只猫抓100只老鼠需要几分钟？", a:"还是5分钟。5只猫5分钟抓5只→1只猫5分钟抓1只→100只猫5分钟抓100只。『猫变多』和『老鼠变多』正好抵消。" },
{ c:2, t:"100扇门", q:"走廊上有100扇关着的门。第1个学生把所有门都打开；第2个学生把编号是2的倍数的门都反向操作（开的关、关的开）；第3个学生操作3的倍数的门……直到第100个学生。最后哪些门是开着的？", a:"编号是完全平方数的门：1、4、9、16、25、36、49、64、81、100。原因：门i被操作的次数=i的因数个数。因数总是成对出现（如12=1×12=2×6=3×4），只有完全平方数有一个『自己乘自己』的因数（如9=3×3只算一次），因数个数是奇数→被操作奇数次→由关变开。" },
{ c:2, t:"13个人的生日", q:"至少多少个人中，才能保证有两人同一个月过生日？为什么？", a:"13个人。一年最多12个月，把12个月看成12个『抽屉』，13个人放进12个抽屉，必有一个抽屉里至少有两人。这就是『抽屉原理』（鸽笼原理），它只保证『存在』，不管具体是谁。" },
{ c:2, t:"钟面上的夹角", q:"3点15分时，时针和分针的夹角是多少度？", a:"7.5度。分针指向15分=90度处；时针在3点过15分，从90度处又走了15×0.5=7.5度，位于97.5度处。夹角=97.5-90=7.5度。记住：分针每分钟走6度，时针每分钟走0.5度。" },
{ c:2, t:"时针分针相遇", q:"一天24小时中，时针和分针一共重合多少次？", a:"22次。每12小时里，分针比时针多转11圈（分针转12圈、时针转1圈），每多转一圈就重合一次，所以12小时重合11次，24小时共22次。" },
{ c:2, t:"猜数字", q:"我心里想一个1~100之间的整数，你每次可以问『它比X大吗』这种问题。最少问几次，保证猜中？", a:"7次。每次提问都把范围砍掉一半：100→50→25→13→7→4→2→1。因为2^7=128>100，7次足够；6次最多区分64个数，不够。这就是『二分法』。" },
{ c:2, t:"凑100", q:"把1、2、3、4、5、6、7、8、9按顺序连成一个算式（数字顺序不能变），中间填加号减号，使结果等于100。", a:"123-45-67+89=100。验算：123-45=78，78-67=11，11+89=100。" },
{ c:2, t:"三个连续的数", q:"三个连续自然数的乘积正好是210，这三个数是多少？", a:"5、6、7。5×6=30，30×7=210。技巧：先估算——三个连续数的乘积接近『中间那个数的三次方』，6³=216≈210，所以从6附近入手。" },
{ c:2, t:"猴子吃桃", q:"小猴子摘了一堆桃，每天吃掉现有的一半再多一个；这样吃了5天，正好吃完（第5天吃完一个不剩）。原来摘了多少个？", a:"62个。倒推法：每天吃完剩下一半减1，反过来就是『先加1再翻倍』。第5天吃前：2个；第4天：(2+1)×2=6；第3天：14；第2天：30；第1天：62。验算：62→30→14→6→2→0，正好吃完。倒推法是解这类题的金钥匙。" },

// ============ 四、策略与对策 ============
{ c:3, t:"分蛋糕", q:"两个人分一块蛋糕，都想多分一点，吵个不停。不用尺子也不用秤，怎么分才能让两个人都觉得公平？", a:"经典的『我切你选』：一个人负责切，另一个人先挑。切的人为了不吃亏，会尽量切得两块一样大（因为他不知道自己能拿到哪块）；选的人拿到他认为不小的一块。两个人都没有理由抱怨——这就是『无嫉妒分配』的雏形。" },
{ c:3, t:"三个海盗分金币", q:"3个海盗分100枚金币。最凶的甲先提方案，若一半或以上的人同意就执行；否则甲被扔下海，由乙接着提，规则相同，然后是丙。海盗都绝顶聪明，都想多拿金币、不想死。甲应该提什么方案？", a:"甲提出：甲99枚、乙0枚、丙1枚。推理：如果只剩乙和丙，乙提『我100、丙0』，乙自己同意就过半，丙一无所有。所以对丙来说，甲的方案里拿到1枚就比将来拿0强，丙会投赞成票；甲自己再投一票，2比1通过。听起来不公平？但这就是理性博弈的结果。" },
{ c:3, t:"抢30", q:"两人轮流报数，从1开始，每人每次可以接着报1个、2个或3个数，谁报到30谁赢。想必胜该怎么做？", a:"先报的人必胜：先报『1、2』，然后永远让自己报到『4的倍数+2』——即6、10、14、18、22、26、30。方法：对方报1个数你就报3个，对方报2个你报2个，对方报3个你报1个——让每一轮合报4个数，最后30必然落在你嘴里。" },
{ c:3, t:"取石子（取到最后一枚的输）", q:"桌上21枚石子，两人轮流取，每次取1~3枚，取到最后一枚的人输。先取还是后取有必胜策略？", a:"后取的人必胜。关键数是4k+1：1、5、9、13、17、21。轮到谁面对这些数谁就输——因为不管他取几枚，对手都能凑成『这一轮共取4枚』，最终让先取者面对最后1枚，不得不取走而输掉。21=4×5+1，正好是『必败数』，所以先取的人怎么走都会输，后取者只要每轮凑4即可。" },
{ c:3, t:"圆桌放硬币", q:"两人轮流在一张圆桌上放一元硬币，硬币不能重叠，放不下的人输。先放的人有必胜策略吗？", a:"有：第一枚放在桌子正中心，之后每次都放在对手所放位置的『中心对称点』上。只要对手能放，对称位置就一定空着（圆是中心对称图形），所以最后放不下的一定是对手。" },
{ c:3, t:"分杯子", q:"桌上有8只满杯、8只半杯、8只空杯。分给4个人，每人要拿6只杯子，而且每个人得到的水一样多。怎么分？", a:"每人分：2只满杯、2只半杯、2只空杯。验算：水2+1+0=3杯，杯子6只。8÷4=2，三种杯子正好平均分。（也可以有人拿3满3空，换走别人的2满2半2空，方案不唯一。）" },
{ c:3, t:"三刀切七块", q:"一张圆形大饼，切3刀（不许叠着切、不许移动饼），最多能切成几块？", a:"7块。每一刀都要和前面所有的刀相交，而且不经过已有的交点：1刀2块、2刀4块、3刀7块。规律是每多一刀，新增块数=这一刀被分成的段数（第3刀被切成3段→新增3块）。n刀最多1+n(n+1)/2块。" },
{ c:3, t:"三根火柴", q:"用三根火柴摆出一个数字，要求比3大、比4小。怎么摆？", a:"摆出π！圆周率≈3.14，比3大比4小。这题考的是跳出『整数』的思维框。" },
{ c:3, t:"金链付房租", q:"你要用一条7个环的金链付7天房租，要求每天付一环，房东可以找零。金链最少切开几个环？", a:"2个环。把两个环切开（打开），整条链变成：两个单独的『1环』和一段2环、一段3环——组合成1、2、3、4、5、6、7：第1天给1环；第2天给2环段找回1环；第3天给1环+2环段；第4天给3环段找回前面的；……用『二进制找零』的思路，每天都凑得出来。多切就浪费了。" },
{ c:3, t:"分牛奶", q:"一桶牛奶正好8斤，另有3斤和5斤的空桶各一个（无刻度）。怎么把牛奶平分成两个4斤？", a:"步骤（记录：8斤桶/5斤桶/3斤桶）：①8→5：3,5,0；②5→3：3,2,3；③3→8：6,2,0；④5的2斤→3：6,0,2；⑤8→5：1,5,2；⑥5→3：1,4,3；⑦3→8：4,4,0。完成！这类题的方法论：不断倒出新数量，直到凑出目标。" },
{ c:3, t:"扑克牌保证同花色", q:"一副扑克54张（4种花色各13张+2张王）。至少抽几张，才能保证其中有4张同花色？", a:"13张。最倒霉的情况：每种花色都只抽到3张（3×4=12张），王不算花色——再抽1张必然是某花色的第4张。12+1=13张。" },
{ c:3, t:"摸球保证三同色", q:"袋子里有红、黄、蓝三种颜色的球各10个，混在一起。闭着眼睛至少摸出几个，才能保证有3个球同色？", a:"7个。最倒霉：每种颜色都摸到2个，共6个；第7个无论什么颜色，都会让某一种凑够3个。公式：(要的数量-1)×颜色数+1=(3-1)×3+1=7。" },

// ============ 五、谁是谁·排排坐 ============
{ c:4, t:"三人三职业", q:"张、王、李三人分别是教师、医生、警察（一人一职）。已知：①张比教师年龄大；②王和教师年龄不同；③教师比警察年龄大。他们分别是什么职业？", a:"李是教师，张是医生，王是警察。由①张不是教师；由②王不是教师；所以教师只能是李。由③教师（李）比警察大，而由①张比教师大，所以张不是警察→张是医生，王是警察。" },
{ c:4, t:"百米排名", q:"小明、小强、小兵、小刚四人百米赛跑。已知：①小强不是第一名；②小兵比小刚快；③小强比小兵快；④小明比小强快。请排出名次。", a:"小明第一、小强第二、小兵第三、小刚第四。由④③②串起来：小明>小强>小兵>小刚；再检查①：小强第二，确实不是第一，完全吻合。" },
{ c:4, t:"排队报数", q:"一列队伍，从前往后数小明是第6个，从后往前数他是第8个。这列队伍一共有多少人？", a:"13人。从前往后第6：前面有5人；从后往前第8：后面有7人。总共5+1+7=13人。公式：6+8-1=13（小明被数了两次，减1）。" },
{ c:4, t:"二胎概率", q:"一家有两个孩子，已知其中有一个是女孩。那么两个孩子都是女孩的概率是多少？", a:"1/3。两个孩子所有等可能的组合：男男、男女、女男、女女。已知『至少一个女孩』排除了男男，剩3种：男女、女男、女女。其中全是女孩的只有1种，所以是1/3。很多人会答1/2，这是没意识到『男女』和『女男』是两种情况。" },
{ c:4, t:"三姐妹的年龄", q:"三个女儿的年龄相乘等于36，相加等于13。爸爸还是算不出来，妈妈补了一句：『咱们大女儿会弹钢琴呢。』爸爸马上算出来了。三个女儿各几岁？", a:"2岁、2岁、9岁。积为36、和为13的组合有两个：1、6、6和2、2、9。『大女儿』说明有一个『唯一的最大者』——1、6、6里没有唯一的大姐（两个6岁并列最大），所以只能是2、2、9。这道题的精髓：『信息不够』本身就是线索。" },
{ c:4, t:"谁当班长", q:"老师要从小明、小红、小刚中选一个当班长。小明说：『不是我。』小红说：『是小刚。』小刚说：『小红在说谎。』三人中只有一人说真话，谁是班长？", a:"班长是小明，只有小刚说了真话。小红和小刚的话互相矛盾，必有一真一假；既然只有一人真，那真话的人就在他俩之中，小明说的必是假话→班长就是小明！验证：班长是小明时，小明说谎、小红『是小刚』为假、小刚『小红在说谎』为真——恰好一人真话，成立。" },
{ c:4, t:"姓氏与爱好", q:"小赵、小钱、小孙三人，一个喜欢唱歌、一个喜欢跳舞、一个喜欢画画。已知：①小钱既不唱歌也不跳舞；②小赵不会画画。他们各喜欢什么？", a:"小钱喜欢画画（由①排除唱歌跳舞），小赵喜欢唱歌（由②排除画画，画画已被小钱占了），小孙喜欢跳舞。" },
{ c:4, t:"牛奶打翻案", q:"厨房的牛奶被打翻了，妈妈问四个孩子。老大：『是老二干的。』老二：『是老四干的。』老三：『我没干。』老四：『老二在说谎。』只有一人说真话，是谁打翻了牛奶？", a:"是老三干的，老四说了真话。假设老二真→是老四→老三『我没干』也为真，两句真话，矛盾；假设老大真→是老二→老三真，矛盾；假设老三真→老四说『老二在说谎』为假→老二说真话，矛盾。所以只有老四真：老二说谎（不是老四）、老大说谎（不是老二）、老三说谎（就是老三！）。全部自洽。" },
{ c:4, t:"三兄弟的年龄", q:"兄弟三人：老二的年龄是老三的2倍，老大比老二大4岁，三人年龄之和是44岁。三人各几岁？", a:"老三8岁、老二16岁、老大20岁。设老三x岁：老二2x、老大2x+4，则x+2x+2x+4=44，5x=40，x=8。" },
{ c:4, t:"谁偷吃了蛋糕", q:"蛋糕少了一块，三个孩子各说一句：A说『不是我』，B说『是C』，C说『是A』。只有一人说谎，谁偷吃的？", a:"是C偷吃的，只有C说了谎。逐一假设：若A说谎→是A偷→但C说『是A』就成了真话，两句谎话？不对——A谎B真C真？C说『是A』为真，但B说『是C』也为真，两人都偷？矛盾。若B说谎→不是C；A真（不是A）、C真（是A）→矛盾。若C说谎→不是A；A真、B真（是C）→自洽！偷吃的是C。" },
{ c:4, t:"三栋小房子", q:"路边有三栋房子排成一排：红、黄、蓝，分别住着养猫、养狗、养鸟的三个孩子。已知：①蓝房子在最右边；②红房子在黄房子的左边；③养猫的孩子不住红房子也不住蓝房子；④养狗的孩子住在养鸟的左边。谁住在哪栋、养什么？", a:"由①②：顺序是红、黄、蓝。由③：猫在黄房子。由④：狗在鸟左边→狗在红房子、鸟在蓝房子。所以：红房子养狗、黄房子养猫、蓝房子养鸟。" },
{ c:4, t:"楼上三家", q:"楼上住着三户人家：一家是老师、一家是医生、一家是司机。已知：①王家不是医生；②张家既不是司机也不是医生。他们家各是什么职业？", a:"张家是老师（由②排除司机和医生），王家是司机（医生没了、老师被张占了），李家是医生。" },

// ============ 六、生活中的逻辑急转弯 ============
{ c:5, t:"只按到7楼的电梯", q:"有个人住在10楼，每天早上坐电梯下到1楼出门。晚上回来却只按到7楼，再爬3层楼梯走回家；只有下雨天他才直接按10楼。为什么？", a:"他是个个子矮的人，只够得着7楼的按钮；下雨天带伞，用伞尖能按到10楼。" },
{ c:5, t:"镜子的秘密", q:"为什么镜子里的字看起来是左右颠倒的，而不是上下颠倒的？", a:"其实镜子既没有左右颠倒也没有上下颠倒——它颠倒的是『前后』！你举起右手，镜中人举起的确实是『同一边』的手，只是他面对着你，你习惯把他的那边叫成了『左手』。这题适合一起讨论，重点是理解『坐标系』。" },
{ c:5, t:"超越第二名", q:"跑步比赛中，你奋力超过了原来的第二名，你现在排第几？", a:"第二名。你只是取代了他的位置，原来第一名还在你前面。很多人会顺口说『第一』。" },
{ c:5, t:"超越最后一名", q:"那如果你超过了最后一名，你现在是第几名？", a:"不可能！如果你能超过最后一名，说明你本来在他后面，那『最后一名』就应该是你——逻辑上自相矛盾。这是一道检验思考严密性的题。" },
{ c:5, t:"蜡烛", q:"停电前屋里点着10支蜡烛，风吹灭了3支。第二天早上，屋里还剩几支蜡烛？", a:"3支。被吹灭的3支留了下来；其余7支一直燃烧，最后烧尽了。要点：『剩下的』不等于『还在烧的』。" },
{ c:5, t:"只过了3个生日", q:"小华今年12岁了，可是他只过了3个生日。这是为什么？", a:"他是2月29日出生的！2月29日每4年才出现一次（闰年），12年里只有3次：4岁、8岁、12岁那年。" },
{ c:5, t:"篮子里的苹果", q:"篮子里有5个苹果，要分给5个孩子，每人分1个，最后篮子里还要留1个。怎么分？", a:"最后一个孩子连篮子一起拿走！前4个孩子每人拿一个苹果，第5个孩子拿着装着最后一个苹果的篮子——每人都分到了，篮子里也『留着』一个。" },
{ c:5, t:"先点什么", q:"房间里有一支蜡烛和一盏油灯，突然停电了，你手里有火柴。应该先点什么？", a:"先点火柴！没有火柴，蜡烛和油灯都点不着。" },
{ c:5, t:"消失的1元钱", q:"三个人去住店，每人付10元共30元。老板说今天优惠只收25元，让伙计退5元。伙计偷偷藏了2元，退给每人1元。现在算账：三人各实际出了9元共27元，加上伙计藏的2元是29元——还有1元去哪儿了？", a:"这题的账算『歪』了！正确的账：三人共付27元=老板收下的25元+伙计藏的2元，一分不差。27元里已经包含了那2元，不该再加一遍。这是经典的『错误归组』陷阱——把不相干的数字硬凑在一起，制造出『少了1元』的错觉。" },
{ c:5, t:"树上的鸟", q:"树上站着10只鸟，猎人开枪打死了1只，树上还剩几只？", a:"常规答案是0只——枪声把其余的都吓飞了。但这题更适合开放讨论：如果那只鸟挂在树枝上呢？如果是聋的鸟听不见呢？——鼓励孩子想出多种可能再判断，这本身就是逻辑训练。" },
{ c:5, t:"妈妈的三个儿子", q:"小明的妈妈有三个儿子，大儿子叫大毛，二儿子叫二毛，三儿子叫什么？", a:"小明！题目第一句就说了是『小明的妈妈』。注意力陷阱：让人盯着『大毛二毛』找规律，忘了回头读题。" },
{ c:5, t:"手术室里的医生", q:"父子俩遭遇车祸，父亲当场身亡，孩子被送进医院。手术室里的医生看了一眼说：『我不能做这台手术，他是我儿子。』这是怎么回事？", a:"医生是孩子的妈妈。思维陷阱：『医生』这个词让人下意识想到男性。可以趁机讨论：为什么很多人第一反应想不出来？" },
{ c:5, t:"一个月有28天", q:"一年当中，有多少个月份有28天？", a:"12个月——每个月都『有』28天（哪怕有的月份有30或31天，28天它也有）。陷阱在于让人以为答案是2月。" },
{ c:5, t:"不是双胞胎的兄弟", q:"哥哥和弟弟同年、同月、同日、同父母出生，却不是双胞胎。为什么？", a:"他们是三胞胎（或四胞胎）中的两个——还有别的孩子和他们同一天出生，所以这俩不算『双胞胎』。" },

// ============ 七、挑战压轴题 ============
{ c:6, t:"12个球（经典难题）", q:"12个外观相同的小球，其中1个重量异常（但不知道是偏重还是偏轻）。用没有砝码的天平称3次，把这个球找出来，并说出它偏重还是偏轻。这是世界著名的难题，一起慢慢推理！", a:"分三组各4个。第一次：A组称B组。①平：坏球在C组，A、B都是标准球；第二次从C组取3个与3个标准球称——平→C组剩下那个是坏球（第三次与标准球比知轻重）；不平→坏球在这3个中且轻重已知，第三次取其中2个对称即可锁定。②不平：设A重B轻，坏球在A或B中，且A中的坏球只能偏重、B中的只能偏轻；第二次按对称方案调换、剔除部分球称，第三次总能锁定。核心思想：每次称量有3种结果（左重/右重/平），3次共3³=27种信息组合，要区分12球×2种轻重=24种情况，刚好够用！" },
{ c:6, t:"钟敲几下", q:"一座钟敲6下用了10秒，那么敲12下要用几秒？", a:"22秒。敲6下之间有5个间隔，每个间隔10÷5=2秒；敲12下有11个间隔，11×2=22秒。陷阱：直接答20秒的人把『下数』当成了『间隔数』。" },
{ c:6, t:"数字黑洞 6174", q:"任取一个四位数字不全相同的数（比如5298），把数字从大到小排成一个大数、从小到大排成一个小数，用大数减小数；对结果反复做同样操作。最后一定会掉进哪个『黑洞』？", a:"6174。以5298为例：9852-2589=7263；7632-2367=5265；6552-2556=3996；9963-3699=6264；6642-2466=4176；7641-1467=6174；之后再算还是6174，停住了。任何符合条件的四位数，最多7步都会到达6174。让孩子自己挑个数试试，非常有成就感！" },
{ c:6, t:"角谷猜想", q:"任取一个正整数：如果是偶数就除以2；如果是奇数就乘3再加1。不断重复，最后会发生什么？这道题至今没有数学家能证明，但你可以亲自验证！", a:"最后都会到达1（然后陷入1→4→2→1的循环）。试试7：22→11→34→17→52→26→13→40→20→10→5→16→8→4→2→1。试试27：要走111步才到1，中途冲到9232！这是『考拉兹猜想』（也叫角谷猜想），看似简单却是数学界的未解之谜——让孩子感受『连数学家也没解决的问题』。" },
{ c:6, t:"锯木头", q:"把一根木头锯成5段，每锯一次要2分钟，一共要几分钟？", a:"8分钟。锯成5段只需锯4次（不是5次！）——最后一段是『免费』送出来的。4×2=8分钟。" },
{ c:6, t:"鸡生蛋", q:"3只鸡3天下了3个蛋。9只鸡9天能下几个蛋？", a:"27个。分两步想：3只鸡3天下3个→3只鸡1天下1个→9只鸡1天下3个→9只鸡9天下27个。『鸡变多』和『天数变多』都要乘进去，只乘一次得9个或3个都是错的。" },
{ c:6, t:"四刀切十一块", q:"一张圆饼切4刀（刀刀相交、不叠切、不移动饼），最多能切成几块？", a:"11块。规律：每新切一刀，新增块数=这一刀被切成的段数。第1刀+1块、第2刀+2、第3刀+3、第4刀+4：2+2+3+4=11。通式：n刀最多1+n(n+1)/2块。可以拿张圆纸片实际剪一剪验证！" },
{ c:6, t:"四个砝码", q:"天平上有1克、2克、4克、8克的砝码各一个。用它们能称出哪些整数克重的物品？", a:"1~15克全部都能称！每个砝码『放』或『不放』共2^4=16种组合，对应0~15克的所有整数。这就是二进制的思想：任何数都能表示成1、2、4、8……的组合。追问孩子：如果砝码是1、3、9（可以放天平两边），能称1~13克——这是另一种巧妙方案。" },
{ c:6, t:"两张王", q:"一副54张的扑克牌（52张普通牌+大小王），至少抽几张，才能保证两张王都被抽到？", a:"54张（全部抽完）。要『保证』两张王都在手里，最坏情况是两张王留到最后——所以必须把54张全抽完。对比一下：如果问『保证至少抽到1张王』，答案是53张。和孩子分析这两种问法的区别，体会『保证』二字的分量。" },
{ c:6, t:"数列找规律", q:"找规律：2、3、5、9、17、下一个数是多少？", a:"33。相邻两数的差是1、2、4、8——每次差都翻倍，下一个差是16，17+16=33。另一个视角：每个数都是前一个数的2倍减1，17×2-1=33。两种看法殊途同归！" },
{ c:6, t:"三个数凑30", q:"从1、3、5、7、9、11、13、15这些数中挑3个相加，让结果等于30。同一个数只能用一次（但可以把卡片倒过来看）。能做到吗？", a:"能！把9的卡片倒过来变成6：6+11+13=30。先让孩子证明『正常情况下不可能』——奇数+奇数+奇数=奇数，永远不可能是偶数30；再给出破解法。一破一立，正是这道题的精彩之处。" },
{ c:6, t:"时针分针的重合", q:"1点以后，时针和分针第一次重合是在几点几分？", a:"1点5又5/11分，约1点05分27秒。1点整时分针落后时针30度；分针每分钟走6度、时针走0.5度，每分钟追5.5度；追上30度需要30÷5.5=60/11=5又5/11分钟。" },
{ c:6, t:"25匹马5条赛道", q:"有25匹马，赛道一次最多5匹同场竞技，没有计时器，只能知道每场比赛的名次。最少比几次，能找出最快的3匹马？", a:"7次。①前5次：25匹分成5组各赛一场。②第6次：5个小组的第一名同场比——冠军产生了。③第7次：只需5匹马争第二、第三名——冠军组的第2、3名，第二名组的第1、2名，第三名组的第1名。这场的头两名就是全场第二、第三。信息一步步『压缩』，这就是这道题的精髓。" },
{ c:6, t:"分硬币（10枚正面）", q:"桌上有1000枚硬币，其中恰好10枚正面朝上。你蒙着眼睛（可以摸硬币、移动它们，但摸不出正反面）。怎样把它们分成两堆，使两堆正面朝上的硬币数量相同？", a:"从1000枚里随便取10枚出来翻个面，作为一堆，剩下990枚作为另一堆。原理：设取出的10枚里有k枚正面，那么翻面后这堆的正面数=10-k；大堆里剩下的正面也正好是10-k枚（总共10枚正面，被拿走了k枚）。无论k是几，两堆永远相等。" },
{ c:6, t:"烧水泡茶（统筹法）", q:"妈妈让小明烧水泡茶：洗水壶1分钟、烧开水10分钟、洗茶壶2分钟、洗茶杯2分钟、拿茶叶1分钟。做完这五件事最少要几分钟才能开始泡茶？", a:"11分钟。先洗水壶（1分钟）→烧水（10分钟），烧水的同时洗茶壶、洗茶杯、拿茶叶（共5分钟，完全来得及）。总共1+10=11分钟。这是数学家华罗庚推广的『统筹法』：找出必须串行的关键路径，其他事情见缝插针并行做。" }
];

// ---------- 题库层：当前题库 = 运行时唯一数据源（qzCats / qzData） ----------
// 内置兜底题库：CATS/DATA 原样复用，仅在配置加载失败时启用（bankId='builtin'）
var QZ_BUILTIN_BANK={id:'builtin',name:'逻辑推理题（内置）',subtitle:'四年级+',cats:CATS,questions:DATA,builtin:true};
var QZ_BANK_KEY='sp_quiz_bank';   // 当前题库 id
var QZ_ACC_KEY_PREFIX='sp_quiz__'; // 刷题数据按账号分键前缀：sp_quiz__<phone>（done/wrong/excluded 三表合一）
var QZ_MIG_FLAG='sp_quiz_migrated'; // 设备级一次性迁移标记：旧设备级键 → 迁移时登录的家长账号
var QZ_INDEX_URL='quiz/index.json';
var QZ_BANKS=[];                  // 题库清单（index.json 的 banks）
var QZ_BANK_CACHE={};             // bankId -> 已加载题库对象（内存缓存：同一会话重复切换不重复请求）
var QZ_FALLBACK=false;            // 是否正在使用内置兜底题库（用于 UI 提示）
var qzBank=null;                  // 当前题库对象 {id,name,subtitle,cats,questions,builtin}
var qzCats=[];                    // 当前题库分类（cats 原样）
var qzData=[];                    // 当前题库题目（内部统一 {c,t,q,a}，由 cat/title/question/answer 归一化而来）
var QZ_CAT_TOTALS=[];             // QZ_CAT_TOTALS[c] = 分类 c 的非剔除题数
var QZ_CAT_RANK=[];               // QZ_CAT_RANK[i]   = 第 i 题在其分类「非剔除序列」中的 1-based 位次（剔除题记 0）
var QZ_ALL_TOTAL=0;               // 全库口径分母 = 题库题数 − 剔除数
var QZ_ALL_RANK=[];               // QZ_ALL_RANK[i]   = 第 i 题在「全库非剔除序列」中的 1-based 位次（剔除题记 0）
var qzLoadPromise=null;           // 首次加载中的 Promise（避免并发重复请求清单）
var qzLastBankWant='';            // 兜底前记录的「上次题库 id」：兜底激活会把 sp_quiz_bank 覆写为 builtin，恢复时优先用它

function qzBankId(){return (qzBank&&qzBank.id)||'builtin'}
function qzDoneKey(id){return 'sp_quiz_done__'+id}    // 进度按题库隔离
function qzWrongKey(id){return 'sp_quiz_wrong__'+id}  // 错题集按题库隔离

// 由当前题库重建派生量（分类统计 / 分类内题号）。
// 口径：剔除题视同不存在 —— 总数只数非剔除题，位次按「分类内非剔除序列」计算（剔除题位次记 0）；
// 同时派生全库口径 QZ_ALL_TOTAL / QZ_ALL_RANK（全部视图题号分母/位次）。
// 依赖 qzExcluded 已就绪（qzActivate 先 qzLoadBankState 再调本函数；剔除/恢复后亦会重跑）。
function qzBuildDerived(){
  qzCats=(qzBank&&qzBank.cats)||[];
  qzData=(qzBank&&qzBank.questions)||[];
  var totals=[],seen=[],ranks=[],allRanks=[],i,c,allSeen=0;
  for(i=0;i<qzCats.length;i++){totals.push(0);seen.push(0)}
  for(i=0;i<qzData.length;i++){
    if(qzExcluded.has(i)){ranks.push(0);allRanks.push(0);continue} // 剔除题不占位次
    allSeen++;allRanks.push(allSeen);
    c=qzData[i].c;
    if(typeof c==='number'&&c>=0&&c<totals.length){totals[c]++;seen[c]++;ranks.push(seen[c])}
    else{ranks.push(0)}   // 分类下标越界：不参与分类统计，题号位次记 0
  }
  QZ_CAT_TOTALS=totals;
  QZ_CAT_RANK=ranks;
  QZ_ALL_TOTAL=allSeen;
  QZ_ALL_RANK=allRanks;
}

function qzStr(v){return (typeof v==='string')?v:(v===null||v===undefined?'':String(v))}
function qzBankMeta(id){
  for(var i=0;i<QZ_BANKS.length;i++)if(QZ_BANKS[i].id===id)return QZ_BANKS[i];
  return null;
}
// 配置题目 → 内部字段（cat/title/question/answer → c/t/q/a），渲染层零改动
function qzNormalizeQuestions(arr){
  var out=[];
  if(Object.prototype.toString.call(arr)!=='[object Array]')return out;
  for(var i=0;i<arr.length;i++){
    var it=arr[i]||{};
    var c=(typeof it.cat==='number')?it.cat:((typeof it.c==='number')?it.c:0);
    out.push({c:c,t:qzStr(it.title),q:qzStr(it.question),a:qzStr(it.answer)});
  }
  return out;
}
// 网络读取：no-store 规避缓存；非 2xx / JSON 解析失败 / 断网一律 reject，交由上层降级。
// 追加时间戳参数：no-store 只管浏览器本地缓存，管不到 CDN/边缘缓存 —— 加 _t 彻底穿透中间缓存层，
// 避免拿到旧版清单副本（仅用于 quiz/*.json 配置文件，不影响 GitHub API 调用）。
// _t 取严格递增时间戳：同毫秒内的连续请求也不会重复，保证每次请求 URL 都不同
var QZ_TS_LAST=0;
function qzFetchJSON(url){
  var t=Date.now();if(t<=QZ_TS_LAST)t=QZ_TS_LAST+1;QZ_TS_LAST=t;
  url+=(url.indexOf('?')>=0?'&':'?')+'_t='+t;
  return fetch(url,{cache:'no-store'}).then(function(r){
    if(!r||!r.ok)throw new Error('HTTP '+(r?r.status:'0'));
    return r.json();
  });
}
// —— 自定义题库（本机 localStorage，随「导出备份」迁移）——
// 结构：[{id:'custom_<ts>',name,subtitle,cats:[...],questions:[{cat,title,question,answer}]}]
var QZ_CUSTOM_KEY='sp_custom_banks';
function qzCustomBanks(){
  try{
    var r=localStorage.getItem(QZ_CUSTOM_KEY);
    var arr=r?JSON.parse(r):[];
    if(Object.prototype.toString.call(arr)!=='[object Array]')return[];
    return arr.filter(function(b){return b&&b.id&&Object.prototype.toString.call(b.questions)==='[object Array]'});
  }catch(e){return[]}
}
function qzSaveCustomBanks(arr){
  try{localStorage.setItem(QZ_CUSTOM_KEY,JSON.stringify(arr))}
  catch(e){toast('保存失败：本机存储空间不足','err')}
}
// 自定义题库 → 清单条目 meta（file 为空、custom 标记；id 复用）
function qzCustomMetas(){
  var cs=qzCustomBanks(),out=[];
  for(var i=0;i<cs.length;i++){
    out.push({id:String(cs[i].id),name:qzStr(cs[i].name)||String(cs[i].id),subtitle:qzStr(cs[i].subtitle),file:'',custom:true});
  }
  return out;
}
// 读取题库清单；清单失败时自定义题库仍可用（由上层转内置兜底仅当连自定义也没有）
function qzLoadIndex(){
  return qzFetchJSON(QZ_INDEX_URL).then(function(j){
    var arr=(j&&Object.prototype.toString.call(j.banks)==='[object Array]')?j.banks:[];
    var out=[];
    for(var i=0;i<arr.length;i++){
      var b=arr[i]||{};
      if(!b.id||!b.file)continue;   // 缺 id / file 的条目直接跳过
      out.push({id:String(b.id),name:qzStr(b.name)||String(b.id),subtitle:qzStr(b.subtitle),file:String(b.file)});
    }
    out=out.concat(qzCustomMetas()); // 自定义题库追加在配置清单之后
    QZ_BANKS=out;
    return out;
  }).catch(function(){QZ_BANKS=qzCustomMetas();return QZ_BANKS});
}
// 按需加载单套题库（内存缓存；失败标记 _unavailable 并 resolve(null)，由上层回退）
function qzLoadBank(id){
  if(QZ_BANK_CACHE[id])return Promise.resolve(QZ_BANK_CACHE[id]);
  var meta=qzBankMeta(id);
  if(!meta)return Promise.resolve(null);
  if(meta.custom){ // 自定义题库：直接从本机存储构建，无网络请求
    var cs=qzCustomBanks(),found=null;
    for(var c=0;c<cs.length;c++)if(String(cs[c].id)===id){found=cs[c];break}
    if(!found){meta._unavailable=true;return Promise.resolve(null)}
    var cbank={id:meta.id,
      name:qzStr(found.name)||meta.id,
      subtitle:qzStr(found.subtitle),
      cats:(Object.prototype.toString.call(found.cats)==='[object Array]')?found.cats:[],
      questions:qzNormalizeQuestions(found.questions),
      builtin:false,custom:true};
    QZ_BANK_CACHE[id]=cbank;
    return Promise.resolve(cbank);
  }
  return qzFetchJSON('quiz/'+meta.file).then(function(j){
    var bank={id:meta.id,
      name:qzStr(j&&j.name)||qzStr(meta.name)||meta.id,
      subtitle:qzStr(j&&j.subtitle)||qzStr(meta.subtitle),
      cats:(j&&Object.prototype.toString.call(j.cats)==='[object Array]')?j.cats:[],
      questions:qzNormalizeQuestions(j&&j.questions),
      builtin:false};
    QZ_BANK_CACHE[id]=bank;
    return bank;
  }).catch(function(){meta._unavailable=true;return null});
}
// 一次性迁移：旧的无后缀键 → 清单第一套题库（默认 logic-4）；该题库新键已存在则不覆盖（不删旧键）
function qzMigrateLegacy(){
  if(!QZ_BANKS.length)return;
  var fid=QZ_BANKS[0].id;
  var pairs=[['sp_quiz_done',qzDoneKey(fid)],['sp_quiz_wrong',qzWrongKey(fid)]];
  for(var i=0;i<pairs.length;i++){
    try{
      if(localStorage.getItem(pairs[i][1])!==null)continue;
      var old=localStorage.getItem(pairs[i][0]);
      if(old!==null)localStorage.setItem(pairs[i][1],old);
    }catch(e){}
  }
}

// ---------- 刷题状态与逻辑（按账号分键 sp_quiz__<phone>，内部按 bankId 隔离；未激活题库前为空集） ----------
var QZ_WRONG=-2;   // 伪分类值：错题集视图（-1 仍表示「全部」）
var qzCat=-1;      // -1 = 全部分类；-2 = 错题集
var qzList=[];     // 当前可见的题目下标（普通视图=未完成+分类过滤；错题集视图=错题集内容；均排除剔除题）
var qzPos=0;       // qzList 中的位置
var qzDone=new Set();     // 当前题库已完成题目下标
var qzWrong=new Set();    // 当前题库错题集下标（去重；剔除题数据保留，仅展示过滤）
var qzExcluded=new Set(); // 当前题库已剔除题目下标（剔除题视同不存在，可恢复）
var qzGQ=[];              // 全局错题视图的合并题目：[{b:bankId,i:题下标,d:题目,cn:分类名,bank:题库对象}]（错题数据仍按题库分键存储，仅视图汇总）
var qzGPending=0;         // 全局错题视图后台补载中的题库数（>0 且列表为空时显示加载态）

// —— 账号级存取：一个键存该账号全部刷题数据 {done:{bank:[i]},wrong:{...},excluded:{...}} ——
function qzAccKey(){return QZ_ACC_KEY_PREFIX+(currentUser||'')}
function qzAccStore(){
  var o=null;
  try{var r=localStorage.getItem(qzAccKey());if(r)o=JSON.parse(r)}catch(e){o=null}
  if(!o||typeof o!=='object'||Object.prototype.toString.call(o)==='[object Array]')o={};
  if(!o.done||typeof o.done!=='object'||Object.prototype.toString.call(o.done)==='[object Array]')o.done={};
  if(!o.wrong||typeof o.wrong!=='object'||Object.prototype.toString.call(o.wrong)==='[object Array]')o.wrong={};
  if(!o.excluded||typeof o.excluded!=='object'||Object.prototype.toString.call(o.excluded)==='[object Array]')o.excluded={};
  if(!o.wrongMeta||typeof o.wrongMeta!=='object'||Object.prototype.toString.call(o.wrongMeta)==='[object Array]')o.wrongMeta={};
  return o;
}
function qzSaveAccStore(store){
  try{localStorage.setItem(qzAccKey(),JSON.stringify(store))}catch(e){}
}
function qzStorePartHas(p){
  if(!p||typeof p!=='object')return false;
  for(var k in p){if(Object.prototype.toString.call(p[k])==='[object Array]'&&p[k].length)return true}
  return false;
}
function qzStoreHasData(s){return qzStorePartHas(s&&s.done)||qzStorePartHas(s&&s.wrong)||qzStorePartHas(s&&s.excluded)}
// 统一落盘：当前题库三张表写回账号键；并镜像进账号桶字段随 sd() 上云（答错不加分也同样触发同步）。
// 账本未就绪（ad=null，登录拉取在途）时不写桶、不推送，但 dataVersion++ 作废在途拉取，
// 防止旧快照回灌覆盖刚写入的进度（与账本「登录拉取不覆盖更新的本地写入」守卫同一语义）。
function qzPersistAll(){
  if(!qzBank||sessionRole==='kid'||!currentUser)return;
  var id=qzBankId();
  var store=qzAccStore();
  store.done[id]=Array.from(qzDone).sort(function(a,b){return a-b});
  store.wrong[id]=Array.from(qzWrong).sort(function(a,b){return a-b});
  store.excluded[id]=Array.from(qzExcluded).sort(function(a,b){return a-b});
  qzSaveAccStore(store);
  if(ad){
    ad.quizDone=store.done;ad.quizWrong=store.wrong;ad.quizExcluded=store.excluded;
    ad.quizWrongMeta=store.wrongMeta;
    sd(ad);
  }else{
    dataVersion++;
  }
}
// 兼容保留原函数名（既有调用点 qzMarkDone/qzWrongAdd/qzWrongRemove/qzResetProgress 不动）：
// 落盘范围从「当前题库单表」升级为「当前账号全量表 + 云同步」
function qzSave(){qzPersistAll()}
function qzSaveWrong(){qzPersistAll()}

// 一次性迁移：旧设备级键 sp_quiz_done__<bankId> / sp_quiz_wrong__<bankId> → 迁移时登录的家长账号名下。
// 必须用设备级标记 sp_quiz_migrated='1' 防止重复迁移（否则同一设备第二个账号登录时会错误地把
// 同一份旧进度再迁给自己）：未标记 → 迁移到当前账号 → 置标记；已标记 → 跳过（新键不覆盖）。
// 旧键保留不删（无害）。在 qzEnsureLoaded 内 qzMigrateLegacy() 之后调用：
// 彼时旧无后缀键（sp_quiz_done）已先归一为 sp_quiz_done__<bankId> 形态，这里统一扫描带后缀键。
function qzMigrateAccountData(){
  if(sessionRole!=='parent'||!currentUser)return;
  var flag='';try{flag=localStorage.getItem(QZ_MIG_FLAG)||''}catch(e){}
  if(flag==='1')return;
  var store=qzAccStore();
  try{
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);if(!k)continue;
      var m=k.match(/^sp_quiz_done__(.+)$/);
      if(m){
        try{var v=JSON.parse(localStorage.getItem(k));
          if(Object.prototype.toString.call(v)==='[object Array]'&&!store.done[m[1]])store.done[m[1]]=v;
        }catch(e){}
        continue;
      }
      m=k.match(/^sp_quiz_wrong__(.+)$/);
      if(m){
        try{var v2=JSON.parse(localStorage.getItem(k));
          if(Object.prototype.toString.call(v2)==='[object Array]'&&!store.wrong[m[1]])store.wrong[m[1]]=v2;
        }catch(e){}
      }
    }
  }catch(e){}
  qzSaveAccStore(store);
  try{localStorage.setItem(QZ_MIG_FLAG,'1')}catch(e){}
  dataVersion++; // 迁移即本地写入：作废在途拉取
  if(ad&&qzStoreHasData(store)){ // 账本就绪则立即随桶上云，其他设备可见
    ad.quizDone=store.done;ad.quizWrong=store.wrong;ad.quizExcluded=store.excluded;
    sd(ad);
  }
}

// 账号切换/登录落定时重载刷题内存态：qzDone/qzWrong/qzExcluded 属于「账号×题库」，
// 换账号必须从新账号的本机键（sp_quiz__<phone>）重建，否则上一账号的内存进度会串号。
// finishParentEntry（家长身份落定）与 init（自动登录）调用；随后 syncPull 的
// qzApplyBucketQuiz 会再按云端桶校正一次。
function qzReloadForAccount(){
  if(sessionRole!=='parent'||!qzBank)return;
  qzLoadBankState();
  qzBuildDerived();
  qzCat=-1;
  qzPos=0;
  qzRebuild();
  qzRenderChips();
  if(curTab==='quiz')qzRender();
}

// 拉取应用：syncPull 成功后调用（家长端）。云端桶 quizDone/quizWrong/quizExcluded（旧桶无此字段
// 时按缺失处理：不报错、不覆盖本地对应表）→ 覆盖本机账号键 → 重建当前题库内存状态。
// 过期守卫：syncPull 内 dataVersion 比对不通过时直接返回本地数据（本函数收到的即是本地桶，
// 字段与内存一致，重载为幂等），「登录拉取不覆盖更新的本地写入」语义对刷题数据同样成立。
function qzApplyBucketQuiz(data){
  if(sessionRole!=='parent'||!currentUser||!data)return;
  var isObj=function(v){return !!v&&typeof v==='object'&&Object.prototype.toString.call(v)!=='[object Array]'};
  var store=qzAccStore();
  var changed=false;
  if(isObj(data.quizDone)){store.done=data.quizDone;changed=true}
  if(isObj(data.quizWrong)){store.wrong=data.quizWrong;changed=true}
  if(isObj(data.quizExcluded)){store.excluded=data.quizExcluded;changed=true}
  if(isObj(data.quizWrongMeta)){store.wrongMeta=data.quizWrongMeta;changed=true}
  if(changed)qzSaveAccStore(store);
  if(!qzBank)return; // 题库未激活：qzActivate/qzLoadBankState 稍后从账号键读取
  if(changed){
    qzLoadBankState();
    qzBuildDerived();
    qzRebuild();
    if(curTab==='quiz')qzRender();
  }else if(ad&&qzStoreHasData(store)){
    // 云端桶无刷题字段（旧格式/迁移后首拉）：本地为准，镜像回桶并推上云
    ad.quizDone=store.done;ad.quizWrong=store.wrong;ad.quizExcluded=store.excluded;
    ad.quizWrongMeta=store.wrongMeta;
    sd(ad);
  }
}

// 载入「当前题库」的进度/错题集/剔除表：切换题库或拉取应用时重建，各题库互不干扰。
// 容错：非法/越界下标过滤 + 去重（越界以当前题库题数为准），旧数据脏内容不会报错。
function qzLoadBankState(){
  var id=qzBankId(),i,n;
  var store=qzAccStore();
  var done=(store.done&&store.done[id])||[];
  if(Object.prototype.toString.call(done)!=='[object Array]')done=[];
  var dset=new Set();
  for(i=0;i<done.length;i++){n=done[i];
    if(typeof n==='number'&&n>=0&&n<qzData.length&&isFinite(n)&&Math.floor(n)===n)dset.add(n);}
  qzDone=dset;
  var wa=(store.wrong&&store.wrong[id])||[];
  if(Object.prototype.toString.call(wa)!=='[object Array]')wa=[];
  var wset=new Set();
  for(i=0;i<wa.length;i++){n=wa[i];
    if(typeof n==='number'&&n>=0&&n<qzData.length&&isFinite(n)&&Math.floor(n)===n)wset.add(n);}
  qzWrong=wset;
  var ex=(store.excluded&&store.excluded[id])||[];
  if(Object.prototype.toString.call(ex)!=='[object Array]')ex=[];
  var eset=new Set();
  for(i=0;i<ex.length;i++){n=ex[i];
    if(typeof n==='number'&&n>=0&&n<qzData.length&&isFinite(n)&&Math.floor(n)===n)eset.add(n);}
  qzExcluded=eset;
}
// 归集：同一题重复答错只保留一条（Set 天然去重，仅在新增时落盘 + 上云）
function qzWrongAdd(i){
  if(i===undefined||i===null||i<0||i>=qzData.length)return;
  if(!qzWrong.has(i)){qzWrong.add(i);qzSaveWrong()}
}
// 出集：答对即从错题集移除（不存在则不动）
function qzWrongRemove(i){if(qzWrong.has(i)){qzWrong.delete(i);qzSaveWrong()}}
// —— 错题间隔复习 ——
// 复习进度存 store.wrongMeta[bankId][i]（0=刚入集；1=复习 1/2；2=毕业移出）。
// correct=true：进度 +1（上限 2，毕业由调用方移出错题集）；correct=false：进度清零。
// 独立落盘（与 wrong 表同键），镜像进账号桶 quizWrongMeta 随 sd() 上云。
// 返回更新后的进度值；无变化（如本就不在集内答错清零）不产生写盘/上云。
function qzWrongBump(bankId,i,correct){
  if(sessionRole==='kid'||!currentUser)return 0;
  var store=qzAccStore();
  if(!store.wrongMeta||typeof store.wrongMeta!=='object'||Object.prototype.toString.call(store.wrongMeta)==='[object Array]')store.wrongMeta={};
  var m=store.wrongMeta[bankId];
  if(Object.prototype.toString.call(m)!=='[object Array]')m=[];
  var cur=(typeof m[i]==='number')?m[i]:0;
  var next=correct?Math.min(2,cur+1):0;
  if(next===cur)return cur;
  m[i]=next;
  store.wrongMeta[bankId]=m;
  qzSaveAccStore(store);
  if(ad){ad.quizWrongMeta=store.wrongMeta;sd(ad)}else dataVersion++;
  return next;
}
// 读取某题库某题的复习进度（渲染错题集「复习 n/2」角标用；不落盘）
function qzWrongStreakOf(bankId,i){
  var store=qzAccStore();
  var m=store.wrongMeta&&store.wrongMeta[bankId];
  return (m&&typeof m[i]==='number')?m[i]:0;
}
// 全局错题可见数 = 各题库（含内置兜底）错题数之和，剔除题不计（数据保留，仅从展示与计数排除）。
// 一律以账号级 store 为准：当前题库内存 Set 的每次增删都会即时落盘，二者恒一致。
function qzWrongVisibleCount(){
  var store=qzAccStore(),n=0;
  var scan=function(bankId){
    var w=store.wrong&&store.wrong[bankId];
    if(Object.prototype.toString.call(w)!=='[object Array]')return;
    var ex=store.excluded&&store.excluded[bankId];
    var exs=(Object.prototype.toString.call(ex)==='[object Array]')?new Set(ex):null;
    for(var k=0;k<w.length;k++){var i=w[k];
      if(typeof i!=='number'||i<0||!isFinite(i))continue;
      if(exs&&exs.has(i))continue;
      n++;}
  };
  scan('builtin');
  for(var j=0;j<QZ_BANKS.length;j++)scan(QZ_BANKS[j].id);
  return n;
}

// —— 全局错题视图：按题库顺序（内置兜底最前 → index.json 清单顺序）合并各题库错题 ——
// 错题数据仍按「账号×题库」分键存储，此处仅是跨题库的汇总视图：
// 只收录题库已加载的错题（未加载的由 qzWrongAsyncRefresh 补载后重渲染），剔除题排除。
function qzBuildGlobalWrong(){
  qzGQ=[];
  var store=qzAccStore();
  var ids=['builtin'];
  for(var j=0;j<QZ_BANKS.length;j++)if(QZ_BANKS[j].id!=='builtin')ids.push(QZ_BANKS[j].id);
  for(var k=0;k<ids.length;k++){
    var bank=(ids[k]==='builtin')?QZ_BUILTIN_BANK:QZ_BANK_CACHE[ids[k]];
    if(!bank||!bank.questions)continue; // 题库未加载/不可用：加载完成后异步刷新补入
    var w=store.wrong&&store.wrong[ids[k]];
    if(Object.prototype.toString.call(w)!=='[object Array]')continue;
    var ex=store.excluded&&store.excluded[ids[k]];
    var exs=(Object.prototype.toString.call(ex)==='[object Array]')?new Set(ex):null;
    var ws=w.slice().sort(function(a,b){return a-b});
    for(var m=0;m<ws.length;m++){
      var i=ws[m];
      if(typeof i!=='number'||i<0||i>=bank.questions.length)continue;
      if(exs&&exs.has(i))continue;
      var d=bank.questions[i];
      qzGQ.push({b:ids[k],i:i,d:d,bank:bank,
        cn:(bank.cats[d.c]&&(bank.cats[d.c].note||bank.cats[d.c].name))||''});
    }
  }
  qzList=[];
  for(var z=0;z<qzGQ.length;z++)qzList.push(z);
}
// 全局错题视图后台补载：把清单内未加载的题库全部拉齐后重渲染（仅当仍停留在错题集视图）
function qzWrongAsyncRefresh(){
  var pending=[];
  for(var i=0;i<QZ_BANKS.length;i++){var m=QZ_BANKS[i];
    if(!QZ_BANK_CACHE[m.id]&&!m._unavailable)pending.push(qzLoadBank(m.id))}
  if(!pending.length){qzGPending=0;return}
  qzGPending=pending.length;
  Promise.all(pending).then(function(){
    qzGPending=0;
    if(qzCat!==QZ_WRONG)return;
    qzRebuild();
    qzRender();
  });
}
// —— 跨题库三表写入口（全局错题视图用）：对指定题库的 done/wrong/excluded 增删一条 →
// 落盘账号键 + 镜像账号桶随 sd() 上云；目标是当前题库时同步内存 Set，保证内存与落盘一致 ——
function qzBankMutate(bankId,part,i,add){
  if(sessionRole==='kid'||!currentUser)return;
  var store=qzAccStore();
  if(!store[part]||typeof store[part]!=='object')store[part]={};
  var arr=store[part][bankId];
  if(Object.prototype.toString.call(arr)!=='[object Array]')arr=[];
  var has=arr.indexOf(i)>=0;
  if(add&&!has)arr=arr.concat([i]).sort(function(a,b){return a-b});
  else if(!add&&has)arr=arr.filter(function(x){return x!==i});
  else return; // 状态不变：不产生无意义的落盘与上云
  store[part][bankId]=arr;
  qzSaveAccStore(store);
  var mem={done:qzDone,wrong:qzWrong,excluded:qzExcluded}[part];
  if(bankId===qzBankId()){if(add)mem.add(i);else mem.delete(i)}
  if(ad){ad.quizDone=store.done;ad.quizWrong=store.wrong;ad.quizExcluded=store.excluded;sd(ad)}
  else dataVersion++;
}
// 重新计算可见列表
//   普通视图：未完成 + 分类过滤 + 排除剔除题
//   错题集视图：全局汇总 —— 所有题库的错题（非剔除）按题库顺序合并；不受「已完成」过滤影响
function qzRebuild(keepId){
  qzList=[];
  if(qzCat===QZ_WRONG){
    qzBuildGlobalWrong();
    if(qzPos>=qzList.length)qzPos=Math.max(0,qzList.length-1);
    return;
  }
  for(var i=0;i<qzData.length;i++){
    if(qzDone.has(i))continue;
    if(qzExcluded.has(i))continue; // 剔除题视同不存在
    if(qzCat!==-1&&qzData[i].c!==qzCat)continue;
    qzList.push(i);
  }
  if(keepId!==undefined){
    var p=qzList.indexOf(keepId);
    qzPos=p>=0?p:0;
  }else if(qzPos>=qzList.length){
    qzPos=Math.max(0,qzList.length-1);
  }
}

// 当前口径（全部/某分类）下的已完成数与总题数；剔除题不计入分母与分子。
// cat 缺省用当前视图口径，传 -1 可取全库口径（供全部完成判断）。
// 已完成数按该口径过滤，天然容错历史脏数据。
function qzCatScope(cat){
  var c=(cat===undefined)?qzCat:cat;
  var total=(c===-1)?QZ_ALL_TOTAL:(QZ_CAT_TOTALS[c]||0);
  var done=0;
  qzDone.forEach(function(i){
    if(i<0||i>=qzData.length)return;
    if(qzExcluded.has(i))return;
    if(c===-1||qzData[i].c===c)done++;
  });
  return {done:done,total:total};
}

// 进度条 + 统计文案 + 副标题随当前分类口径刷新（分类选中时即该分类维度）
//   错题集视图：统计显示「错题 N 题」（N=集内非剔除题数），进度条表示错题占非剔除题库比例
function qzUpdateStats(){
  if(qzCat===QZ_WRONG){
    var n=qzWrongVisibleCount();
    // 错题集视图（全局汇总）：统计行标注「全部题库」；进度条 = 错题数 / 已加载题库总题数
    document.getElementById('qzStats').textContent='全部题库 · 错题 '+n+' 题';
    var tot=0;
    for(var i=0;i<QZ_BANKS.length;i++){var cb=QZ_BANK_CACHE[QZ_BANKS[i].id];if(cb&&cb.questions)tot+=cb.questions.length}
    if(qzBank&&qzBank.builtin)tot+=qzData.length;
    document.getElementById('qzBar').style.width=(tot?n/tot*100:0)+'%';
    return;
  }
  var s=qzCatScope();
  document.getElementById('qzStats').textContent=s.done+'/'+s.total;
  document.getElementById('qzBar').style.width=(s.total?s.done/s.total*100:0)+'%';
  // 副标题只保留题库副标题（如「四年级+」）：题量统计唯一口径收敛到右侧统计文本分母，
  // 不再重复展示「共 N 题」——360 宽下长副标题+题量会折成两行（改前实测复现）
  var sub=document.getElementById('qzSub');
  if(sub)sub.textContent=(qzBank&&qzBank.subtitle?qzBank.subtitle:'');
}

// 分类 chips：只渲染「全部 + 各分类」（错题集入口已移至头部行，见 qzRefreshWrongBtn）
function qzRenderChips(){
  var h='<button class="qz-chip'+(qzCat===-1?' on':'')+'" onclick="qzSetCat(-1)">全部</button>';
  for(var i=0;i<qzCats.length;i++){
    h+='<button class="qz-chip'+(qzCat===i?' on':'')+'" onclick="qzSetCat('+i+')">'+escHtml(qzCats[i].name||'')+'</button>';
  }
  document.getElementById('qzCatBar').innerHTML=h;
}

// 头部「错题集 (N)」按钮实时刷新：文案带数量；N=0 → 置灰 + disabled 不可点；错题集视图内 → 选中态。
// 统一由 qzRender() 调用，覆盖答错归集 / 答对出集 / 分类切换 / 重置 / 进入刷题页等全部路径。
function qzRefreshWrongBtn(){
  var b=document.getElementById('qzWrongBtn');
  if(!b)return;
  var wn=qzWrongVisibleCount(); // 剔除题不计入错题集按钮计数（数据保留，恢复后回来）
  b.textContent='错题集 ('+wn+')';
  b.title='汇总所有题库的错题'; // 桌面端 hover 提示
  b.disabled=(wn===0);
  b.className='qz-wrongbtn'+(qzCat===QZ_WRONG?' on':'')+(wn===0?' qz-wrongbtn-off':'');
}

// 渲染当前题目（含全部完成/分类做完的空态）
function qzRender(){
  qzRefreshWrongBtn(); // 错题集按钮文案/禁用态/选中态随本次渲染同步刷新（含下方各提前 return 分支）
  qzRenderCheckin();   // 连续打卡条（连续天数/补签卡/补签与购卡入口）
  var card=document.getElementById('qzCard');
  var prevBtn=document.getElementById('qzPrev');
  var nextBtn=document.getElementById('qzNext');
  var okBtn=document.getElementById('qzOk');
  var ngBtn=document.getElementById('qzNg');
  if(qzList.length===0){
    prevBtn.disabled=true;
    nextBtn.disabled=true;
    // 无进行中的题目（全完成/分类做完/错题集已清空）时判分按钮同样禁用，避免无题可判
    okBtn.disabled=true;
    ngBtn.disabled=true;
    if(qzCat===QZ_WRONG){
      card.innerHTML='<div class="qz-fin">'
        +(qzGPending>0
          ?'<div class="qz-fin-t">正在加载错题…</div>'
          :'<div class="qz-fin-t">暂无错题，太棒了！</div>'
            +'<div class="qz-fin-p">所有题库的错题都会汇总在这里，方便随时重做。</div>')
        +'</div>';
      qzUpdateStats();
      return;
    }
    var bs=qzCatScope(-1);
    var allDone=bs.total>0&&bs.done===bs.total; // 全库口径：非剔除题全部完成
    card.innerHTML='<div class="qz-fin">'
      +'<div class="qz-fin-t">'+(allDone?bs.total+' 题全部完成！':'这个分类做完了')+'</div>'
      +'<div class="qz-fin-p">'+(allDone
        ?'和孩子一起坚持下来真了不起！可以重置进度，再来一轮。'
        :'换一个分类看看，或者重置进度重新挑战。')+'</div>'
      +'<button class="qz-fin-b" onclick="qzResetProgress()">重置进度，重新开始</button>'
      +'</div>';
    qzUpdateStats();
    return;
  }
  var qi=qzList[qzPos];
  var gw=(qzCat===QZ_WRONG)?qzGQ[qi]:null; // 全局错题视图：条目携带出处题库
  var d=gw?gw.d:qzData[qi];
  prevBtn.disabled=qzPos<=0;
  nextBtn.disabled=qzPos>=qzList.length-1;
  okBtn.disabled=false;
  ngBtn.disabled=false;
  // 题号徽章：全部口径 → 全库非剔除序列位次/非剔除总数；错题集口径 → 该题在错题集中的位次/错题总数（均非剔除）；
  // 分类口径 → 分类内非剔除序列位次/分类非剔除总数
  var badge;
  if(qzCat===QZ_WRONG){
    badge=(qzPos+1)+' / '+qzGQ.length;
  }else if(qzCat===-1){
    badge=QZ_ALL_RANK[qi]+' / '+QZ_ALL_TOTAL;
  }else{
    badge=QZ_CAT_RANK[qi]+' / '+QZ_CAT_TOTALS[qzCat];
  }
  var cn=(qzCats[d.c]&&(qzCats[d.c].note||qzCats[d.c].name))||'';
  // 剔除入口：徽章行右侧角标位，仅家长端渲染（刷题页本身仅家长可达，此处双保险）
  var exBtn=(sessionRole==='parent')?'<button type="button" class="qz-exbtn" onclick="qzExcludeCurrent()">剔除</button>':'';
  // 错题集视图：meta 行以「出自：题库名」小标签替代分类说明（题库归属是错题集的关键信息，
  // 且 360 宽下徽章+标签+说明+剔除四者同排放不下；分类信息可由题目内容与 chips 判断）
  var metaMid=(qzCat===QZ_WRONG&&gw)
    ?'<span class="qz-src">出自：'+escHtml(gw.bank.name||'')+'</span>'
    :'<span class="qz-cat">'+escHtml(cn)+'</span>';
  // 错题集视图复习角标：复习进度 1/2 时黄域标注（2/2 即毕业移出，不会再出现）
  var stk=(qzCat===QZ_WRONG&&gw)?qzWrongStreakOf(gw.b,gw.i):0;
  var stkChip=(qzCat===QZ_WRONG&&gw&&stk>0&&stk<2)
    ?'<span class="qz-src" style="background:var(--yellow-l);color:var(--yel-deep)">复习 '+stk+'/2</span>'
    :'';
  card.innerHTML='<div class="qz-meta">'
    +'<span class="qz-num num">'+badge+'</span>'
    +metaMid+stkChip+exBtn+'</div>'
    +'<div class="qz-title">'+escHtml(d.t)+'</div>'
    +'<div class="qz-body">'+escHtml(d.q)+'</div>'
    +'<div class="qz-ans" id="qzAns"><span class="qz-ans-lb">答案：</span>'+escHtml(d.a)+'</div>'
    +'<div class="qz-actions">'
    +'<button class="qz-abtn" id="qzAnsBtn" onclick="qzToggleAnswer()">看答案</button>'
    +'</div>';
  qzUpdateStats();
}

// 「看答案」仅切换答案区显隐；判分按钮已移至吸顶条常显，不再由此控制
function qzToggleAnswer(){
  var box=document.getElementById('qzAns');
  var btn=document.getElementById('qzAnsBtn');
  var showing=box.classList.toggle('show');
  btn.textContent=showing?'收起答案':'看答案';
}

// 是否有可判分的题目：列表非空 + qzPos 落在有效区间 + 该题下标有效。
// 用于封堵「st('quiz') 已显示页面、qzShow() 尚未跑」窗口期内判分按钮可点却无题可判的场景。
function qzHasQuestion(){
  return !!(qzList&&qzList.length&&qzPos>=0&&qzPos<qzList.length
    &&qzList[qzPos]!==undefined&&qzList[qzPos]!==null);
}

// 判分：答对了 → 奖励积分（每题不限次、可重复作答重复得分）→ 打卡 → 错题间隔复习推进 → 标记完成并跳下一题。
// 间隔复习：错题答对 1 次进入「复习 1/2」（保留在集内），连续答对 2 次才移出错题集。
// 原子性：qzAward() 未成功（孩子端/未登录/账本桶未加载）时直接返回，绝不只标记完成——
// 否则会出现「题目消失但没加分」的静默丢失（init 首次 syncPull 返回前的窗口期即此情形）。
function qzMarkCorrect(){
  if(!qzHasQuestion())return;
  if(qzCat===QZ_WRONG){
    var e=qzGQ[qzList[qzPos]];
    if(!e)return;
    if(!qzAward(e.bank.name)){toast('数据还在加载，请稍候再点');return}
    var extra=qzCheckin()||'';
    var rv='';
    var s=qzWrongBump(e.b,e.i,true);
    if(s>=2){ // 复习毕业：移出错题集并在出处题库标记完成
      qzBankMutate(e.b,'wrong',e.i,false);
      qzBankMutate(e.b,'done',e.i,true);
      rv=' · 复习完成，已移出错题集';
    }else{
      rv=' · 复习进度 '+s+'/2';
    }
    toast('答对了！+'+QZ_REWARD+' 分'+rv+extra,'ok');
    if(qzPos<qzList.length-1)qzPos++;
    else if(qzPos>0)qzPos--;
    qzRebuild();
    qzRender();
    return;
  }
  if(!qzAward()){toast('数据还在加载，请稍候再点');return}
  var extra2=qzCheckin()||'';
  var qi=qzList[qzPos];
  var rv2='';
  if(qzWrong.has(qi)){ // 该题在错题集中：推进复习进度（连续答对 2 次出集）
    var s2=qzWrongBump(qzBankId(),qi,true);
    if(s2>=2){
      qzWrongRemove(qi);
      rv2=' · 复习完成，已移出错题集';
    }else{
      rv2=' · 复习进度 '+s2+'/2';
    }
  }
  toast('答对了！+'+QZ_REWARD+' 分'+rv2+extra2,'ok');
  qzMarkDone();
}
// 判分：答错了 → 记入错题集（去重）+ 复习进度清零 + 不加分，仅标记完成并跳下一题（不依赖账本，窗口期也可正常标记）。
// 错题集视图内答错：该题本就在集内，复习进度清零并跳到下一题。
function qzMarkWrong(){
  if(!qzHasQuestion())return;
  if(qzCat===QZ_WRONG){
    // 全局错题视图内答错：复习进度清零，保留并跳下一题
    // （不可调用 qzWrongAdd——全局视图的 qzList 是合并列表下标，误加会污染当前题库错题集）
    var e2=qzGQ[qzList[qzPos]];
    if(e2)qzWrongBump(e2.b,e2.i,false);
    if(qzPos<qzList.length-1){qzPos++;qzRender()}
    return;
  }
  var extra=qzCheckin()||'';
  if(extra)toast(extra,'ok');
  qzWrongAdd(qzList[qzPos]);
  if(qzWrong.has(qzList[qzPos]))qzWrongBump(qzBankId(),qzList[qzPos],false); // 复习中断：进度清零
  qzMarkDone();
}

// 奖励写入当前登录账号的账本：字段与 ss() 记录一致（id/date/timestamp/type/itemId/name/category/score/note）。
// 走 sd(ad)：本地落桶 + syncPush 上云；孩子端被 sd() 的角色守卫拦截（此处再守卫一次，绝不写桶）。
// 返回 true=已写入账本；false=未写入（不可判分/孩子端/未登录/账本未就绪）。
var QZ_REWARD=5;
function qzAward(bankName){
  if(sessionRole!=='parent')return false; // 仅家长端开放：孩子端只读，绝不写账本
  if(!currentUser||!ad)return false;      // 账本未就绪（init syncPull 未返回时 ad 为 null）
  if(!qzHasQuestion())return false;       // 无题目可判时绝不写账本（空列表/越界索引兜底）
  var rec={id:'r_'+Date.now(),date:today(),timestamp:Date.now(),type:'up',
    itemId:'quiz_reward',name:'答题获取',category:'学习',score:QZ_REWARD,
    note:(bankName||(qzBank?qzBank.name:'逻辑推理题'))+'答对'};
  ad.records.push(rec);
  ad.totalPoints+=QZ_REWARD;
  sd(ad);
  render();
  return true;
}

// 标记完成 → 隐藏此题并自动跳到下一题（错题集数量随判分实时刷新）
function qzMarkDone(){
  if(qzCat===QZ_WRONG)return; // 全局错题视图的完成标记走 qzBankMutate（出处题库），此函数仅服务普通视图
  if(!qzHasQuestion())return; // 空列表/越界时不得 add(undefined)，否则 qzDone 会被 null 永久污染
  var qi=qzList[qzPos];
  var wasLast=qzPos>=qzList.length-1;
  qzDone.add(qi);
  qzSave();
  if(wasLast&&qzPos>0)qzPos--;
  qzRebuild();
  qzRenderChips();
  qzRender();
}

// 导航：列表未就绪（空/未初始化）时直接返回，避免在无题状态下触发渲染
function qzPrev(){if(!qzList||!qzList.length)return;if(qzPos>0){qzPos--;qzRender()}}
function qzNext(){if(!qzList||!qzList.length)return;if(qzPos<qzList.length-1){qzPos++;qzRender()}}

// ===== 连续打卡（存账号桶 quizStreak：{count,best,cards,last,ms}，随 sd() 上云多设备同步） =====
// 打卡时机：每日首次判分（答对/答错均算刷题）。断签次日可用补签卡补回「昨天」（仅隔 1 天时可补）。
// 里程碑奖励：连续达 3/7/14/21/30/60/100 天各发一次积分（记录 itemId=quiz_streak_reward，不可删除）。
var QZ_CARD_COST=20; // 补签卡售价（积分）
var QZ_STREAK_MILESTONES={3:5,7:10,14:15,21:20,30:30,60:50,100:100};
function qzDayShift(n){
  var d=new Date();d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
// 读取并规范化打卡对象（桶缺失/旧桶无字段时给默认值；不改桶）
function qzStreakObj(){
  var s=(ad&&ad.quizStreak&&typeof ad.quizStreak==='object'&&Object.prototype.toString.call(ad.quizStreak)!=='[object Array]')?ad.quizStreak:{};
  if(typeof s.count!=='number'||!isFinite(s.count)||s.count<0)s.count=0;
  if(typeof s.best!=='number'||!isFinite(s.best)||s.best<0)s.best=0;
  if(typeof s.cards!=='number'||!isFinite(s.cards)||s.cards<0)s.cards=0;
  if(typeof s.last!=='string')s.last='';
  if(!s.ms||typeof s.ms!=='object'||Object.prototype.toString.call(s.ms)==='[object Array]')s.ms={};
  return s;
}
// 发放里程碑奖励（内部函数）：命中未发过的天数档 → 记一笔不可删除的系统流水。
// 返回提示文案（如 ' · 达成 7 天连续，奖励 +10 分！'），无奖励返回 ''
function qzStreakReward(s){
  var rew=QZ_STREAK_MILESTONES[s.count];
  if(!rew||s.ms[s.count])return '';
  s.ms[s.count]=true;
  ad.records.push({id:'r_'+Date.now(),date:today(),timestamp:Date.now(),type:'up',
    itemId:'quiz_streak_reward',name:'连续刷题 '+s.count+' 天奖励',category:'学习',score:rew,note:''});
  ad.totalPoints+=rew;
  return ' · 达成 '+s.count+' 天连续，奖励 +'+rew+' 分！';
}
// 每日打卡：返回提示文案（里程碑奖励），无里程碑返回 ''（调用方拼进判分 toast）
function qzCheckin(){
  if(sessionRole!=='parent'||!currentUser||!ad)return '';
  var s=qzStreakObj();
  var td=today();
  if(s.last===td)return ''; // 今日已打卡
  if(s.last===qzDayShift(-1))s.count++; // 昨天打过：连续 +1
  else s.count=1;                        // 断签：重新起算
  if(s.count>s.best)s.best=s.count;
  s.last=td;
  var msg=qzStreakReward(s);
  ad.quizStreak=s;
  sd(ad);
  qzRenderCheckin();
  return msg;
}
// 补签昨日：仅「昨天恰好断签」（last=前天）且有补签卡时可补
function qzMakeupYesterday(){
  if(sessionRole!=='parent'||!ad)return;
  var s=qzStreakObj();
  if(s.cards<=0||s.last!==qzDayShift(-2)){toast('当前无法补签（仅昨天断签且持有补签卡时可补）','err');return}
  sc2('补签','使用 1 张补签卡补上昨天的刷题打卡？',function(){
    s.cards--;s.count++;if(s.count>s.best)s.best=s.count;
    s.last=qzDayShift(-1);
    var extra=qzStreakReward(s);
    ad.quizStreak=s;
    sd(ad);
    toast('已补签昨日'+extra,'ok');
    qzRenderCheckin();
    render();
  });
}
// 购买补签卡：扣积分 + 记一笔不可删除的系统流水（itemId=quiz_card_buy）
function qzBuyCard(){
  if(sessionRole!=='parent'||!ad)return;
  if(ad.totalPoints<QZ_CARD_COST){toast('积分不足（需 '+QZ_CARD_COST+' 分）','err');return}
  sc2('购买补签卡','花 '+QZ_CARD_COST+' 积分购买 1 张补签卡？断签次日可用它补回连续记录。',function(){
    ad.totalPoints-=QZ_CARD_COST;
    var s=qzStreakObj();
    s.cards++;
    ad.quizStreak=s;
    ad.records.push({id:'r_'+Date.now(),date:today(),timestamp:Date.now(),type:'down',
      itemId:'quiz_card_buy',name:'购买补签卡',category:'学习',score:-QZ_CARD_COST,note:''});
    sd(ad);
    toast('已购买 1 张补签卡','ok');
    qzRenderCheckin();
    render();
  });
}
// 打卡条渲染：连续天数/最佳/补签卡存量 + 补签与购卡入口（仅家长端；刷题页本身仅家长可达）
function qzRenderCheckin(){
  var el=document.getElementById('qzCk');
  if(!el)return;
  if(sessionRole!=='parent'||!ad){el.innerHTML='';return}
  var s=qzStreakObj();
  var canMakeup=(s.cards>0&&s.last===qzDayShift(-2)&&s.last!==today());
  var h='<span>连续刷题 <b>'+s.count+'</b> 天 · 最佳 '+s.best+' 天 · 补签卡 ×'+s.cards+'</span>';
  if(canMakeup)h+='<button type="button" class="qz-ckbtn" onclick="qzMakeupYesterday()">补签昨日</button>';
  h+='<button type="button" class="qz-ckbtn" onclick="qzBuyCard()"'+(ad.totalPoints<QZ_CARD_COST?' disabled':'')+'>补签卡 +1（'+QZ_CARD_COST+' 分）</button>';
  el.innerHTML=h;
}

function qzSetCat(i){
  qzCat=i;
  qzPos=0;
  qzRenderChips();
  qzRebuild();
  qzRender();
  if(i===QZ_WRONG)qzWrongAsyncRefresh(); // 全局错题视图：后台补齐未加载题库后重渲染
}

function qzRandomPick(){
  if(!qzList||!qzList.length)return;
  qzPos=Math.floor(Math.random()*qzList.length);
  qzRender();
}

// ===== 剔除题目（仅家长端）：确认后该题视同不存在，可随时恢复 =====
// 剔除 = 当前题库 excluded 加入该题下标 → 落盘 + sd() 上云 → 重建派生量与视图。
// 进度/错题数据保留（恢复后原样回来）；剔除按 bankId 分键，天然按题库与账号隔离。
function qzExcludeCurrent(){
  if(sessionRole!=='parent')return; // 家长端守卫（按钮已按角色渲染，此处双保险）
  if(!qzHasQuestion())return;
  var wrong=(qzCat===QZ_WRONG);
  var qi=qzList[qzPos];
  var d=wrong?((qzGQ[qi]||{}).d||{t:''}):(qzData[qi]||{t:''});
  sc2('剔除题目','剔除后「'+(d.t||'该题')+'」将不再出现在刷题、错题集与统计中，可在题库选择中恢复。确定要剔除吗？',function(){
    if(wrong){ // 全局错题视图：剔除「出处题库」中的该题（数据仍按题库分键）
      var e=qzGQ[qi];
      if(!e)return;
      qzBankMutate(e.b,'excluded',e.i,true);
      if(e.b===qzBankId())qzBuildDerived(); // 目标为当前题库：重算统计分母/题号位次
      qzRebuild();
      qzRender();
      toast('已剔除，可在题库选择中恢复','ok');
      return;
    }
    qzExcludeAt(qi);
  });
}
function qzExcludeAt(qi){
  if(sessionRole!=='parent')return;
  if(qi===undefined||qi===null||qi<0||qi>=qzData.length)return;
  if(qzExcluded.has(qi))return;
  qzExcluded.add(qi);
  qzBuildDerived(); // 统计分母/题号位次按剔除后序列重排
  qzPersistAll();   // 落盘 + 上云（含排除后口径）
  qzRebuild();      // 正在显示该题时自然滑到下一题（qzPos 不动，越界时收敛）
  qzRenderChips();
  qzRender();
  qzRenderTitle();  // 单题库配置下：有剔除题后标题也可点开题库弹窗（恢复入口）
  toast('已剔除，可在题库选择中恢复','ok');
}
// 恢复：从 excluded 移除 → 派生量/视图重建 → 落盘 + 上云；进度与错题随数据保留自动还原
function qzRestoreAt(qi){
  if(sessionRole!=='parent')return;
  if(qi===undefined||qi===null||qi<0||qi>=qzData.length)return;
  if(!qzExcluded.has(qi))return;
  qzExcluded.delete(qi);
  qzBuildDerived();
  qzPersistAll();
  qzRebuild();
  qzRenderChips();
  qzRender();
  qzRenderTitle();
  toast('已恢复该题','ok');
  var mo=document.getElementById('mBank');
  if(mo&&mo.classList.contains('show'))qzRenderExcludedMgr(); // 管理列表开着则同步刷新（数量递减/清空态）
}
// 题库弹窗内「已剔除题目」管理视图：每条 题目名 + 恢复按钮（复用弹窗容器，返回按钮切回题库列表）
function qzRenderExcludedMgr(){
  var box=document.getElementById('bankList');
  if(!box)return;
  qzBankListView='excluded';
  var t=document.querySelector('#mBank .ml-title');
  if(t)t.textContent='已剔除题目';
  var ids=Array.from(qzExcluded).sort(function(a,b){return a-b});
  var h='<div class="excl-title">当前题库已剔除 '+ids.length+' 题。恢复后回到原位次，进度与错题数据保留。</div>';
  if(!ids.length){
    h+='<div class="es" style="padding:24px 0">'+esBricks()+'<div class="et">暂无剔除的题目</div></div>';
  }
  for(var i=0;i<ids.length;i++){
    var d=qzData[ids[i]]||{t:''};
    h+='<div class="excl-row"><span class="n">'+escHtml(d.t)+'</span>'
      +'<button type="button" class="ap-btn ok" onclick="qzRestoreAt('+ids[i]+')">恢复</button></div>';
  }
  h+='<button type="button" class="bn bn-q" style="margin-top:8px" onclick="qzBackToBankList()">返回题库列表</button>';
  box.innerHTML=h;
}
function qzBackToBankList(){
  var t=document.querySelector('#mBank .ml-title');
  if(t)t.textContent='选择题库';
  qzRenderBankList();
}

// 重置进度：走 App 内确认框（与删除记录/清除数据同一交互语言）
// 只重置「当前题库 + 当前账号」的已完成（done 表清空后落盘上云），不影响其他题库/其他账号；
// 错题集与剔除表不受影响（剔除题不因重置回来），只在错题集里答对才移出。
function qzResetProgress(){
  sc2('重置刷题进度','所有已完成的题目会重新显示。错题集不受影响（只有在错题集里答对才会移出）。确定要继续吗？',function(){
    qzDone.clear();
    qzSave();
    qzPos=0;
    qzRebuild();
    qzRenderChips();
    qzRender();
    toast('刷题进度已重置','ok');
  });
}

// 吸顶操作条的 top 偏移 = sticky 顶栏高度（顶栏隐藏时为 0），避免被顶栏遮住
function qzSetStickyTop(){
  var h=document.getElementById('mainHeader');
  var top=(h&&h.offsetHeight)||0;
  document.documentElement.style.setProperty('--qz-top',top+'px');
}

// ---------- 题库切换 UI ----------
// 标题 = 当前题库 name；标题恒可点开题库弹窗（多套切换 / 剔除恢复 / 自定义题库管理）；
// 内置兜底时给一行小字提示
function qzRenderTitle(){
  var t=document.getElementById('qzTt');
  if(t&&qzBank)t.textContent=qzBank.name;
  var btn=document.getElementById('qzTitleBtn');
  if(btn)btn.classList.add('multi'); // 恒可点：题库切换/剔除恢复/自定义题库管理共用此入口
  var hint=document.getElementById('qzHint');
  if(hint){
    hint.textContent=QZ_FALLBACK?'配置未加载，当前为内置题库 · 点此重试':'';
    hint.style.display=QZ_FALLBACK?'':'none';
  }
}

// 题库弹窗当前视图标记：list=题库列表 / excluded=剔除管理。
// 异步补加载题库完成后仅在列表视图下重渲染，避免覆盖用户正在查看的管理列表。
var qzBankListView='list';

// 选择题库弹窗：每套题库一行（题库名 + 副标题/题量；当前题库高亮打勾；不可用置灰）
function qzRenderBankList(){
  var box=document.getElementById('bankList');
  if(!box)return;
  qzBankListView='list';
  var h='';
  for(var i=0;i<QZ_BANKS.length;i++){
    var m=QZ_BANKS[i],bank=QZ_BANK_CACHE[m.id],sub=qzStr(m.subtitle);
    var on=!!(qzBank&&qzBank.id===m.id),na=!!m._unavailable;
    var n=(bank&&bank.questions)?bank.questions.length:null;
    if(na)sub='文件加载失败，暂不可用';
    else if(n!==null)sub=(sub?sub+' · ':'')+'共 '+n+' 题';
    h+='<button type="button" class="bank-row'+(on?' on':'')+(na?' na':'')+'"'+(na?' disabled':'')
      +' onclick="qzPickBankAt('+i+')">'
      +'<span class="bank-row-main"><span class="bank-row-name">'+escHtml(m.name)+'</span>'
      +'<span class="bank-row-sub">'+escHtml(sub)+'</span></span>'
      +'<span class="bank-row-tick" aria-hidden="true"></span></button>';
  }
  // 恢复入口（防误剔）：当前题库有剔除题时，题库列表底部显示管理入口
  var exN=qzExcluded?qzExcluded.size:0;
  if(exN>0){
    h+='<button type="button" class="bank-row" onclick="qzRenderExcludedMgr()">'
      +'<span class="bank-row-main"><span class="bank-row-name">已剔除题目 ('+exN+')</span>'
      +'<span class="bank-row-sub">查看与恢复当前题库剔除的题目</span></span>'
      +'<span class="bank-row-tick" aria-hidden="true"></span></button>';
  }
  // 自定义题库管理：列表（编辑/删除）+ 新建/导入入口（本机存储，随「导出备份」迁移）
  var customs=qzCustomBanks();
  h+='<div class="excl-title" style="margin:14px 0 8px">自定义题库</div>';
  for(var c=0;c<customs.length;c++){
    var cItem=customs[c];
    var cN=Object.prototype.toString.call(cItem.questions)==='[object Array]'?cItem.questions.length:0;
    h+='<div class="excl-row"><span class="n">'+escHtml(qzStr(cItem.name)||cItem.id)+'<span style="color:var(--ink3)"> · '+cN+' 题</span></span>'
      +'<button type="button" class="ap-btn ok" onclick="qzEditCustomBank(\''+cItem.id+'\')">编辑</button>'
      +'<button type="button" class="ap-btn no" onclick="qzDeleteCustomBank(\''+cItem.id+'\')">删除</button></div>';
  }
  if(!customs.length)h+='<div class="sync-hint" style="margin-bottom:8px">暂无自定义题库。可导入学校错题、听写内容等，格式支持 cat/title/question/answer。</div>';
  h+='<button type="button" class="bn bn-q" style="margin-top:4px" onclick="qzEditCustomBank(\'\')">＋ 新建 / 导入题库</button>';
  h+='<button type="button" class="bn bn-q" style="margin-top:8px" onclick="cm(\'mBank\')">取消</button>';
  box.innerHTML=h;
}

// 打开弹窗（题库选择 / 剔除恢复 / 自定义题库管理三合一入口，恒可打开）：
// 打开时后台补齐未加载题库，用于显示题量 / 标注不可用（不阻塞弹窗打开）；
// 标题复位为「选择题库」（可能刚从剔除管理视图返回）
function qzOpenBankPicker(){
  if(QZ_FALLBACK&&!qzLoadPromise)qzEnsureLoaded(); // 兜底状态：先尝试恢复清单（成功后弹窗即可见全部题库）
  var t=document.querySelector('#mBank .ml-title');
  if(t)t.textContent='选择题库';
  qzRenderBankList();
  document.getElementById('mBank').classList.add('show');
  var pending=[];
  for(var i=0;i<QZ_BANKS.length;i++){
    var m=QZ_BANKS[i];
    if(!QZ_BANK_CACHE[m.id]&&!m._unavailable)pending.push(qzLoadBank(m.id));
  }
  if(pending.length)Promise.all(pending).then(function(){
    var mo=document.getElementById('mBank');
    if(mo&&mo.classList.contains('show')&&qzBankListView==='list')qzRenderBankList();
  });
}

// 选中第 i 套题库：不可用则提示；已是当前题库则只关弹窗
function qzPickBankAt(i){
  var m=QZ_BANKS[i];
  if(!m)return;
  if(m._unavailable){toast('该题库暂不可用');return}
  cm('mBank');
  if(qzBank&&qzBank.id===m.id)return;
  qzSwitchBank(m.id);
}

// 切换题库：重建题目列表、恢复该题库的进度与错题集、刷新统计/题号/错题集按钮/分类 chips，并回到第一题
function qzSwitchBank(id){
  qzRenderLoading();
  qzLoadBank(id).then(function(bank){
    if(!bank){toast('该题库暂不可用');qzActivate(qzBank||QZ_BUILTIN_BANK);return}
    qzActivate(bank);
    toast('已切换到「'+bank.name+'」','ok');
  });
}

// 激活题库：落盘当前 id → 建题目数据 → 载入该题库进度/错题集/剔除表（越界校验依赖 qzData）
// → 按剔除口径重算派生量 → 回到第一题 → 全量刷新
function qzActivate(bank){
  qzBank=bank;
  QZ_FALLBACK=!!bank.builtin;
  try{localStorage.setItem(QZ_BANK_KEY,qzBankId())}catch(e){}
  qzBuildDerived();  // 第一遍：建立 qzCats/qzData（供 qzLoadBankState 的越界校验使用）
  qzLoadBankState();
  qzBuildDerived();  // 第二遍：按剔除口径重算统计分母/题号位次
  qzCat=-1;
  qzPos=0;
  qzRenderTitle();
  qzRenderChips();
  qzRebuild();
  qzRender();
}

// 依次尝试加载（第一套成功即用；全部失败 → null）
function qzLoadSeq(ids,i){
  if(i>=ids.length)return Promise.resolve(null);
  return qzLoadBank(ids[i]).then(function(b){return b||qzLoadSeq(ids,i+1)});
}

// 首次加载：清单 → 迁移旧进度（旧无后缀键归一 → 一次性迁给当前登录账号）→ 选定题库（上次选中的优先，否则清单第一套）→ 全失败回退内置兜底。
// 兜底不是「本会话判死刑」：失败时复位 qzLoadPromise，下次进刷题页/开弹窗/点提示行会自动重新拉取；
// 重试成功后的自动恢复（仅当当前正处于内置兜底）：
//   内置名下无任何进度（qzDone/qzWrong/qzExcluded 全空）→ 自动切换（上次题库 id 优先，否则清单第一套）并 toast「题目配置已加载」；
//   内置名下已有进度（用户在内置库做过题）→ 不自动切换（保住进度），仅 toast 提示手动切换。
function qzEnsureLoaded(){
  if(qzLoadPromise)return qzLoadPromise;
  var want='';try{want=localStorage.getItem(QZ_BANK_KEY)||''}catch(e){}
  if(want&&want!=='builtin')qzLastBankWant=want; // 先记下真实「上次题库 id」（兜底激活会覆写 sp_quiz_bank）
  qzLoadPromise=qzLoadIndex().then(function(){
    qzMigrateLegacy();
    qzMigrateAccountData(); // 旧设备级键 → 当前登录家长账号（sp_quiz_migrated 防重复迁移）
    var ids=[];
    var first=(want&&want!=='builtin'&&qzBankMeta(want))?want:((qzLastBankWant&&qzBankMeta(qzLastBankWant))?qzLastBankWant:'');
    if(first)ids.push(first);
    for(var i=0;i<QZ_BANKS.length;i++)if(ids.indexOf(QZ_BANKS[i].id)<0)ids.push(QZ_BANKS[i].id);
    return qzLoadSeq(ids,0);
  }).then(function(bank){
    if(!bank){ // 清单不可用 / 题库全部取不到 → 内置兜底，并复位加载态以便下次重试
      if(!qzBank||!qzBank.builtin)qzActivate(QZ_BUILTIN_BANK);
      else{QZ_FALLBACK=true;qzRenderTitle()} // 已在内置：保持现场，仅确保提示行可见
      qzLoadPromise=null;
      return qzBank;
    }
    if(qzBank&&qzBank.builtin){ // 从内置兜底恢复
      if(qzDone.size||qzWrong.size||qzExcluded.size){ // 内置名下已有进度：不自动切换，保住进度
        QZ_FALLBACK=false;
        qzRenderTitle();
        toast('题目配置已加载，可在题库选择中切换','ok');
      }else{ // 无进度：自动切换到可用题库
        qzActivate(bank);
        toast('题目配置已加载','ok');
      }
    }else{
      qzActivate(bank); // 首次加载成功：静默激活
    }
    return qzBank;
  }).catch(function(){
    if(!qzBank||!qzBank.builtin)qzActivate(QZ_BUILTIN_BANK);
    else{QZ_FALLBACK=true;qzRenderTitle()} // 已在内置：保持现场（不重置进度/视图）
    qzLoadPromise=null; // 复位：下次进页/开弹窗/点提示行自动重试
    return qzBank;
  });
  return qzLoadPromise;
}

// 提示行点击重试：重新拉取清单；成功按 qzEnsureLoaded 内自动恢复规则处理，失败保留提示行
function qzHintRetry(){
  qzEnsureLoaded().then(function(){
    if(QZ_FALLBACK)toast('仍无法加载题目配置，请检查网络');
  });
}

// 加载中占位（复用空态卡片样式）：清空分类/统计并禁用导航与判分按钮
function qzRenderLoading(){
  var bar=document.getElementById('qzCatBar');
  if(bar)bar.innerHTML='';
  var card=document.getElementById('qzCard');
  if(card)card.innerHTML='<div class="qz-fin"><div class="qz-fin-t">正在加载题目…</div></div>';
  var st=document.getElementById('qzStats');
  if(st)st.textContent='0/0';
  var b=document.getElementById('qzBar');
  if(b)b.style.width='0%';
  var wb=document.getElementById('qzWrongBtn');
  if(wb){wb.textContent='错题集 (0)';wb.disabled=true;wb.className='qz-wrongbtn qz-wrongbtn-off'}
  qzDisableControls(true);
}
function qzDisableControls(dis){
  var ids=['qzPrev','qzNext','qzOk','qzNg'];
  for(var i=0;i<ids.length;i++){var el=document.getElementById(ids[i]);if(el)el.disabled=dis}
}

// 进入刷题页时调用（st('quiz')）：首次进入先显示 loading，加载完成由 qzActivate 渲染；
// 已激活则进度与分类保持内存态，重建视图即可
function qzShow(){
  qzSetStickyTop();
  if(!qzBank){qzRenderLoading();qzEnsureLoaded();return}
  if(QZ_FALLBACK&&!qzLoadPromise)qzEnsureLoaded(); // 内置兜底：每次进页自动静默重试一次（成功才 toast 打扰）
  qzRenderChips();
  qzRebuild();
  qzRender();
  if(qzCat===QZ_WRONG)qzWrongAsyncRefresh(); // 停留在全局错题视图：补齐未加载题库后重渲染
}

// ===== 自定义题库编辑器（弹窗 mBankEdit，index.html） =====
// 新建/编辑共用一个弹窗：qzEditBankCtx 存编辑中的题库 id（''=新建）。
// 题目 JSON 支持 cat/title/question/answer（数字 cat 为分类下标，越界归 0）；
// 兼容内置题库的字段简写 c/t/q/a。保存后刷新清单并自动切到该题库。
var qzEditBankCtx=''; // 编辑中的自定义题库 id（''=新建）
function qzEditCustomBank(id){
  if(sessionRole!=='parent')return; // 刷题/题库管理仅家长端
  qzEditBankCtx=id||'';
  var name='',sub='',json='';
  if(id){
    var cs=qzCustomBanks();
    for(var i=0;i<cs.length;i++){
      if(String(cs[i].id)===id){
        name=qzStr(cs[i].name);sub=qzStr(cs[i].subtitle);
        try{json=JSON.stringify({cats:cs[i].cats||[],questions:cs[i].questions||[]},null,2)}catch(e){json=''}
        break;
      }
    }
  }
  var t=document.getElementById('mBankEditTitle');
  if(t)t.textContent=id?'编辑题库':'新建题库';
  document.getElementById('cbName').value=name;
  document.getElementById('cbSub').value=sub;
  document.getElementById('cbJson').value=json;
  cm('mBank'); // 若从题库弹窗进入，先收起（mBankEdit z-index 更高，叠开亦可，收起更清爽）
  document.getElementById('mBankEdit').classList.add('show');
}
// 从 .json 文件导入：读入后回填 JSON 文本域（保存时才落盘）
function qzImportBankFile(inp){
  var f=inp.files&&inp.files[0];
  inp.value='';
  if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    var j=null;
    try{j=JSON.parse(rd.result)}catch(e){toast('JSON 解析失败','err');return}
    var qs=(j&&Object.prototype.toString.call(j.questions)==='[object Array]')?j.questions:[];
    if(!qs.length){toast('文件中没有题目（需 questions 数组）','err');return}
    try{
      document.getElementById('cbJson').value=JSON.stringify({
        cats:(j&&Object.prototype.toString.call(j.cats)==='[object Array]')?j.cats:[],
        questions:qs
      },null,2);
    }catch(e){}
    if(j&&qzStr(j.name)&&!document.getElementById('cbName').value.trim())document.getElementById('cbName').value=qzStr(j.name);
    if(j&&qzStr(j.subtitle))document.getElementById('cbSub').value=qzStr(j.subtitle);
    toast('已读取 '+qs.length+' 题，请检查后保存','ok');
  };
  rd.readAsText(f);
}
// 保存自定义题库（新建或编辑）：校验 → 归一化 → 落盘 → 失效缓存 → 刷新清单 → 自动切换
function qzSaveCustomBank(){
  if(sessionRole!=='parent')return;
  var name=document.getElementById('cbName').value.trim();
  if(!name){toast('请输入题库名称','err');return}
  var j=null;
  try{j=JSON.parse(document.getElementById('cbJson').value)}
  catch(e){toast('题目 JSON 解析失败，请检查格式','err');return}
  var qs=(j&&Object.prototype.toString.call(j.questions)==='[object Array]')?j.questions:[];
  if(!qs.length){toast('至少需要一道题目','err');return}
  var cats=(j&&Object.prototype.toString.call(j.cats)==='[object Array]')?j.cats:[];
  var maxCat=Math.max(0,cats.length-1);
  var norm=[];
  for(var i=0;i<qs.length;i++){
    var it=qs[i]||{};
    var c=(typeof it.cat==='number'&&it.cat>=0&&it.cat<=maxCat)?it.cat
        :((typeof it.c==='number'&&it.c>=0&&it.c<=maxCat)?it.c:0);
    norm.push({cat:c,title:qzStr(it.title!==undefined?it.title:it.t),
      question:qzStr(it.question!==undefined?it.question:it.q),
      answer:qzStr(it.answer!==undefined?it.answer:it.a)});
  }
  if(!norm[0].question){toast('第 1 题缺少 question 字段','err');return}
  var cs=qzCustomBanks();
  var id=qzEditBankCtx;
  var sub=document.getElementById('cbSub').value.trim();
  if(id){
    var hit=null;
    for(var k=0;k<cs.length;k++)if(String(cs[k].id)===id){hit=cs[k];break}
    if(hit){hit.name=name;hit.subtitle=sub;hit.cats=cats;hit.questions=norm}
    else id=''; // 编辑目标已不存在（其他入口删过）：转为新建
  }
  if(!id){
    id='custom_'+Date.now();
    cs.push({id:id,name:name,subtitle:sub,cats:cats,questions:norm});
  }
  qzSaveCustomBanks(cs);
  delete QZ_BANK_CACHE[id];
  cm('mBankEdit');
  toast('题库已保存（'+norm.length+' 题）','ok');
  qzLoadIndex().then(function(){
    var meta=qzBankMeta(id);
    if(meta)qzSwitchBank(id);
    else if(curTab==='quiz')qzShow();
  });
}
// 删除自定义题库：连带清掉该题库的进度/错题/剔除/复习数据；当前题库被删时回退第一套可用
function qzDeleteCustomBank(id){
  if(sessionRole!=='parent')return;
  var cs=qzCustomBanks(),name='',kept=[];
  for(var i=0;i<cs.length;i++){
    if(String(cs[i].id)===id)name=qzStr(cs[i].name);
    else kept.push(cs[i]);
  }
  sc2('删除题库','删除自定义题库「'+(name||id)+'」？其刷题进度与错题数据将一并清除。',function(){
    qzSaveCustomBanks(kept);
    try{ // 清掉该题库的账号级数据
      var store=qzAccStore();
      delete store.done[id];delete store.wrong[id];delete store.excluded[id];delete store.wrongMeta[id];
      qzSaveAccStore(store);
      if(ad){ad.quizDone=store.done;ad.quizWrong=store.wrong;ad.quizExcluded=store.excluded;ad.quizWrongMeta=store.wrongMeta;sd(ad)}
    }catch(e){}
    delete QZ_BANK_CACHE[id];
    var wasCurrent=qzBank&&qzBank.id===id;
    qzLoadIndex().then(function(){
      if(wasCurrent){
        var ids=[];
        for(var j=0;j<QZ_BANKS.length;j++)ids.push(QZ_BANKS[j].id);
        qzLoadSeq(ids,0).then(function(b){qzActivate(b||QZ_BUILTIN_BANK)});
      }else if(curTab==='quiz')qzShow();
      toast('题库已删除','ok');
      var mo=document.getElementById('mBank');
      if(mo&&mo.classList.contains('show'))qzRenderBankList(); // 列表开着则同步刷新
    });
  });
}
// 备份导入后刷新自定义题库清单；当前题库若已不存在则回退第一套可用
function qzRefreshCustomBanks(){
  qzLoadIndex().then(function(){
    if(qzBank&&qzBank.id!=='builtin'&&!qzBankMeta(qzBank.id)){
      var ids=[];
      for(var i=0;i<QZ_BANKS.length;i++)ids.push(QZ_BANKS[i].id);
      qzLoadSeq(ids,0).then(function(b){qzActivate(b||QZ_BUILTIN_BANK)});
      return;
    }
    if(curTab==='quiz')qzShow();
  });
}
