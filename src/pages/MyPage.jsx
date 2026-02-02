// ==========================================
// マイページ画面コンポーネント (src/pages/MyPage.jsx)
// ==========================================

import React, { useState } from "react";
import { updatePassword } from "firebase/auth";
import { ArrowUp, User, Lock, Loader2, Save } from "lucide-react";

const MyPage = ({ user, onBack, showNotify }) => {
    const [newPass, setNewPass] = useState("");
    const [confPass, setConfPass] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (newPass !== confPass) {
            showNotify("パスワードが一致しません", "error");
            return;
        }
        if (newPass.length < 6) {
            showNotify("パスワードは6文字以上で設定してください", "error");
            return;
        }
        
        setIsUpdating(true);
        try {
            await updatePassword(user, newPass);
            showNotify("パスワードを更新しました");
            setNewPass("");
            setConfPass("");
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                showNotify("セキュリティのため、再ログイン後に再度お試しください", "error");
            } else {
                showNotify("更新に失敗しました: " + error.message, "error");
            }
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-slate p-6 fade-in">
            <div className="max-w-2xl mx-auto">
                <button onClick={onBack} className="flex items-center text-gray-500 hover:text-gray-700 mb-6 font-bold">
                    <ArrowUp className="w-4 h-4 mr-1 -rotate-90" /> 戻る
                </button>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-gray-200 text-brand-blue">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">マイページ</h2>
                                <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-8">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <Lock className="w-5 h-5 mr-2 text-brand-blue"/>
                            パスワード変更
                        </h3>
                        <form onSubmit={handleUpdate} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">新しいパスワード</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-brand-blue"
                                    placeholder="6文字以上"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">新しいパスワード（確認）</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-brand-blue"
                                    placeholder="もう一度入力"
                                    value={confPass}
                                    onChange={(e) => setConfPass(e.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className="pt-2">
                                <button 
                                    type="submit" 
                                    disabled={isUpdating}
                                    className="bg-brand-blue text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                                >
                                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                                    パスワードを更新する
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyPage;