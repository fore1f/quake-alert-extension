/**
 * QuakeAlert Popup JavaScript
 * 保存された情報（地震情報・EEW）を表示します。
 */

document.addEventListener('DOMContentLoaded', async () => {
    const { latestData } = await chrome.storage.local.get('latestData');
    
    if (latestData && latestData.length > 0) {
        renderData(latestData);
    } else {
        fetchAndRender();
    }

    console.log('Popup loaded, setting up test buttons...');
    // テストボタンのイベント
    const testBtn = document.getElementById('test-btn');
    const testInvBtn = document.getElementById('test-inv-btn');

    if (testBtn) {
        testBtn.addEventListener('click', () => {
            console.log('EEW test button clicked');
            chrome.runtime.sendMessage({ action: 'test-eew' });
        });
    }
    if (testInvBtn) {
        testInvBtn.addEventListener('click', () => {
            console.log('Investigating test button clicked');
            chrome.runtime.sendMessage({ action: 'test-investigating' });
        });
    }
});

async function fetchAndRender() {
    const API_URL = 'https://api.p2pquake.net/v2/history?limit=10&codes=551&codes=554&codes=556';
    try {
        console.log('Fetching:', API_URL);
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        renderData(data);
    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('quake-list').innerHTML = `
            <div class="error" style="color: #ff4d4d; text-align: center; padding: 20px;">
                データ取得に失敗しました<br>
                <small>${error.message}</small>
            </div>`;
    }
}

function renderData(items) {
    const list = document.getElementById('quake-list');
    list.innerHTML = '';

    items.forEach(item => {
        const card = document.createElement('div');
        
        // EEWか地震情報かでスタイルやラベルを分ける
        const isEEW = item.code === 554 || item.code === 556;
        const typeLabel = isEEW ? (item.code === 556 ? '緊急速報(警報)' : '緊急速報(予報)') : '地震情報';
        
        card.className = `quake-card ${isEEW ? 'eew-card' : ''}`;

        const intensity = item.earthquake?.maxScale || 0;
        const scaleStr = translateScale(intensity);

        card.innerHTML = `
            <div class="quake-header">
                <div>
                    <span class="type-tag ${isEEW ? 'tag-eew' : 'tag-info'}">${typeLabel}</span>
                    <p class="quake-place">${item.earthquake?.hypocenter?.name || '調査中'}</p>
                </div>
                <div class="intensity-badge intensity-${intensity}">震度 ${scaleStr}</div>
            </div>
            <p class="quake-info">
                ${isEEW ? '強い揺れに警戒してください' : `マグニチュード: ${item.earthquake?.hypocenter?.magnitude || '-'}`}
            </p>
            <p class="quake-time">${item.earthquake?.time || '-'}</p>
        `;
        list.appendChild(card);
    });
}

function translateScale(scale) {
    const scaleMap = {
        10: '1', 20: '2', 30: '3', 40: '4', 
        45: '5弱', 50: '5強', 55: '6弱', 60: '6強', 70: '7'
    };
    return scaleMap[scale] || '-';
}
