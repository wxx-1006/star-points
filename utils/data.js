// utils/data.js - 数据管理
const STORAGE_KEY = 'starPointsData';

// 默认加分项
const defaultUpItems = [
  { id: 'up_1', name: '按时完成作业', score: 5, category: '学习' },
  { id: 'up_2', name: '完成额外作业', score: 5, category: '学习', unit: '项' },
  { id: 'up_3', name: '作业全对/优秀', score: 10, category: '学习' },
  { id: 'up_4', name: '被老师表扬', score: 10, category: '学习' },
  { id: 'up_5', name: '主动预习', score: 5, category: '学习' },
  { id: 'up_6', name: '主动复习', score: 5, category: '学习' },
  { id: 'up_7', name: '阅读课外书(≥20分钟)', score: 8, category: '学习' },
  { id: 'up_8', name: '读完一本书并分享', score: 15, category: '学习' },
  { id: 'up_9', name: '学会新技能并分享', score: 10, category: '学习' },
  { id: 'up_10', name: '考试进步', score: 15, category: '学习' },
  { id: 'up_11', name: '考试满分/前3名', score: 20, category: '学习' },
  { id: 'up_12', name: '背课文/单词达标', score: 5, category: '学习' },
  { id: 'up_13', name: '练字认真(≥15分钟)', score: 5, category: '学习' },
  { id: 'up_14', name: '整理错题本', score: 8, category: '学习' },
  { id: 'up_15', name: '按时起床(不赖床)', score: 3, category: '生活' },
  { id: 'up_16', name: '自己穿衣', score: 5, category: '生活' },
  { id: 'up_17', name: '自己刷牙洗脸', score: 3, category: '生活' },
  { id: 'up_18', name: '自己整理书包', score: 5, category: '生活' },
  { id: 'up_19', name: '整理书桌', score: 5, category: '生活' },
  { id: 'up_20', name: '收拾玩具/房间', score: 5, category: '生活' },
  { id: 'up_21', name: '自己叠被子', score: 3, category: '生活' },
  { id: 'up_22', name: '按时上床睡觉', score: 3, category: '生活' },
  { id: 'up_23', name: '独立睡觉', score: 10, category: '生活' },
  { id: 'up_24', name: '好好吃饭(不挑食)', score: 5, category: '饮食' },
  { id: 'up_25', name: '主动喝水(≥4杯)', score: 3, category: '饮食' },
  { id: 'up_26', name: '光盘行动', score: 3, category: '饮食' },
  { id: 'up_27', name: '尝试新食物', score: 8, category: '饮食' },
  { id: 'up_28', name: '饭后收拾碗筷', score: 3, category: '饮食' },
  { id: 'up_29', name: '主动说礼貌用语', score: 3, category: '品德' },
  { id: 'up_30', name: '分享玩具/食物', score: 5, category: '品德' },
  { id: 'up_31', name: '诚实承认错误', score: 10, category: '品德' },
  { id: 'up_32', name: '帮助家人', score: 5, category: '品德' },
  { id: 'up_33', name: '帮助同学/朋友', score: 8, category: '品德' },
  { id: 'up_34', name: '耐心等待不插队', score: 3, category: '品德' },
  { id: 'up_35', name: '控制情绪不哭闹', score: 10, category: '品德' },
  { id: 'up_36', name: '遵守约定/规则', score: 5, category: '品德' },
  { id: 'up_37', name: '主动道歉', score: 5, category: '品德' },
  { id: 'up_38', name: '爱护公共物品', score: 5, category: '品德' },
  { id: 'up_39', name: '户外运动≥30分钟', score: 8, category: '运动' },
  { id: 'up_40', name: '户外运动≥1小时', score: 12, category: '运动' },
  { id: 'up_41', name: '认真做眼保健操', score: 3, category: '运动' },
  { id: 'up_42', name: '注意护眼', score: 3, category: '运动' },
  { id: 'up_43', name: '学会新运动技能', score: 15, category: '运动' },
  { id: 'up_44', name: '按约定时间使用电子产品', score: 3, category: '电子产品' },
  { id: 'up_45', name: '到点主动关掉平板', score: 5, category: '电子产品' },
  { id: 'up_46', name: '练习乐器≥20分钟', score: 8, category: '兴趣' },
  { id: 'up_47', name: '练习乐器≥40分钟', score: 12, category: '兴趣' },
  { id: 'up_48', name: '完成一幅画', score: 10, category: '兴趣' },
  { id: 'up_49', name: '完成手工/搭建作品', score: 15, category: '兴趣' },
  { id: 'up_50', name: '兴趣班表现积极', score: 5, category: '兴趣' },
  { id: 'up_51', name: '兴趣班获奖/表扬', score: 15, category: '兴趣' },
  { id: 'up_52', name: '主动创作', score: 10, category: '兴趣' },
  { id: 'up_53', name: '帮忙摆碗筷', score: 3, category: '家务' },
  { id: 'up_54', name: '帮忙收碗筷/擦桌子', score: 5, category: '家务' },
  { id: 'up_55', name: '帮忙择菜/洗菜', score: 5, category: '家务' },
  { id: 'up_56', name: '帮忙扫地/拖地', score: 8, category: '家务' },
  { id: 'up_57', name: '帮忙倒垃圾', score: 3, category: '家务' },
  { id: 'up_58', name: '帮忙晾/收衣服', score: 5, category: '家务' },
  { id: 'up_59', name: '帮忙浇花', score: 3, category: '家务' },
  { id: 'up_60', name: '照顾宠物', score: 8, category: '家务' },
  { id: 'up_61', name: '整理衣柜/叠衣服', score: 10, category: '家务' },
  { id: 'up_62', name: '帮忙洗车', score: 10, category: '家务' },
];

