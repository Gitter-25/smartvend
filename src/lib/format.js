// Display an amount in Philippine pesos, including centavos.
export function pesos(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}
