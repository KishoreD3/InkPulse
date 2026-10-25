import 'server-only';

/**
 * How the store takes money.
 *  - test (default): no gateway. Orders go through every status as if paid, marked gateway = 'test',
 *    and are never sent to the printer unless PRINT_TEST_ORDERS=true.
 *  - razorpay: the Razorpay checkout (set PAYMENTS_MODE=razorpay once keys and the webhook are in place).
 */
export function paymentsMode(): 'test' | 'razorpay' {
  return process.env.PAYMENTS_MODE === 'razorpay' ? 'razorpay' : 'test';
}

export const printTestOrders = () => process.env.PRINT_TEST_ORDERS === 'true';