// 默认扣分项
const defaultDownItems = [
  { id: 'down_1', name: '赖床/叫多次不起', score: 3, category: '生活' },
  { id: 'down_2', name: '挑食/只吃喜欢的菜', score: 3, category: '饮食' },
  { id: 'down_3', name: '吃饭拖拉(>40分钟)', score: 5, category: '饮食' },
  { id: 'down_4', name: '浪费食物', score: 5, category: '饮食' },
  { id: 'down_5', name: '饭前吃零食', score: 5, category: '饮食' },
  { id: 'down_6', name: '不做眼保健操', score: 3, category: '运动' },
  { id: 'down_7', name: '一整天不运动', score: 5, category: '运动' },
  { id: 'down_8', name: '坐姿不对提醒不改', score: 3, category: '运动' },
  { id: 'down_9', name: '电子产品超时', score: 5, category: '电子产品' },
  { id: 'down_10', name: '到点不关还讨价还价', score: 8, category: '电子产品' },
  { id: 'down_11', name: '偷玩电子产品', score: 10, category: '电子产品' },
  { id: 'down_12', name: '发脾气/摔东西', score: 8, category: '品德' },
  { id: 'down_13', name: '说粗话/骂人', score: 8, category: '品德' },
  { id: 'down_14', name: '撒谎/隐瞒', score: 10, category: '品德' },
  { id: 'down_15', name: '未经允许拿别人东西', score: 8, category: '品德' },
  { id: 'down_16', name: '欺负弟弟妹妹/同学', score: 10, category: '品德' },
  { id: 'down_17', name: '缺勤兴趣班(无正当理由)', score: 5, category: '兴趣' },
];

