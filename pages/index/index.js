// pages/index/index.js
const { loadData, saveData, today, formatDate, getWeekData, getStreak, categoryIcons } = require('../../utils/data');

Page({
  data: {
    totalPoints: 0,
    todayNet: 0,
    todayUp: 0,
    todayDown: 0,
    streak: 0,
    weekData: [],
    quickActions: [],
    todayRecords: [],
    headerDate: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const appData = loadData();
    const todayStr = today();
    const todayRecords = appData.records.filter(r => r.date === todayStr);
    const todayUp = todayRecords.filter(r => r.score > 0).reduce((s, r) => s + r.score, 0);
    const todayDown = todayRecords.filter(r => r.score < 0).reduce((s, r) => s + Math.abs(r.score), 0);
    const todayNet = todayUp - todayDown;

    // 快捷操作（前6个加分项）
    const quickActions = appData.upItems.slice(0, 6).map(item => ({
      ...item,
      icon: categoryIcons[item.category] || '⭐'
    }));

    this.setData({
      totalPoints: appData.totalPoints,
      todayNet,
      todayUp,
      todayDown,
      streak: getStreak(appData.records),
      weekData: getWeekData(appData.records),
      quickActions,
      todayRecords: todayRecords.slice().reverse(),
      headerDate: formatDate(todayStr)
    });
  },

  // 打开加分弹窗
  openScore(e) {
    const itemId = e.currentTarget.dataset.id;
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage.scoreModal) {
      currentPage.scoreModal.open('up', itemId);
    }
  },

  // 删除记录
  deleteRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    const appData = loadData();
    const record = appData.records.find(r => r.id === recordId);
    if (!record) return;

    wx.showModal({
      title: '删除记录',
      content: `删除「${record.name}」(${record.score > 0 ? '+' : ''}${record.score}分)？`,
      success: (res) => {
        if (res.confirm) {
          appData.totalPoints -= record.score;
          appData.records = appData.records.filter(r => r.id !== recordId);
          saveData(appData);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.refresh();
        }
      }
    });
  },

  // 加分成功回调
  onScoreSuccess() {
    this.refresh();
  }
})
