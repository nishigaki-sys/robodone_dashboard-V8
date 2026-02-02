// ==========================================
// 収支CSVアップローダー (src/components/dashboard/CsvUploader.jsx)
// ==========================================

import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { YEARS_LIST } from '../../utils/constants';

export const CsvUploader = ({ onUpload, isUploading, targetYear, setTargetYear }) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => parseCSV(event.target.result);
        reader.readAsText(file, 'Shift_JIS');
    };

    const parseCSV = (text) => {
        const lines = text.split(/\r\n|\n/);
        const data = [];
        let headerIdx = -1;
        
        // ヘッダー行を探す
        for(let i=0; i<lines.length; i++) {
            if (lines[i].includes('勘定コード') || lines[i].includes('科目') || lines[i].includes('４月')) { 
                headerIdx = i; 
                break; 
            }
        }
        
        if (headerIdx === -1) { 
            alert("フォーマット認識エラー: ヘッダーが見つかりませんでした"); 
            return; 
        }

        const headers = lines[headerIdx].split(',').map(h => h.trim());
        const monthMap = {}; 
        
        // 月列のマッピング (例: "４月" -> index)
        headers.forEach((h, idx) => { 
            const mMatch = h.match(/([０-９0-9]+)月/); 
            if (mMatch) monthMap[h] = idx; 
        });

        for (let i = headerIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim(); 
            if (!line) continue;
            
            const cols = line.split(',');
            const codeCol = cols[0] ? cols[0].trim() : '';
            
            // 勘定コードがない行はスキップ
            if (!/^\d/.test(codeCol)) continue;
            
            const parts = codeCol.split(/\s+/);
            const code = parts[0];
            const name = parts.length > 1 ? parts.slice(1).join(' ') : '不明';
            
            let category = 'other';
            let signMultiplier = 1;
            
            // 科目の判定 (5系:売上, 6/7系:費用)
            if (code.startsWith('5')) { 
                category = 'revenue'; 
                signMultiplier = -1; // 売上はマイナス入力されていることが多いので反転
            } else if (code.startsWith('6') || code.startsWith('7')) { 
                category = 'expense'; 
                signMultiplier = 1; 
            } else { 
                continue; 
            }

            Object.entries(monthMap).forEach(([monthLabel, colIdx]) => {
                const rawVal = cols[colIdx];
                if (rawVal) {
                    const val = Number(rawVal);
                    if (!isNaN(val) && val !== 0) {
                        const monthNum = parseInt(monthLabel.replace('月','').replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)));
                        data.push({ 
                            month: monthNum, 
                            category, 
                            subCategory: name, 
                            amount: val * signMultiplier, 
                            accountCode: code 
                        });
                    }
                }
            });
        }
        onUpload(data);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-bold text-gray-700">取り込み対象年度:</label>
                <select 
                    value={targetYear} 
                    onChange={(e) => setTargetYear(Number(e.target.value))} 
                    className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-blue"
                >
                    {YEARS_LIST.map(y => <option key={y} value={y}>{y}年度</option>)}
                </select>
            </div>
            
            <div 
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer group" 
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    accept=".csv" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange} 
                />
                <div className="w-16 h-16 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-1">収支CSVファイルをアップロード</h3>
            </div>
        </div>
    );
};