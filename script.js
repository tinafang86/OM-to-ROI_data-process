/**
 * ==========================================
 * 【手動調整區】!新增指標改這裡!
 * ==========================================
 */
const CONFIG = {
    // 1. 定義 CSV 產出的指標與順序
    TARGET_METRICS: {
        spend: "Spend(TWD)",
        imp: "Impressions",
        click: "Clicks",
        views: "Views",
        grp: "GRP",
        reach: "Reach",
        leads: "Lead",
        tvr: "TVR"
    },

    // 2. 指標關鍵字比對 (標題只要包含這些字眼就會被分類)
    METRIC_KEYWORDS: {
        "spend": "spend",
        "cost": "spend",
        "imp": "imp",
        "click": "click",
        "view": "views",
        "grp": "grp",
        "reach": "reach",
        "lead": "leads",
        "tvr": "tvr"
    }
};

/**
 * ==========================================
 * 核心邏輯區
 * ==========================================
 */
const fileInput = document.getElementById('fileInput');
const statusDiv = document.getElementById('status');

// 監聽檔案上傳
fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: function (results) {
            try {
                processData(results.data);
            } catch (err) {
                console.error(err);
                showStatus("錯誤: " + err.message, 'error');
            }
        }
    });
});

function showStatus(msg, type) {
    statusDiv.innerText = msg;
    statusDiv.className = type;
}

function processData(data) {
    if (!data || data.length < 2) throw new Error("檔案內容不足");

    const headers = data[0].map(h => h.trim().toLowerCase());
    const rows = data.slice(1);

    // 1. 尋找日期欄位
    const dateColIndex = headers.findIndex(h =>
        h.includes("week") || h.includes("日期") || h.includes("date")
    );
    if (dateColIndex === -1) throw new Error("找不到日期欄位 (標題需含 'week', '日期' 或 'date')");

    // 2. 解析媒體與指標對應
    const mediaGroups = {};
    const metricIds = Object.keys(CONFIG.TARGET_METRICS);
    const keywords = Object.keys(CONFIG.METRIC_KEYWORDS);

    headers.forEach((h, colIndex) => {
        if (colIndex === dateColIndex) return;

        // 偵測指標
        let foundMetricId = null;
        for (const kw of keywords) {
            if (h.includes(kw)) {
                foundMetricId = CONFIG.METRIC_KEYWORDS[kw];
                break;
            }
        }

        if (!foundMetricId) return;

        // 提取媒體名稱 (移除標題中的指標關鍵字)
        let mediaName = h;
        keywords.forEach(kw => {
            if (h.includes(kw)) {
                mediaName = mediaName.replace(`_${kw}`, "").replace(kw, "");
            }
        });
        mediaName = mediaName.replace(/^_+|_+$/g, ''); // 清理前後底線

        if (!mediaGroups[mediaName]) mediaGroups[mediaName] = {};
        mediaGroups[mediaName][foundMetricId] = colIndex;
    });

    if (Object.keys(mediaGroups).length === 0) {
        throw new Error("無法辨識媒體指標，請檢查標題是否包含 spend, imp, click 等關鍵字");
    }

    // 3. 組合 Output 數據
    const outputHeaders = ["Date", "Media", ...Object.values(CONFIG.TARGET_METRICS)];
    const output = [outputHeaders];

    rows.forEach(row => {
        const dateValue = row[dateColIndex];
        if (!dateValue) return;

        Object.keys(mediaGroups).forEach(media => {
            const m = mediaGroups[media];
            const rowData = [dateValue, media];

            metricIds.forEach(id => {
                const colIdx = m[id];
                rowData.push(getMetricValue(row, colIdx));
            });
            output.push(rowData);
        });
    });

    // 4. 下載檔案
    const csvContent = Papa.unparse(output);
    downloadCSV(csvContent, `ROI_Media_${new Date().toISOString().split('T')[0]}.csv`);
    showStatus(`✅ 轉換成功！偵測到 ${Object.keys(mediaGroups).length} 個媒體渠道。`, 'success');
}

function getMetricValue(row, colIndex) {
    if (colIndex === undefined || row[colIndex] === undefined) return 0;
    // 移除千分位逗號並轉為數字
    const v = row[colIndex].toString().replace(/,/g, "");
    return v === "" || isNaN(v) ? 0 : Number(v);
}

function downloadCSV(content, filename) {
    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}