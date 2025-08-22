/**
 * React hook for translations
 */

import { useState, useEffect } from 'react';
import I18nService from '../I18nService';
import { SupportedLocale, TranslationFunction, InterpolationParams } from '../types';
import { EventBus } from '../../services/EventBus';

export interface UseTranslationResult {
    t: TranslationFunction;
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => Promise<void>;
    isReady: boolean;
}

export function useTranslation(): UseTranslationResult {
    const [locale, setCurrentLocale] = useState<SupportedLocale>('en');
    const [isReady, setIsReady] = useState(false);
    const [translationFunction, setTranslationFunction] = useState<TranslationFunction | null>(null);

    const i18nService = I18nService.getInstance();
    const eventBus = EventBus.getInstance();

    useEffect(() => {
        const initialize = async () => {
            try {
                // Detect device locale
                const deviceLocale = I18nService.detectDeviceLocale();
                
                // Initialize i18n service
                await i18nService.initialize(deviceLocale);
                
                // Set initial state
                setCurrentLocale(i18nService.getCurrentLocale());
                setTranslationFunction(i18nService.createTranslationFunction());
                setIsReady(true);
            } catch (error) {
                console.error('Failed to initialize i18n:', error);
                // Fallback to English
                setCurrentLocale('en');
                setTranslationFunction(i18nService.createTranslationFunction());
                setIsReady(true);
            }
        };

        initialize();
    }, []);

    useEffect(() => {
        const handleLocaleChange = (event: any) => {
            setCurrentLocale(event.newLocale);
            setTranslationFunction(i18nService.createTranslationFunction());
        };

        eventBus.on('i18n:localeChanged', handleLocaleChange);

        return () => {
            eventBus.off('i18n:localeChanged', handleLocaleChange);
        };
    }, [eventBus]);

    const setLocale = async (newLocale: SupportedLocale) => {
        try {
            await i18nService.setLocale(newLocale);
        } catch (error) {
            console.error('Failed to set locale:', error);
        }
    };

    // Create fallback translation function if not ready
    const fallbackT = (key: string, params?: InterpolationParams): string => {
        return key;
    };
    fallbackT.plural = (key: string, count: number, params?: InterpolationParams): string => key;
    fallbackT.formatDate = (date: Date, format?: string): string => date.toLocaleDateString();
    fallbackT.formatTime = (date: Date, format?: string): string => date.toLocaleTimeString();
    fallbackT.formatNumber = (value: number): string => value.toString();
    fallbackT.formatCurrency = (value: number, currency?: string): string => `${value} ${currency || 'ADA'}`;

    return {
        t: translationFunction || fallbackT,
        locale,
        setLocale,
        isReady
    };
}

export default useTranslation;

