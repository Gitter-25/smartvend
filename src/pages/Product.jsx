import { useState } from 'react';
import { useDemo } from '../data/DemoContext';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Input from '../components/Input';

// Edit the single product and its stock in temporary demo data.
export default function Product() {
  const { product, setProduct } = useDemo();
  const [message, setMessage] = useState('');

  // Validate price and stock before saving the demo product.
  function saveProduct(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get('name').trim();
    const price = Number(data.get('price'));
    const stock = Number(data.get('stock'));
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(stock) || stock < 0) return setMessage('Enter a name, a positive price, and a whole stock count.');
    setProduct({ name, price: Math.round(price * 100) / 100, stock });
    setMessage('Demo product saved. Dashboard stock has been updated.');
  }

  return <><PageHeading title="Product" description="Manage the product in your one vending slot." />
    <div className="two-columns"><section className="card"><h3>Product settings</h3><form onSubmit={saveProduct}>
      <Input label="Product name" id="product-name" name="name" defaultValue={product.name} required maxLength={80} />
      <Input label="Price (₱)" id="price" name="price" type="number" defaultValue={product.price} min="0.01" step="0.01" required />
      <Input label="Stock count" id="stock" name="stock" type="number" defaultValue={product.stock} min="0" step="1" required />
      <Button type="submit">Save product</Button></form><p role="status">{message}</p></section>
      <section className="card"><p className="eyebrow">SLOT 01</p><h3>{product.name}</h3><strong>{pesos(product.price)}</strong><p>{product.stock} items available</p><p>Update the stock count after refilling the machine.</p></section>
    </div></>;
}
