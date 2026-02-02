// ==========================================
// 校舎コンソール (src/pages/SchoolConsole/index.jsx)
// ==========================================

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
    doc, setDoc, deleteDoc, serverTimestamp, getDoc, collection, 
    query, where, getDocs, writeBatch 
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { YEARS_LIST, MONTHS_LIST } from "../../utils/constants";
import { processDashboardData, getWeeksStruct } from "../../utils/calculations";
import { formatDateStr, parseDate } from "../../utils/formatters";
import { 
    Loader2, Calendar, Save, Trash2, PenTool, School, LogOut, 
    Upload, Printer, FileSpreadsheet, Lock, Sun, Cloud, CloudRain, 
    Snowflake, Ban, TrendingUp, AlertCircle, FileText, CheckCircle2 
} from "lucide-react";

// コンポーネントのインポート
import { ReportView } from "../../components/reports/ReportView";
import { AnnualReportView } from "../../components/reports/AnnualReportView";
import { CsvUploader } from "../../components/dashboard/CsvUploader";

// --- サブコンポーネント: CSVインポートパネル ---
const CSVImportPanel = ({ campus, refreshData, showNotify }) => {
    const dailyFileRef = useRef(null);
    const planFileRef = useRef(null);
    const [importType, setImportType] = useState('daily');
    const [isProcessing, setIsProcessing] = useState(false);

    const parseCSV = (file, callback) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                showNotify("データが含まれていないか、ヘッダーのみのようです", "error");
                return;
            }
            callback(lines);
        };
        reader.readAsText(file, 'Shift_JIS');
    };

    const handleDailyImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsProcessing(true);

        parseCSV(file, async (lines) => {
            try {
                const batchLimit = 450;
                let batch = writeBatch(db);
                let count = 0;
                let totalCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (!cols[0]) continue;
                    
                    const dateParts = cols[0].split(/[\/\-]/);
                    if (dateParts.length !== 3) {
                        console.warn(`日付形式エラー行: ${i+1} [${cols[0]}]`);
                        continue;
                    }

                    const y = dateParts[0];
                    const m = ('0' + dateParts[1]).slice(-2);
                    const d = ('0' + dateParts[2]).slice(-2);
                    const dateStr = `${y}-${m}-${d}`;

                    const weatherMap = { '晴': 'sunny', '曇': 'cloudy', '雨': 'rainy', '雪': 'snowy', '休': 'closed' };
                    const weather = weatherMap[cols[1]] || 'sunny';
                    
                    const flyers = cols[2] === '' ? 0 : Number(cols[2]);
                    const touchTry = cols[3] === '' ? 0 : Number(cols[3]);
                    const trialLessons = cols[4] === '' ? 0 : Number(cols[4]);
                    const comment = cols[5] || '';

                    const docRef = doc(db, "daily_reports", `${campus.id}_${dateStr}`);
                    batch.set(docRef, {
                        campusId: campus.id,
                        date: dateStr,
                        weather,
                        flyers: isNaN(flyers) ? 0 : flyers,
                        touchTry: isNaN(touchTry) ? 0 : touchTry,
                        trialLessons: isNaN(trialLessons) ? 0 : trialLessons,
                        comment,
                        updatedAt: serverTimestamp()
                    });

                    count++;
                    totalCount++;

                    if (count >= batchLimit) {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    }
                }
                if (count > 0) await batch.commit();
                
                showNotify(`${totalCount}件の日報データを取り込みました`);
                refreshData();
            } catch (err) {
                console.error("Import Error Details:", err);
                showNotify("取込エラー: " + err.message, "error");
            } finally {
                setIsProcessing(false);
                if (dailyFileRef.current) dailyFileRef.current.value = "";
            }
        });
    };

    const handlePlanImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsProcessing(true);

        parseCSV(file, async (lines) => {
            try {
                const updates = {}; 

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim());
                    if (!cols[0] || !cols[1] || !cols[2]) continue;

                    const year = Number(cols[0]);
                    const month = cols[1]; 
                    const weekStr = cols[2]; 
                    const weekIndex = parseInt(weekStr.replace(/[^0-9]/g, '')) - 1;

                    if (isNaN(weekIndex) || weekIndex < 0) continue;

                    if (!updates[year]) updates[year] = {};
                    if (!updates[year][month]) updates[year][month] = {};

                    updates[year][month][weekIndex] = {
                        touchTry: Number(cols[3]) || 0,
                        flyers: Number(cols[4]) || 0,
                        trialApp: Number(cols[5]) || 0,
                        trialParticipation: Number(cols[6]) || 0,
                        enrollments: Number(cols[7]) || 0
                    };
                }

                for (const year of Object.keys(updates)) {
                    const docRef = doc(db, "campus_plans", `${campus.id}_${year}`);
                    const snap = await getDoc(docRef);
                    let plans = snap.exists() ? snap.data().plans : {};

                    Object.keys(updates[year]).forEach(month => {
                        if (!plans[month]) plans[month] = { weeks: [] };
                        if (!plans[month].weeks) plans[month].weeks = [];

                        Object.keys(updates[year][month]).forEach(wIdx => {
                            while (plans[month].weeks.length <= wIdx) {
                                plans[month].weeks.push({});
                            }
                            plans[month].weeks[wIdx] = {
                                ...plans[month].weeks[wIdx],
                                ...updates[year][month][wIdx]
                            };
                        });
                    });

                    await setDoc(docRef, {
                        campusId: campus.id,
                        year: Number(year),
                        plans: plans,
                        updatedAt: serverTimestamp()
                    });
                }

                showNotify("週次計画データを取り込みました");
                refreshData();
            } catch (err) {
                console.error(err);
                showNotify("取込エラー: " + err.message, "error");
            } finally {
                setIsProcessing(false);
                if (planFileRef.current) planFileRef.current.value = "";
            }
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center">
                    <Upload className="w-5 h-5 mr-2 text-brand-blue"/> データ一括取込
                </h3>

                <div className="flex gap-4 mb-6">
                    <button onClick={()=>setImportType('daily')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${importType==='daily' ? 'bg-brand-blue text-white shadow' : 'bg-gray-100 text-gray-500'}`}>日報データ</button>
                    <button onClick={()=>setImportType('plan')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${importType==='plan' ? 'bg-brand-blue text-white shadow' : 'bg-gray-100 text-gray-500'}`}>週次計画データ</button>
                </div>

                {importType === 'daily' && (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-blue-50 transition-colors">
                        <h4 className="font-bold text-gray-700 mb-2">日報CSVのアップロード</h4>
                        <p className="text-xs text-gray-500 mb-6">形式: 日付(yyyy/mm/dd), 天気, 門配数, T&T数, 体験実施数, コメント</p>
                        
                        <input type="file" ref={dailyFileRef} accept=".csv" onChange={handleDailyImport} className="hidden" />
                        <button 
                            onClick={() => dailyFileRef.current?.click()} 
                            disabled={isProcessing}
                            className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-white hover:border-brand-blue hover:text-brand-blue shadow-sm flex items-center justify-center mx-auto transition-all"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <FileText className="w-5 h-5 mr-2 text-brand-orange"/>}
                            CSVファイルを選択
                        </button>
                        <p className="mt-2 text-[10px] text-gray-400">※日付は「2025/1/1」形式でも自動補正して取り込みます</p>
                    </div>
                )}

                {importType === 'plan' && (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-blue-50 transition-colors">
                        <h4 className="font-bold text-gray-700 mb-2">週次計画CSVのアップロード</h4>
                        <p className="text-xs text-gray-500 mb-6">形式: 年度, 月(例:4月), 週(例:第1週), T&T, 門配, 体験申込, 体験実施, 入会</p>
                        
                        <input type="file" ref={planFileRef} accept=".csv" onChange={handlePlanImport} className="hidden" />
                        <button 
                            onClick={() => planFileRef.current?.click()} 
                            disabled={isProcessing}
                            className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-white hover:border-brand-blue hover:text-brand-blue shadow-sm flex items-center justify-center mx-auto transition-all"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <TrendingUp className="w-5 h-5 mr-2 text-brand-orange"/>}
                            CSVファイルを選択
                        </button>
                    </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-blue-800 border border-blue-100">
                    <p className="font-bold mb-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1"/>注意点:</p>
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>文字コードは <strong>Shift_JIS</strong> で保存されたCSVを使用してください。</li>
                        <li>1行目はヘッダーとしてスキップされます。</li>
                        <li>既存のデータがある日付や週は、CSVの内容で<strong>上書き</strong>されます。</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// --- 校舎コンソールメインコンポーネント ---
export default function SchoolConsole({ onBack, campus, allData, selectedYear, setSelectedYear, refreshData, showNotify, isAdmin }) {
    const [activeTab, setActiveTab] = useState('daily');
    const [planMode, setPlanMode] = useState('annual'); // 'annual' | 'monthly'
    const [reportMode, setReportMode] = useState('monthly'); // 'monthly' | 'annual'
    const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return (d.getMonth() + 1) + '月'; });
    const [reportDate, setReportDate] = useState(formatDateStr(new Date()));
    const [inputData, setInputData] = useState({ weather: 'sunny', flyers: 0, touch: 0, trial: 0, comment: '' });
    const [uploading, setUploading] = useState(false);
    const [planData, setPlanData] = useState({ initialStudents: 0 }); 
    const [isSavingPlan, setIsSavingPlan] = useState(false);
    const [uploadTargetYear, setUploadTargetYear] = useState(selectedYear);
    const [isInputModalOpen, setIsInputModalOpen] = useState(false);

    const reportStyle = `
        @media print {
            @page { 
                size: A4 ${reportMode === 'annual' ? 'landscape' : 'portrait'}; 
                margin: 5mm; 
            }
            body {
                zoom: ${reportMode === 'annual' ? '0.9' : '0.83'};
            }
        }
        .report-preview-wrapper {
            width: ${reportMode === 'annual' ? '297mm' : '210mm'} !important;
            min-height: ${reportMode === 'annual' ? '210mm' : '297mm'} !important;
        }
    `;

    const dashboardData = useMemo(() => {
        if (!campus) return [];
        return processDashboardData([campus], allData.enrollments, allData.statusChanges, allData.transfers, allData.dailyReports, allData.financials, allData.trialApps, Number(selectedYear));
    }, [campus, allData, selectedYear]);

    const currentMonthData = useMemo(() => {
        return dashboardData.find(d => d.name === selectedMonth) || { daily: [], weekly: [], students: 0, newEnrollments: 0, withdrawals: 0 };
    }, [dashboardData, selectedMonth]);

    const lastUploadInfo = useMemo(() => {
        if (!campus || !allData.financialUpdates) return null;
        const update = allData.financialUpdates.find(u => u.campusId === campus.id && u.fiscalYear === uploadTargetYear);
        return update ? parseDate(update.updatedAt) : null;
    }, [campus, allData.financialUpdates, uploadTargetYear]);

    const currentWeeksStruct = useMemo(() => {
        const mIdx = MONTHS_LIST.indexOf(selectedMonth);
        return getWeeksStruct(Number(selectedYear), mIdx);
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        if (activeTab === 'plan' || activeTab === 'report') {
            const fetchPlan = async () => {
                try {
                    const docRef = doc(db, "campus_plans", `${campus.id}_${selectedYear}`);
                    const docSnap = await getDoc(docRef);
                    setPlanData(docSnap.exists() ? { initialStudents: 0, ...docSnap.data().plans } : { initialStudents: 0 });
                } catch (e) { console.error(e); }
            };
            fetchPlan();
        }
    }, [activeTab, campus, selectedYear]);

    const calculatedPlanData = useMemo(() => {
        const newData = { ...planData };
        let currentStudentCount = Number(newData.initialStudents) || 0;
        
        MONTHS_LIST.forEach(m => {
            if (!newData[m]) newData[m] = {};
            const enroll = Number(newData[m].enrollments || 0);
            const withdraw = Number(newData[m].withdrawals || 0);
            const monthEndStudents = currentStudentCount + enroll - withdraw;
            newData[m].students = monthEndStudents;
            currentStudentCount = monthEndStudents;
        });
        return newData;
    }, [planData]);

    useEffect(() => {
        if (!campus) return;
        const existing = allData.dailyReports.find(r => r.campusId === campus.id && r.date === reportDate);
        if (existing) {
            setInputData({
                weather: existing.weather || 'sunny', 
                flyers: existing.flyers || 0, 
                touch: existing.touchTry || 0, 
                trial: existing.trialLessons || 0,
                comment: existing.comment || ''
            });
        } else { 
            setInputData({ weather: 'sunny', flyers: 0, touch: 0, trial: 0, comment: '' }); 
        }
    }, [reportDate, allData.dailyReports, campus]);

    const handleDateClick = (dateStr) => { setReportDate(dateStr); setIsInputModalOpen(true); };
    
    const handleSaveReport = async () => {
        if (!campus) return;
        try {
            await setDoc(doc(db, "daily_reports", `${campus.id}_${reportDate}`), {
                campusId: campus.id, 
                date: reportDate, 
                weather: inputData.weather,
                flyers: Number(inputData.flyers), 
                touchTry: Number(inputData.touch), 
                trialLessons: Number(inputData.trial),
                comment: inputData.comment,
                updatedAt: serverTimestamp()
            });
            refreshData(); showNotify("日報を保存しました"); setIsInputModalOpen(false);
        } catch(e) { showNotify("エラー: " + e.message, 'error'); }
    };

    const handleDeleteReport = async () => {
        if (!campus) return;
        if (!confirm("この日の日報データを完全に削除（リセット）しますか？")) return;
        try {
            await deleteDoc(doc(db, "daily_reports", `${campus.id}_${reportDate}`));
            setInputData({ weather: 'sunny', flyers: 0, touch: 0, trial: 0, comment: '' });
            refreshData(); 
            showNotify("日報データを削除しました"); 
            setIsInputModalOpen(false);
        } catch(e) { showNotify("削除エラー: " + e.message, 'error'); }
    };

    const updatePlanData = (month, key, value, weekIndex = null) => {
        let normalizedValue = value;
        if (typeof value === 'string') {
            normalizedValue = value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        }
        const newValue = normalizedValue === '' ? '' : Number(normalizedValue);

        setPlanData(prev => {
            const newData = { ...prev };
            if (month === 'initial' && key === 'students') {
                newData.initialStudents = newValue;
                return newData;
            }
            if (!newData[month]) newData[month] = {};
            if (weekIndex !== null) {
                if (!newData[month].weeks) newData[month].weeks = [];
                const weeks = [...newData[month].weeks];
                if (!weeks[weekIndex]) weeks[weekIndex] = {};
                weeks[weekIndex] = { ...weeks[weekIndex], [key]: newValue };
                newData[month].weeks = weeks;
            } else {
                newData[month] = { ...newData[month], [key]: newValue };
            }
            return newData;
        });
    };

    const handleSavePlan = async () => {
        if (!campus) return;
        setIsSavingPlan(true);
        try {
            await setDoc(doc(db, "campus_plans", `${campus.id}_${selectedYear}`), { campusId: campus.id, year: selectedYear, plans: planData, updatedAt: serverTimestamp() });
            showNotify("計画を保存しました");
        } catch (e) { showNotify("保存失敗: " + e.message, 'error'); } finally { setIsSavingPlan(false); }
    };
    
    let currentStudentCount = Number(planData.initialStudents) || 0;

    const weeklyTotals = useMemo(() => {
        if (!planData[selectedMonth]?.weeks) return { touchTry:0, flyers:0, trialApp:0, trialParticipation:0, enrollments:0 };
        return planData[selectedMonth].weeks.reduce((acc, curr) => ({
            touchTry: acc.touchTry + (curr?.touchTry || 0),
            flyers: acc.flyers + (curr?.flyers || 0),
            trialApp: acc.trialApp + (curr?.trialApp || 0),
            trialParticipation: acc.trialParticipation + (curr?.trialParticipation || 0),
            enrollments: acc.enrollments + (curr?.enrollments || 0),
        }), { touchTry:0, flyers:0, trialApp:0, trialParticipation:0, enrollments:0 });
    }, [planData, selectedMonth]);
    
    const handleCsvUpload = async (parsedData) => {
        if (!campus) return;
        setUploading(true);
        try {
            const batchSize = 450; 
            const q = query(collection(db, "financials"), where("campusId", "==", campus.id), where("fiscalYear", "==", uploadTargetYear));
            const snapshot = await getDocs(q);
            const chunks = [];
            for (let i = 0; i < snapshot.docs.length; i += batchSize) chunks.push(snapshot.docs.slice(i, i + batchSize));
            for (const chunk of chunks) { const deleteBatch = writeBatch(db); chunk.forEach(doc => deleteBatch.delete(doc.ref)); await deleteBatch.commit(); }
            const insertChunks = [];
            for (let i = 0; i < parsedData.length; i += batchSize) insertChunks.push(parsedData.slice(i, i + batchSize));
            for (const chunk of insertChunks) {
                const insertBatch = writeBatch(db);
                chunk.forEach(item => {
                    let tYear = Number(uploadTargetYear); if (item.month <= 3) tYear += 1;
                    const dateStr = `${tYear}-${('0'+item.month).slice(-2)}-01`;
                    const ref = doc(collection(db, "financials"));
                    insertBatch.set(ref, { 
                        date: dateStr, fiscalYear: uploadTargetYear, amount: item.amount, 
                        category: item.category, subCategory: item.subCategory, accountCode: item.accountCode,
                        campusId: campus.id, createdAt: serverTimestamp() 
                    });
                });
                await insertBatch.commit();
            }
            await setDoc(doc(db, "financial_updates", `${campus.id}_${uploadTargetYear}`), { campusId: campus.id, fiscalYear: uploadTargetYear, updatedAt: serverTimestamp() });
            refreshData(); showNotify(`${parsedData.length}件のデータを取り込みました (重複削除済み)`);
        } catch (e) { showNotify("エラー: " + e.message, 'error'); } finally { setUploading(false); }
    };

    if (!campus) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-blue"/></div>;
    const weatherMap = { sunny: {i:Sun,l:'晴',c:'text-orange-500'}, cloudy: {i:Cloud,l:'曇',c:'text-gray-500'}, rainy: {i:CloudRain,l:'雨',c:'text-blue-500'}, snowy: {i:Snowflake,l:'雪',c:'text-cyan-500'}, closed: {i:Ban,l:'休',c:'text-red-500'} };
    
    const isJanFebMar = ['1月', '2月', '3月'].includes(selectedMonth);
    const displayCalendarYear = isJanFebMar ? Number(selectedYear) + 1 : Number(selectedYear);

    return (
        <div className="flex h-screen bg-brand-slate overflow-hidden fade-in print:block print:h-auto print:overflow-visible print:bg-white">
            <style>{reportStyle}</style>

            <div className="print-only">
                    {reportMode === 'monthly' ? (
                    <ReportView 
                        year={displayCalendarYear} 
                        month={selectedMonth} 
                        campus={campus} 
                        dailyData={currentMonthData.daily} 
                        weeklyData={currentMonthData.weekly} 
                        planData={calculatedPlanData} 
                        summaryData={{
                            students: currentMonthData.students,
                            newEnrollments: currentMonthData.newEnrollments,
                            withdrawals: currentMonthData.withdrawals
                        }}
                        />
                    ) : (
                    <AnnualReportView 
                        year={selectedYear}
                        campus={campus}
                        planData={calculatedPlanData}
                    />
                    )}
            </div>

            {isInputModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay backdrop-blur-sm transition-opacity no-print" onClick={() => setIsInputModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center"><PenTool className="w-5 h-5 mr-2 text-brand-blue"/> 日報入力</h3>
                            <div className="text-sm font-bold text-gray-500">{reportDate}</div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-2">天気</label>
                                <div className="flex gap-2 justify-between">
                                    {Object.entries(weatherMap).map(([k,v])=><button key={k} onClick={()=>setInputData({...inputData,weather:k})} className={`flex-1 py-2 rounded-lg border flex flex-col items-center justify-center transition-colors ${inputData.weather===k?'bg-blue-50 border-brand-blue':'border-gray-100 hover:bg-gray-50'}`}><v.i className={`w-4 h-4 mb-1 ${v.c}`}/><span className="text-[10px] font-bold text-gray-500">{v.l}</span></button>)}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">門配数</label>
                                    <input type="number" value={inputData.flyers} onChange={e => { const val = e.target.value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)); setInputData({...inputData, flyers: val}); }} className="w-full border rounded p-2 text-right font-bold text-gray-700"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">T&T数</label>
                                    <input type="number" value={inputData.touch} onChange={e => { const val = e.target.value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)); setInputData({...inputData, touch: val}); }} className="w-full border rounded p-2 text-right font-bold text-gray-700"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">体験会実施数</label>
                                <input type="number" value={inputData.trial} onChange={e => { const val = e.target.value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)); setInputData({...inputData, trial: val}); }} className="w-full border rounded p-2 text-right font-bold text-gray-700"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">コメント (100文字以内)</label>
                                <textarea value={inputData.comment} onChange={e=>setInputData({...inputData,comment:e.target.value})} maxLength={100} className="w-full border rounded p-2 text-sm text-gray-700 h-20 resize-none focus:ring-2 focus:ring-brand-orange outline-none" placeholder="特記事項があれば入力..."/>
                                <div className="text-right text-[10px] text-gray-400">{inputData.comment.length}/100</div>
                            </div>
                            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                                <button onClick={handleDeleteReport} className="p-3 text-red-500 hover:bg-red-50 rounded-lg" title="データを削除"><Trash2 className="w-5 h-5"/></button>
                                <button onClick={() => setIsInputModalOpen(false)} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 rounded-lg font-bold text-sm">キャンセル</button>
                                <button onClick={handleSaveReport} className="flex-1 bg-brand-orange text-white font-bold py-3 rounded-lg hover:bg-orange-600 shadow-sm flex items-center justify-center text-sm"><Save className="w-4 h-4 mr-2"/>保存</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 no-print">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center space-x-2 mb-1"><School className="w-5 h-5 text-brand-orange" /><span className="font-bold text-sm text-brand-orange">校舎</span></div>
                    <h2 className="text-xl font-bold text-gray-800 truncate">{campus.name}</h2>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {[{id:'daily',l:'日報入力',i:Calendar}, {id:'plan',l:'計画策定',i:FileText}, {id:'import',l:'データ取込',i:Upload}, {id:'report',l:'帳票出力',i:Printer}, {id:'finance',l:'収支取込',i:FileSpreadsheet}].map(t => {
                        if (t.id === 'finance' && !isAdmin) return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className="w-full flex items-center px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors">
                                <div className="relative"><t.i className="w-5 h-5 mr-3" /><Lock className="w-3 h-3 absolute -top-1 -right-1 text-gray-400" /></div>{t.l}
                            </button>
                        );
                        return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${activeTab === t.id ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/30' : 'text-gray-500 hover:bg-gray-50'}`}>
                                <t.i className="w-5 h-5 mr-3" />{t.l}
                            </button>
                        )
                    })}
                </nav>
                <div className="p-4 border-t border-gray-100"><button onClick={onBack} className="flex items-center text-gray-400 hover:text-gray-600 text-sm w-full px-4 py-2"><LogOut className="w-4 h-4 mr-2" /> 戻る</button></div>
            </aside>
            <main className="flex-1 overflow-y-auto no-print">
                <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-20">
                    <h2 className="text-xl font-bold text-gray-800">{{daily:'日報管理', plan:'計画策定', import:'データ一括取込', report:'帳票出力', finance:'収支管理'}[activeTab]}</h2>
                    <div className="flex items-center space-x-4">
                        <select value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-600 focus:ring-2 focus:ring-brand-orange outline-none">
                            {YEARS_LIST.map(y => <option key={y} value={y}>{y}年度</option>)}
                        </select>
                        <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-xs">SC</div>
                    </div>
                </header>
                <div className="p-8 w-full mx-auto">
                    {activeTab === 'daily' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                            <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex justify-between mb-4">
                                    <h3 className="font-bold text-gray-700 flex items-center"><Calendar className="w-4 h-4 mr-2"/> {displayCalendarYear}年 {selectedMonth}</h3>
                                    <div className="flex gap-1">{MONTHS_LIST.map(m=><button key={m} onClick={()=>setSelectedMonth(m)} className={`text-xs px-2 py-1 rounded ${selectedMonth===m?'bg-brand-orange text-white':'text-gray-400 hover:bg-gray-100'}`}>{m}</button>)}</div>
                                </div>
                                <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                                    {['日','月','火','水','木','金','土'].map((d,i)=><div key={i} className="bg-gray-50 text-center py-2 text-xs font-bold text-gray-500">{d}</div>)}
                                    {(() => {
                                        const targetMonthIdx = MONTHS_LIST.indexOf(selectedMonth);
                                        let tYear = Number(selectedYear);
                                        let tMonth = targetMonthIdx + 3; 
                                        if (tMonth > 11) { tMonth -= 12; tYear++; }

                                        const firstDayOfWeek = new Date(tYear, tMonth, 1).getDay();
                                        const daysInMonth = new Date(tYear, tMonth + 1, 0).getDate();

                                        const emptyCells = Array.from({ length: firstDayOfWeek }).map((_, i) => (
                                            <div key={`empty-${i}`} className="bg-gray-50/50 min-h-[96px]" />
                                        ));

                                        const dayCells = Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                            const dateStr = `${tYear}-${('0'+(tMonth+1)).slice(-2)}-${('0'+d).slice(-2)}`; 
                                            const report = allData.dailyReports.find(r => r.campusId === campus.id && r.date === dateStr);
                                            const WeatherIcon = report && weatherMap[report.weather] ? weatherMap[report.weather].i : null;
                                            const isToday = dateStr === formatDateStr(new Date());
                                            
                                            return (
                                                <div key={d} onClick={()=>handleDateClick(dateStr)} className={`bg-white h-24 p-1 cursor-pointer hover:bg-blue-50 relative flex flex-col justify-between border border-transparent hover:border-blue-200 ${isToday?'bg-blue-50/60':''}`}>
                                                    <div className="flex justify-between items-start">
                                                        <span className={`text-xs font-bold ${isToday?'text-brand-blue':'text-gray-700'}`}>{d}</span>
                                                        {WeatherIcon && <WeatherIcon className={`w-3 h-3 ${weatherMap[report.weather].c}`}/>}
                                                    </div>
                                                    {report && (
                                                        <div className="text-[9px] text-gray-500 space-y-0.5">
                                                            <div className="flex justify-between"><span>門配</span><span className="font-bold">{report.flyers}</span></div>
                                                            <div className="flex justify-between"><span>T&T</span><span className="font-bold">{report.touchTry}</span></div>
                                                            <div className="flex justify-between"><span>体験</span><span className="font-bold">{report.trialLessons}</span></div>
                                                            {report.comment && <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-brand-orange rounded-full"></div>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });

                                        return [...emptyCells, ...dayCells];
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'plan' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-gray-800 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-brand-orange"/> {selectedYear}年度 計画策定</h3>
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button onClick={() => setPlanMode('annual')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${planMode==='annual' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500'}`}>年間計画</button>
                                            <button onClick={() => setPlanMode('monthly')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${planMode==='monthly' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-500'}`}>月度計画 (週次)</button>
                                        </div>
                                    </div>
                                    <button onClick={handleSavePlan} disabled={isSavingPlan} className="bg-brand-blue text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center">{isSavingPlan ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Save className="w-4 h-4 mr-2"/>} 保存する</button>
                                </div>

                                {planMode === 'annual' && (
                                    <div className="overflow-x-auto w-full">
                                        <div className="mb-8 w-full">
                                            <h4 className="font-bold text-gray-700 mb-2 border-l-4 border-brand-orange pl-2">1. 生徒・マーケティング計画</h4>
                                            <div className="flex items-center mb-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                                <label className="text-sm font-bold text-gray-600 mr-2">期首生徒数:</label>
                                                <input 
                                                    type="number" 
                                                    value={planData.initialStudents ?? ''} 
                                                    onChange={(e)=>updatePlanData('initial', 'students', e.target.value)} 
                                                    onFocus={(e) => e.target.select()}
                                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-right w-24 font-bold text-brand-orange"
                                                />
                                                <span className="text-xs text-gray-500 ml-2">※ここに入力した人数から、各月の入会・退会計画を加減して生徒数が自動計算されます。</span>
                                            </div>
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-2 py-2 whitespace-nowrap">月度</th>
                                                        <th className="px-2 py-2 whitespace-nowrap bg-gray-50">生徒数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">退会数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">T&T数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">門配数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">体験数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">入会数</th>
                                                        <th className="px-2 py-2 whitespace-nowrap bg-gray-50">入会率</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {MONTHS_LIST.map((m) => {
                                                        const d = planData[m] || {};
                                                        const rate = d.trials > 0 ? ((d.enrollments / d.trials) * 100).toFixed(1) : 0;
                                                        const enroll = Number(d.enrollments || 0);
                                                        const withdraw = Number(d.withdrawals || 0);
                                                        const monthEndStudents = currentStudentCount + enroll - withdraw;
                                                        currentStudentCount = monthEndStudents; 

                                                        return (
                                                            <tr key={m} className="hover:bg-gray-50">
                                                                <td className="px-2 py-2 font-bold text-gray-700">{m}</td>
                                                                <td className="px-2 py-2 text-right font-bold text-brand-blue bg-gray-50">{monthEndStudents}</td>
                                                                <td className="px-1"><input type="number" value={d.withdrawals ?? ''} onChange={(e)=>updatePlanData(m, 'withdrawals', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.touchTry ?? ''} onChange={(e)=>updatePlanData(m, 'touchTry', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.flyers ?? ''} onChange={(e)=>updatePlanData(m, 'flyers', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.trials ?? ''} onChange={(e)=>updatePlanData(m, 'trials', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.enrollments ?? ''} onChange={(e)=>updatePlanData(m, 'enrollments', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-2 py-2 text-right text-gray-500 text-xs">{rate}%</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        <div className="w-full">
                                            <h4 className="font-bold text-gray-700 mb-2 border-l-4 border-brand-blue pl-2">2. 収支・PL計画</h4>
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-2 py-2 whitespace-nowrap">月度</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">売上高</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">入会金</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">他売上</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">広告費</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">販売費</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">人件費</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">設備費</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">管理費</th>
                                                        <th className="px-2 py-2 whitespace-nowrap bg-gray-50">営業利益</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {MONTHS_LIST.map((m) => {
                                                        const d = planData[m] || {};
                                                        const revenueTotal = (Number(d.revenue)||0) + (Number(d.entranceFee)||0) + (Number(d.otherSales)||0);
                                                        const expenseTotal = (Number(d.adCost)||0) + (Number(d.salesCost)||0) + (Number(d.laborCost)||0) + (Number(d.facilityCost)||0) + (Number(d.adminCost)||0);
                                                        const profit = revenueTotal - expenseTotal;
                                                        return (
                                                            <tr key={m} className="hover:bg-gray-50">
                                                                <td className="px-2 py-2 font-bold text-gray-700">{m}</td>
                                                                <td className="px-1"><input type="number" value={d.revenue ?? ''} onChange={(e)=>updatePlanData(m, 'revenue', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.entranceFee ?? ''} onChange={(e)=>updatePlanData(m, 'entranceFee', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.otherSales ?? ''} onChange={(e)=>updatePlanData(m, 'otherSales', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.adCost ?? ''} onChange={(e)=>updatePlanData(m, 'adCost', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.salesCost ?? ''} onChange={(e)=>updatePlanData(m, 'salesCost', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.laborCost ?? ''} onChange={(e)=>updatePlanData(m, 'laborCost', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.facilityCost ?? ''} onChange={(e)=>updatePlanData(m, 'facilityCost', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className="px-1"><input type="number" value={d.adminCost ?? ''} onChange={(e)=>updatePlanData(m, 'adminCost', e.target.value)} onFocus={(e) => e.target.select()} className="w-full border rounded px-1 py-1 text-right text-xs"/></td>
                                                                <td className={`px-2 py-2 text-right text-xs font-bold ${profit>=0 ? 'text-gray-700':'text-red-500'}`}>{profit.toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {planMode === 'monthly' && (
                                    <div>
                                        <div className="flex gap-1 mb-4 flex-wrap">
                                            {MONTHS_LIST.map(m=><button key={m} onClick={()=>setSelectedMonth(m)} className={`text-sm px-3 py-1 rounded-full border ${selectedMonth===m?'bg-brand-orange text-white border-brand-orange':'bg-white text-gray-500 hover:bg-gray-50'}`}>{m}</button>)}
                                        </div>
                                        <div className="overflow-x-auto w-full">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-2 py-2 whitespace-nowrap">期間</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">T&T数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">門配数</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">体験申込</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">体験実施</th>
                                                        <th className="px-1 py-2 text-center whitespace-nowrap">入会数</th>
                                                        <th className="px-2 py-2 text-right whitespace-nowrap">入会率</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {currentWeeksStruct.weeks.map((week, idx) => {
                                                        const weekData = planData[selectedMonth]?.weeks?.[idx] || {};
                                                        const rate = weekData.trialParticipation > 0 ? ((weekData.enrollments / weekData.trialParticipation) * 100).toFixed(1) : 0;
                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-2 py-2 font-bold text-gray-700">{week.label}</td>
                                                                <td className="px-1"><input type="number" value={weekData.touchTry ?? ''} onChange={(e)=>updatePlanData(selectedMonth, 'touchTry', e.target.value, idx)} onFocus={(e) => e.target.select()} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-right focus:bg-white focus:ring-1 focus:ring-brand-orange outline-none"/></td>
                                                                <td className="px-1"><input type="number" value={weekData.flyers ?? ''} onChange={(e)=>updatePlanData(selectedMonth, 'flyers', e.target.value, idx)} onFocus={(e) => e.target.select()} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-right focus:bg-white focus:ring-1 focus:ring-brand-orange outline-none"/></td>
                                                                <td className="px-1"><input type="number" value={weekData.trialApp ?? ''} onChange={(e)=>updatePlanData(selectedMonth, 'trialApp', e.target.value, idx)} onFocus={(e) => e.target.select()} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-right focus:bg-white focus:ring-1 focus:ring-brand-orange outline-none"/></td>
                                                                <td className="px-1"><input type="number" value={weekData.trialParticipation ?? ''} onChange={(e)=>updatePlanData(selectedMonth, 'trialParticipation', e.target.value, idx)} onFocus={(e) => e.target.select()} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-right focus:bg-white focus:ring-1 focus:ring-brand-orange outline-none"/></td>
                                                                <td className="px-1"><input type="number" value={weekData.enrollments ?? ''} onChange={(e)=>updatePlanData(selectedMonth, 'enrollments', e.target.value, idx)} onFocus={(e) => e.target.select()} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-right focus:bg-white focus:ring-1 focus:ring-brand-orange outline-none"/></td>
                                                                <td className="px-2 py-2 text-right text-gray-500 font-mono">{rate}%</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                                        <td className="px-2 py-2 text-gray-700">合計</td>
                                                        <td className="px-1 py-2 text-right">{weeklyTotals.touchTry}</td>
                                                        <td className="px-1 py-2 text-right">{weeklyTotals.flyers}</td>
                                                        <td className="px-1 py-2 text-right">{weeklyTotals.trialApp}</td>
                                                        <td className="px-1 py-2 text-right">{weeklyTotals.trialParticipation}</td>
                                                        <td className="px-1 py-2 text-right">{weeklyTotals.enrollments}</td>
                                                        <td className="px-2 py-2 text-right">{weeklyTotals.trialParticipation > 0 ? ((weeklyTotals.enrollments / weeklyTotals.trialParticipation)*100).toFixed(1) : 0}%</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'import' && <CSVImportPanel campus={campus} refreshData={refreshData} showNotify={showNotify} />}

                    {activeTab === 'report' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-gray-800 flex items-center"><Printer className="w-5 h-5 mr-2 text-brand-orange"/> レポート出力プレビュー</h3>
                                        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                                            <button onClick={() => setReportMode('monthly')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${reportMode === 'monthly' ? 'bg-brand-blue text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>月度レポート</button>
                                            <button onClick={() => setReportMode('annual')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${reportMode === 'annual' ? 'bg-brand-blue text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>年間計画表</button>
                                        </div>
                                        {reportMode === 'monthly' && (
                                            <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-200">
                                                {MONTHS_LIST.map(m => (
                                                    <button key={m} onClick={() => setSelectedMonth(m)} className={`text-xs px-2 py-1 rounded ${selectedMonth === m ? 'bg-brand-orange text-white' : 'text-gray-400 hover:bg-gray-50'}`}>{m}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => window.print()} className="bg-brand-blue text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center shadow-sm">
                                        <Printer className="w-4 h-4 mr-2"/> {reportMode === 'monthly' ? 'A4レポート印刷' : '計画表印刷(A4横)'}
                                    </button>
                                </div>
                                
                                <div className="bg-gray-200 p-8 overflow-auto flex justify-center">
                                    <div className="shadow-lg transform scale-90 origin-top bg-white">
                                        {reportMode === 'monthly' ? (
                                            <ReportView 
                                                year={displayCalendarYear} 
                                                month={selectedMonth} 
                                                campus={campus} 
                                                dailyData={currentMonthData.daily} 
                                                weeklyData={currentMonthData.weekly} 
                                                planData={calculatedPlanData} 
                                                summaryData={{
                                                    students: currentMonthData.students,
                                                    newEnrollments: currentMonthData.newEnrollments,
                                                    withdrawals: currentMonthData.withdrawals
                                                }}
                                            />
                                        ) : (
                                            <AnnualReportView 
                                                year={selectedYear}
                                                campus={campus}
                                                planData={calculatedPlanData}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center"><FileSpreadsheet className="w-5 h-5 mr-2 text-brand-orange"/> 収支CSV取込 (横持ち形式)</h3>
                                {lastUploadInfo && (
                                    <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                                        <Clock className="w-3 h-3 mr-1.5" />
                                        最終更新: <span className="font-bold ml-1">{lastUploadInfo.toLocaleString()}</span>
                                        <span className="ml-1 text-gray-400">({uploadTargetYear}年度)</span>
                                    </div>
                                )}
                            </div>
                            {isAdmin ? (
                                <>
                                    <div className="max-w-xl mx-auto"><CsvUploader onUpload={handleCsvUpload} isUploading={uploading} targetYear={uploadTargetYear} setTargetYear={setUploadTargetYear} /></div>
                                    <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
                                        <p className="font-bold mb-2">取込ルール:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li><span className="font-bold text-red-500">重要:</span> 詳細分析のため「勘定コード」を保存します。以前のデータを上書き更新してください。</li>
                                            <li>取り込みを実行すると、選択した年度の既存データは全て上書き(削除→再登録)されます。</li>
                                            <li>5系:売上, 61:広告, 62:販売, 63:人件費, 64:設備, 65:管理, 69:本社 に自動分類されます。</li>
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <Lock className="w-12 h-12 mb-4 text-gray-300" />
                                    <p className="font-bold text-lg">管理者権限が必要です</p>
                                    <p className="text-sm mt-2">収支データの取り込みを行うには、管理者モードでログインしてください。</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}