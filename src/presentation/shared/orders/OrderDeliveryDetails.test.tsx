// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderDeliveryDetails from './OrderDeliveryDetails';

describe('OrderDeliveryDetails', () => {
  it('рендерит получателя, телефон и адрес', () => {
    render(
      <OrderDeliveryDetails
        delivery={{ fullName: 'Данила', phone: '+375257914112', address: 'Минск, Ленина 1' }}
      />,
    );
    expect(screen.getByText('Данила')).toBeInTheDocument();
    expect(screen.getByText('+375257914112')).toBeInTheDocument();
    expect(screen.getByText('Минск, Ленина 1')).toBeInTheDocument();
  });

  it('пустое значение → прочерк', () => {
    render(<OrderDeliveryDetails delivery={{ fullName: '', phone: '', address: '' }} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});
