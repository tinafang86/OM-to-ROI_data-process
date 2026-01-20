/**
 * ==========================================
 * 【手動調整區】!新增指標改這裡!
 * ==========================================
 */
const CONFIG = {
    // 1. 定義你想要產出的指標與順序 (對應 CSV 的標題列)
    // 格式：{ 內部ID: "CSV顯示的標題名稱" }
    TARGET_METRICS: {
        spend: "Spend(TWD)",
        imp: "Impressions",
        click: "Clicks",
        views: "Views",
        grp: "GRP"
    },

    // 2. 指標名稱正規化 (Mapping)
    // 系統會自動抓取底線後的字串，並比對下方清單轉換為內部ID
    METRIC_MAPPING: {
        "spend": "spend",
        "cost": "spend",
        "impression": "imp",
        "impressions": "imp",
        "imp": "imp",
        "click": "click",
        "clicks": "click",
        "view": "views",
        "views": "views",
        "grp": "grp"
    }
};

/**
 * ==========================================
 * 核心邏輯區 勿更改
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
                showStatus(err.message, 'error');
            }
        }
    });
});

function showStatus(msg, type) {
    statusDiv.innerText = msg;
    statusDiv.className = type;
}

function processData(data) {
    const headers = data[0].map(h => h.trim());
    const rows = data.slice(1);

    // 1. 尋找日期欄位
    const dateColIndex = headers.findIndex(h =>
        h.toLowerCase().includes("week") || h.includes("日期")
    );
    if (dateColIndex === -1) throw new Error("找不到包含 'week' 或 '日期' 的欄位");

    // 2. 解析媒體欄位結構 (以最後一個底線 _ 作為分割點)
    const mediaGroups = {};
    const metricKeys = Object.keys(CONFIG.TARGET_METRICS);

    headers.forEach((header, colIndex) => {
        const h = header.toLowerCase();
        const lastUnderscore = h.lastIndexOf("_");
        if (lastUnderscore === -1) return;

        // metrics_ 前方的字串為 Media Type
        const media = h.substring(0, lastUnderscore);
        const rawMetric = h.substring(lastUnderscore + 1);

        // 進行正規化
        const metric = CONFIG.METRIC_MAPPING[rawMetric];

        // 檢查是否為我們需要的指標
        if (!metric || !metricKeys.includes(metric)) return;

        if (!mediaGroups[media]) mediaGroups[media] = {};
        mediaGroups[media][metric] = colIndex;
    });

    if (Object.keys(mediaGroups).length === 0) throw new Error("未偵測到符合格式的媒體指標 (例: meta_spend)");

    // 3. 組合 Output (根據 CONFIG 自動產出)
    const outputHeaders = ["Date", "Media", ...Object.values(CONFIG.TARGET_METRICS)];
    const output = [outputHeaders];

    rows.forEach(row => {
        const dateValue = row[dateColIndex];
        if (!dateValue) return;

        Object.keys(mediaGroups).forEach(media => {
            const m = mediaGroups[media];

            // 動態組建每一列資料
            const rowData = [dateValue, media];
            metricKeys.forEach(key => {
                rowData.push(getMetricValue(row, m[key]));
            });

            output.push(rowData);
        });
    });

    // 4. 下載 CSV
    const csvContent = Papa.unparse(output);
    downloadCSV(csvContent, `ROI_Media_${new Date().toISOString().split('T')[0]}.csv`);
    showStatus(`✅ 轉換完成！處理了 ${rows.length} 天資料，產生 ${output.length - 1} 列數據。`, 'success');
}

function getMetricValue(row, colIndex) {
    if (colIndex === undefined || row[colIndex] === undefined) return 0;
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