// 默认兑换项
const defaultShopItems = [
  { id: 'shop_1', name: '看动画片30分钟', cost: 15, icon: '📺', desc: '周末可用' },
  { id: 'shop_2', name: '选今晚的晚餐菜', cost: 20, icon: '🍳', desc: '有一定决定权' },
  { id: 'shop_3', name: '多玩15分钟平板', cost: 20, icon: '📱', desc: '在基础时间上加' },
  { id: 'shop_4', name: '买小零食/小玩具(≤10元)', cost: 25, icon: '🍬', desc: '超市自选' },
  { id: 'shop_5', name: '选睡前故事', cost: 10, icon: '📖', desc: '从书架上自己选' },
  { id: 'shop_6', name: '决定周末早餐', cost: 15, icon: '🥐', desc: '披萨/煎饼/三明治等' },
  { id: 'shop_7', name: '晚睡30分钟(周末)', cost: 20, icon: '🌙', desc: '周末特例' },
  { id: 'shop_8', name: '选全家电影', cost: 25, icon: '🎬', desc: '家庭电影夜' },
  { id: 'shop_9', name: '买一本喜欢的书', cost: 50, icon: '📚', desc: '书店/网店自选' },
  { id: 'shop_10', name: '买小玩具(≤30元)', cost: 80, icon: '🧸', desc: '生日/节日除外' },
  { id: 'shop_11', name: '去游乐场玩一次', cost: 100, icon: '🎢', desc: '周末家庭活动' },
  { id: 'shop_12', name: '邀请好朋友来玩', cost: 60, icon: '👫', desc: '需要提前约定' },
  { id: 'shop_13', name: '买贴纸/盲盒', cost: 40, icon: '🎯', desc: '文具店自选' },
  { id: 'shop_14', name: '去肯德基/麦当劳', cost: 70, icon: '🍟', desc: '全家一起' },
  { id: 'shop_15', name: '买彩笔/画具', cost: 60, icon: '🎨', desc: '美术用品' },
  { id: 'shop_16', name: '去儿童乐园', cost: 90, icon: '🏰', desc: '室内蹦床/淘气堡' },
  { id: 'shop_17', name: '买大玩具(≤100元)', cost: 300, icon: '🎁', desc: '需要提前申请' },
  { id: 'shop_18', name: '去动物园/科技馆', cost: 200, icon: '🦁', desc: '全家出行' },
  { id: 'shop_19', name: '去水上乐园', cost: 250, icon: '🏊', desc: '夏季限定' },
  { id: 'shop_20', name: '买乐高/拼装玩具', cost: 350, icon: '🧩', desc: '按预算调整' },
  { id: 'shop_21', name: '旅行选择权', cost: 500, icon: '✈️', desc: '参与目的地决策' },
  { id: 'shop_22', name: '实现一个小愿望', cost: 400, icon: '🌟', desc: '合理范围内' },
  { id: 'shop_23', name: '买运动鞋/新衣服', cost: 280, icon: '👟', desc: '商场自选' },
  { id: 'shop_24', name: '参加付费体验课', cost: 200, icon: '🔬', desc: '陶艺/烘焙/科学实验' },
];

const categoryIcons = {
  '学习': '📚', '生活': '🏠', '饮食': '🍽️', '品德': '❤️',
  '运动': '🏃', '电子产品': '📱', '兴趣': '🎨', '家务': '🧹'
};

function getDefaultData() {
  return {
    totalPoints: 0,
    records: [],
    exchanges: [],
    upItems: JSON.parse(JSON.stringify(defaultUpItems)),
    downItems: JSON.parse(JSON.stringify(defaultDownItems)),
    shopItems: JSON.parse(JSON.stringify(defaultShopItems)),
  };
}

function loadData() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return getDefaultData();
}

function saveData(data) {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return d.getFullYear() + '年' + months[d.getMonth()] + d.getDate() + '日 ' + days[d.getDay()];
}

function formatDateTime(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// 获取本周7天数据
function getWeekData(records) {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);

  const result = [];
  const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    const ds = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
    const dayRecords = records.filter(r => r.date === ds);
    const dayNet = dayRecords.reduce((s, r) => s + r.score, 0);
    result.push({
      label: dayLabels[i],
      date: ds,
      score: dayNet,
      hasData: dayRecords.length > 0,
      isToday: ds === today()
    });
  }
  return result;
}

// 计算连续天数
function getStreak(records) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hasRecord = records.some(r => r.date === ds);
    if (hasRecord) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

module.exports = {
  STORAGE_KEY, defaultUpItems, defaultDownItems, defaultShopItems,
  categoryIcons, getDefaultData, loadData, saveData, today,
  formatDate, formatDateTime, getWeekData, getStreak
};
