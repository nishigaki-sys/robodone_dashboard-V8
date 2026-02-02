// ==========================================
// ログイン画面コンポーネント (src/pages/Login.jsx)
// ==========================================

import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { LayoutDashboard, AlertCircle, Loader2, LogIn } from "lucide-react";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const auth = getAuth();
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-blue/20">
                        <LayoutDashboard className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">ロボ団営業部ダッシュボード</h2>
                    <p className="text-gray-500 mt-2">ログインしてダッシュボードにアクセス</p>
                </div>
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス</label>
                        <input 
                            type="email" 
                            required 
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">パスワード</label>
                        <input 
                            type="password" 
                            required 
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-brand-blue text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5 mr-2" /> ログイン</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;