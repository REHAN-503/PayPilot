import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const products = [
  {
    sku: 'ELEC-001',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    slug: 'sony-wh-1000xm5',
    description: 'Premium wireless noise-cancelling headphones with immersive sound.',
    category: 'Electronics',
    price: '299.99',
    stock: 25,
    imageUrl: 'https://placehold.co/600x600?text=Sony+Headphones',
  },
  {
    sku: 'ELEC-002',
    name: 'Apple AirPods Pro 2',
    slug: 'apple-airpods-pro-2',
    description: 'Wireless earbuds with active noise cancellation and spatial audio.',
    category: 'Electronics',
    price: '189.99',
    stock: 40,
    imageUrl: 'https://placehold.co/600x600?text=AirPods+Pro',
  },
  {
    sku: 'ELEC-003',
    name: 'Samsung 27-inch 4K Monitor',
    slug: 'samsung-27-inch-4k-monitor',
    description: 'Sharp 4K display for productivity and entertainment.',
    category: 'Electronics',
    price: '349.99',
    stock: 12,
    imageUrl: 'https://placehold.co/600x600?text=4K+Monitor',
  },
  {
    sku: 'ELEC-004',
    name: 'Logitech MX Master 3S',
    slug: 'logitech-mx-master-3s',
    description: 'Advanced wireless mouse with ergonomic design.',
    category: 'Electronics',
    price: '99.99',
    stock: 30,
    imageUrl: 'https://placehold.co/600x600?text=MX+Master+3S',
  },
  {
    sku: 'ELEC-005',
    name: 'Anker 737 Power Bank',
    slug: 'anker-737-power-bank',
    description: 'High-capacity portable charger with fast USB-C charging.',
    category: 'Electronics',
    price: '109.99',
    stock: 35,
    imageUrl: 'https://placehold.co/600x600?text=Anker+PowerBank',
  },
  {
    sku: 'ACC-001',
    name: 'Apple Magic Keyboard',
    slug: 'apple-magic-keyboard',
    description: 'Slim wireless keyboard with a comfortable typing experience.',
    category: 'Accessories',
    price: '99.00',
    stock: 20,
    imageUrl: 'https://placehold.co/600x600?text=Magic+Keyboard',
  },
  {
    sku: 'ACC-002',
    name: 'Logitech MX Keys Mini',
    slug: 'logitech-mx-keys-mini',
    description: 'Compact wireless keyboard designed for productivity.',
    category: 'Accessories',
    price: '79.99',
    stock: 18,
    imageUrl: 'https://placehold.co/600x600?text=MX+Keys+Mini',
  },
  {
    sku: 'ACC-003',
    name: 'Anker USB-C Hub 8-in-1',
    slug: 'anker-usbc-hub-8-in-1',
    description: 'Multiport USB-C hub with HDMI and card reader connectivity.',
    category: 'Accessories',
    price: '49.99',
    stock: 45,
    imageUrl: 'https://placehold.co/600x600?text=USB-C+Hub',
  },
  {
    sku: 'HOME-001',
    name: 'Philips Smart LED Bulb',
    slug: 'philips-smart-led-bulb',
    description: 'Smart LED lighting with adjustable brightness and app control.',
    category: 'Home',
    price: '24.99',
    stock: 60,
    imageUrl: 'https://placehold.co/600x600?text=Smart+Bulb',
  },
  {
    sku: 'HOME-002',
    name: 'Amazon Echo Dot',
    slug: 'amazon-echo-dot',
    description: 'Compact smart speaker for music and smart home control.',
    category: 'Home',
    price: '49.99',
    stock: 28,
    imageUrl: 'https://placehold.co/600x600?text=Echo+Dot',
  },
  {
    sku: 'HOME-003',
    name: 'Xiaomi Air Purifier 4',
    slug: 'xiaomi-air-purifier-4',
    description: 'Smart air purifier designed to improve indoor air quality.',
    category: 'Home',
    price: '179.99',
    stock: 10,
    imageUrl: 'https://placehold.co/600x600?text=Air+Purifier',
  },
  {
    sku: 'LIFE-001',
    name: 'Fitbit Charge 6',
    slug: 'fitbit-charge-6',
    description: 'Fitness tracker with activity and sleep tracking features.',
    category: 'Lifestyle',
    price: '159.95',
    stock: 22,
    imageUrl: 'https://placehold.co/600x600?text=Fitbit+Charge+6',
  },
  {
    sku: 'LIFE-002',
    name: 'JBL Flip 6 Speaker',
    slug: 'jbl-flip-6',
    description: 'Portable Bluetooth speaker with powerful sound.',
    category: 'Lifestyle',
    price: '99.95',
    stock: 32,
    imageUrl: 'https://placehold.co/600x600?text=JBL+Flip+6',
  },
  {
    sku: 'WORK-001',
    name: 'Dell UltraSharp Webcam',
    slug: 'dell-ultrasharp-webcam',
    description: 'High-quality webcam designed for professional video calls.',
    category: 'Work',
    price: '129.99',
    stock: 14,
    imageUrl: 'https://placehold.co/600x600?text=Dell+Webcam',
  },
  {
    sku: 'WORK-002',
    name: 'Blue Yeti USB Microphone',
    slug: 'blue-yeti-usb-microphone',
    description: 'USB microphone for streaming, meetings and recording.',
    category: 'Work',
    price: '109.99',
    stock: 16,
    imageUrl: 'https://placehold.co/600x600?text=Blue+Yeti',
  },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        ...product,
        currency: 'USD',
        status: 'ACTIVE',
      },
      create: {
        ...product,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });
  }

  console.log(`Successfully seeded ${products.length} PayPilot products.`);
}

main()
  .catch((error: unknown) => {
    console.error('Product seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
