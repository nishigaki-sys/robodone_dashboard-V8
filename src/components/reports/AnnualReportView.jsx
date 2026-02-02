// ==========================================
// 年間予算計画表コンポーネント (src/components/reports/AnnualReportView.jsx)
// ==========================================

import React from 'react';

export const AnnualReportView = ({ year, campus, planData }) => {
    // 表示する月のリスト (4月始まり)
    const months = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
    
    // データ取得ヘルパー
    const getValues = (key) => months.map(m => Number(planData[m]?.[key] || 0));
    
    // 計算ヘルパー
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // 各種データの配列を取得
    const students = getValues('students');
    const withdrawals = getValues('withdrawals');
    const touchTry = getValues('touchTry');
    const flyers = getValues('flyers');
    const trials = getValues('trials'); 
    const enrollments = getValues('enrollments');
    
    const revenue = getValues('revenue');
    const entranceFee = getValues('entranceFee');
    const otherSales = getValues('otherSales');
    const adCost = getValues('adCost');
    const salesCost = getValues('salesCost');
    const laborCost = getValues('laborCost');
    const facilityCost = getValues('facilityCost');
    const adminCost = getValues('adminCost');

    // 期間集計 (上期・下期・年度)
    const calcPeriod = (values, type = 'sum') => {
        const first = values.slice(0, 6);   // 上期 (4-9月)
        const second = values.slice(6, 12); // 下期 (10-3月)
        const all = values;                 // 年度全体
        
        if (type === 'avg') {
            return { first: avg(first), second: avg(second), annual: avg(all) };
        }
        return { first: sum(first), second: sum(second), annual: sum(all) };
    };

    // 集計データのオブジェクト作成
    const agg = {
        students: calcPeriod(students, 'avg'), // 生徒数は平均
        withdrawals: calcPeriod(withdrawals),
        touchTry: calcPeriod(touchTry),
        flyers: calcPeriod(flyers),
        trials: calcPeriod(trials),
        enrollments: calcPeriod(enrollments),
        
        revenue: calcPeriod(revenue),
        entranceFee: calcPeriod(entranceFee),
        otherSales: calcPeriod(otherSales),
        adCost: calcPeriod(adCost),
        salesCost: calcPeriod(salesCost),
        laborCost: calcPeriod(laborCost),
        facilityCost: calcPeriod(facilityCost),
        adminCost: calcPeriod(adminCost),
    };

    // 営業利益の計算
    const profits = months.map((_, i) => {
        const totalRev = revenue[i] + entranceFee[i] + otherSales[i];
        const totalExp = adCost[i] + salesCost[i] + laborCost[i] + facilityCost[i] + adminCost[i];
        return totalRev - totalExp;
    });
    const aggProfit = calcPeriod(profits);

    // 入会率計算ヘルパー
    const calcRate = (enroll, trial) => trial > 0 ? ((enroll / trial) * 100).toFixed(1) + '%' : '0.0%';

    // 行レンダリング用サブコンポーネント
    const RenderRow = ({ label, values, periodData, type = 'sum', isRate = false, trialValues = null }) => (
        <tr>
            <td className="bg-gray-50 font-bold text-left px-2">{label}</td>
            {values.map((v, i) => (
                <td key={i} className="text-right px-1">
                    {isRate ? calcRate(v, trialValues[i]) : v.toLocaleString()}
                </td>
            ))}
            <td className="bg-blue-50 text-right px-1 font-medium">
                {isRate ? calcRate(periodData.first, agg.trials.first) : (type === 'avg' ? periodData.first.toFixed(1) : periodData.first.toLocaleString())}
            </td>
            <td className="bg-blue-50 text-right px-1 font-medium">
                {isRate ? calcRate(periodData.second, agg.trials.second) : (type === 'avg' ? periodData.second.toFixed(1) : periodData.second.toLocaleString())}
            </td>
            <td className="bg-yellow-50 text-right px-1 font-bold">
                {isRate ? calcRate(periodData.annual, agg.trials.annual) : (type === 'avg' ? periodData.annual.toFixed(1) : periodData.annual.toLocaleString())}
            </td>
        </tr>
    );

    return (
        <div className="report-preview-wrapper p-10 relative print:p-0 print:w-full print:shadow-none" style={{ fontFamily: '"Noto Sans JP", sans-serif', color: '#111' }}>
            <div className="flex justify-between items-end mb-6 border-b-2 border-gray-800 pb-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">年間予算計画表 {year}年度</h1>
                    <div className="text-sm mt-1 font-medium text-gray-700">教室名: {campus.name}</div>
                </div>
                <div className="text-xs text-right text-gray-500">
                    <div>作成日: {new Date().toLocaleDateString()}</div>
                </div>
            </div>

            <div className="mb-8">
                <div className="report-section-title">▼KPI</div>
                <table className="report-table">
                    <thead>
                        <tr>
                            <th className="w-24">項目</th>
                            {months.map(m => <th key={m}>{m}</th>)}
                            <th className="bg-blue-100">上期</th>
                            <th className="bg-blue-100">下期</th>
                            <th className="bg-yellow-100">年度</th>
                        </tr>
                    </thead>
                    <tbody>
                        <RenderRow label="生徒数(期末)" values={students} periodData={agg.students} type="avg" />
                        <RenderRow label="退会数" values={withdrawals} periodData={agg.withdrawals} />
                        <RenderRow label="T&T" values={touchTry} periodData={agg.touchTry} />
                        <RenderRow label="門前配布" values={flyers} periodData={agg.flyers} />
                        <RenderRow label="体験会人数" values={trials} periodData={agg.trials} />
                        <RenderRow label="入会数" values={enrollments} periodData={agg.enrollments} />
                        <RenderRow label="入会率" values={enrollments} periodData={agg.enrollments} isRate={true} trialValues={trials} />
                    </tbody>
                </table>
            </div>

            <div>
                <div className="report-section-title">▼PL (単位:円)</div>
                <table className="report-table">
                    <thead>
                        <tr>
                            <th className="w-24">項目</th>
                            {months.map(m => <th key={m}>{m}</th>)}
                            <th className="bg-blue-100">上期</th>
                            <th className="bg-blue-100">下期</th>
                            <th className="bg-yellow-100">年度</th>
                        </tr>
                    </thead>
                    <tbody>
                        <RenderRow label="(+)売上(月謝)" values={revenue} periodData={agg.revenue} />
                        <RenderRow label="(+)入会金" values={entranceFee} periodData={agg.entranceFee} />
                        <RenderRow label="(+)その他" values={otherSales} periodData={agg.otherSales} />
                        <tr className="bg-gray-100"><td colSpan={16} className="h-1"></td></tr>
                        <RenderRow label="(-)広告宣伝費" values={adCost} periodData={agg.adCost} />
                        <RenderRow label="(-)販売費" values={salesCost} periodData={agg.salesCost} />
                        <RenderRow label="(-)人件費" values={laborCost} periodData={agg.laborCost} />
                        <RenderRow label="(-)設備費" values={facilityCost} periodData={agg.facilityCost} />
                        <RenderRow label="(-)一般管理費" values={adminCost} periodData={agg.adminCost} />
                        
                        <tr className="border-t-2 border-gray-400">
                            <td className="bg-gray-100 font-bold px-2">営業利益</td>
                            {profits.map((v, i) => (
                                <td key={i} className={`text-right px-1 font-bold ${v < 0 ? 'text-red-600' : ''}`}>{v.toLocaleString()}</td>
                            ))}
                            <td className={`bg-blue-50 text-right px-1 font-bold ${aggProfit.first < 0 ? 'text-red-600' : ''}`}>{aggProfit.first.toLocaleString()}</td>
                            <td className={`bg-blue-50 text-right px-1 font-bold ${aggProfit.second < 0 ? 'text-red-600' : ''}`}>{aggProfit.second.toLocaleString()}</td>
                            <td className={`bg-yellow-50 text-right px-1 font-bold ${aggProfit.annual < 0 ? 'text-red-600' : ''}`}>{aggProfit.annual.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};