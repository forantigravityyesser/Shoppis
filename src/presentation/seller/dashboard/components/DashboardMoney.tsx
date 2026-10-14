import { formatMoneyMinor } from '../../../../domain/rules/product-rules';

interface Props {
  minor: number;
  symbol: string;
  /** Тон суммы: заработано (зелёный) / потенциально (жёлтый). */
  tone: 'earned' | 'frozen';
}

/** Сумма дохода с цветовым тоном (docs/25 §4.3). */
export default function DashboardMoney({ minor, symbol, tone }: Props) {
  return (
    <span
      className={`dash-money dash-money--${tone}`}
      data-testid="dashboard-money"
      data-tone={tone}
    >
      {formatMoneyMinor(minor, symbol)}
    </span>
  );
}
