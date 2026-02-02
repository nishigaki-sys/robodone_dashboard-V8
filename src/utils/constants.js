// ==========================================
// 定数定義 (src/utils/constants.js)
// ==========================================

export const MONTHS_LIST = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];

// 必要に応じて年度を追加してください
export const YEARS_LIST = [2022, 2023, 2024, 2025, 2026];

export const COLORS = {
    revenue: '#1E51A2',   // 売上
    profit: '#10B981',    // 営業利益
    profitOrd: '#059669', // (予備)
    ad: '#F3981E',        // 広告宣伝費
    sales: '#F59E0B',     // 販売費
    labor: '#EF4444',     // 人件費
    facility: '#8B5CF6',  // 設備費
    admin: '#6366F1',     // 一般管理費
    hq: '#EC4899',        // 本社費
    other: '#94A3B8'      // その他
};

export const PIE_COLORS = [
    '#1E51A2', '#F3981E', '#10B981', '#EF4444', '#8B5CF6', 
    '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#64748B'
];

export const SUB_COLORS = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', 
    '#EAB308', '#10B981', '#14B8A6', '#06B6D4', '#6366F1'
];

export const CATEGORY_MAP = {
    'revenue': { label: 'A51 売上', color: COLORS.revenue },
    'ad': { label: 'A61 広告宣伝費', color: COLORS.ad },
    'sales': { label: 'A62 販売費', color: COLORS.sales },
    'labor': { label: 'A63 人件費', color: COLORS.labor },
    'facility': { label: 'A64 設備費', color: COLORS.facility },
    'admin': { label: 'A65 一般管理費', color: COLORS.admin },
    'hq': { label: 'A69 本社費', color: COLORS.hq },
    'other': { label: 'その他費用', color: COLORS.other }
};