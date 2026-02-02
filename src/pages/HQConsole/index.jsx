// ==========================================
// 本部コンソール (src/pages/HQConsole/index.jsx)
// ==========================================

import React, { useState, useMemo } from "react";
import { 
    doc, setDoc, deleteDoc, updateDoc, serverTimestamp, writeBatch 
} from "firebase/firestore";
import { 
    LayoutDashboard, Users, DollarSign, Megaphone, Settings, 
    LogOut, MapPin, RefreshCw, Activity, Edit2, Trash2, ArrowUp, ArrowDown 
} from "lucide-react";
import { 
    ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, 
    CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell, ReferenceLine 
} from "recharts";

// 設定・ユーティリティのインポート
import { db } from "../../config/firebase";
import { YEARS_LIST, MONTHS_LIST, COLORS, SUB_COLORS, CATEGORY_MAP } from "../../utils/constants";
import { processDashboardData, aggregatePeriod } from "../../utils/calculations";
import { formatYen } from "../../utils/formatters";

// コンポーネントのインポート
import { StatCard } from "../../components/dashboard/StatCard";
import { DetailModal } from "../../components/common/DetailModal";

export default function HQConsole({ onBack, campusList, allData, selectedYear, setSelectedYear, refreshData, showNotify, isSyncing, lastUpdated, isUsingCache, isAdmin }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [viewMode, setViewMode] = useState('annual');
    const [selectedMonth, setSelectedMonth] = useState('4月');
    
    // カスタム期間の初期値設定
    const [customStartMonth, setCustomStartMonth] = useState(() => {
        const d = new Date();
        const fy = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
        return `${fy}-04`; 
    });
    const [customEndMonth, setCustomEndMonth] = useState(() => {
        const d = new Date();
        const m = ('0' + (d.getMonth() + 1)).slice(-2);
        return `${d.getFullYear()}-${m}`; 
    });

    const [newCampusName, setNewCampusName] = useState("");
    const [newCampusId, setNewCampusId] = useState("");
    const [selectedHQCampusId, setSelectedHQCampusId] = useState('All');
    const [plViewCategory, setPlViewCategory] = useState('all');
    const [hoveredData, setHoveredData] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalData, setModalData] = useState([]);
    const [modalTitle, setModalTitle] = useState("");
    const [modalColor, setModalColor] = useState("");
    const [selectedPLItem, setSelectedPLItem] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingCampus, setEditingCampus] = useState(null);
    const [editName, setEditName] = useState("");
    const [editSheetName, setEditSheetName] = useState("");
    const [isReordering, setIsReordering] = useState(false);

    // カスタム期間変更ハンドラ
    const handleCustomDateChange = (type, part, val) => {
        const base = type === 'start' ? customStartMonth : customEndMonth;
        let [y, m] = base.split('-').map(Number);
        if (part === 'year') y = Number(val);
        if (part === 'month') m = Number(val);
        const newVal = `${y}-${('0' + m).slice(-2)}`;

        if (type === 'start') {
            setCustomStartMonth(newVal);
            const [eY, eM] = customEndMonth.split('-').map(Number);
            const diff = (eY - y) * 12 + (eM - m);
            if (diff < 0) setCustomEndMonth(newVal);
        } else {
            setCustomEndMonth(newVal);
            const [sY, sM] = customStartMonth.split('-').map(Number);
            const diff = (y - sY) * 12 + (m - sM);
            if (diff < 0) setCustomStartMonth(newVal);
        }
    };

    const getFyFromYm = (ym) => {
        if (!ym) return 0;
        const [y, m] = ym.split('-').map(Number);
        return m < 4 ? y - 1 : y;
    };

    // 校舎フィルタリング
    const filteredCampusList = useMemo(() => {
        if (selectedHQCampusId === 'All') return campusList;
        return campusList.filter(c => c.id === selectedHQCampusId);
    }, [selectedHQCampusId, campusList]);

    // 全データの処理
    const fullDashboardData = useMemo(() => {
        return processDashboardData(filteredCampusList, allData.enrollments, allData.statusChanges, allData.transfers, allData.dailyReports, allData.financials, allData.trialApps, Number(selectedYear));
    }, [allData, filteredCampusList, selectedYear]);

    // 表示用データの抽出・集計
    const displayData = useMemo(() => {
        if (viewMode === 'annual') return fullDashboardData;
        if (viewMode === 'half' || viewMode === 'quarter') return aggregatePeriod(fullDashboardData, viewMode);
        
        if (viewMode === 'custom') {
            if (!customStartMonth || !customEndMonth) return fullDashboardData;
            if (customStartMonth > customEndMonth) return [];

            const startFy = getFyFromYm(customStartMonth);
            const endFy = getFyFromYm(customEndMonth);
            
            let combinedData = [];
            for (let y = startFy; y <= endFy; y++) {
                const yearData = processDashboardData(filteredCampusList, allData.enrollments, allData.statusChanges, allData.transfers, allData.dailyReports, allData.financials, allData.trialApps, y);
                const labeledData = yearData.map((d, i) => {
                    let mNum = i + 4;
                    let mYear = y;
                    if (mNum > 12) { mNum -= 12; mYear += 1; }
                    const ym = `${mYear}-${('0' + mNum).slice(-2)}`;
                    return { ...d, ym };
                });
                combinedData = [...combinedData, ...labeledData];
            }
            const filtered = combinedData.filter(d => d.ym >= customStartMonth && d.ym <= customEndMonth);
            return filtered.slice(0, 12);
        }

        const targetMonthData = fullDashboardData.find(m => m.name === selectedMonth);
        if (!targetMonthData) return [];
        if (viewMode === 'weekly') return targetMonthData.weekly || [];
        return targetMonthData.daily;
    }, [fullDashboardData, viewMode, selectedMonth, customStartMonth, customEndMonth, selectedYear, filteredCampusList, allData]);

    const monthDataForPL = useMemo(() => { return fullDashboardData.find(m => m.name === selectedMonth); }, [fullDashboardData, selectedMonth]);

    // 合計値の計算
    const totals = useMemo(() => {
        const initial = { revenue: 0, prevRevenue: 0, expense: 0, prevExpense: 0, profit: 0, prevProfit: 0, newEnrollments: 0, prevNewEnrollments: 0, withdrawals: 0, prevWithdrawals: 0, transferIns: 0, returns: 0, graduates: 0, transfers: 0, flyers: 0, touchTry: 0, trialApp: 0, eventApp: 0, trialScheduled: 0, eventScheduled: 0, trialActual: 0, partTime: 0 };
        
        if (viewMode === 'monthly' && monthDataForPL) {
            return {
                revenue: monthDataForPL.revenue, prevRevenue: monthDataForPL.prevRevenue,
                expense: monthDataForPL.expense, prevExpense: monthDataForPL.prevExpense,
                profit: monthDataForPL.profit, prevProfit: monthDataForPL.prevProfit,
                newEnrollments: monthDataForPL.newEnrollments, prevNewEnrollments: monthDataForPL.prevNewEnrollments,
                withdrawals: monthDataForPL.withdrawals, prevWithdrawals: monthDataForPL.prevWithdrawals,
                transferIns: monthDataForPL.transferIns, returns: monthDataForPL.returns,
                graduates: Math.abs(monthDataForPL.graduates_neg || 0), transfers: Math.abs(monthDataForPL.transfers_neg || 0),
                flyers: monthDataForPL.flyers, touchTry: monthDataForPL.touchTry,
                trialApp: monthDataForPL.trialApp, eventApp: monthDataForPL.eventApp || 0,
                trialScheduled: monthDataForPL.trialScheduled, eventScheduled: monthDataForPL.eventScheduled || 0,
                trialActual: monthDataForPL.trialActual, partTime: monthDataForPL.partTime || 0, students: monthDataForPL.students
            };
        }
        return displayData.reduce((acc, curr) => ({
            revenue: acc.revenue + (curr.revenue || 0), prevRevenue: acc.prevRevenue + (curr.prevRevenue || 0),
            expense: acc.expense + (curr.expense || 0), prevExpense: acc.prevExpense + (curr.prevExpense || 0),
            profit: acc.profit + (curr.profit || 0), prevProfit: acc.prevProfit + (curr.prevProfit || 0),
            newEnrollments: acc.newEnrollments + (curr.newEnrollments || 0), prevNewEnrollments: acc.prevNewEnrollments + (curr.prevNewEnrollments || 0),
            withdrawals: acc.withdrawals + (curr.withdrawals || 0), prevWithdrawals: acc.prevWithdrawals + (curr.prevWithdrawals || 0),
            transferIns: acc.transferIns + (curr.transferIns || 0), returns: acc.returns + (curr.returns || 0),
            graduates: acc.graduates + Math.abs(curr.graduates_neg || 0), transfers: acc.transfers + Math.abs(curr.transfers_neg || 0),
            flyers: acc.flyers + (curr.flyers || 0), touchTry: acc.touchTry + (curr.touchTry || 0),
            trialApp: acc.trialApp + (curr.trialApp || 0), eventApp: acc.eventApp + (curr.eventApp || 0),
            trialScheduled: acc.trialScheduled + (curr.trialScheduled || 0), eventScheduled: acc.eventScheduled + (curr.eventScheduled || 0),
            trialActual: acc.trialActual + (curr.trialActual || 0), partTime: acc.partTime + (curr.partTime || 0)
        }), initial);
    }, [displayData, viewMode, monthDataForPL]);
    
    const monthlySummaryData = useMemo(() => {
        if (viewMode !== 'monthly' || !monthDataForPL) return [];
        const data = [
            { id: 'revenue', name: '売上', value: monthDataForPL.revenue, prev: monthDataForPL.prevRevenue, fill: COLORS.revenue },
            { id: 'ad', name: '広告宣伝費', value: monthDataForPL.ad, prev: monthDataForPL.prevAd, fill: COLORS.ad },
            { id: 'sales', name: '販売費', value: monthDataForPL.sales, prev: monthDataForPL.prevSales, fill: COLORS.sales },
            { id: 'labor', name: '人件費', value: monthDataForPL.labor, prev: monthDataForPL.prevLabor, fill: COLORS.labor },
            { id: 'facility', name: '設備費', value: monthDataForPL.facility, prev: monthDataForPL.prevFacility, fill: COLORS.facility },
            { id: 'admin', name: '一般管理費', value: monthDataForPL.admin, prev: monthDataForPL.prevAdmin, fill: COLORS.admin },
            { id: 'hq', name: '本社費', value: monthDataForPL.hq, prev: monthDataForPL.prevHq, fill: COLORS.hq },
            { id: 'other', name: 'その他', value: monthDataForPL.other, prev: monthDataForPL.prevOther, fill: COLORS.other },
            { id: 'profit', name: '営業利益', value: monthDataForPL.profit, prev: monthDataForPL.prevProfit, fill: COLORS.profit },
        ];
        return data;
    }, [monthDataForPL, viewMode]);

    const currentTotalStudents = useMemo(() => {
        if (viewMode === 'monthly') return monthDataForPL ? monthDataForPL.students : 0;
        if (viewMode === 'annual' || viewMode === 'half' || viewMode === 'quarter' || viewMode === 'custom') {
            return displayData.length > 0 ? displayData[displayData.length - 1].students : 0;
        }
        const mData = fullDashboardData.find(m => m.name === selectedMonth);
        return mData ? mData.students : 0;
    }, [fullDashboardData, viewMode, selectedMonth, displayData, monthDataForPL]);

    // 計画データの集計 (Firestoreから取得したcampusPlansを使用)
    const currentPlanData = useMemo(() => {
        const plans = allData.campusPlans || [];
        const targetYearNum = Number(selectedYear);

        const filteredPlans = plans.filter(p => {
            if (p.year !== targetYearNum) return false;
            if (selectedHQCampusId !== 'All' && p.campusId !== selectedHQCampusId) return false;
            if (selectedHQCampusId === 'All') return campusList.some(c => c.id === p.campusId);
            return true;
        });

        let monthsToAgg = [];
        if (['annual', 'half', 'quarter'].includes(viewMode)) {
            monthsToAgg = MONTHS_LIST;
        } else if (viewMode === 'monthly' || viewMode === 'weekly') {
            monthsToAgg = [selectedMonth];
        } else if (viewMode === 'custom') {
            const [sY, sM] = customStartMonth.split('-').map(Number);
            const [eY, eM] = customEndMonth.split('-').map(Number);
            const startVal = sY * 12 + sM;
            const endVal = eY * 12 + eM;

            MONTHS_LIST.forEach((m, idx) => {
                let y = targetYearNum;
                let monthNum = idx + 4;
                if (monthNum > 12) { monthNum -= 12; y += 1; }
                const currentVal = y * 12 + monthNum;
                if (currentVal >= startVal && currentVal <= endVal) {
                    monthsToAgg.push(m);
                }
            });
        }

        let agg = { flyers: 0, touchTry: 0, trialApp: 0, trialActual: 0, enrollments: 0 };

        filteredPlans.forEach(doc => {
            const planData = doc.plans || {};
            monthsToAgg.forEach(m => {
                const mData = planData[m];
                if (!mData) return;

                if (mData.weeks && Array.isArray(mData.weeks) && mData.weeks.length > 0) {
                    mData.weeks.forEach(w => {
                        agg.flyers += (Number(w.flyers) || 0);
                        agg.touchTry += (Number(w.touchTry) || 0);
                        agg.trialApp += (Number(w.trialApp) || 0);
                        agg.trialActual += (Number(w.trialParticipation) || 0);
                        agg.enrollments += (Number(w.enrollments) || 0);
                    });
                } else {
                    agg.flyers += (Number(mData.flyers) || 0);
                    agg.touchTry += (Number(mData.touchTry) || 0);
                    agg.trialActual += (Number(mData.trials) || 0);
                    agg.enrollments += (Number(mData.enrollments) || 0);
                }
            });
        });
        return agg;
    }, [allData.campusPlans, selectedYear, selectedHQCampusId, viewMode, selectedMonth, customStartMonth, customEndMonth, campusList]);

    const calcPlanRatio = (actual, plan) => {
        if (!plan || plan === 0) return null;
        return ((actual / plan) * 100).toFixed(1);
    };

    const viewLabel = { 'annual': '年度', 'half': '半期', 'quarter': '四半期', 'monthly': '月度', 'weekly': '週次', 'custom': `${customStartMonth}〜${customEndMonth}` }[viewMode];

    const currentViewData = useMemo(() => {
        const base = hoveredData || totals;
        const val = (key) => base[key] || 0;

        let graduates = 0;
        let transfers = 0;
        if (hoveredData) {
            graduates = Math.abs(hoveredData.graduates_neg || 0);
            transfers = Math.abs(hoveredData.transfers_neg || 0);
        } else {
            graduates = totals.graduates;
            transfers = totals.transfers;
        }

        const newEnrollments = val('newEnrollments');
        const transferIns = val('transferIns');
        const withdrawals = val('withdrawals');

        const increase = newEnrollments + transferIns;
        const decrease = withdrawals + transfers + graduates;
        const netIncrease = newEnrollments - withdrawals;
        const totalStudents = hoveredData ? (hoveredData.students || 0) : currentTotalStudents;

        const flyers = val('flyers');
        const touchTry = val('touchTry');
        const trialApp = val('trialApp');
        const eventApp = val('eventApp');
        const trialActual = val('trialActual');
        
        const totalApps = trialApp + eventApp;
        const rate = trialActual > 0 ? ((newEnrollments / trialActual) * 100).toFixed(1) : "0.0";

        return {
            ...base,
            newEnrollments, transferIns, withdrawals, graduates, transfers,
            increase, decrease, netIncrease, totalStudents,
            flyers, touchTry, trialApp, eventApp, trialActual,
            totalApps, rate,
            periodLabel: hoveredData ? hoveredData.name : (viewLabel === '月度' ? selectedMonth : viewLabel)
        };
    }, [hoveredData, totals, currentTotalStudents, viewLabel, selectedMonth, viewMode]);

    const calcYoY = (curr, prev) => { if (!prev || prev === 0) return null; return ((curr / prev) * 100).toFixed(1); };
    const handleChartHover = (state) => { if (state && state.activePayload && state.activePayload.length > 0) { setHoveredData(state.activePayload[0].payload); } };
    const handleChartLeave = () => { setHoveredData(null); };
    
    const openDetailModal = (categoryKey, monthData) => {
        if (!monthData || !monthData.detailItems || !monthData.detailItems[categoryKey]) return;
        setModalTitle(`${monthData.name} - ${CATEGORY_MAP[categoryKey].label}`);
        setModalColor(CATEGORY_MAP[categoryKey].color); 
        setModalData(monthData.detailItems[categoryKey]); 
        setModalOpen(true);
    };
    
    const onBarClick = (data, idx, e, catKey) => { openDetailModal(catKey, data); };
    
    const handleAddCampus = async () => {
        if (!newCampusId || !newCampusName) return showNotify("必須項目が空です", 'error');
        try { await setDoc(doc(db, "campuses", newCampusId), { id: newCampusId, name: newCampusName, order: campusList.length, createdAt: serverTimestamp() }); setNewCampusId(""); setNewCampusName(""); refreshData(); showNotify("校舎を追加しました"); } catch(e) { showNotify("エラー: " + e.message, 'error'); }
    };
    
    const handleDeleteCampus = async (id, name) => {
        if (!confirm(`${name} を削除しますか？`)) return;
        try { await deleteDoc(doc(db, "campuses", id)); refreshData(); showNotify("校舎を削除しました"); } catch(e) { showNotify("エラー: " + e.message, 'error'); }
    };
    
    const openEditCampus = (campus) => { setEditingCampus(campus); setEditName(campus.name); setEditSheetName(campus.sheetName || ""); setEditModalOpen(true); };
    
    const handleUpdateCampus = async () => {
        if (!editingCampus) return;
        try { await updateDoc(doc(db, "campuses", editingCampus.id), { name: editName, sheetName: editSheetName, updatedAt: serverTimestamp() }); setEditModalOpen(false); setEditingCampus(null); refreshData(); showNotify("校舎情報を更新しました"); } catch (e) { showNotify("更新エラー: " + e.message, 'error'); }
    };
    
    const handleReorder = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= campusList.length) return;
        setIsReordering(true);
        try {
            const batch = writeBatch(db);
            const newList = [...campusList];
            [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
            newList.forEach((item, idx) => { const ref = doc(db, "campuses", item.id); batch.update(ref, { order: idx }); });
            await batch.commit(); refreshData(); showNotify("並び順を更新しました");
        } catch(e) { showNotify("並び替えエラー: " + e.message, 'error'); } finally { setIsReordering(false); }
    };
    
    const WeeklyAxisTick = ({ x, y, payload }) => {
        const item = displayData.find(d => d.name === payload.value);
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={12} fontWeight="bold">{payload.value}</text>
                {item && item.label && <text x={0} y={0} dy={30} textAnchor="middle" fill="#94a3b8" fontSize={10}>{item.label}</text>}
            </g>
        );
    };
    
    const plChartData = useMemo(() => {
        if (plViewCategory === 'all') return displayData;
        const uniqueKeys = new Set();
        const processed = displayData.map(d => {
            const base = { name: d.name };
            const items = d.detailItems ? d.detailItems[plViewCategory] || [] : [];
            items.forEach(item => { base[item.name] = item.value; uniqueKeys.add(item.name); });
            return base;
        });
        return { data: processed, keys: Array.from(uniqueKeys) };
    }, [displayData, plViewCategory]);

    const availableViewModes = ['annual', 'half', 'quarter', 'monthly'];
    if (activeTab === 'students' || activeTab === 'marketing') availableViewModes.push('weekly');

    const handlePLRowClick = (item) => { if (!monthDataForPL) return; if (item.id === 'revenue' || item.id === 'profit') return; setSelectedPLItem(item); };

    return (
        <div className="flex h-screen bg-brand-slate overflow-hidden fade-in">
            <DetailModal isOpen={modalOpen} onClose={()=>setModalOpen(false)} data={modalData} title={modalTitle} color={modalColor} />
            
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay backdrop-blur-sm transition-opacity" onClick={() => setEditModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Edit2 className="w-5 h-5 mr-2 text-brand-blue"/> 校舎情報の修正</h3>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">校舎ID (変更不可)</label><input type="text" value={editingCampus?.id} disabled className="w-full bg-gray-100 border border-gray-200 rounded px-3 py-2 text-gray-500 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">校舎名</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-brand-blue outline-none" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">連携名 (Spreadsheet)</label><input type="text" value={editSheetName} onChange={e => setEditSheetName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-brand-blue outline-none" /></div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setEditModalOpen(false)} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">キャンセル</button>
                                <button onClick={handleUpdateCampus} className="flex-1 bg-brand-blue text-white py-2 rounded-lg hover:bg-blue-700">更新する</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-10">
                <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
                    <div className="w-8 h-8 bg-brand-blue rounded flex items-center justify-center"><LayoutDashboard className="w-5 h-5 text-white" /></div>
                    <span className="font-bold text-lg text-gray-800">本部</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {[{id:'dashboard',l:'サマリー',i:Activity}, {id:'pl',l:'収支・PL',i:DollarSign}, {id:'students',l:'生徒数',i:Users}, {id:'marketing',l:'マーケティング',i:Megaphone}, {id:'settings',l:'校舎管理',i:Settings}].map(t => {
                        if (t.id === 'settings' && !isAdmin) return null;
                        return (
                            <button 
                                key={t.id} 
                                onClick={() => { 
                                    setActiveTab(t.id); 
                                    if(t.id !== 'students' && t.id !== 'marketing' && viewMode === 'weekly') setViewMode('monthly'); 
                                }} 
                                className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${activeTab === t.id ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/30' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <t.i className="w-5 h-5 mr-3" />{t.l}
                            </button>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-gray-100 space-y-2">
                    <div className="text-xs text-gray-400 flex justify-between px-2"><span>{isUsingCache ? 'Cache' : 'Live'}</span><span>{lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}</span></div>
                    <button onClick={onBack} className="flex items-center text-gray-400 hover:text-gray-600 text-sm w-full px-4 py-2"><LogOut className="w-4 h-4 mr-2" /> 戻る</button>
                </div>
            </aside>
            
            <main className="flex-1 overflow-y-auto">
                <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-20">
                    <h2 className="text-xl font-bold text-gray-800">{{dashboard:'全校サマリー', pl:'収支・PL分析', students:'生徒数・入退会', marketing:'集客・ファネル', settings:'校舎マスタ管理'}[activeTab]}</h2>
                    <div className="flex items-center space-x-3">
                        {activeTab !== 'settings' && (
                            <>
                                <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1 border border-gray-200 mr-2">
                                    <MapPin className="w-3 h-3 text-slate-500 mr-2" />
                                    <select value={selectedHQCampusId} onChange={(e) => setSelectedHQCampusId(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
                                        <option value="All">全校舎 (合計)</option>
                                        {campusList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                                    {[...availableViewModes, 'custom'].map(m => (
                                        <button key={m} onClick={()=>setViewMode(m)} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode===m ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                            {{annual:'年度', half:'半期', quarter:'四半期', monthly:'月度', weekly:'週次', custom:'期間指定'}[m]}
                                        </button>
                                    ))}
                                </div>
                                {(viewMode === 'monthly' || viewMode === 'weekly') && (
                                    <div className="flex items-center bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                                        <select value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer">
                                            {MONTHS_LIST.map(m=><option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                )}
                                {viewMode === 'custom' && (
                                    <div className="flex items-center bg-gray-50 rounded-lg px-2 py-1 border border-gray-200 gap-2">
                                        <div className="flex items-center gap-1">
                                            <select value={customStartMonth.split('-')[0]} onChange={(e) => handleCustomDateChange('start', 'year', e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer">
                                                {YEARS_LIST.map(y => <option key={y} value={y}>{y}年</option>)}
                                            </select>
                                            <select value={parseInt(customStartMonth.split('-')[1])} onChange={(e) => handleCustomDateChange('start', 'month', e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer">
                                                {Array.from({length:12}, (_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}
                                            </select>
                                        </div>
                                        <span className="text-gray-400 text-xs">〜</span>
                                        <div className="flex items-center gap-1">
                                            <select value={customEndMonth.split('-')[0]} onChange={(e) => handleCustomDateChange('end', 'year', e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer">
                                                {YEARS_LIST.map(y => <option key={y} value={y}>{y}年</option>)}
                                            </select>
                                            <select value={parseInt(customEndMonth.split('-')[1])} onChange={(e) => handleCustomDateChange('end', 'month', e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer">
                                                {Array.from({length:12}, (_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <select value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-600 focus:ring-2 focus:ring-brand-blue outline-none">
                            {YEARS_LIST.map(y => <option key={y} value={y}>{y}年度</option>)}
                        </select>
                        <button onClick={refreshData} disabled={isSyncing} className={`p-2 rounded-lg border border-gray-200 transition-all ${isSyncing ? 'bg-blue-50 text-blue-600' : 'bg-white hover:bg-gray-50 text-gray-600'}`}><RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /></button>
                    </div>
                </header>
                
                <div className="p-8 max-w-7xl mx-auto">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                <StatCard title="売上" value={formatYen(currentViewData.revenue)} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.revenue, currentViewData.prevRevenue)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_1eb00716-6ac0-4be4-9b78-e8e9be44198e.svg" colorClass="text-brand-blue" />
                                <StatCard title="費用" value={formatYen(currentViewData.expense)} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.expense, currentViewData.prevExpense)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_72e22ba6-81fa-4b3e-abf5-23d886ad1dea.svg" colorClass="text-rose-500" />
                                <StatCard title="営業利益" value={formatYen(currentViewData.profit)} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.profit, currentViewData.prevProfit)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_33bb072f-fe8f-4a20-8e5a-0bc5f53bde3d.svg" colorClass="text-emerald-500" />
                                <StatCard title="入会数" value={`${currentViewData.newEnrollments}名`} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.newEnrollments, currentViewData.prevNewEnrollments)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_c7c5b948-913f-4f31-903b-c8a91774107f.svg" colorClass="text-emerald-500" />
                                <StatCard title="退会数" value={`${currentViewData.withdrawals}名`} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.withdrawals, currentViewData.prevWithdrawals)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_28d76d55-88ab-48e9-b098-dc838ba040c2.svg" colorClass="text-rose-500" />
                                <StatCard title="在籍生徒数" value={`${currentViewData.totalStudents}名`} subValue="期間末" iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_cd586213-916c-4b50-b0c3-deb64e7fdd8a.svg" colorClass="text-brand-blue" />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-brand-blue"/> 収支サマリー ({viewLabel})</h3>
                                    <ResponsiveContainer width="100%" height="90%">
                                        {viewMode === 'monthly' ? (
                                            <BarChart data={monthlySummaryData} layout="vertical" margin={{left: 20}}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" />
                                                <YAxis dataKey="name" type="category" width={80} />
                                                <Tooltip formatter={(value)=>formatYen(value)} />
                                                <Bar dataKey="value" name="金額" radius={[0, 4, 4, 0]}>
                                                    {monthlySummaryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                                </Bar>
                                            </BarChart>
                                        ) : (
                                            <ComposedChart data={displayData} onMouseMove={handleChartHover} onMouseLeave={handleChartLeave}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" interval={0} />
                                                <YAxis />
                                                <Tooltip formatter={(value)=>formatYen(value)} />
                                                <Legend />
                                                <Bar dataKey="revenue" name="売上" fill={COLORS.revenue} barSize={20} />
                                                <Bar dataKey="expense" name="費用" fill={COLORS.labor} barSize={20} />
                                                <Line type="monotone" dataKey="profit" name="営業利益" stroke={COLORS.profit} strokeWidth={3} />
                                            </ComposedChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><Users className="w-5 h-5 mr-2 text-brand-orange"/> 生徒数推移 (増減要因)</h3>
                                    <ResponsiveContainer width="100%" height="90%">
                                        <BarChart data={displayData} stackOffset="sign" onMouseMove={handleChartHover} onMouseLeave={handleChartLeave}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" interval={0} />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <ReferenceLine y={0} stroke="#000" />
                                            <Bar dataKey="newEnrollments" name="入会" fill="#10B981" stackId="stack" />
                                            <Bar dataKey="transferIns" name="転入" fill="#06B6D4" stackId="stack" />
                                            <Bar dataKey="withdrawals_neg" name="退会" fill="#EF4444" stackId="stack" />
                                            <Bar dataKey="graduates_neg" name="卒業" fill="#A855F7" stackId="stack" />
                                            <Bar dataKey="transfers_neg" name="転校" fill="#F97316" stackId="stack" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'pl' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                <StatCard title="売上" value={formatYen(currentViewData.revenue)} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.revenue, currentViewData.prevRevenue)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_1eb00716-6ac0-4be4-9b78-e8e9be44198e.svg" colorClass="text-brand-blue" />
                                <StatCard title="費用" value={formatYen(currentViewData.expense)} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.expense, currentViewData.prevExpense)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_72e22ba6-81fa-4b3e-abf5-23d886ad1dea.svg" colorClass="text-rose-500" />
                                <StatCard title="営業利益" value={formatYen(currentViewData.profit)} subValue={currentViewData.periodLabel} yoy={calcYoY(currentViewData.profit, currentViewData.prevProfit)} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_33bb072f-fe8f-4a20-8e5a-0bc5f53bde3d.svg" colorClass="text-emerald-500" />
                                <StatCard title="アルバイト人件費率" value={`${currentViewData.revenue > 0 ? (currentViewData.partTime / currentViewData.revenue * 100).toFixed(1) : 0}%`} subValue="売上比" iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_f93e0546-f8d7-464b-b008-882ad339027e.svg" colorClass="text-rose-500" />
                                <StatCard title="利益率" value={`${currentViewData.revenue ? ((currentViewData.profit/currentViewData.revenue)*100).toFixed(1) : 0}%`} subValue="売上対比" iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_d71099f5-a933-4295-9991-75c16e130f81.svg" colorClass="text-brand-orange" />
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[500px]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-brand-blue"/> 詳細収支推移 ({viewLabel})</h3>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500">表示科目:</span>
                                        <select value={plViewCategory} onChange={(e) => setPlViewCategory(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 outline-none">
                                            <option value="all">全体 (サマリー)</option>
                                            <option value="revenue">売上</option>
                                            <option value="ad">広告宣伝費</option>
                                            <option value="sales">販売費</option>
                                            <option value="labor">人件費</option>
                                            <option value="facility">設備費</option>
                                            <option value="admin">一般管理費</option>
                                            <option value="hq">本社費</option>
                                        </select>
                                    </div>
                                </div>
                                {viewMode === 'monthly' ? (
                                    <div className="grid grid-cols-2 gap-8 h-full">
                                            <div className="overflow-x-auto h-full">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                                    <tr><th className="px-4 py-2 text-left">科目</th><th className="px-4 py-2 text-right">実績</th><th className="px-4 py-2 text-right">売上比</th><th className="px-4 py-2 text-right">前年</th><th className="px-4 py-2 text-right">前年比</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {monthlySummaryData.map((item) => {
                                                        const isProfit = item.id === 'profit';
                                                        const ratio = monthlySummaryData[0].value > 0 ? (item.value / monthlySummaryData[0].value * 100).toFixed(1) : '-';
                                                        const yoy = item.prev > 0 ? ((item.value - item.prev) / item.prev * 100).toFixed(1) : '-';
                                                        return (
                                                            <tr key={item.id} onClick={() => handlePLRowClick(item)} className={`hover:bg-blue-50 cursor-pointer ${selectedPLItem?.id === item.id ? 'bg-blue-50' : ''}`}>
                                                                <td className="px-4 py-3 font-bold text-gray-700 flex items-center"><div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: item.fill}}></div>{item.name}</td>
                                                                <td className="px-4 py-3 text-right">{formatYen(item.value)}</td>
                                                                <td className="px-4 py-3 text-right text-gray-500">{ratio}%</td>
                                                                <td className="px-4 py-3 text-right text-gray-400">{formatYen(item.prev)}</td>
                                                                <td className={`px-4 py-3 text-right font-bold ${yoy > 0 ? (isProfit ? 'text-emerald-600' : 'text-rose-600') : (isProfit ? 'text-rose-600' : 'text-emerald-600')}`}>{yoy !== '-' ? yoy + '%' : '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="h-full flex flex-col">
                                                {selectedPLItem ? (
                                                    <>
                                                    <h3 className="text-lg font-bold text-gray-800 mb-2">{selectedPLItem.name} 詳細</h3>
                                                    <div className="flex-1 overflow-y-auto">
                                                        {monthDataForPL.detailItems[selectedPLItem.id]?.map((d, i) => (
                                                            <div key={i} className="flex justify-between p-2 border-b border-gray-50 text-sm"><span>{d.name}</span><span>{formatYen(d.value)}</span></div>
                                                        ))}
                                                    </div>
                                                    </>
                                                ) : <div className="flex items-center justify-center h-full text-gray-400">科目を選択してください</div>}
                                        </div>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="90%">
                                        {plViewCategory === 'all' ? (
                                            <ComposedChart data={displayData} stackOffset="sign" onMouseMove={handleChartHover} onMouseLeave={handleChartLeave}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" interval={0} />
                                                <YAxis />
                                                <Tooltip formatter={(value)=>formatYen(value)} />
                                                <Legend />
                                                <Bar dataKey="ad" name="広告宣伝費" stackId="exp" fill={COLORS.ad} onClick={(data, i) => onBarClick(data, i, null, 'ad')} cursor="pointer"/>
                                                <Bar dataKey="sales" name="販売費" stackId="exp" fill={COLORS.sales} onClick={(data, i) => onBarClick(data, i, null, 'sales')} cursor="pointer"/>
                                                <Bar dataKey="labor" name="人件費" stackId="exp" fill={COLORS.labor} onClick={(data, i) => onBarClick(data, i, null, 'labor')} cursor="pointer"/>
                                                <Bar dataKey="facility" name="設備費" stackId="exp" fill={COLORS.facility} onClick={(data, i) => onBarClick(data, i, null, 'facility')} cursor="pointer"/>
                                                <Bar dataKey="admin" name="一般管理費" stackId="exp" fill={COLORS.admin} onClick={(data, i) => onBarClick(data, i, null, 'admin')} cursor="pointer"/>
                                                <Bar dataKey="hq" name="本社費" stackId="exp" fill={COLORS.hq} onClick={(data, i) => onBarClick(data, i, null, 'hq')} cursor="pointer"/>
                                                <Bar dataKey="other" name="その他" stackId="exp" fill={COLORS.other} onClick={(data, i) => onBarClick(data, i, null, 'other')} cursor="pointer"/>
                                                <Line type="monotone" dataKey="revenue" name="売上" stroke={COLORS.revenue} strokeWidth={3} />
                                                <Line type="monotone" dataKey="profit" name="営業利益" stroke={COLORS.profit} strokeWidth={2} strokeDasharray="5 5" />
                                            </ComposedChart>
                                        ) : (
                                            <BarChart data={plChartData.data}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" interval={0} />
                                                <YAxis />
                                                <Tooltip formatter={(value)=>formatYen(value)} />
                                                <Legend />
                                                {plChartData.keys.map((key, index) => (
                                                    <Bar key={key} dataKey={key} stackId="a" fill={SUB_COLORS[index % SUB_COLORS.length]} />
                                                ))}
                                            </BarChart>
                                        )}
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'students' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <StatCard title="期間内増加" value={`${currentViewData.increase}名`} subValue={currentViewData.periodLabel} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_d71099f5-a933-4295-9991-75c16e130f81.svg" colorClass="text-emerald-500" details={[{label:'入会', value:currentViewData.newEnrollments}, {label:'転入', value:currentViewData.transferIns}]} />
                                <StatCard title="期間内減少" value={`${currentViewData.decrease}名`} subValue={currentViewData.periodLabel} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_c22e686d-38dc-4fb6-bcf8-dc71adcf9d99.svg" colorClass="text-rose-500" details={[{label:'退会', value:currentViewData.withdrawals}, {label:'転校', value:currentViewData.transfers}, {label:'卒業', value:currentViewData.graduates}]} />
                                <StatCard title="純増数" value={`${currentViewData.netIncrease > 0 ? '+' : ''}${currentViewData.netIncrease}名`} subValue={currentViewData.periodLabel} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_c7c5b948-913f-4f31-903b-c8a91774107f.svg" colorClass={currentViewData.netIncrease >= 0 ? "text-emerald-500" : "text-rose-500"} />
                                <StatCard title="在籍生徒数" value={`${currentViewData.totalStudents}名`} subValue={hoveredData ? currentViewData.periodLabel : (viewMode==='annual'?'年度末':'月末')} iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_cd586213-916c-4b50-b0c3-deb64e7fdd8a.svg" colorClass="text-brand-blue" />
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[500px]">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">生徒数増減詳細 (折れ線: 在籍生徒数)</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={displayData} stackOffset="sign" onMouseMove={handleChartHover} onMouseLeave={handleChartLeave}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" interval={0} tick={viewMode === 'weekly' ? WeeklyAxisTick : undefined} />
                                        <YAxis yAxisId="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip />
                                        <Legend />
                                        <ReferenceLine y={0} stroke="#000" yAxisId="left" />
                                        <Bar yAxisId="left" dataKey="newEnrollments" name="入会" fill="#10b981" stackId="stack" />
                                        <Bar yAxisId="left" dataKey="transferIns" name="転入" fill="#06B6D4" stackId="stack" />
                                        <Bar yAxisId="left" dataKey="withdrawals_neg" name="退会" fill="#EF4444" stackId="stack" />
                                        <Bar yAxisId="left" dataKey="graduates_neg" name="卒業" fill="#A855F7" stackId="stack" />
                                        <Bar yAxisId="left" dataKey="transfers_neg" name="転校" fill="#F97316" stackId="stack" />
                                        <Line yAxisId="right" type="monotone" dataKey="students" name="在籍生徒数" stroke="#1E51A2" strokeWidth={3} dot={{r: 4}} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {activeTab === 'marketing' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <StatCard 
                                    title="門配数" 
                                    value={Number(currentViewData.flyers).toLocaleString()} 
                                    subValue="枚" 
                                    iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_c2a71fb3-8a17-487f-9a43-8bbaf4fd5dbc.svg" 
                                    colorClass="text-brand-blue"
                                    planRatio={calcPlanRatio(currentViewData.flyers, currentPlanData.flyers)}
                                />
                                <StatCard 
                                    title="T&T数" 
                                    value={`${currentViewData.touchTry}名`} 
                                    subValue="回" 
                                    iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_c70b5f6d-6213-489c-bd5e-e3f6ce379f23.svg" 
                                    colorClass="text-emerald-500"
                                    planRatio={calcPlanRatio(currentViewData.touchTry, currentPlanData.touchTry)}
                                />
                                <StatCard 
                                    title="体験・イベント申込" 
                                    value={`${currentViewData.totalApps}名`} 
                                    subValue={`体験:${currentViewData.trialApp} / イベ:${currentViewData.eventApp}`} 
                                    iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-1523x1551_v-fms_webp_aac06d68-945a-47cb-95d6-19c1f545a656.png" 
                                    colorClass="text-brand-blue"
                                    planRatio={calcPlanRatio(currentViewData.totalApps, currentPlanData.trialApp)}
                                />
                                <StatCard 
                                    title="体験会実施" 
                                    value={`${currentViewData.trialActual}名`} 
                                    subValue="回" 
                                    iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_8a59c5ac-e140-4c01-a48b-c32bbeec5af0.svg" 
                                    colorClass="text-brand-orange"
                                    planRatio={calcPlanRatio(currentViewData.trialActual, currentPlanData.trialActual)}
                                />
                                <StatCard 
                                    title="入会数" 
                                    value={`${currentViewData.newEnrollments}名`} 
                                    subValue="人" 
                                    iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_963a0f4f-287f-4143-8c66-6c301ca67ae8.svg" 
                                    colorClass="text-emerald-600"
                                    planRatio={calcPlanRatio(currentViewData.newEnrollments, currentPlanData.enrollments)}
                                />
                                <StatCard 
                                    title="入会率" 
                                    value={`${currentViewData.rate}%`} 
                                    subValue="入会 ÷ 実施" 
                                    iconUrl="https://storage.googleapis.com/studio-design-asset-files/projects/nBW2jZ2ZWv/s-150x150_d71099f5-a933-4295-9991-75c16e130f81.svg" 
                                    colorClass="text-rose-500"
                                />
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[500px]">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">集客ファネル推移 ({viewLabel})</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={displayData} onMouseMove={handleChartHover} onMouseLeave={handleChartLeave}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" interval={0} tick={viewMode === 'weekly' ? WeeklyAxisTick : undefined} />
                                        <YAxis yAxisId="left" orientation="left" />
                                        <YAxis yAxisId="right" orientation="right" />
                                        <Tooltip />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="flyers" name="門配数" stackId="contact" fill="#94a3b8" />
                                        <Bar yAxisId="left" dataKey="touchTry" name="T&T数" stackId="contact" fill="#82ca9d" />
                                        <Bar yAxisId="right" dataKey="trialApp" name="体験申込" stackId="app" fill="#3b82f6" />
                                        <Bar yAxisId="right" dataKey="eventApp" name="イベント申込" stackId="app" fill="#93c5fd" />
                                        <Bar yAxisId="right" dataKey="trialScheduled" name="体験予約" stackId="sch" fill="#facc15" />
                                        <Bar yAxisId="right" dataKey="eventScheduled" name="イベント予約" stackId="sch" fill="#fde047" />
                                        <Bar yAxisId="right" dataKey="trialActual" name="体験実施" fill="#f97316" />
                                        <Line yAxisId="right" type="monotone" dataKey="newEnrollments" name="入会数" stroke="#10b981" strokeWidth={3} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'settings' && (
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-6">登録済み校舎 ({campusList.length})</h3>
                            <div className="flex gap-4 items-end mb-10">
                                <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-2">ID (英数)</label><input type="text" value={newCampusId} onChange={e=>setNewCampusId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue" placeholder="shibuya"/></div>
                                <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-2">校舎名</label><input type="text" value={newCampusName} onChange={e=>setNewCampusName(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue" placeholder="渋谷校"/></div>
                                <button onClick={handleAddCampus} className="bg-brand-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">登録</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {campusList.map((c, index)=>(
                                    <div key={c.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex justify-between items-center group hover:shadow-md transition-shadow">
                                        <div><div className="font-bold text-gray-700">{c.name}</div><div className="text-xs text-gray-400">{c.id}</div></div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1 mr-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleReorder(index, -1)} disabled={index === 0 || isReordering} className="p-1 hover:text-brand-blue disabled:opacity-20"><ArrowUp className="w-4 h-4"/></button>
                                                <button onClick={() => handleReorder(index, 1)} disabled={index === campusList.length - 1 || isReordering} className="p-1 hover:text-brand-blue disabled:opacity-20"><ArrowDown className="w-4 h-4"/></button>
                                            </div>
                                            <button onClick={() => openEditCampus(c)} className="text-gray-400 hover:text-brand-blue p-2"><Edit2 className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteCampus(c.id, c.name)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}