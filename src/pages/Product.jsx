import { useState } from 'react';
import { useData } from '../data/AppData';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Input from '../components/Input';

// Show the two fixed vending slots using the same editor component.
export default function Product() {
  const { products } = useData();
  return <><PageHeading title="Product slots" description="Manage the products in Slot 1 and Slot 2." />
    <div className="two-columns">{products.map((product) => <SlotEditor key={product.id} product={product} />)}</div></>;
}

// Edit one slot independently so unsaved changes in the other slot stay intact.
function SlotEditor({ product }) {
  const { saveProduct: persistProduct } = useData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Validate price and stock before saving the product.
  async function saveProduct(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('name').trim();
    const price = Number(data.get('price'));
    const stock = Number(data.get('stock'));
    if (!name || !Number.isFinite(price) || price < 0.01 || price > 9999999999.99 || !Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647) return setMessage('Enter a name, a positive price, and a whole stock count.');
    setBusy(true);
    try {
      await persistProduct(product.id, { name, price: Math.round(price * 100) / 100, stock });
      setMessage(`Slot ${product.id} saved.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <section className="card"><p className="eyebrow">SLOT {product.id}</p><h3>{product.name}</h3>
    <p>{pesos(product.price)} · {product.stock} items available</p><form onSubmit={saveProduct}>
      <Input label="Product name" id={`product-name-${product.id}`} name="name" defaultValue={product.name} required maxLength={80} />
      <Input label="Price (₱)" id={`price-${product.id}`} name="price" type="number" defaultValue={product.price} min="0.01" step="0.01" required />
      <Input label="Stock count" id={`stock-${product.id}`} name="stock" type="number" defaultValue={product.stock} min="0" step="1" required />
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : `Save Slot ${product.id}`}</Button>
    </form><p role="status">{message}</p><p>Update the stock count after refilling this slot.</p></section>;
}
