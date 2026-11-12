import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        currency: 'SAR',
        timezone: 'AST',
        date_format: 'DD/MM/YYYY',
        company_name: 'Arab Season'
    });
    const [loading, setLoading] = useState(true);

    const refreshSettings = useCallback(async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('settings/');
            setSettings(response.data);
        } catch (error) {
            console.error('Failed to fetch site settings:', error);
            // Don't set loading to false here if we want to retry or handle error differently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshSettings();
    }, [refreshSettings]);

    const formatCurrency = (amount, customCurrency) => {
        const curr = customCurrency || settings?.currency || 'SAR';
        const num = parseFloat(amount || 0);
        const formatted = Math.abs(num).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        if (num < 0) {
            return `- ${curr} ${formatted}`;
        }
        return `${curr} ${formatted}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const parts = String(dateStr).split('T')[0].split(' ')[0].split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const d = new Date(year, month, day);
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        } catch (e) {
            // fallback
        }
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const value = {
        settings,
        loading,
        refreshSettings,
        formatCurrency,
        formatDate
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
