// ==========================================
// KPIカードコンポーネント (src/components/dashboard/StatCard.jsx)
// ==========================================

import React from 'react';

export const StatCard = ({ title, value, subValue, iconUrl, colorClass, details, yoy, planRatio }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-transparent hover:border-l-brand-orange transition-all duration-200 group h-full">
        <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
                {iconUrl && <img src={iconUrl} alt={title} className="w-5 h-5 object-contain" />}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 group-hover:text-brand-blue transition-colors">{value}</h3>
            
            <div className="mt-2 space-y-1 w-full">
                {planRatio && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-400">計画比</span>
                        <span className={`font-bold ${Number(planRatio) >= 100 ? 'text-brand-blue' : 'text-rose-500'}`}>{planRatio}%</span>
                    </div>
                )}
                {yoy && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-400">前年比</span>
                        <span className={`font-bold ${Number(yoy) >= 100 ? 'text-emerald-500' : 'text-rose-500'}`}>{yoy}%</span>
                    </div>
                )}
            </div>
        </div>
        {subValue && (
            <div className="mt-3 pt-2 border-t border-slate-50 flex items-center text-sm">
                <span className="text-gray-400 font-medium">{subValue}</span>
            </div>
        )}
        {details && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                {details.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-500">
                        <span>{item.label}</span>
                        <span className="font-medium text-slate-700">{item.value}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);