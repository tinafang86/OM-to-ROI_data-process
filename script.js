/**
 * ==========================================
 * 【手動調整區】這裡決定你要抓什麼、產出什麼
 * ==========================================
 */
const CONFIG = {
    // 1. 定義 CSV 產出的欄位與標題名稱
    // 順序決定了產出 CSV 的欄位順序
    TARGET_METRICS: {
        spend: "Spend(TWD)",
        imp: "Impressions",
        click: "Clicks",
        views: "Views",
        grp: "GRP"
    },

    // 2. 定義「指標後綴」的判斷規則 (這就是你說的：抓取前面名稱的依據)
    // 格式： "原始欄位結尾出現的字": "對應到上面的哪個內部ID"
    // 只要標題是以「_加上這些字」結尾，前面全部都會被當作 Media Type
    METRIC_MAPPING: {
        "spend": "spend",
        "cost": "spend",
        "imp": "imp",
        "impression": "imp",
        "impressions": "imp",
        "click": "click",
        "clicks": "click",
        "view": "views",
        "views": "views",
        "grp": "grp"
    }
};

/**
 * ==========================================
 * 核心邏輯區 (自動化抓取邏輯)
 * ==========================================
 */

function processData(data) {
    const headers = data[0].map(h => h.trim());
    const rows = data.slice(1);

    // 1. 定位日期欄位
    const dateColIndex = headers.findIndex(h =>
        h.toLowerCase().includes("week") || h.includes("日期")
    );
    if (dateColIndex === -1) throw new Error("找不到日期欄位 (需包含 week 或 日期)");

    const mediaGroups = {};
    const metricMappingKeys = Object.keys(CONFIG.METRIC_MAPPING);

    // 2. 動態解析媒體名稱與指標
    headers.forEach((header, colIndex) => {
        const h = header.toLowerCase();

        let foundMetricKey = null;
        let matchedSuffix = "";

        // 核心邏輯：從定義好的 Mapping 中找尋匹配的「結尾」
        for (const key of metricMappingKeys) {
            if (h.endsWith("_" + key)) { // 判斷是否為 "_指標" 結尾
                foundMetricKey = CONFIG.METRIC_MAPPING[key];
                matchedSuffix = "_" + key; // 記錄這段後綴，等等要切掉它
                break;
            }
        }

        // 如果符合指標格式，就抓取前面剩餘的部分當作 Media Name
        if (foundMetricKey) {
            // 抓取前面的全部名稱：例如 "meta_awn_spend" 切掉 "_spend" 變成 "meta_awn"
            const mediaName = h.substring(0, h.lastIndexOf(matchedSuffix));

            if (!mediaGroups[mediaName]) mediaGroups[mediaName] = {};
            mediaGroups[mediaName][foundMetricKey] = colIndex;
        }
    });

    if (Object.keys(mediaGroups).length === 0) throw new Error("未偵測到任何符合格式的欄位");

    // 3. 產出資料 (Long Format)
    const metricKeys = Object.keys(CONFIG.TARGET_METRICS);
    const outputHeaders = ["Date", "Media", ...Object.values(CONFIG.TARGET_METRICS)];
    const output = [outputHeaders];

    rows.forEach(row => {
        const dateValue = row[dateColIndex];
        if (!dateValue) return;

        Object.keys(mediaGroups).forEach(media => {
            const m = mediaGroups[media];
            const rowData = [dateValue, media];

            // 根據定義的指標順序填入數值
            metricKeys.forEach(key => {
                rowData.push(getMetricValue(row, m[key]));
            });
            output.push(rowData);
        });
    });

    // 4. 轉換與下載
    const csvContent = Papa.unparse(output);
    downloadCSV(csvContent, `ROI_Media_${new Date().toISOString().split('T')[0]}.csv`);
}

// 輔助函式：數值清洗
function getMetricValue(row, colIndex) {
    if (colIndex === undefined || row[colIndex] === undefined) return 0;
    const v = row[colIndex].toString().replace(/,/g, "");
    return v === "" || isNaN(v) ? 0 : Number(v);
}

// 輔助函式：下載 CSV (含 BOM 防亂碼)
function downloadCSV(content, filename) {
    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// 監聽檔案上傳 (其餘 UI 邏輯同前)
document.getElementById('fileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (r) => { try { processData(r.data); } catch (e) { alert(e.message); } }
    });
});