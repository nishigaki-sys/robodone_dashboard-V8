// ==========================================
// 計算・集計ロジック (src/utils/calculations.js)
// ==========================================

import { MONTHS_LIST } from './constants';
import { parseDate, formatDateStr, getFiscalYear, getFiscalYearFromStr, normalizeString } from './formatters';

/**
 * 指定された年度・月の週構造（第何週、開始日、終了日）を生成します
 */
export const getWeeksStruct = (fiscalYear, monthIndex) => {
    let targetYear = fiscalYear;
    let jsMonth = monthIndex + 3; 
    if (jsMonth > 11) { jsMonth -= 12; targetYear += 1; }
    
    const daysInMonth = new Date(targetYear, jsMonth + 1, 0).getDate();
    const weeks = [];
    let startDay = 1;
    const firstDayObj = new Date(targetYear, jsMonth, 1);
    const isFirstDaySunday = firstDayObj.getDay() === 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(targetYear, jsMonth, day);
        const dayOfWeek = dateObj.getDay(); 
        // 土曜日または月末を週の区切りとする（ただし1日が日曜の場合は1日だけで第1週としない調整）
        let isWeekEnd = (dayOfWeek === 0) || (day === daysInMonth);
        if (isFirstDaySunday && day === 1 && daysInMonth > 1) { isWeekEnd = false; }
        
        if (isWeekEnd) {
            weeks.push({ 
                name: `第${weeks.length + 1}週`, 
                startDay: startDay, 
                endDay: day, 
                label: `${startDay}日～${day}日` 
            });
            startDay = day + 1;
        }
    }
    return { weeks, daysInMonth, year: targetYear, month: jsMonth };
};

/**
 * 勘定科目コードから詳細カテゴリを判定します
 */
export const determineDetailedCategory = (code) => {
    if (!code) return 'other';
    const c = String(code);
    if (c.startsWith('51')) return 'revenue';
    if (c.startsWith('61')) return 'ad';
    if (c.startsWith('62')) return 'sales';
    if (c.startsWith('63')) return 'labor';
    if (c.startsWith('64')) return 'facility';
    if (c.startsWith('65')) return 'admin';
    if (c.startsWith('69')) return 'hq';
    if (c.startsWith('5')) return 'revenue'; 
    if (c.startsWith('6') || c.startsWith('7')) return 'other'; 
    return 'other';
};

/**
 * 生徒データ、日報データ、収支データなどを統合してダッシュボード表示用データを生成します
 */
