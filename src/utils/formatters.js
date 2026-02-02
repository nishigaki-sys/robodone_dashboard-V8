// ==========================================
// フォーマット・ユーティリティ関数 (src/utils/formatters.js)
// ==========================================

/**
 * 数値を日本円形式にフォーマットします (例: ¥1,000)
 */
export const formatYen = (val) => `¥${Number(val).toLocaleString()}`;

/**
 * FirebaseのTimestampや文字列など、様々な形式の日付データをDateオブジェクトに変換します
 */
export const parseDate = (dateValue) => {
    if (!dateValue) return null;
    // Firebase Timestamp
    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
    // Seconds format
    if (dateValue.seconds) return new Date(dateValue.seconds * 1000);
    // String format
    if (typeof dateValue === 'string') {
        let cleanStr = dateValue.replace(/年|月/g, '/').replace(/日/g, ' ').replace(/\([^\)]+\)/g, '').trim();
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) return d;
        return new Date(dateValue);
    }
    // Date object or others
    return new Date(dateValue);
};

/**
 * Dateオブジェクトを 'YYYY-MM-DD' 形式の文字列に変換します
 */
export const formatDateStr = (date) => {
    if (!date || isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}-${m}-${d}`;
};

/**
 * 'YYYY-MM-DD' 形式の文字列から年度を取得します
 * (例: 2024-03-31 -> 2023, 2024-04-01 -> 2024)
 */
export const getFiscalYearFromStr = (dateStr) => {
    if (!dateStr) return -1;
    const [y, m] = dateStr.split('-').map(Number);
    if (!y || !m) return -1;
    return m < 4 ? y - 1 : y;
};

/**
 * Dateオブジェクトから年度を取得します
 */
export const getFiscalYear = (date) => (date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear());

/**
 * 文字列を正規化します (全角英数を半角に変換、空白除去)
 * 校舎名の揺らぎ吸収などに使用します
 */
export const normalizeString = (str) => (
    !str ? "" : str.replace(/[\s\u3000]/g, "").replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
);