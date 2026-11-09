import 'dotenv/config';
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
    name: 'AuraSound Aero-5 Noise-Cancelling Headphones',
    slug: 'aurasound-aero-5',
    description: 'Premium wireless active noise-cancelling over-ear headphones with 40-hour battery life.',
    category: 'Electronics',
    price: '299.99',
    stock: 25,
    imageUrl: 'https://placehold.co/600x600?text=AuraSound+Aero-5',
  },
  {
    sku: 'ELEC-002',
    name: 'SonicBuds Pro 2 Wireless Earbuds',
    slug: 'sonicbuds-pro-2',
    description: 'Compact wireless earbuds with adaptive transparency and spatial audio.',
    category: 'Electronics',
    price: '189.99',
    stock: 40,
    imageUrl: 'https://placehold.co/600x600?text=SonicBuds+Pro+2',
  },
  {
    sku: 'ELEC-003',
    name: 'NovaView 27-inch 4K Productivity Monitor',
    slug: 'novaview-27-4k',
    description: 'Ultra-sharp 4K IPS display engineered for multi-tasking and color fidelity.',
    category: 'Electronics',
    price: '349.99',
    stock: 12,
    imageUrl: 'https://placehold.co/600x600?text=NovaView+27+4K',
  },
  {
    sku: 'ELEC-006',
    name: 'PixelView 24-inch QHD Developer Monitor',
    slug: 'pixelview-24-qhd',
    description: 'Crisp QHD IPS developer monitor with exceptional text clarity, sRGB color calibration, and anti-glare finish.',
    category: 'Electronics',
    price: '229.99',
    stock: 18,
    imageUrl: 'https://placehold.co/600x600?text=PixelView+24+QHD',
  },
  {
    sku: 'ELEC-004',
    name: 'ErgoFlow Precision Mouse 3S',
    slug: 'ergoflow-mouse-3s',
    description: 'Ergonomic multi-device wireless mouse with high-precision electromagnetic scroll.',
    category: 'Electronics',
    price: '99.99',
    stock: 30,
    imageUrl: 'https://placehold.co/600x600?text=ErgoFlow+Mouse',
  },
  {
    sku: 'ELEC-005',
    name: 'VoltCore 700 Fast-Charge Power Bank',
    slug: 'voltcore-700-power-bank',
    description: '24,000mAh high-output portable power bank with dual USB-C Power Delivery.',
    category: 'Electronics',
    price: '109.99',
    stock: 35,
    imageUrl: 'https://placehold.co/600x600?text=VoltCore+700',
  },
  {
    sku: 'ACC-001',
    name: 'AeroType Slim Wireless Keyboard',
    slug: 'aerotype-wireless-keyboard',
    description: 'Ultra-thin aluminum chassis wireless keyboard with tactile scissor switches.',
    category: 'Accessories',
    price: '99.00',
    stock: 20,
    imageUrl: 'https://placehold.co/600x600?text=AeroType+Keyboard',
  },
  {
    sku: 'ACC-002',
    name: 'KeyFlow Mini Compact Keyboard',
    slug: 'keyflow-mini-keyboard',
    description: 'Compact 75% mechanical wireless keyboard with whisper-quiet linear switches.',
    category: 'Accessories',
    price: '79.99',
    stock: 18,
    imageUrl: 'https://placehold.co/600x600?text=KeyFlow+Mini',
  },
  {
    sku: 'ACC-003',
    name: 'PortMatrix 8-in-1 Multiport USB-C Hub',
    slug: 'portmatrix-usbc-hub',
    description: 'Aluminum USB-C hub with 4K HDMI, Gigabit Ethernet, SD card reader, and 100W PD.',
    category: 'Accessories',
    price: '49.99',
    stock: 45,
    imageUrl: 'https://placehold.co/600x600?text=PortMatrix+Hub',
  },
  {
    sku: 'HOME-001',
    name: 'LuminaCore Smart Ambient LED Bulb',
    slug: 'luminacore-smart-bulb',
    description: 'Full-spectrum WiFi RGBW smart bulb with circadian rhythm scheduling.',
    category: 'Home',
    price: '24.99',
    stock: 60,
    imageUrl: 'https://placehold.co/600x600?text=LuminaCore+Bulb',
  },
  {
    sku: 'HOME-002',
    name: 'AuraNode Voice Companion Speaker',
    slug: 'auranode-voice-speaker',
    description: 'Compact smart speaker with room-filling acoustic sound and assistant integration.',
    category: 'Home',
    price: '49.99',
    stock: 28,
    imageUrl: 'https://placehold.co/600x600?text=AuraNode+Speaker',
  },
  {
    sku: 'HOME-003',
    name: 'PureBreeze Smart Room Air Purifier',
    slug: 'purebreeze-smart-air-purifier',
    description: 'HEPA H13 filtration system capturing 99.97% of airborne particles and allergens.',
    category: 'Home',
    price: '179.99',
    stock: 10,
    imageUrl: 'https://placehold.co/600x600?text=PureBreeze+Purifier',
  },
  {
    sku: 'LIFE-001',
    name: 'PulseTrack V6 Health & Fitness Band',
    slug: 'pulsetrack-v6-band',
    description: 'Water-resistant fitness tracker with heart-rate telemetry, sleep scoring, and GPS.',
    category: 'Lifestyle',
    price: '159.95',
    stock: 22,
    imageUrl: 'https://placehold.co/600x600?text=PulseTrack+V6',
  },
  {
    sku: 'LIFE-002',
    name: 'BassWave SoundPulse Portable Speaker',
    slug: 'basswave-soundpulse-speaker',
    description: 'IP67 rugged waterproof Bluetooth speaker delivering deep dynamic bass outdoors.',
    category: 'Lifestyle',
    price: '99.95',
    stock: 32,
    imageUrl: 'https://placehold.co/600x600?text=BassWave+Speaker',
  },
  {
    sku: 'WORK-001',
    name: 'ClarityMax 4K Studio Webcam',
    slug: 'claritymax-4k-webcam',
    description: 'Ultra HD video conference webcam with dual stereo noise-reducing microphones.',
    category: 'Work',
    price: '129.99',
    stock: 14,
    imageUrl: 'https://placehold.co/600x600?text=ClarityMax+Webcam',
  },
  {
    sku: 'WORK-002',
    name: 'VocalPeak Professional USB Microphone',
    slug: 'vocalpeak-usb-microphone',
    description: 'Studio condenser microphone with quad polar patterns and zero-latency monitoring.',
    category: 'Work',
    price: '109.99',
    stock: 16,
    imageUrl: 'https://placehold.co/600x600?text=VocalPeak+Mic',
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
