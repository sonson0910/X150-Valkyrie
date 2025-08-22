/**
 * Internationalization type definitions
 */

export type SupportedLocale = 'en' | 'vi';

export interface TranslationKey {
    [key: string]: string | TranslationKey;
}

export interface LocaleConfig {
    code: SupportedLocale;
    name: string;
    nativeName: string;
    rtl: boolean;
    dateFormat: string;
    timeFormat: string;
    numberFormat: {
        decimal: string;
        thousands: string;
        currency: {
            symbol: string;
            position: 'before' | 'after';
        };
    };
}

export interface PluralRule {
    zero?: string;
    one?: string;
    two?: string;
    few?: string;
    many?: string;
    other: string;
}

export interface InterpolationParams {
    [key: string]: string | number | Date;
}

export interface TranslationFunction {
    (key: string, params?: InterpolationParams): string;
    plural: (key: string, count: number, params?: InterpolationParams) => string;
    formatDate: (date: Date, format?: string) => string;
    formatTime: (date: Date, format?: string) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatCurrency: (value: number, currency?: string) => string;
}

export interface I18nState {
    currentLocale: SupportedLocale;
    fallbackLocale: SupportedLocale;
    translations: Record<SupportedLocale, TranslationKey>;
    localeConfig: Record<SupportedLocale, LocaleConfig>;
}

