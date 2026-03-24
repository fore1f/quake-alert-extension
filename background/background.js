/**
 * QuakeAlert Background Script (Service Worker)
 * P2PQuake APIを利用して最新の地震情報と緊急地震速報(EEW)を取得します。
 */

// /history エンドポイントを使用して地震情報(551)と緊急地震速報(554, 556)をまとめて取得
const API_URL = 'https://api.p2pquake.net/v2/history?limit=10&codes=551&codes=554&codes=556';
const ALARM_NAME = 'checkQuake';
const CHECK_INTERVAL_SEC = 20; // 20秒間隔（APIのレート制限に配慮）

chrome.runtime.onInstalled.addListener(() => {
  console.log('QuakeAlert Extension installed with EEW support.');
  checkQuakeInfo();
  // アラームは分単位なので、高頻度ポーリングのためにsetTimeout/alarmsを組み合わせるか
  // シンプルに1分間隔にするか。ここではAPI制限を守りつつ高頻度にするため
  // MV3では1分未満のアラームが制限される場合があるため、1分に設定しつつ
  // 初回実行時にループを開始する手法を検討
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkQuakeInfo();
  }
});

// メッセージを受け取ってテストを実行
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'test-eew') {
    const mockEEW = {
      code: 556,
      id: 'test-' + Date.now(),
      earthquake: {
        hypocenter: { name: 'テスト震源地' },
        maxScale: 55, // 震度6弱
        time: '202X/XX/XX XX:XX'
      }
    };
    showEEWNotification(mockEEW);
  }
});

/**
 * 情報を取得して新着があれば通知する
 */
async function checkQuakeInfo() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('API fetch failed');
    
    const data = await response.json();
    if (!data || data.length === 0) return;

    const latest = data[0];
    const { lastId } = await chrome.storage.local.get('lastId');

    // 新着チェック
    if (latest.id !== lastId) {
      processNewInfo(latest);
      
      // ストレージを更新
      await chrome.storage.local.set({ 
        lastId: latest.id,
        latestData: data // 全データを保存
      });
    }
  } catch (error) {
    console.error('Error checking quake/eew info:', error);
  }
}

/**
 * 新着情報の種類に応じて通知を出し分ける
 */
function processNewInfo(item) {
  if (item.code === 551) {
    // 地震情報 (発生後)
    showQuakeNotification(item);
  } else if (item.code === 554 || item.code === 556) {
    // 緊急地震速報 (EEW)
    showEEWNotification(item);
  }
}

/**
 * 緊急地震速報 (EEW) の通知
 */
function showEEWNotification(eew) {
  const isWarning = eew.code === 556;
  const title = isWarning ? '【緊急地震速報（警報）】' : '【緊急地震速報（予報）】';
  const place = eew.earthquake?.hypocenter?.name || '不明';
  const maxIntensity = eew.earthquake?.maxScale || '不明';
  
  chrome.notifications.create(eew.id, {
    type: 'basic',
    iconUrl: '../icons/icon.png',
    title: title,
    message: `強い揺れに警戒してください。\n震源地: ${place}\n想定最大震度: ${translateScale(maxIntensity)}`,
    priority: 2,
    requireInteraction: true // ユーザーが閉じるまで表示
  });
}

/**
 * 地震情報の通知
 */
function showQuakeNotification(quake) {
  const place = quake.earthquake.hypocenter.name || '不明';
  const intensity = quake.earthquake.maxScale || '不明';
  
  chrome.notifications.create(quake.id, {
    type: 'basic',
    iconUrl: '../icons/icon.png',
    title: `【地震情報】最大震度 ${translateScale(intensity)}`,
    message: `震源地: ${place}\nマグニチュード: ${quake.earthquake.magnitude || '-'}`,
    priority: 1
  });
}

/**
 * P2PQuakeの震度数値を日本語に変換
 */
function translateScale(scale) {
  const scaleMap = {
    10: '1', 20: '2', 30: '3', 40: '4', 
    45: '5弱', 50: '5強', 55: '6弱', 60: '6強', 70: '7'
  };
  return scaleMap[scale] || '調査中';
}
