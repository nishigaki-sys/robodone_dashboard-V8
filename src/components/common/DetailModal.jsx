// ==========================================
// 詳細モーダルコンポーネント (src/components/common/DetailModal.jsx)
// ==========================================

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Search, X } from "lucide-react";
import { formatYen } from "../../utils/formatters";
import { PIE_COLORS } from "../../utils/constants";

export const DetailModal = ({ isOpen, onClose, data, title, color }) => {
    if (!isOpen || !data) return null;

    const chartData = data.filter(d => d.value > 0);
    const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay backdrop-blur-sm transition-opacity" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white shadow-sm" style={{color: color}}>
                            <Search className="w-5 h-5"/>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">{title} 詳細内訳</h3>
                            <p className="text-sm text-gray-500">合計: <span className="font-bold text-gray-700">{formatYen(total)}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500"/>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="w-full md:w-1/2 h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={chartData} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={60} 
                                        outerRadius={80} 
                                        paddingAngle={2} 
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value)=>formatYen(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 space-y-3">
                            {chartData.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: PIE_COLORS[idx % PIE_COLORS.length]}}></div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-700">{item.name}</div>
                                            <div className="text-xs text-gray-400 font-mono">{item.code}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-gray-800">{formatYen(item.value)}</div>
                                        <div className="text-xs text-gray-400">{((item.value/total)*100).toFixed(1)}%</div>
                                    </div>
                                </div>
                            ))}
                            {chartData.length === 0 && <div className="text-center text-gray-400 py-8">データがありません</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};