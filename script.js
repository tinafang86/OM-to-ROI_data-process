/**
 * ==========================================
 * 【手動調整區】
 * ==========================================
 */
const CONFIG = {
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
    // 這裡定義標題「最後一段」出現什麼字，要歸類到哪個指標
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
        "grp": "grp",
        "reach": "reach",
        "lead": "leads",
        "leads": "leads",
        "tvr": "tvr"
    }
};

/**
 * ==========================================
 * 核心邏輯
 * ==========================================
 */
const fileInput = document.getElementById('fileInput');
const statusDiv = document.getElementById('status');

fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    showStatus("處理中...", "");

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: function (results) {
            try {
                processData(results.data);
            } catch (err) {
                console.error(err);
                showStatus("❌ 錯誤: " + err.message, 'error');
            }
        }
    });
});

function showStatus(msg, type) {
    statusDiv.innerText = msg;
    statusDiv.className = type;
    statusDiv.style.display = msg ? "block" : "none";
}

function processData(data) {
    const headers = data[0].map(h => h.trim().toLowerCase());
    const rows = data.slice(1);

    const dateColIndex = headers.findIndex(h =>
        h.includes("week") || h.includes("日期") || h.includes("date")
    );
    if (dateColIndex === -1) throw new Error("找不到日期欄位");

    const mediaGroups = {};
    const metricIds = Object.keys(CONFIG.TARGET_METRICS);

    headers.forEach((h, colIndex) => {
        if (colIndex === dateColIndex) return;

        // 找到最後一個底線的位置
        const lastUnderscore = h.lastIndexOf("_");
        if (lastUnderscore === -1) return;

        // 切分：底線前是 Media，底線後是 Metric
        const rawMedia = h.substring(0, lastUnderscore);
        const rawMetric = h.substring(lastUnderscore + 1);

        // 檢查指標是否存在於 Mapping 中
        const foundMetricId = CONFIG.METRIC_MAPPING[rawMetric];
        if (!foundMetricId) return;

        // 這裡會保留完整的底線前名稱，例如 "fb_awn_ttl"
        const mediaName = rawMedia;

        if (!mediaGroups[mediaName]) mediaGroups[mediaName] = {};
        mediaGroups[mediaName][foundMetricId] = colIndex;
    });

    if (Object.keys(mediaGroups).length === 0) throw new Error("未偵測到有效格式 (例如 fb_spend)");

    const outputHeaders = ["Date", "Media", ...Object.values(CONFIG.TARGET_METRICS)];
    const output = [outputHeaders];

    rows.forEach(row => {
        const dateValue = row[dateColIndex];
        if (!dateValue) return;

        Object.keys(mediaGroups).forEach(media => {
            const m = mediaGroups[media];
            const rowData = [dateValue, media];
            metricIds.forEach(id => {
                rowData.push(getMetricValue(row, m[id]));
            });
            output.push(rowData);
        });
    });

    const csvContent = Papa.unparse(output);
    downloadCSV(csvContent, `ROI_Media_${new Date().toISOString().split('T')[0]}.csv`);
    showStatus(`✅ 轉換完成！媒體名稱已保留原始前綴。`, 'success');
}

function getMetricValue(row, colIndex) {
    if (colIndex === undefined || row[colIndex] === undefined) return 0;
    const v = row[colIndex].toString().replace(/,/g, "");
    return v === "" || isNaN(v) ? 0 : Number(v);
}

function downloadCSV(content, filename) {
    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}