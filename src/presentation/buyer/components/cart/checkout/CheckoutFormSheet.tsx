import { useState, type ReactNode } from 'react';
import { LoaderCircle, MapPin, Phone, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../../../../shared/components/BottomSheet';
import type { RecipientInfo } from '../../../../../domain/models/customer';
import type { CheckoutRecipientValidation } from '../../../../../domain/rules/checkout-rules';
import type {
  CheckoutFieldPatch,
  CheckoutStatus,
} from '../../../../../application/hooks/useCheckout';
import StoreContactLink from './StoreContactLink';

interface Props {
  open: boolean;
  recipient: RecipientInfo;
  validation: CheckoutRecipientValidation;
  status: CheckoutStatus;
  /** Локализованная ошибка оформления (из application). */
  error: string | null;
  supportHandle: string | null;
  storeName?: string;
  onFieldChange: (patch: CheckoutFieldPatch) => void;
  onSubmit: () => void;
  onClose: () => void;
}

interface FieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  placeholder: string;
  invalid: boolean;
  errorText: string;
  multiline?: boolean;
  inputMode?: 'text' | 'tel';
  autoComplete?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function CheckoutField({
  id,
  label,
  icon,
  value,
  placeholder,
  invalid,
  errorText,
  multiline = false,
  inputMode = 'text',
  autoComplete,
  onChange,
  onBlur,
}: FieldProps) {
  return (
    <div className={`checkout-field${invalid ? ' checkout-field--invalid' : ''}`}>
      <label className="checkout-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="checkout-field__box">
        <span className="checkout-field__icon" aria-hidden>
          {icon}
        </span>
        {multiline ? (
          <textarea
            id={id}
            className="checkout-field__input checkout-field__input--area"
            rows={2}
            placeholder={placeholder}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        ) : (
          <input
            id={id}
            className="checkout-field__input"
            type={inputMode === 'tel' ? 'tel' : 'text'}
            inputMode={inputMode}
            placeholder={placeholder}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      </div>
      {invalid ? (
        <p className="checkout-field__error" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Форма оформления заказа (docs/18 §23–§26): ФИО, телефон (цифровая клавиатура),
 * адрес доставки + контакт продавца. Кнопка «Оформить заказ» (без цены) активна,
 * только когда все поля валидны и заказ не отправляется. Presentational — всё
 * состояние и отправка приходят из `useCheckout`.
 */
export default function CheckoutFormSheet({
  open,
  recipient,
  validation,
  status,
  error,
  supportHandle,
  storeName,
  onFieldChange,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState({ name: false, phone: false, address: false });
  const markTouched = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const submitting = status === 'submitting';
  const canSubmit = validation.valid && !submitting;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="checkout-form" data-testid="checkout-form">
        <div className="checkout-form__head">
          <h2 className="checkout-form__title">{t('buyer.checkout.title')}</h2>
          <button
            type="button"
            className="checkout-form__close"
            aria-label={t('buyer.checkout.close')}
            onClick={onClose}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {error ? (
          <div className="checkout-form__error" role="alert">
            {error}
          </div>
        ) : null}

        <CheckoutField
          id="checkout-name"
          label={t('buyer.checkout.nameLabel')}
          icon={<User size={18} />}
          value={recipient.name}
          placeholder={t('buyer.checkout.namePlaceholder')}
          autoComplete="name"
          invalid={touched.name && !validation.nameValid}
          errorText={t('buyer.checkout.nameError')}
          onChange={(value) => onFieldChange({ name: value })}
          onBlur={() => markTouched('name')}
        />

        <CheckoutField
          id="checkout-phone"
          label={t('buyer.checkout.phoneLabel')}
          icon={<Phone size={18} />}
          value={recipient.phone}
          placeholder={t('buyer.checkout.phonePlaceholder')}
          inputMode="tel"
          autoComplete="tel"
          invalid={touched.phone && !validation.phoneValid}
          errorText={t('buyer.checkout.phoneError')}
          onChange={(value) => onFieldChange({ phone: value })}
          onBlur={() => markTouched('phone')}
        />

        <CheckoutField
          id="checkout-address"
          label={t('buyer.checkout.addressLabel')}
          icon={<MapPin size={18} />}
          value={recipient.address}
          placeholder={t('buyer.checkout.addressPlaceholder')}
          multiline
          autoComplete="street-address"
          invalid={touched.address && !validation.addressValid}
          errorText={t('buyer.checkout.addressError')}
          onChange={(value) => onFieldChange({ address: value })}
          onBlur={() => markTouched('address')}
        />

        <StoreContactLink handle={supportHandle} storeName={storeName} />

        <button
          type="button"
          className="checkout-submit"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitting ? (
            <>
              <LoaderCircle className="checkout-submit__spin" size={18} aria-hidden />
              {t('buyer.checkout.submitting')}
            </>
          ) : (
            t('buyer.checkout.submit')
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
