/**
 * Locale configurations for supported languages
 */

import { LocaleConfig, SupportedLocale } from '../types';

export const localeConfigs: Record<SupportedLocale, LocaleConfig> = {
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        rtl: false,
        dateFormat: 'MM/dd/yyyy',
        timeFormat: 'hh:mm a',
        numberFormat: {
            decimal: '.',
            thousands: ',',
            currency: {
                symbol: '₳',
                position: 'before'
            }
        }
    },
    vi: {
        code: 'vi',
        name: 'Vietnamese',
        nativeName: 'Tiếng Việt',
        rtl: false,
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'HH:mm',
        numberFormat: {
            decimal: ',',
            thousands: '.',
            currency: {
                symbol: '₳',
                position: 'after'
            }
        }
    }
};

