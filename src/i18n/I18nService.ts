/**
 * Internationalization Service
 * Handles translations, locale switching, and formatting
 */

import { 
    SupportedLocale, 
    LocaleConfig, 
    TranslationKey, 
    I18nState, 
    InterpolationParams,
    TranslationFunction
} from './types';
import { localeConfigs } from './locales/configs';
import logger from '../utils/Logger';
import { EventBus } from '../services/EventBus';

export class I18nService {
    private static instance: I18nService;
    private state: I18nState;
    private eventBus: EventBus;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.state = {
            currentLocale: 'en',
            fallbackLocale: 'en',
            translations: {} as Record<SupportedLocale, TranslationKey>,
            localeConfig: localeConfigs
        };
    }

    public static getInstance(): I18nService {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService();
        }
        return I18nService.instance;
    }

    /**
     * Initialize i18n service with default locale
     */
    public async initialize(locale: SupportedLocale = 'en'): Promise<void> {
        try {
            logger.info('Initializing i18n service', 'I18nService.initialize', { locale });

            // Load default translations
            await this.loadTranslations('en');
            
            // Load target locale if different
            if (locale !== 'en') {
                await this.loadTranslations(locale);
            }

            await this.setLocale(locale);

            logger.info('i18n service initialized successfully', 'I18nService.initialize');
        } catch (error) {
            logger.error('Failed to initialize i18n service', 'I18nService.initialize', error);
            throw error;
        }
    }

    /**
     * Load translations for a specific locale
     */
    private async loadTranslations(locale: SupportedLocale): Promise<void> {
        try {
            // Dynamic import based on locale
            const translations = await import(`./locales/${locale}/index.ts`);
            this.state.translations[locale] = translations.default;
            
            logger.debug('Translations loaded', 'I18nService.loadTranslations', { locale });
        } catch (error) {
            logger.error('Failed to load translations', 'I18nService.loadTranslations', { 
                locale, 
                error 
            });
            
            // If loading fails and it's not the fallback, try fallback
            if (locale !== this.state.fallbackLocale) {
                logger.warn('Falling back to default locale', 'I18nService.loadTranslations', {
                    failedLocale: locale,
                    fallbackLocale: this.state.fallbackLocale
                });
            }
            throw error;
        }
    }

    /**
     * Set the current locale
     */
    public async setLocale(locale: SupportedLocale): Promise<void> {
        try {
            if (!this.state.localeConfig[locale]) {
                throw new Error(`Unsupported locale: ${locale}`);
            }

            // Load translations if not already loaded
            if (!this.state.translations[locale]) {
                await this.loadTranslations(locale);
            }

            const previousLocale = this.state.currentLocale;
            this.state.currentLocale = locale;

            // Emit locale change event
            this.eventBus.emit('i18n:localeChanged', {
                previousLocale,
                newLocale: locale
            });

            logger.info('Locale changed', 'I18nService.setLocale', {
                from: previousLocale,
                to: locale
            });
        } catch (error) {
            logger.error('Failed to set locale', 'I18nService.setLocale', { locale, error });
            throw error;
        }
    }

    /**
     * Get current locale
     */
    public getCurrentLocale(): SupportedLocale {
        return this.state.currentLocale;
    }

    /**
     * Get available locales
     */
    public getAvailableLocales(): LocaleConfig[] {
        return Object.values(this.state.localeConfig);
    }

    /**
     * Get translation for a key with interpolation support
     */
    public translate(key: string, params?: InterpolationParams): string {
        const translation = this.getTranslation(key);
        return this.interpolate(translation, params);
    }

    /**
     * Get plural translation
     */
    public translatePlural(key: string, count: number, params?: InterpolationParams): string {
        const pluralKey = this.getPluralKey(key, count);
        const translation = this.getTranslation(pluralKey);
        return this.interpolate(translation, { ...params, count });
    }

    /**
     * Format date according to current locale
     */
    public formatDate(date: Date, format?: string): string {
        const locale = this.state.currentLocale;
        const config = this.state.localeConfig[locale];
        
        const formatString = format || config.dateFormat;
        
        try {
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: formatString.includes('MM') ? '2-digit' : 'long',
                day: '2-digit'
            }).format(date);
        } catch (error) {
            logger.warn('Date formatting failed, using fallback', 'I18nService.formatDate', {
                date,
                format: formatString,
                error
            });
            return date.toLocaleDateString();
        }
    }

    /**
     * Format time according to current locale
     */
    public formatTime(date: Date, format?: string): string {
        const locale = this.state.currentLocale;
        const config = this.state.localeConfig[locale];
        
        const formatString = format || config.timeFormat;
        
        try {
            const is24Hour = formatString.includes('HH');
            return new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: !is24Hour
            }).format(date);
        } catch (error) {
            logger.warn('Time formatting failed, using fallback', 'I18nService.formatTime', {
                date,
                format: formatString,
                error
            });
            return date.toLocaleTimeString();
        }
    }

    /**
     * Format number according to current locale
     */
    public formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
        const locale = this.state.currentLocale;
        
        try {
            return new Intl.NumberFormat(locale, options).format(value);
        } catch (error) {
            logger.warn('Number formatting failed, using fallback', 'I18nService.formatNumber', {
                value,
                options,
                error
            });
            return value.toString();
        }
    }

    /**
     * Format currency according to current locale
     */
    public formatCurrency(value: number, currency: string = 'ADA'): string {
        const locale = this.state.currentLocale;
        const config = this.state.localeConfig[locale];
        
        try {
            // For ADA, use custom formatting
            if (currency === 'ADA') {
                const formatted = this.formatNumber(value, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                });
                
                return config.numberFormat.currency.position === 'before' 
                    ? `${config.numberFormat.currency.symbol}${formatted}`
                    : `${formatted} ${config.numberFormat.currency.symbol}`;
            }
            
            // Use standard currency formatting for other currencies
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(value);
        } catch (error) {
            logger.warn('Currency formatting failed, using fallback', 'I18nService.formatCurrency', {
                value,
                currency,
                error
            });
            return `${value} ${currency}`;
        }
    }

    /**
     * Create translation function for React components
     */
    public createTranslationFunction(): TranslationFunction {
        const t = (key: string, params?: InterpolationParams): string => {
            return this.translate(key, params);
        };

        t.plural = (key: string, count: number, params?: InterpolationParams): string => {
            return this.translatePlural(key, count, params);
        };

        t.formatDate = (date: Date, format?: string): string => {
            return this.formatDate(date, format);
        };

        t.formatTime = (date: Date, format?: string): string => {
            return this.formatTime(date, format);
        };

        t.formatNumber = (value: number, options?: Intl.NumberFormatOptions): string => {
            return this.formatNumber(value, options);
        };

        t.formatCurrency = (value: number, currency?: string): string => {
            return this.formatCurrency(value, currency);
        };

        return t;
    }

    /**
     * Get nested translation value
     */
    private getTranslation(key: string): string {
        const keys = key.split('.');
        const currentTranslations = this.state.translations[this.state.currentLocale];
        const fallbackTranslations = this.state.translations[this.state.fallbackLocale];

        // Try current locale first
        let translation = this.getNestedValue(currentTranslations, keys);
        
        // Fallback to default locale
        if (!translation && this.state.currentLocale !== this.state.fallbackLocale) {
            translation = this.getNestedValue(fallbackTranslations, keys);
        }

        // Return key if no translation found
        if (!translation) {
            logger.warn('Translation not found', 'I18nService.getTranslation', {
                key,
                locale: this.state.currentLocale
            });
            return key;
        }

        return translation;
    }

    /**
     * Get nested value from object
     */
    private getNestedValue(obj: any, keys: string[]): string | null {
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return null;
            }
        }

        return typeof current === 'string' ? current : null;
    }

    /**
     * Interpolate parameters into translation string
     */
    private interpolate(translation: string, params?: InterpolationParams): string {
        if (!params) return translation;

        return translation.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = params[key];
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Get plural key based on count and locale rules
     */
    private getPluralKey(key: string, count: number): string {
        const locale = this.state.currentLocale;
        
        // Simple pluralization rules
        if (locale === 'en') {
            return count === 1 ? `${key}.one` : `${key}.other`;
        } else if (locale === 'vi') {
            // Vietnamese doesn't have plural forms
            return `${key}.other`;
        }
        
        return `${key}.other`;
    }

    /**
     * Detect device locale
     */
    public static detectDeviceLocale(): SupportedLocale {
        try {
            // For React Native
            if (typeof navigator !== 'undefined' && navigator.language) {
                const language = navigator.language.split('-')[0];
                return language === 'vi' ? 'vi' : 'en';
            }
            
            // For Node.js/testing
            if (typeof process !== 'undefined' && process.env.LANG) {
                const language = process.env.LANG.split('_')[0];
                return language === 'vi' ? 'vi' : 'en';
            }
            
            return 'en';
        } catch (error) {
            logger.warn('Could not detect device locale, using English', 'I18nService.detectDeviceLocale', error);
            return 'en';
        }
    }
}

export default I18nService;

