const fs = require('fs');

// Load customer data
const customers = JSON.parse(fs.readFileSync('/root/.openclaw/workspace/sales-crm/customers.json', 'utf8'));

const today = new Date('2026-05-13');
const todayStr = today.toISOString().split('T')[0];

// Analyze customers
const overdueCustomers = [];
const todayFollowUps = [];
const upcomingFollowUps = [];

for (const c of customers) {
  const lastFollow = new Date(c.last_follow_date);
  const nextFollow = new Date(c.next_follow_date);
  const daysSinceLastFollow = Math.floor((today - lastFollow) / (1000 * 60 * 60 * 24));
  const daysOverdue = daysSinceLastFollow - c.follow_cycle_days;
  const isOverdue = daysOverdue > 0;

  const info = {
    ...c,
    daysSinceLastFollow,
    daysOverdue: isOverdue ? daysOverdue : 0,
    isOverdue
  };

  if (isOverdue) {
    overdueCustomers.push(info);
  } else if (nextFollow.toISOString().split('T')[0] <= todayStr) {
    todayFollowUps.push(info);
  } else {
    upcomingFollowUps.push(info);
  }
}

// Sort overdue by severity
overdueCustomers.sort((a, b) => b.daysOverdue - a.daysOverdue);

// Calculate total estimated amount
const totalPipeline = customers.reduce((sum, c) => sum + (c.estimated_amount || 0), 0);
const overduePipeline = overdueCustomers.reduce((sum, c) => sum + (c.estimated_amount || 0), 0);

// Generate report
let report = `═══════════════════════════════════════════
📢 销售督导官 - 晨间提醒
日期：2026年5月13日（周三）08:40
═══════════════════════════════════════════

【📊 客户总览】
• 客户总数：${customers.length} 家
• 总预估金额：${totalPipeline} 万元
• 逾期客户：${overdueCustomers.length} 家（${overdueCustomers.length === customers.length ? '⚠️ 全部逾期' : ''}）
• 逾期金额：${overduePipeline} 万元

【🔴 逾期预警 - ${overdueCustomers.length}家客户超过跟进周期】
`;

if (overdueCustomers.length === 0) {
  report += '暂无逾期客户，状态良好 👍\n';
} else {
  for (const c of overdueCustomers) {
    const levelEmoji = c.level === 'A' ? '🔴' : c.level === 'B' ? '🟠' : '🟡';
    report += `\n${levelEmoji} ${c.name}（${c.level}级）
   负责人：${c.owner} | 预估：${c.estimated_amount}万
   最后跟进：${c.last_follow_date}（已${c.daysSinceLastFollow}天）
   跟进周期：${c.follow_cycle_days}天 | ⚠️ 逾期 ${c.daysOverdue} 天
   状态：${c.status} | 联系人：${c.contact} ${c.phone}
   备注：${c.notes}\n`;
  }
}

report += `
【📅 今日计划跟进】
`;

// All customers are overdue, so technically none are "on schedule"
// But we suggest prioritizing by estimated amount and level
const priorityCustomers = [...customers].sort((a, b) => {
  if (a.level !== b.level) {
    const levelOrder = { 'A': 0, 'B': 1, 'C': 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  }
  return b.estimated_amount - a.estimated_amount;
});

report += `基于客户优先级和预估金额，建议今日跟进顺序：\n\n`;

let idx = 1;
for (const c of priorityCustomers) {
  const overdueInfo = overdueCustomers.find(o => o.id === c.id);
  const overdueTag = overdueInfo ? ` ⚠️逾期${overdueInfo.daysOverdue}天` : '';
  report += `${idx}. ${c.name}（${c.level}级）- ${c.owner}
   预估金额：${c.estimated_amount}万 | 状态：${c.status}${overdueTag}
   联系人：${c.contact} ${c.phone}
   建议动作：`;

  if (c.status === '待签约') {
    report += '🔥 紧急催签，今日必须推进签约流程';
  } else if (c.status === '商务谈判') {
    report += '💰 推进商务条款确认';
  } else if (c.status === '方案确认') {
    report += '📋 确认方案反馈，推进下一步';
  } else if (c.status === '技术对接') {
    report += '🔧 安排技术会议或方案演示';
  } else if (c.status === '价格谈判') {
    report += '💵 确认价格方案，争取达成一致';
  } else {
    report += '📞 电话/拜访跟进';
  }
  report += '\n';
  idx++;
}

report += `
【📌 今日必做清单】
`;

// Priority A customers
const priorityA = priorityCustomers.filter(c => c.level === 'A');
for (const c of priorityA) {
  const overdueInfo = overdueCustomers.find(o => o.id === c.id);
  report += `□ ${c.name}（${c.owner}）- ${c.estimated_amount}万 ${overdueInfo ? '⚠️逾期' + overdueInfo.daysOverdue + '天' : ''}\n`;
}

report += `
【⚡ 紧急提醒】
• CRM数据最后更新：2026年4月15日，距今已 28 天未更新
• 所有客户跟进记录均已过时，数据严重滞后
• 建议：立即与团队确认实际跟进情况，更新CRM数据

【📈 销售目标进度】
• 本月目标：待确认（需人工填入）
• 本月已签约：待确认（需人工填入）
• 重点大单：广州智慧城市 420万（待签约状态）

═══════════════════════════════════════════
🤖 本提醒由销售督导官自动生成
⏰ 每日08:30自动推送
💡 如需更新客户数据，请修改 sales-crm/customers.json
═══════════════════════════════════════════
`;

// Save report
const reportDir = '/root/.openclaw/workspace/reports';
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const txtPath = `${reportDir}/sales-morning-reminder-${todayStr}.txt`;
const mdPath = `${reportDir}/sales-morning-reminder-${todayStr}.md`;

fs.writeFileSync(txtPath, report);

// Markdown version
const markdownReport = report
  .replace(/═/g, '=')
  .replace(/📢/g, '## 📢')
  .replace(/【📊 客户总览】/g, '### 📊 客户总览')
  .replace(/【🔴 逾期预警 - /g, '### 🔴 逾期预警 - ')
  .replace(/【📅 今日计划跟进】/g, '### 📅 今日计划跟进')
  .replace(/【📌 今日必做清单】/g, '### 📌 今日必做清单')
  .replace(/【⚡ 紧急提醒】/g, '### ⚡ 紧急提醒')
  .replace(/【📈 销售目标进度】/g, '### 📈 销售目标进度');

fs.writeFileSync(mdPath, markdownReport);

console.log('✅ 晨间提醒已生成');
console.log(`📄 纯文本版：${txtPath}`);
console.log(`📄 Markdown版：${mdPath}`);
console.log(`\n${report}`);
