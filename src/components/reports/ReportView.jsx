// ==========================================
// 帳票プレビューコンポーネント (src/components/reports/ReportView.jsx)
// ==========================================

import React from 'react';

export const ReportView = ({ year, month, campus, dailyData, weeklyData, planData, summaryData }) => {
    const weatherMap = { sunny: '晴', cloudy: '曇', rainy: '雨', snowy: '雪', closed: '-' };
    const weeklyPlans = planData[month]?.weeks || [];
    
    // 差異計算ヘルパー
    const getDiff = (plan, actual) => (actual || 0) - (plan || 0);

    const monthlyPlan = planData[month] || {};
    const actualEnrollments = summaryData.newEnrollments;
    const actualWithdrawals = summaryData.withdrawals;
    const actualStudents = summaryData.students;
    let plannedStudents = Number(monthlyPlan.students) || 0; 

    // KPIデータの構築
    const kpiData = [
        { 
            label: "在籍生徒数", 
            value: `${actualStudents}名`, 
            plan: `${plannedStudents}名`, 
            diff: actualStudents - plannedStudents 
        },
        { 
            label: "入会数", 
            value: `${actualEnrollments}名`, 
            plan: `${monthlyPlan.enrollments || 0}名`, 
            diff: actualEnrollments - (monthlyPlan.enrollments || 0) 
        },
        { 
            label: "退会数", 
            value: `${actualWithdrawals}名`, 
            plan: `${monthlyPlan.withdrawals || 0}名`, 
            diff: actualWithdrawals - (monthlyPlan.withdrawals || 0) 
        },
    ];

    return (
        <div className="report-preview-wrapper p-10 relative print:p-0 print:w-full print:shadow-none" style={{ fontFamily: '"Noto Sans JP", sans-serif', color: '#111' }}>
            {/* ヘッダー部分 */}
            <div className="flex justify-between items-end mb-8 border-b-2 border-gray-800 pb-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ロボ団教室実績管理表 {year}年{month}</h1>
                    <div className="text-sm mt-1 font-medium text-gray-700">校舎名: {campus.name} (ID: {campus.id})</div>
                </div>
                <div className="text-xs text-right text-gray-500">
                    <div>作成日: {new Date().toLocaleDateString()}</div>
                </div>
            </div>

            {/* KPIカード部分 */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {kpiData.map((kpi, i) => (
                    <div key={i} className="border border-gray-300 p-3 rounded bg-white shadow-sm flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-500 mb-1">{kpi.label}</div>
                        <div className="text-2xl font-bold mb-1 text-gray-800">{kpi.value}</div>
                        <div className="text-xs flex gap-3 text-gray-600 font-medium">
                            <span>計画: {kpi.plan}</span>
                            <span className={typeof kpi.diff === 'number' && kpi.diff < 0 ? 'text-red-600' : 'text-blue-600'}>
                                差異: {typeof kpi.diff === 'number' && kpi.diff > 0 ? '+' : ''}{kpi.diff}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-6">
                {/* 1. 日別実績テーブル */}
                <div>
                    <div className="report-section-title">1. 日別実績</div>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>日付</th><th>曜</th><th>天候</th>
                                <th>門配</th><th>T&T</th>
                                <th className="bg-blue-50">体験申込</th>
                                <th className="bg-yellow-50">参加予定</th>
                                <th className="bg-orange-50">参加実績</th>
                                <th className="bg-green-50">入会数</th>
                                <th style={{width: '20%'}}>備考</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyData.map((day, idx) => (
                                <tr key={idx}>
                                    <td>{day.name.replace('日','')}</td>
                                    <td className={day.dayOfWeek==='土'?'text-blue-600 font-bold':day.dayOfWeek==='日'?'text-red-600 font-bold':''}>{day.dayOfWeek}</td>
                                    <td>{weatherMap[day.weather] || day.weather || '-'}</td>
                                    <td>{day.flyers || ''}</td>
                                    <td>{day.touchTry || ''}</td>
                                    <td className="bg-blue-50">{day.trialApp || ''}</td>
                                    <td className="bg-yellow-50">{day.trialScheduled || ''}</td>
                                    <td className="bg-orange-50">{day.trialActual || ''}</td>
                                    <td className="bg-green-50">{day.newEnrollments || ''}</td>
                                    <td className="text-left px-2 text-[9px]"></td>
                                </tr>
                            ))}
                            {/* 月度合計行 */}
                            <tr className="font-bold bg-gray-100">
                                <td colSpan="3">月度合計</td>
                                <td>{dailyData.reduce((s,d)=>s+(d.flyers||0),0)}</td>
                                <td>{dailyData.reduce((s,d)=>s+(d.touchTry||0),0)}</td>
                                <td className="bg-blue-50">{dailyData.reduce((s,d)=>s+(d.trialApp||0),0)}</td>
                                <td className="bg-yellow-50">{dailyData.reduce((s,d)=>s+(d.trialScheduled||0),0)}</td>
                                <td className="bg-orange-50">{dailyData.reduce((s,d)=>s+(d.trialActual||0),0)}</td>
                                <td className="bg-green-50">{dailyData.reduce((s,d)=>s+(d.newEnrollments||0),0)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-2 gap-8 items-start">
                    {/* 2. 集客活動 (週次) テーブル */}
                    <div>
                        <div className="report-section-title">2. 集客活動 (週次)</div>
                        <table className="report-table">
                            <thead>
                                <tr><th rowSpan="2">期間</th><th colSpan="3">T&T</th><th colSpan="3">門配</th></tr>
                                <tr className="bg-gray-50"><th>計画</th><th>実績</th><th>差異</th><th>計画</th><th>実績</th><th>差異</th></tr>
                            </thead>
                            <tbody>
                                {weeklyData.map((w, i) => {
                                    const plan = weeklyPlans[i] || {};
                                    return (
                                        <tr key={i}>
                                            <td className="text-xs">{w.label}</td>
                                            <td>{plan.touchTry || 0}</td>
                                            <td>{w.touchTry}</td>
                                            <td className={getDiff(plan.touchTry, w.touchTry)<0 ? 'text-red-600 font-bold':''}>{getDiff(plan.touchTry, w.touchTry)}</td>
                                            
                                            <td>{plan.flyers || 0}</td>
                                            <td>{w.flyers}</td>
                                            <td className={getDiff(plan.flyers, w.flyers)<0 ? 'text-red-600 font-bold':''}>{getDiff(plan.flyers, w.flyers)}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="font-bold bg-gray-100">
                                    <td>月度計</td>
                                    <td>{weeklyPlans.reduce((s,p)=>s+(p.touchTry||0),0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.touchTry,0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.touchTry,0) - weeklyPlans.reduce((s,p)=>s+(p.touchTry||0),0)}</td>
                                    
                                    <td>{weeklyPlans.reduce((s,p)=>s+(p.flyers||0),0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.flyers,0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.flyers,0) - weeklyPlans.reduce((s,p)=>s+(p.flyers||0),0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    {/* 3. 体験・入会 (週次) テーブル */}
                    <div>
                        <div className="report-section-title">3. 体験・入会 (週次)</div>
                        <table className="report-table">
                            <thead>
                                <tr><th rowSpan="2">期間</th><th colSpan="3">体験申込</th><th colSpan="3">体験参加</th><th colSpan="3">入会</th></tr>
                                <tr className="bg-gray-50"><th>計画</th><th>実績</th><th>差異</th><th>計画</th><th>実績</th><th>差異</th><th>計画</th><th>実績</th><th>差異</th></tr>
                            </thead>
                            <tbody>
                                {weeklyData.map((w, i) => {
                                    const plan = weeklyPlans[i] || {};
                                    return (
                                        <tr key={i}>
                                            <td className="text-xs">{w.label}</td>
                                            <td>{plan.trialApp || 0}</td>
                                            <td>{w.trialApp}</td>
                                            <td className={getDiff(plan.trialApp, w.trialApp)<0 ? 'text-red-600 font-bold':''}>{getDiff(plan.trialApp, w.trialApp)}</td>
                                            
                                            <td>{plan.trialParticipation || 0}</td>
                                            <td>{w.trialActual}</td>
                                            <td className={getDiff(plan.trialParticipation, w.trialActual)<0 ? 'text-red-600 font-bold':''}>{getDiff(plan.trialParticipation, w.trialActual)}</td>
                                            
                                            <td>{plan.enrollments || 0}</td>
                                            <td>{w.newEnrollments}</td>
                                            <td className={getDiff(plan.enrollments, w.newEnrollments)<0 ? 'text-red-600 font-bold':''}>{getDiff(plan.enrollments, w.newEnrollments)}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="font-bold bg-gray-100">
                                    <td>月度計</td>
                                    <td>{weeklyPlans.reduce((s,p)=>s+(p.trialApp||0),0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.trialApp,0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.trialApp,0) - weeklyPlans.reduce((s,p)=>s+(p.trialApp||0),0)}</td>
                                    
                                    <td>{weeklyPlans.reduce((s,p)=>s+(p.trialParticipation||0),0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.trialActual,0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.trialActual,0) - weeklyPlans.reduce((s,p)=>s+(p.trialParticipation||0),0)}</td>
                                    
                                    <td>{weeklyPlans.reduce((s,p)=>s+(p.enrollments||0),0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.newEnrollments,0)}</td>
                                    <td>{weeklyData.reduce((s,w)=>s+w.newEnrollments,0) - weeklyPlans.reduce((s,p)=>s+(p.enrollments||0),0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};