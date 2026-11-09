// UI strings: English and Simplified Chinese. Trip data (stop names, notes, labels) is
// shown as typed; only the app's own words, dates and times change with the language.
// No DOM access and no module state: callers pass `lang` ('en' | 'zh').

export const LANGS = ['en', 'zh'];
export const normLang = (l) => (LANGS.includes(l) ? l : 'en');

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const en = {
  htmlLang: 'en',
  wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  // "Tue 1 Dec", "Tue 1"
  longDate: (d) => `${en.wd[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`,
  shortDate: (d) => `${en.wd[d.getDay()]} ${d.getDate()}`,
  undated: 'Undated',
  today: 'Today', days: 'Days', trip: 'Trip',
  dayOf: (n, of) => `Day ${n} of ${of}`,
  showIn: (c) => `Show amounts in ${c}`,
  sync: 'Sync',
  openInMaps: 'Open in Maps', map: 'Map', mapsToHotel: 'Maps to hotel',
  sortSpends: 'Sort spends', oldest: 'Oldest', newest: 'Newest', amount: 'Amount',
  nothingSpent: 'Nothing spent yet.', spend: 'Spend',
  confirmDel: (amt, name) => `Delete ${amt} · ${name}?`,
  del: 'Delete', keep: 'Keep', delSpend: 'Delete spend',
  nextUp: 'Next up', allDone: 'All done for today', beOnTime: '⏱ be on time', done: 'Done',
  removeLink: 'Remove link', pasteLink: 'Paste a link (Google Drive, Trip.com…)',
  linkName: 'Name, e.g. Boarding pass', add: 'Add', addLink: '＋ Link',
  bookings: 'Bookings & files',
  fixedTitle: 'Fixed time (must make it)', delStop: 'Delete stop', time: 'Time', stop: 'Stop',
  nextFixed: 'Next fixed: ', fixed: 'Fixed: ',
  spentToday: 'Spent today', spent: 'Spent', edit: '✎ Edit',
  notes: 'Notes', notesPh: 'Notes for the day…', plan: 'Plan', todaysPlan: "Today's plan",
  date: 'Date', city: 'City', summary: 'Summary', summaryPh: 'One-line summary of the day',
  noStops: 'No stops yet.', addStop: 'Add a stop…', delDay: 'Delete day', tapAgain: 'Tap again to delete',
  spendFab: '＋ ¥ Spend', undo: 'Undo',
  close: 'Close', logSpend: 'Log a spend', amountYen: 'Amount in yen', save: 'Save',
  saveYen: (y) => `Save ${y}`, whatFor: 'What for? (optional)',
  noPlansToday: 'No plans today',
  nDays: (n) => plural(n, 'day', 'days'),
  daysToGo: (n) => `${en.nDays(n)} to go`,
  seeDays: 'See the days', tripComplete: 'Trip complete', amtSpent: (a) => `${a} spent`,
  tripSummary: 'Trip summary', noDays: 'No trip days yet',
  spentSoFar: 'Spent so far', byCategory: 'By category', spendsByDay: 'Spends by day',
  noSpends: 'No spends yet.', plansDone: (d, n) => `Plans done: ${d} of ${n}`,
  cat: { food: 'food', shopping: 'shopping', transport: 'transport', tickets: 'tickets', misc: 'miscellaneous' },
  catChip: { misc: 'misc' },
  link: 'Link',
  // fmtTime / fmtUntil / fmtRange
  time12: (h, mm) => `${h % 12 || 12}:${mm} ${h < 12 ? 'am' : 'pm'}`,
  now: 'now',
  inMin: (h, m) => (!h ? `in ${m} min` : m ? `in ${h} h ${m} min` : `in ${h} h`),
  range: (a, b) => {
    const D = (x) => `${x.d} ${MON[x.m - 1]}`;
    if (a.iso === b.iso) return `${D(a)} ${a.y}`;
    if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MON[a.m - 1]} ${a.y}`;
    if (a.y === b.y) return `${D(a)} – ${D(b)} ${a.y}`;
    return `${D(a)} ${a.y} – ${D(b)} ${b.y}`;
  },
  // app.js status line
  st: {
    syncing: 'Syncing…', synced: (t) => `Synced ${t}`,
    syncFailed: (m) => `Sync failed: ${m}. Changes are still saved on this device.`,
    needToken: 'Add a GitHub token in Sync settings (Trip → Settings) to sync.',
    unsynced: 'Unsynced changes on this device. Tap Sync to save to GitHub.',
    offline: 'Offline. Showing the copy on this phone.',
    lastSynced: (t) => `Last synced ${t}`,
    cantReach: (m) => `Couldn't reach GitHub (${m}). Showing this phone's copy.`,
    fetchingRate: 'Fetching rate…', rateFailed: 'Rate fetch failed; kept the saved rate.',
    rateUpdated: (h, r) => `Rate updated: 1 ${h} = ${r} JPY`,
    rateSaved: (h, r) => `Rate saved: 1 ${h} = ${r} JPY`, rateInvalid: 'Enter a rate above 0.',
    deleted: (a, w) => `Deleted ${a} (${w}).`, logged: (a) => `Logged ${a}.`,
    stopDeleted: (t) => `Deleted “${t}”.`,
    yenInvalid: 'Enter an amount in yen above 0.',
    badLink: 'No link found. Paste a link, e.g. https://drive.google.com/…',
    settingsSaved: 'Settings saved.',
    imported: 'Imported. Tap Sync to save to GitHub.', importFailed: (m) => `Import failed: ${m}`,
    updatedAt: (t) => `updated ${t}`,
  },
  // index.html (elements with data-i18n="key")
  page: {
    update: 'Updated, tap to reload', settings: 'Settings', saveRate: 'Save rate', fetchLatest: 'Fetch latest',
    export: 'Export JSON', import: 'Import JSON', reload: 'Reload from GitHub', syncSettings: 'Sync settings',
    owner: 'Repo owner', repo: 'Repo name', branch: 'Branch', path: 'Data file path',
    token: 'GitHub token (fine-grained, Contents: read & write, this repo only)',
    saveSettings: 'Save settings', tokenNote: 'The token is stored only in this browser (localStorage).',
  },
};

const ZWD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const zh = {
  htmlLang: 'zh-Hans',
  wd: ZWD,
  // "12月1日 周二", "1日 周二"
  longDate: (d) => `${d.getMonth() + 1}月${d.getDate()}日 ${ZWD[d.getDay()]}`,
  shortDate: (d) => `${d.getDate()}日 ${ZWD[d.getDay()]}`,
  undated: '未定日期',
  today: '今天', days: '日程', trip: '旅程',
  dayOf: (n, of) => `第 ${n} 天 / 共 ${of} 天`,
  showIn: (c) => `金额显示为 ${c}`,
  sync: '同步',
  openInMaps: '在地图中打开', map: '地图', mapsToHotel: '导航到酒店',
  sortSpends: '支出排序', oldest: '最早', newest: '最新', amount: '金额',
  nothingSpent: '还没有支出。', spend: '支出',
  confirmDel: (amt, name) => `删除 ${amt} · ${name}？`,
  del: '删除', keep: '保留', delSpend: '删除支出',
  nextUp: '下一项', allDone: '今天的安排都完成了', beOnTime: '⏱ 准时', done: '完成',
  removeLink: '移除链接', pasteLink: '粘贴链接（Google Drive、Trip.com…）',
  linkName: '名称，如：登机牌', add: '添加', addLink: '＋ 链接',
  bookings: '预订与文件',
  fixedTitle: '固定时间（必须赶上）', delStop: '删除行程', time: '时间', stop: '行程',
  nextFixed: '下一个固定行程：', fixed: '固定行程：',
  spentToday: '今日支出', spent: '支出', edit: '✎ 编辑',
  notes: '备注', notesPh: '当天的备注…', plan: '安排', todaysPlan: '今日安排',
  date: '日期', city: '城市', summary: '概要', summaryPh: '一句话概括这一天',
  noStops: '还没有行程。', addStop: '添加行程…', delDay: '删除这一天', tapAgain: '再点一次删除',
  spendFab: '＋ ¥ 记账', undo: '撤销',
  close: '关闭', logSpend: '记一笔支出', amountYen: '金额（日元）', save: '保存',
  saveYen: (y) => `保存 ${y}`, whatFor: '用途（可选）',
  noPlansToday: '今天没有安排',
  daysToGo: (n) => `还有 ${n} 天`,
  nDays: (n) => `${n} 天`,
  seeDays: '查看日程', tripComplete: '旅程结束', amtSpent: (a) => `共支出 ${a}`,
  tripSummary: '旅程总结', noDays: '还没有旅程日期',
  spentSoFar: '目前总支出', byCategory: '按类别', spendsByDay: '按天查看支出',
  noSpends: '还没有支出。', plansDone: (d, n) => `已完成安排：${d} / ${n}`,
  cat: { food: '餐饮', shopping: '购物', transport: '交通', tickets: '门票', misc: '其他' },
  catChip: {},
  link: '链接',
  time12: (h, mm) => `${h < 12 ? '上午' : '下午'}${h % 12 || 12}:${mm}`,
  now: '现在',
  inMin: (h, m) => (!h ? `${m} 分钟后` : m ? `${h} 小时 ${m} 分钟后` : `${h} 小时后`),
  range: (a, b) => {
    const D = (x) => `${x.m}月${x.d}日`;
    if (a.iso === b.iso) return `${a.y}年${D(a)}`;
    if (a.y === b.y && a.m === b.m) return `${a.y}年${D(a)}–${b.d}日`;
    if (a.y === b.y) return `${a.y}年${D(a)}–${D(b)}`;
    return `${a.y}年${D(a)}–${b.y}年${D(b)}`;
  },
  st: {
    syncing: '同步中…', synced: (t) => `已同步 ${t}`,
    syncFailed: (m) => `同步失败：${m}。更改仍保存在这台设备上。`,
    needToken: '请先在同步设置（旅程 → 设置）中添加 GitHub 令牌。',
    unsynced: '这台设备上有未同步的更改。点“同步”保存到 GitHub。',
    offline: '离线中，显示手机上的副本。',
    lastSynced: (t) => `上次同步 ${t}`,
    cantReach: (m) => `无法连接 GitHub（${m}），显示手机上的副本。`,
    fetchingRate: '正在获取汇率…', rateFailed: '获取汇率失败，保留原汇率。',
    rateUpdated: (h, r) => `汇率已更新：1 ${h} = ${r} JPY`,
    rateSaved: (h, r) => `汇率已保存：1 ${h} = ${r} JPY`, rateInvalid: '请输入大于 0 的汇率。',
    deleted: (a, w) => `已删除 ${a}（${w}）。`, logged: (a) => `已记录 ${a}。`,
    stopDeleted: (t) => `已删除“${t}”。`,
    yenInvalid: '请输入大于 0 的日元金额。',
    badLink: '没有找到链接。请粘贴链接，如 https://drive.google.com/…',
    settingsSaved: '设置已保存。',
    imported: '已导入。点“同步”保存到 GitHub。', importFailed: (m) => `导入失败：${m}`,
    updatedAt: (t) => `更新于 ${t}`,
  },
  page: {
    update: '有新版本，点此刷新', settings: '设置', saveRate: '保存汇率', fetchLatest: '获取最新',
    export: '导出 JSON', import: '导入 JSON', reload: '从 GitHub 重新加载', syncSettings: '同步设置',
    owner: '仓库所有者', repo: '仓库名称', branch: '分支', path: '数据文件路径',
    token: 'GitHub 令牌（细粒度，Contents：读写，仅限此仓库）',
    saveSettings: '保存设置', tokenNote: '令牌只保存在这个浏览器中（localStorage）。',
  },
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DICTS = { en, zh };
export const strings = (lang) => DICTS[normLang(lang)];