export const processDashboardData = (campuses, enrollments, statusChanges, transfers, dailyReports, financials, trialApps, targetYear) => {
    const sheetNameToIdMap = {};
    const targetCampusIds = new Set(campuses.map(c => c.id));
    
    // 校舎名の揺らぎ対応マップを作成
    campuses.forEach(c => {
        const validNames = [c.name, c.sheetName].filter(n => n);
        if (c.name) {
            validNames.push(`ロボ団エディオン${c.name}校`);
            validNames.push(`エディオン${c.name}校`);
            validNames.push(`ロボ団エディオン${c.name}`);
            validNames.push(`エディオン${c.name}`);
        }
        validNames.forEach(n => {
            sheetNameToIdMap[n] = c.id;
            sheetNameToIdMap[normalizeString(n)] = c.id;
        });
    });

    const isTargetCampus = (item) => {
        if (item.campusId && targetCampusIds.has(item.campusId)) return true;
        const rawName = item.campus || item.school;
        if (!rawName) return false;
        const cId = sheetNameToIdMap[rawName] || sheetNameToIdMap[normalizeString(rawName)];
        return cId && targetCampusIds.has(cId);
    };

    // 期首時点の生徒数を計算
    let baseStudentCount = 0;
    const countBefore = (list, typeFilter = null) => {
        let count = 0;
        list.forEach(item => {
            if (!isTargetCampus(item)) return;
            let fy = -1;
            if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 fy = getFiscalYearFromStr(item.date);
            } else { const d = parseDate(item.date); if (d) fy = getFiscalYear(d); }
            
            if (fy === -1 || fy >= targetYear) return;
            if (typeFilter && (!item.type || !item.type.includes(typeFilter))) return;
            count++;
        });
        return count;
    };
    
    const prevEnroll = countBefore(enrollments);
    const prevTransferIn = countBefore(transfers); 
    const prevWithdraw = countBefore(statusChanges, "退会");
    const prevGrad = countBefore(statusChanges, "卒業");
    const prevTransferOut = countBefore(statusChanges, "転校");
    
    baseStudentCount = (prevEnroll + prevTransferIn) - (prevWithdraw + prevGrad + prevTransferOut);
    let currentStudents = baseStudentCount;

    // 月ごとにデータを集計
    return MONTHS_LIST.map((monthName, mIdx) => {
        const { weeks, daysInMonth, year: tYear, month: tMonth } = getWeeksStruct(targetYear, mIdx);
        const tYearPrev = tYear - 1;
        
        // 収支データのフィルタリング (当月・前年同月)
        const mFinancials = financials.filter(fin => {
            if (!isTargetCampus(fin)) return false;
            const dateStr = typeof fin.date === 'string' ? fin.date : formatDateStr(parseDate(fin.date));
            const [fY, fM] = dateStr.split('-').map(Number);
            return fY === tYear && fM === (tMonth + 1);
        });
        const mFinancialsPrev = financials.filter(fin => {
            if (!isTargetCampus(fin)) return false;
            const dateStr = typeof fin.date === 'string' ? fin.date : formatDateStr(parseDate(fin.date));
            const [fY, fM] = dateStr.split('-').map(Number);
            return fY === tYearPrev && fM === (tMonth + 1);
        });

        // 収支データの集計関数
        const aggFinancials = (fins) => {
            const agg = { revenue: 0, ad: 0, sales: 0, labor: 0, facility: 0, admin: 0, hq: 0, other: 0, expenseTotal: 0, partTime: 0 };
            const details = {};
            fins.forEach(f => {
                const cat = determineDetailedCategory(f.accountCode);
                if (cat === 'revenue') { agg.revenue += f.amount; } 
                else { agg[cat] += f.amount; agg.expenseTotal += f.amount; }
                
                // アルバイト人件費の特定 (6320...)
                if (String(f.accountCode).startsWith('6320')) { agg.partTime += f.amount; }
                
                if (!details[cat]) details[cat] = [];
                const existing = details[cat].find(i => i.name === f.subCategory);
                if (existing) { existing.value += f.amount; } 
                else { details[cat].push({ name: f.subCategory, value: f.amount, code: f.accountCode }); }
            });
            return { ...agg, details };
        };
        const currentFin = aggFinancials(mFinancials);
        const prevFin = aggFinancials(mFinancialsPrev);

        // 前年同月の入退会数 (比較用)
        const filterPrevMonth = (list, typeFilter=null, dateKey='date') => list.filter(item => {
            if (!isTargetCampus(item)) return false;
            let d = parseDate(item[dateKey]);
            if (!d) return false;
            const iYear = d.getFullYear();
            const iMonth = d.getMonth() + 1;
            return iYear === tYearPrev && iMonth === (tMonth + 1) && (!typeFilter || item.type?.includes(typeFilter));
        }).length;
        const prevNewEnrollments = filterPrevMonth(enrollments);
        const prevWithdrawals = filterPrevMonth(statusChanges, "退会");

        // 日次データの生成
        const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${tYear}-${('0'+(tMonth+1)).slice(-2)}-${('0'+day).slice(-2)}`;
            const dayOfWeek = new Date(tYear, tMonth, day).getDay();
            const dayOfWeekStr = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];
            
            const filterDay = (list, typeFilter=null, dateKey='date') => list.filter(item => {
                if (!isTargetCampus(item)) return false; 
                let itemDateStr = "";
                const d = parseDate(item[dateKey]);
                if (d) itemDateStr = formatDateStr(d);
                return itemDateStr === dateStr && (!typeFilter || item.type?.includes(typeFilter));
            }).length;

            const dEnroll = filterDay(enrollments);
            const dayReports = dailyReports.filter(r => r.date === dateStr && isTargetCampus(r));
            const dFlyers = dayReports.reduce((sum, r) => sum + (Number(r.flyers) || 0), 0);
            const dTouchTry = dayReports.reduce((sum, r) => sum + (Number(r.touchTry) || 0), 0);
            const dTrialActual = dayReports.reduce((sum, r) => sum + (Number(r.trialLessons) || 0), 0);
            const weather = dayReports.length > 0 ? dayReports[0].weather : '';
            
            const trialAppsOnly = trialApps.filter(a => a.type === '体験会');
            const eventAppsOnly = trialApps.filter(a => a.type !== '体験会');
            const dTrialApp = filterDay(trialAppsOnly, null, 'date');
            const dEventApp = filterDay(eventAppsOnly, null, 'date');
            const dTrialScheduled = filterDay(trialAppsOnly, null, 'trialDate'); 
            const dEventScheduled = filterDay(eventAppsOnly, null, 'trialDate'); 
            const dTransferIn = filterDay(transfers);
            const dWithdraw = filterDay(statusChanges, "退会");
            const dGrad = filterDay(statusChanges, "卒業");
            const dTransferOut = filterDay(statusChanges, "転校");
            const dRecess = filterDay(statusChanges, "休会");
            
            return {
                name: `${day}日`, date: dateStr, dayOfWeek: dayOfWeekStr,
                newEnrollments: dEnroll, flyers: dFlyers, touchTry: dTouchTry,
                trialApp: dTrialApp, eventApp: dEventApp,
                trialScheduled: dTrialScheduled, eventScheduled: dEventScheduled, 
                trialActual: dTrialActual, weather: weather,
                transferIns: dTransferIn, withdrawals: dWithdraw, 
                graduates_neg: -dGrad, transfers_neg: -dTransferOut, withdrawals_neg: -dWithdraw, recesses_neg: -dRecess
            };
        });

        // 日次データの合計
        const sumDaily = (key) => dailyData.reduce((acc, d) => acc + (d[key] || 0), 0);

        // 週次データの集計
        const weeklyData = weeks.map(week => {
            const daysInWeek = dailyData.slice(week.startDay - 1, week.endDay);
            const sum = (key) => daysInWeek.reduce((acc, d) => acc + (d[key] || 0), 0);
            return {
                name: week.name, label: week.label,
                newEnrollments: sum('newEnrollments'), flyers: sum('flyers'), touchTry: sum('touchTry'),
                trialApp: sum('trialApp'), eventApp: sum('eventApp'),
                trialScheduled: sum('trialScheduled'), eventScheduled: sum('eventScheduled'), 
                trialActual: sum('trialActual'),
                transferIns: sum('transferIns'),
                withdrawals_neg: sum('withdrawals_neg'),
                graduates_neg: sum('graduates_neg'),
                transfers_neg: sum('transfers_neg')
            };
        });

        // 月末生徒数の計算 (期首 + 入会 + 転入 - 退会 - 卒業 - 転出)
        const netChange = (sumDaily('newEnrollments') + sumDaily('transferIns')) - (sumDaily('withdrawals') + Math.abs(sumDaily('graduates_neg')) + Math.abs(sumDaily('transfers_neg')));
        currentStudents += netChange;

        return {
            name: monthName, daily: dailyData, weekly: weeklyData,
            newEnrollments: sumDaily('newEnrollments'), flyers: sumDaily('flyers'), touchTry: sumDaily('touchTry'),
            trialApp: sumDaily('trialApp'), eventApp: sumDaily('eventApp'),
            trialScheduled: sumDaily('trialScheduled'), eventScheduled: sumDaily('eventScheduled'),
            trialActual: sumDaily('trialActual'), 
            students: currentStudents,
            ...currentFin, expense: currentFin.expenseTotal, profit: currentFin.revenue - currentFin.expenseTotal, detailItems: currentFin.details,
            transferIns: sumDaily('transferIns'), withdrawals: sumDaily('withdrawals'),
            withdrawals_neg: sumDaily('withdrawals_neg'), graduates_neg: sumDaily('graduates_neg'), transfers_neg: sumDaily('transfers_neg'), recesses_neg: sumDaily('recesses_neg'),
            prevRevenue: prevFin.revenue, prevExpense: prevFin.expenseTotal, prevProfit: prevFin.revenue - prevFin.expenseTotal, 
            prevNewEnrollments, prevWithdrawals
        };
    });
};

/**
 * 月次データを半期・四半期などの期間で集計します
 */
export const aggregatePeriod = (monthlyData, periodType) => {
    if (periodType === 'annual') return monthlyData;
    let groups = [];
    if (periodType === 'half') { 
        groups = [
            { name: '上期', months: ['4月','5月','6月','7月','8月','9月'] }, 
            { name: '下期', months: ['10月','11月','12月','1月','2月','3月'] }
        ]; 
    } else if (periodType === 'quarter') { 
        groups = [
            { name: '第1四半期', months: ['4月','5月','6月'] }, 
            { name: '第2四半期', months: ['7月','8月','9月'] }, 
            { name: '第3四半期', months: ['10月','11月','12月'] }, 
            { name: '第4四半期', months: ['1月','2月','3月'] }
        ]; 
    }

    return groups.map(g => {
        const targets = monthlyData.filter(d => g.months.includes(d.name));
        const agg = targets.reduce((acc, curr) => {
            const keys = [
                'revenue','expense','profit','ad','sales','labor','facility','admin','hq','other','partTime',
                'newEnrollments','transferIns','returns','withdrawals','graduates_neg','transfers_neg','recesses_neg',
                'flyers','touchTry','trialApp','eventApp','trialScheduled','eventScheduled','trialActual',
                'withdrawals_neg', 'transfers_neg', 'graduates_neg', 'recesses_neg',
                'prevRevenue', 'prevExpense', 'prevProfit', 'prevAd', 'prevSales', 'prevLabor', 'prevFacility', 'prevAdmin', 'prevHq', 'prevOther', 'prevNewEnrollments', 'prevWithdrawals'
            ];
            
            keys.forEach(k => { 
                if (curr[k] !== undefined) acc[k] = (acc[k] || 0) + curr[k]; 
            });
            
            if (curr.detailItems) {
                Object.keys(curr.detailItems).forEach(cat => {
                    if (!acc.detailItems[cat]) acc.detailItems[cat] = [];
                    curr.detailItems[cat].forEach(item => {
                        const existing = acc.detailItems[cat].find(i => i.name === item.name);
                        if (existing) existing.value += item.value; 
                        else acc.detailItems[cat].push({ ...item });
                    });
                });
            }
            return acc;
        }, { name: g.name, detailItems: {} });
        
        // 生徒数は期間末の値を採用
        if (targets.length > 0) { 
            agg.students = targets[targets.length - 1].students; 
        }

        return agg;
    });
};