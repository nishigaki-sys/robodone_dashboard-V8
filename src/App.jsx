// ==========================================
// ルートコンポーネント (src/App.jsx)
// ==========================================

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseInitialized } from "./config/firebase";
import { Loader2, Shield, User, LogOut, LayoutDashboard, School, Database } from "lucide-react";

// ページ・コンポーネントのインポート
import Login from "./pages/Login";
import MyPage from "./pages/MyPage";
import HQConsole from "./pages/HQConsole";     // src/pages/HQConsole/index.jsx を読み込みます
import SchoolConsole from "./pages/SchoolConsole"; // src/pages/SchoolConsole/index.jsx を読み込みます
import { Notification } from "./components/common/Notification";

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [consoleMode, setConsoleMode] = useState('select'); 
    const [selectedCampusId, setSelectedCampusId] = useState(null);
    const [campusList, setCampusList] = useState([]);
    
    // 現在の月が1~3月の場合は前年度をデフォルトにする
    const [selectedYear, setSelectedYear] = useState(() => { 
        const d = new Date(); 
        return d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); 
    });
    
    const [notification, setNotification] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isUsingCache, setIsUsingCache] = useState(false);
    
    // データ保持用State
    const [allData, setAllData] = useState({ 
        enrollments: [], 
        statusChanges: [], 
        transfers: [], 
        dailyReports: [], 
        financials: [], 
        trialApps: [], 
        financialUpdates: [],
        campusPlans: [] 
    });
    
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminAuth, setShowAdminAuth] = useState(false);
    const [adminPasswordInput, setAdminPasswordInput] = useState("");

    // 認証状態の監視
    useEffect(() => {
        // authが初期化されていない場合のガード
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // データのリアルタイム同期
    useEffect(() => {
        if (!user || !isFirebaseInitialized || !db) return;

        setIsSyncing(true);
        const cleanups = [];
        const queries = [
            { key: 'campuses', q: query(collection(db, "campuses"), orderBy("order")) },
            { key: 'enrollments', q: collection(db, "enrollments") },
            { key: 'statusChanges', q: collection(db, "status_changes") },
            { key: 'transfers', q: collection(db, "transfers") },
            { key: 'dailyReports', q: collection(db, "daily_reports") },
            { key: 'financials', q: collection(db, "financials") },
            { key: 'trialApps', q: collection(db, "trial_applications") },
            { key: 'financialUpdates', q: collection(db, "financial_updates") },
            { key: 'campusPlans', q: collection(db, "campus_plans") },
        ];
        
        let loadedCount = 0;

        queries.forEach(({ key, q }) => {
            // エラーハンドリング付きでonSnapshotを実行
            try {
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const data = snapshot.docs.map(d => {
                        if (key === 'trialApps') {
                            const raw = d.data();
                            return { id: d.id, ...raw, date: raw.date, trialDate: raw.trialDate, type: raw.type };
                        }
                        return { id: d.id, ...d.data() };
                    });
                    
                    if (key === 'campuses') {
                        // orderフィールドで並び替え（念のため再度ソート）
                        data.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
                        setCampusList(data);
                    } else {
                        setAllData(prev => ({ ...prev, [key]: data }));
                    }

                    setLastUpdated(new Date());
                    loadedCount++;
                    if (loadedCount >= queries.length) {
                        setIsSyncing(false);
                        setIsUsingCache(true); 
                    }
                }, (error) => {
                    console.error(`Sync Error (${key}):`, error);
                    // 権限エラーなどは無視し、続行させる
                    if (error.code !== 'permission-denied') {
                        showNotify(`データ同期エラー: ${key}`, 'error');
                    }
                });
                
                cleanups.push(unsubscribe);
            } catch (e) {
                console.error(`Setup Error (${key}):`, e);
            }
        });

        return () => {
            cleanups.forEach(unsub => unsub && unsub());
        };
    }, [user]);

    const handleLogout = async () => {
        if (!auth) return;
        await signOut(auth);
    };

    const showNotify = (msg, type='success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleRefresh = () => {
        showNotify("データはリアルタイムで同期されています");
    };

    const handleEnterHQ = () => setConsoleMode('hq');
    const handleEnterSchool = (id) => { setSelectedCampusId(id); setConsoleMode('school'); };
    const handleBack = () => { setConsoleMode('select'); setSelectedCampusId(null); };
    const handleMyPage = () => setConsoleMode('mypage');

    const handleAdminToggle = () => {
        if (isAdmin) {
            setIsAdmin(false);
            showNotify("管理者モードを終了しました");
        } else {
            setShowAdminAuth(true);
            setAdminPasswordInput("");
        }
    };

    const handleAdminLogin = () => {
        if (adminPasswordInput === "admin") {
            setIsAdmin(true);
            setShowAdminAuth(false);
            showNotify("管理者モードでログインしました");
        } else {
            showNotify("パスワードが違います", "error");
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-blue" /></div>;
    
    // ログインしていない場合はログイン画面を表示
    if (!user) return <Login />;

    return (
        <>
            <Notification msg={notification?.msg} type={notification?.type} onClose={()=>setNotification(null)} />
            
            {showAdminAuth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay backdrop-blur-sm transition-opacity" onClick={() => setShowAdminAuth(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Shield className="w-5 h-5 mr-2 text-brand-blue"/> 管理者認証</h3>
                        <p className="text-sm text-gray-500 mb-4">パスワードを入力してください</p>
                        <input 
                            type="password" 
                            value={adminPasswordInput}
                            onChange={(e) => setAdminPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-blue outline-none"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowAdminAuth(false)} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold">キャンセル</button>
                            <button onClick={handleAdminLogin} className="flex-1 bg-brand-blue text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-bold">認証</button>
                        </div>
                    </div>
                </div>
            )}

            {consoleMode === 'select' && (
                <div className="min-h-screen bg-brand-slate flex items-center justify-center p-6 fade-in relative">
                    <div className="absolute top-4 right-4 flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                            <Shield className={`w-4 h-4 ${isAdmin ? 'text-brand-blue' : 'text-gray-300'}`} />
                            <span className={`text-xs font-bold ${isAdmin ? 'text-brand-blue' : 'text-gray-400'}`}>管理者モード</span>
                            <button onClick={handleAdminToggle} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${isAdmin ? 'bg-brand-blue' : 'bg-gray-200'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${isAdmin ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <button onClick={handleMyPage} className="bg-white p-2 rounded-full shadow-sm border border-gray-100 text-gray-500 hover:text-brand-blue transition-colors" title="マイページ"><User className="w-5 h-5" /></button>
                        <button onClick={handleLogout} className="bg-white p-2 rounded-full shadow-sm border border-gray-100 text-gray-500 hover:text-red-500 transition-colors" title="ログアウト"><LogOut className="w-5 h-5" /></button>
                    </div>

                    <div className="max-w-4xl w-full">
                        <div className="text-center mb-12">
                            <h1 className="text-4xl font-bold text-brand-blue mb-4 tracking-tight">ロボ団営業部ダッシュボード</h1>
                            <p className="text-gray-500">管理コンソールを選択してください</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div onClick={handleEnterHQ} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-xl hover:border-brand-blue/30 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-brand-blue/20">
                                        <LayoutDashboard className="w-8 h-8 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-2">本部</h2>
                                    <p className="text-sm text-gray-500 mb-6">全校データの閲覧・管理</p>
                                    <span className="inline-flex items-center text-brand-blue font-bold text-sm group-hover:translate-x-1 transition-transform">ログイン <ArrowRight className="ml-2 w-4 h-4" /></span>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/5 rounded-bl-full -mr-8 -mt-8"></div>
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-brand-orange rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-brand-orange/20">
                                        <School className="w-8 h-8 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-2">校舎</h2>
                                    <p className="text-sm text-gray-500 mb-6">日報・計画・収支入力</p>
                                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {campusList.map(c => (
                                            <button key={c.id} onClick={() => handleEnterSchool(c.id)} className="w-full text-left px-4 py-3 rounded-lg border border-gray-100 hover:border-brand-orange hover:bg-orange-50 transition-colors flex items-center justify-between group">
                                                <span className="font-bold text-gray-700 group-hover:text-brand-orange">{c.name}</span>
                                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-orange" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 text-center text-xs text-gray-400 flex items-center justify-center gap-4">
                            <span className="flex items-center gap-1"><Database className={`w-3 h-3 ${isFirebaseInitialized ? 'text-emerald-500' : 'text-gray-400'}`} /> {isUsingCache ? 'Offline Enabled' : 'Connecting...'}</span>
                            <span>更新: {lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}</span>
                        </div>
                    </div>
                </div>
            )}
            
            {consoleMode === 'mypage' && <MyPage user={user} onBack={handleBack} showNotify={showNotify} />}
            
            {consoleMode === 'hq' && <HQConsole onBack={handleBack} campusList={campusList} allData={allData} selectedYear={selectedYear} setSelectedYear={setSelectedYear} refreshData={handleRefresh} showNotify={showNotify} isSyncing={isSyncing} lastUpdated={lastUpdated} isUsingCache={isUsingCache} isAdmin={isAdmin} />}
            
            {consoleMode === 'school' && <SchoolConsole onBack={handleBack} campus={campusList.find(c=>c.id===selectedCampusId)} allData={allData} selectedYear={selectedYear} setSelectedYear={setSelectedYear} refreshData={handleRefresh} showNotify={showNotify} isSyncing={isSyncing} lastUpdated={lastUpdated} isUsingCache={isUsingCache} isAdmin={isAdmin} />}
        </>
    );
}

// ChevronRight と ArrowRight が未定義だった場合の対策として追加インポート
import { ChevronRight, ArrowRight } from "lucide-react";

export default App;