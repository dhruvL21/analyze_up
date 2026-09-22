import { Product, Supplier, Category, Transaction, PurchaseOrder, ProductReturn } from './types';

export function generateDemoBusinessData() {
  const categories: Category[] = [
    { id: 'cat-fashion-1', name: 'Apparel & Wearables', description: 'T-Shirts, Hoodies, Jackets & Denim', isDemo: true, source: 'DEMO' },
    { id: 'cat-fashion-2', name: 'Footwear', description: 'Sneakers, Formal Shoes & Boots', isDemo: true, source: 'DEMO' },
    { id: 'cat-electronics-1', name: 'Smartphones & Audio', description: 'Headphones, Earbuds & Accessories', isDemo: true, source: 'DEMO' },
    { id: 'cat-electronics-2', name: 'Computers & Peripherals', description: 'Laptops, Keyboards & Cables', isDemo: true, source: 'DEMO' },
    { id: 'cat-beauty-1', name: 'Skincare & Cosmetics', description: 'Serums, Moisturizers & Cleansers', isDemo: true, source: 'DEMO' },
    { id: 'cat-home-1', name: 'Home & Kitchen', description: 'Cookware, Decor & Organizers', isDemo: true, source: 'DEMO' },
    { id: 'cat-sports-1', name: 'Fitness & Outdoors', description: 'Yoga Mats, Dumbbells & Gear', isDemo: true, source: 'DEMO' },
    { id: 'cat-food-1', name: 'Specialty Gourmet & Coffee', description: 'Artisanal Coffee Beans & Organic Teas', isDemo: true, source: 'DEMO' },
  ];

  const nowIso = new Date().toISOString();

  const suppliers: Supplier[] = [
    { id: 'sup-1', name: 'Apex Apparel Global', contactName: 'Rajesh Sharma', email: 'orders@apexapparel.com', phone: '+91 98765 43210', address: 'Tirupur, Tamil Nadu, India', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-2', name: 'Vanguard Footwear Ltd', contactName: 'Elena Rostova', email: 'sales@vanguardfootwear.com', phone: '+1 555 019 2831', address: 'Portland, OR, USA', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-3', name: 'Zenith Electronics Corp', contactName: 'Kenji Sato', email: 'b2b@zenithelec.jp', phone: '+81 3 5555 0142', address: 'Akihabara, Tokyo, Japan', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-4', name: 'PureBotanica Labs', contactName: 'Dr. Sarah Lin', email: 'wholesale@purebotanica.com', phone: '+1 800 555 9182', address: 'San Francisco, CA, USA', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-5', name: 'MasterCraft Homeware', contactName: 'Vikram Mehta', email: 'supply@mastercrafthome.in', phone: '+91 98200 11223', address: 'Moradabad, UP, India', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-6', name: 'Titanium Athletics', contactName: 'Marcus Vance', email: 'orders@titaniumfit.com', phone: '+44 20 7946 0912', address: 'Manchester, UK', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-7', name: 'Himalayan Coffee Estate', contactName: 'Anil Coorg', email: 'beans@himalayancoffee.in', phone: '+91 94480 33445', address: 'Chikmagalur, Karnataka, India', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-8', name: 'SiliconValley Tech Components', contactName: 'David Miller', email: 'sales@svtechcomp.com', phone: '+1 408 555 4910', address: 'San Jose, CA, USA', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-9', name: 'Velvet Thread Textiles', contactName: 'Priya Sundaram', email: 'orders@velvetthread.in', phone: '+91 97110 88990', address: 'Surat, Gujarat, India', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-10', name: 'Nordic Minimalist Living', contactName: 'Astrid Lindgren', email: 'b2b@nordicliving.se', phone: '+46 8 123 4567', address: 'Stockholm, Sweden', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-11', name: 'Gourmet Spice Route', contactName: 'Zubair Ahmed', email: 'wholesale@spiceroute.in', phone: '+91 99000 77665', address: 'Kochi, Kerala, India', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-12', name: 'Urban Leather Craft', contactName: 'Gabriel Fernandez', email: 'orders@urbanleather.es', phone: '+34 91 555 8920', address: 'Ubrique, Spain', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-13', name: 'Solaris Eco Packaging', contactName: 'Neha Gupta', email: 'eco@solarispack.com', phone: '+91 98100 44332', address: 'Bhiwadi, Rajasthan, India', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-14', name: 'ProFit Gym Equipment', contactName: 'Hans Gruber', email: 'sales@profitgym.de', phone: '+49 30 9876 5432', address: 'Frankfurt, Germany', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
    { id: 'sup-15', name: 'Aura Fragrances Co', contactName: 'Sophie Dubois', email: 'contact@aurafragrances.fr', phone: '+33 1 42 68 55 00', address: 'Grasse, France', createdAt: nowIso, updatedAt: nowIso, isDemo: true, source: 'DEMO' },
  ];

  // Helper for random choices
  const now = new Date();

  // Create 205 realistic products across categories with real Unsplash photography
  const productTemplates = [
    { name: 'Organic Cotton Crewneck T-Shirt', catId: 'cat-fashion-1', basePrice: 1299, cost: 450, unit: 'Piece', brand: 'AnalyzeUp Apparel', sup: 'Apex Apparel Global', imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&auto=format&fit=crop&q=80' },
    { name: 'Heavyweight Fleece Oversized Hoodie', catId: 'cat-fashion-1', basePrice: 2999, cost: 1100, unit: 'Piece', brand: 'Urban Thread', sup: 'Apex Apparel Global', imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&auto=format&fit=crop&q=80' },
    { name: 'Slim-Fit Stretch Denim Jeans', catId: 'cat-fashion-1', basePrice: 3499, cost: 1250, unit: 'Piece', brand: 'DenimCo', sup: 'Velvet Thread Textiles', imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&auto=format&fit=crop&q=80' },
    { name: 'Water-Resistant Windbreaker Jacket', catId: 'cat-fashion-1', basePrice: 4999, cost: 1950, unit: 'Piece', brand: 'Titanium Outdoors', sup: 'Titanium Athletics', imageUrl: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&auto=format&fit=crop&q=80' },
    { name: 'Breathable Running Mesh Sneakers', catId: 'cat-fashion-2', basePrice: 4499, cost: 1600, unit: 'Pair', brand: 'Vanguard Kicks', sup: 'Vanguard Footwear Ltd', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=80' },
    { name: 'Handcrafted Italian Leather Loafers', catId: 'cat-fashion-2', basePrice: 7999, cost: 3200, unit: 'Pair', brand: 'Urban Leather', sup: 'Urban Leather Craft', imageUrl: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=400&auto=format&fit=crop&q=80' },
    { name: 'Active Performance Cross-Trainers', catId: 'cat-fashion-2', basePrice: 5299, cost: 2100, unit: 'Pair', brand: 'Vanguard Kicks', sup: 'Vanguard Footwear Ltd', imageUrl: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&auto=format&fit=crop&q=80' },
    { name: 'ANC Wireless Noise Cancelling Headphones', catId: 'cat-electronics-1', basePrice: 8999, cost: 3800, unit: 'Piece', brand: 'Zenith Audio', sup: 'Zenith Electronics Corp', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80' },
    { name: 'True Wireless Stereo Earbuds Pro', catId: 'cat-electronics-1', basePrice: 3999, cost: 1400, unit: 'Piece', brand: 'Zenith Audio', sup: 'Zenith Electronics Corp', imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80' },
    { name: 'Ergonomic Mechanical Keyboard (RGB)', catId: 'cat-electronics-2', basePrice: 5499, cost: 2300, unit: 'Piece', brand: 'SV Tech', sup: 'SiliconValley Tech Components', imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&auto=format&fit=crop&q=80' },
    { name: 'Ultra-Slim 4K USB-C Hub (7-in-1)', catId: 'cat-electronics-2', basePrice: 2499, cost: 850, unit: 'Piece', brand: 'SV Tech', sup: 'SiliconValley Tech Components', imageUrl: 'https://images.unsplash.com/photo-1616440347437-b1c73416efc2?w=400&auto=format&fit=crop&q=80' },
    { name: 'Hyaluronic Acid Hydrating Serum (50ml)', catId: 'cat-beauty-1', basePrice: 1499, cost: 320, unit: 'Bottle', brand: 'PureBotanica', sup: 'PureBotanica Labs', imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&auto=format&fit=crop&q=80' },
    { name: 'Niacinamide Glow Brightening Cream', catId: 'cat-beauty-1', basePrice: 1299, cost: 280, unit: 'Bottle', brand: 'PureBotanica', sup: 'PureBotanica Labs', imageUrl: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&auto=format&fit=crop&q=80' },
    { name: 'Elysium Eau De Parfum (100ml)', catId: 'cat-beauty-1', basePrice: 4999, cost: 1350, unit: 'Bottle', brand: 'Aura Fragrances', sup: 'Aura Fragrances Co', imageUrl: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=400&auto=format&fit=crop&q=80' },
    { name: 'Cast Iron Dutch Oven (4.5L)', catId: 'cat-home-1', basePrice: 6499, cost: 2600, unit: 'Piece', brand: 'MasterCraft', sup: 'MasterCraft Homeware', imageUrl: 'https://images.unsplash.com/photo-1584990347449-399088656111?w=400&auto=format&fit=crop&q=80' },
    { name: 'Hand-Poured Soy Wax Scented Candle', catId: 'cat-home-1', basePrice: 999, cost: 220, unit: 'Piece', brand: 'Nordic Living', sup: 'Nordic Minimalist Living', imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=400&auto=format&fit=crop&q=80' },
    { name: 'High-Density Non-Slip Yoga Mat (6mm)', catId: 'cat-sports-1', basePrice: 1899, cost: 550, unit: 'Piece', brand: 'Titanium Athletics', sup: 'Titanium Athletics', imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&auto=format&fit=crop&q=80' },
    { name: 'Adjustable Quick-Lock Dumbbell Set', catId: 'cat-sports-1', basePrice: 12999, cost: 5200, unit: 'Set', brand: 'ProFit Gym', sup: 'ProFit Gym Equipment', imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400&auto=format&fit=crop&q=80' },
    { name: 'Dark Roast Arabica Whole Bean Coffee (1kg)', catId: 'cat-food-1', basePrice: 1499, cost: 480, unit: 'Kg', brand: 'Himalayan Estate', sup: 'Himalayan Coffee Estate', imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80' },
    { name: 'Organic Matcha Green Tea Powder (250g)', catId: 'cat-food-1', basePrice: 1199, cost: 350, unit: 'Pack', brand: 'Gourmet Route', sup: 'Gourmet Spice Route', imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80' },
  ];

  const products: Product[] = [];
  let productIndex = 1;

  // Generate 205 items by creating variants/colors/sizes
  const colors = ['Black', 'Navy', 'White', 'Charcoal', 'Olive', 'Beige', 'Crimson'];
  const sizes = ['S', 'M', 'L', 'XL', 'Standard', 'Pro'];

  for (let i = 0; i < 205; i++) {
    const template = productTemplates[i % productTemplates.length];
    const color = colors[i % colors.length];
    const size = sizes[Math.floor(i / 2) % sizes.length];
    const isVariantName = `${template.name} - ${color} (${size})`;
    const sku = `ANUP-${1000 + productIndex}`;
    const barcode = `89012345${10000 + productIndex}`;
    
    // Vary stock to create out-of-stock, low stock, fast movers, slow movers, and dead stock
    let stock = 45;
    let minStock = 10;
    if (i === 7 || i === 21 || i === 49 || i === 84) {
      stock = 0; // Critical Out of Stock (0 units remaining)
    } else if (i % 7 === 0) {
      stock = 3; // Low stock alert
    } else if (i % 9 === 0) {
      stock = 140; // High inventory / slow moving
    } else if (i % 13 === 0) {
      stock = 85; // Dead stock (zero sales)
    } else {
      stock = Math.floor(Math.random() * 60) + 15;
    }

    const supObj = suppliers.find(s => s.name === template.sup) || suppliers[0];
    const catObj = categories.find(c => c.id === template.catId);
    const unitPrice = template.basePrice + ((i % 5) * 100);
    const unitCost = template.cost + ((i % 5) * 30);

    products.push({
      id: `prod-${productIndex}`,
      name: isVariantName,
      description: `Premium grade ${template.name.toLowerCase()} designed for modern performance and durability.`,
      sku: sku,
      barcode: barcode,
      category: catObj ? catObj.name : 'General',
      categoryId: template.catId,
      brand: template.brand,
      supplier: supObj.name,
      supplierId: supObj.id,
      stock: stock,
      minStock: minStock,
      maxStock: minStock * 5,
      reorderPoint: minStock * 2,
      reorderQuantity: minStock * 4,
      unit: template.unit,
      price: unitPrice,
      costPrice: unitCost,
      profitMarginPercent: Math.round(((unitPrice - unitCost) / unitPrice) * 100),
      status: 'Active',
      imageUrl: template.imageUrl,
      averageDailySales: parseFloat(((Math.random() * 3) + 0.2).toFixed(1)),
      salesVelocity: parseFloat(((Math.random() * 2.5) + 0.3).toFixed(2)),
      leadTimeDays: Math.floor(Math.random() * 10) + 5,
      isDemo: true,
      source: 'DEMO',
      createdAt: new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    productIndex++;
  }

  // Generate 520 Sales & Purchase Transactions spanning the last 90 days
  const transactions: Transaction[] = [];
  const paymentMethods = ['UPI', 'Credit Card', 'Debit Card', 'Cash on Delivery', 'Net Banking'];

  for (let t = 1; t <= 520; t++) {
    // Pick product (prefer non-dead stock for realistic velocity)
    const product = products[t % 180]; // leave last 25 products with 0 sales for Dead Stock!
    const isSale = t % 5 !== 0; // 80% sales, 20% purchases
    const daysAgo = Math.floor((t / 520) * 90); // spread across 90 days
    const txDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (Math.random() * 3600000 * 12)).toISOString();
    
    const qty = isSale ? (Math.floor(Math.random() * 3) + 1) : (Math.floor(Math.random() * 30) + 20);
    const unitPrice = isSale ? product.price : product.costPrice;
    const catObj = categories.find(c => c.id === product.categoryId);

    transactions.push({
      id: `tx-${t}`,
      transactionId: `TXN-2026-${10000 + t}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: catObj ? catObj.name : 'General',
      type: isSale ? 'Sale' : 'Purchase',
      quantity: qty,
      price: unitPrice || 0,
      totalRevenue: isSale ? (unitPrice || 0) * qty : 0,
      costPerUnit: product.costPrice || 0,
      totalCost: (product.costPrice || 0) * qty,
      supplier: product.supplier,
      customerName: isSale ? `Customer #${1000 + (t % 150)}` : undefined,
      paymentMethod: isSale ? paymentMethods[t % paymentMethods.length] : 'Bank Transfer',
      status: 'Completed',
      isDemo: true,
      source: 'DEMO',
      transactionDate: txDate,
      createdAt: txDate,
      updatedAt: txDate,
    });
  }

  // Generate 65 Purchase Orders across suppliers with realistic lead times and delivery statuses
  const purchaseOrders: PurchaseOrder[] = [];
  const poStatuses: ('Fulfilled' | 'Pending' | 'Cancelled')[] = ['Fulfilled', 'Fulfilled', 'Fulfilled', 'Pending', 'Cancelled'];

  for (let po = 1; po <= 65; po++) {
    const product = products[po * 3 % products.length];
    // Leave supplier 'sup-15' with ZERO POs to test Insufficient History empty state!
    const activeSuppliers = suppliers.filter(s => s.id !== 'sup-15');
    const supObj = activeSuppliers[po % activeSuppliers.length];
    
    const daysAgo = Math.floor((po / 65) * 80) + 2;
    const orderDateObj = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const poDate = orderDateObj.toISOString();
    
    const leadTime = supObj.name.includes('Apex') || supObj.name.includes('Pure') ? 4 : (supObj.name.includes('Master') ? 9 : 6);
    const expectedDeliveryObj = new Date(orderDateObj.getTime() + (leadTime * 24 * 60 * 60 * 1000));
    const expectedDeliveryDate = expectedDeliveryObj.toISOString();

    const status = poStatuses[po % poStatuses.length];
    let actualDeliveryDate: string | undefined = undefined;

    if (status === 'Fulfilled') {
      // Simulate on-time vs late delivery (85% on time, 15% delayed)
      const delayDays = (po % 7 === 0) ? Math.floor(Math.random() * 4) + 2 : 0;
      actualDeliveryDate = new Date(expectedDeliveryObj.getTime() + (delayDays * 24 * 60 * 60 * 1000)).toISOString();
    }

    const qty = Math.floor(Math.random() * 60) + 20;
    const unitCost = product.costPrice || Math.round(product.price * 0.6);
    const totalCost = Math.round(unitCost * qty);

    purchaseOrders.push({
      id: `po-${po}`,
      supplierId: supObj.id,
      productId: product.id,
      quantity: qty,
      unitCost,
      totalCost,
      orderDate: poDate,
      expectedDeliveryDate,
      actualDeliveryDate,
      status,
      isDemo: true,
      source: 'DEMO',
      createdAt: poDate,
      updatedAt: actualDeliveryDate || poDate,
    });
  }

  // Generate 12 Returns
  const returns: ProductReturn[] = [];
  const returnReasons = ['Defective', 'Wrong Item', 'Unopened / Buyer Remorse', 'Damaged in Transit'];
  for (let r = 1; r <= 12; r++) {
    const product = products[r * 12 % products.length];
    const retDate = new Date(now.getTime() - (r * 5 * 24 * 60 * 60 * 1000)).toISOString();

    returns.push({
      id: `ret-${r}`,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      customerName: `Customer #${1050 + r}`,
      reason: returnReasons[r % returnReasons.length] as any,
      actionTaken: r % 2 === 0 ? 'Restocked' : 'Disposed / Written Off',
      refundStatus: r % 3 === 0 ? 'Pending' : 'Refunded',
      refundAmount: product.price,
      returnDate: retDate,
      notes: 'Customer requested quick inspection and refund processing.',
      isDemo: true,
      source: 'DEMO',
      createdAt: retDate,
      updatedAt: retDate,
    });
  }

  return {
    products,
    suppliers,
    categories,
    transactions,
    orders: purchaseOrders,
    returns,
  };
}
