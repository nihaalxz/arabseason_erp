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
        currency: 'AED',
        timezone: 'GST',
        date_format: 'DD/MM/YYYY',
        company_name: 'Arab Season ERPS'
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

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: settings.currency || 'AED',
        }).format(amount);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        // Simple mapping from setting to toLocaleDateString options or similar
        // For now, let's keep it simple or use a library if available.
        // Assuming settings.date_format is something like 'DD/MM/YYYY'
        return date.toLocaleDateString('en-GB'); 
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
