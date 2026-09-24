import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ru: {
    translation: {
      home: 'Главная',
      favorites: 'Избранное',
      orders: 'Заказы',
      cart: 'Корзина',
      myShops: 'Мои магазины',
    },
  },
  en: {
    translation: {
      home: 'Home',
      favorites: 'Favorites',
      orders: 'Orders',
      cart: 'Cart',
      myShops: 'My shops',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;
