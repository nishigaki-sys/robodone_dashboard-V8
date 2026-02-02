import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const Notification = ({ msg, type, onClose }) => {
    if (!msg) return null;
    
    return (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-top-5 ${type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
            {type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
            <span className="text-sm font-medium">{msg}</span>
            <button onClick={onClose}><X className="w-4 h-4 opacity-50 hover:opacity-100"/></button>
        </div>
    );
};