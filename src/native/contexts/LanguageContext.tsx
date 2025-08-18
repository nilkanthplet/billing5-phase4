import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'gu' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  translate: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionary
const translations = {
  // Navigation
  'Dashboard': { gu: 'ડેશબોર્ડ', en: 'Dashboard' },
  'Issue': { gu: 'ઉધાર', en: 'Issue' },
  'Return': { gu: 'જમા', en: 'Return' },
  'Clients': { gu: 'ગ્રાહકો', en: 'Clients' },
  'Stock': { gu: 'સ્ટોક', en: 'Stock' },
  'Challans': { gu: 'ચલણો', en: 'Challans' },
  'Bills': { gu: 'બિલ', en: 'Bills' },
  'Ledger': { gu: 'ખાતાવહી', en: 'Ledger' },
  
  // Common
  'Loading': { gu: 'લોડ થઈ રહ્યું છે', en: 'Loading' },
  'Error': { gu: 'ભૂલ', en: 'Error' },
  'Success': { gu: 'સફળતા', en: 'Success' },
  'Save': { gu: 'સેવ કરો', en: 'Save' },
  'Cancel': { gu: 'રદ કરો', en: 'Cancel' },
  'Submit': { gu: 'સબમિટ કરો', en: 'Submit' },
  'Search': { gu: 'શોધો', en: 'Search' },
  'Add New': { gu: 'નવું ઉમેરો', en: 'Add New' },
  
  // Company
  'NO WERE TECH': { gu: 'NO WERE TECH', en: 'NO WERE TECH' },
  'Centering Plates Rental Service': { gu: 'સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા', en: 'Centering Plates Rental Service' },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>('gu'); // Default to Gujarati

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('language');
      if (saved) {
        setLanguage(saved as Language);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const updateLanguage = async (lang: Language) => {
    try {
      setLanguage(lang);
      await AsyncStorage.setItem('language', lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const translate = (key: string): string => {
    const translation = translations[key as keyof typeof translations];
    if (!translation) return key;
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: updateLanguage, translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}