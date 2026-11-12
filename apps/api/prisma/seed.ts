import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from 'better-auth/crypto';

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
    minPrice: '290.00',
    stock: 12,
    imageUrl: 'https://placehold.co/600x600?text=NovaView+27+4K',
  },
  {
    sku: 'ELEC-007',
    name: 'NovaView 27-inch Pro Developer Monitor',
    slug: 'novaview-27-pro-developer-monitor',
    description: 'Pro 27-inch developer monitor with ultra-sharp text clarity, USB-C PD, and factory sRGB calibration.',
    category: 'Electronics',
    price: '289.00',
    minPrice: '250.00',
    stock: 20,
    imageUrl: 'https://placehold.co/600x600?text=NovaView+289',
  },
  {
    sku: 'ELEC-006',
    name: 'PixelView 24-inch QHD Developer Monitor',
    slug: 'pixelview-24-qhd',
    description: 'Crisp QHD IPS developer monitor with exceptional text clarity, sRGB color calibration, and anti-glare finish.',
    category: 'Electronics',
    price: '229.99',
    minPrice: '190.00',
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
  {
    sku: 'ELEC-008', name: 'NovaView 24-inch Full HD Monitor', slug: 'novaview-24-fhd-monitor',
    description: 'Compact IPS monitor with an anti-glare screen and adjustable stand for everyday work.',
    category: 'Electronics', price: '139.99', stock: 24, imageUrl: 'https://placehold.co/600x600?text=24-inch+Monitor',
  },
  {
    sku: 'ELEC-009', name: 'PixelView 27-inch QHD Monitor', slug: 'pixelview-27-qhd-monitor',
    description: '27-inch QHD IPS display with crisp text, wide viewing angles, and USB-C connectivity.',
    category: 'Electronics', price: '249.99', stock: 16, imageUrl: 'https://placehold.co/600x600?text=27-inch+QHD',
  },
  {
    sku: 'ELEC-010', name: 'TerraBook 14-inch Work Laptop', slug: 'terrabook-14-work-laptop',
    description: 'Lightweight productivity laptop with 16GB memory, 512GB storage, and all-day battery life.',
    category: 'Electronics', price: '749.99', stock: 9, imageUrl: 'https://placehold.co/600x600?text=Work+Laptop',
  },
  {
    sku: 'ELEC-011', name: 'Northstar 15-inch Business Laptop', slug: 'northstar-15-business-laptop',
    description: 'Business laptop with a 15-inch display, 16GB memory, 1TB storage, and fingerprint login.',
    category: 'Electronics', price: '999.00', stock: 7, imageUrl: 'https://placehold.co/600x600?text=Business+Laptop',
  },
  {
    sku: 'ELEC-012', name: 'ClearTone USB-C Over-Ear Headset', slug: 'cleartone-usbc-headset',
    description: 'Comfortable wired headset with a noise-reducing microphone for calls and meetings.',
    category: 'Electronics', price: '59.99', stock: 30, imageUrl: 'https://placehold.co/600x600?text=USB-C+Headset',
  },
  {
    sku: 'ELEC-013', name: 'BrightBeam 1080p Portable Projector', slug: 'brightbeam-portable-projector',
    description: 'Portable 1080p projector with HDMI and built-in speakers for presentations.',
    category: 'Electronics', price: '219.99', stock: 8, imageUrl: 'https://placehold.co/600x600?text=Portable+Projector',
  },
  {
    sku: 'ELEC-014', name: 'ArcPoint Wi-Fi 6 Router', slug: 'arcpoint-wifi-6-router',
    description: 'Dual-band Wi-Fi 6 router with coverage for home offices and small workspaces.',
    category: 'Electronics', price: '119.99', stock: 18, imageUrl: 'https://placehold.co/600x600?text=Wi-Fi+6+Router',
  },
  {
    sku: 'ACC-004', name: 'KeyFlow TKL Mechanical Keyboard', slug: 'keyflow-tkl-mechanical-keyboard',
    description: 'Tenkeyless mechanical keyboard with hot-swappable quiet tactile switches.',
    category: 'Accessories', price: '119.99', stock: 15, imageUrl: 'https://placehold.co/600x600?text=Mechanical+Keyboard',
  },
  {
    sku: 'ACC-005', name: 'ErgoFlow Vertical Wireless Mouse', slug: 'ergoflow-vertical-mouse',
    description: 'Wireless ergonomic vertical mouse with adjustable DPI and USB-C charging.',
    category: 'Accessories', price: '54.99', stock: 22, imageUrl: 'https://placehold.co/600x600?text=Vertical+Mouse',
  },
  {
    sku: 'ACC-006', name: 'LiftDesk Electric Standing Desk', slug: 'liftdesk-electric-standing-desk',
    description: 'Height-adjustable electric desk with memory presets and a sturdy work surface.',
    category: 'Accessories', price: '399.99', stock: 6, imageUrl: 'https://placehold.co/600x600?text=Standing+Desk',
  },
  {
    sku: 'ACC-007', name: 'AlignPro Adjustable Monitor Arm', slug: 'alignpro-monitor-arm',
    description: 'Gas-spring monitor arm with smooth height, tilt, and rotation adjustment.',
    category: 'Accessories', price: '89.99', stock: 19, imageUrl: 'https://placehold.co/600x600?text=Monitor+Arm',
  },
  {
    sku: 'ACC-008', name: 'PortMatrix Thunderbolt 4 Dock', slug: 'portmatrix-thunderbolt-4-dock',
    description: 'Desk dock with dual display outputs, fast charging, Ethernet, and multiple USB ports.',
    category: 'Accessories', price: '189.99', stock: 11, imageUrl: 'https://placehold.co/600x600?text=Thunderbolt+Dock',
  },
  {
    sku: 'ACC-009', name: 'Evergreen Recycled Desk Mat', slug: 'evergreen-recycled-desk-mat',
    description: 'Large non-slip desk mat made with recycled materials and a water-resistant surface.',
    category: 'Accessories', price: '29.99', stock: 40, imageUrl: 'https://placehold.co/600x600?text=Desk+Mat',
  },
  {
    sku: 'WORK-003', name: 'ClearFrame 2K Conference Webcam', slug: 'clearframe-2k-conference-webcam',
    description: '2K webcam with autofocus, a privacy shutter, and dual noise-reducing microphones.',
    category: 'Work', price: '89.99', stock: 20, imageUrl: 'https://placehold.co/600x600?text=2K+Webcam',
  },
  {
    sku: 'WORK-004', name: 'SoundDesk USB Podcast Microphone', slug: 'sounddesk-usb-podcast-microphone',
    description: 'USB condenser microphone with a desktop stand, mute control, and headphone monitoring.',
    category: 'Work', price: '69.99', stock: 17, imageUrl: 'https://placehold.co/600x600?text=USB+Microphone',
  },
  {
    sku: 'WORK-005', name: 'PaperTrail A4 Laser Printer', slug: 'papertrail-a4-laser-printer',
    description: 'Compact monochrome laser printer with duplex printing and wireless connectivity.',
    category: 'Work', price: '179.99', stock: 7, imageUrl: 'https://placehold.co/600x600?text=Laser+Printer',
  },
  {
    sku: 'WORK-006', name: 'FieldNote A4 Paper Ream', slug: 'fieldnote-a4-paper-ream',
    description: '500-sheet pack of sustainably sourced, bright white A4 office paper.',
    category: 'Work', price: '8.99', stock: 100, imageUrl: 'https://placehold.co/600x600?text=A4+Paper',
  },
  {
    sku: 'WORK-007', name: 'FieldNote Refillable Pen Set', slug: 'fieldnote-refillable-pen-set',
    description: 'Set of four smooth-writing refillable pens with black ink and a storage case.',
    category: 'Work', price: '14.99', stock: 60, imageUrl: 'https://placehold.co/600x600?text=Pen+Set',
  },
  {
    sku: 'HOME-004', name: 'QuietCurrent Compact Desk Fan', slug: 'quietcurrent-compact-desk-fan',
    description: 'Quiet USB-powered desk fan with three speeds and adjustable tilt.',
    category: 'Home', price: '34.99', stock: 25, imageUrl: 'https://placehold.co/600x600?text=Desk+Fan',
  },
  {
    sku: 'HOME-005', name: 'WarmGlow Adjustable Desk Lamp', slug: 'warmglow-adjustable-desk-lamp',
    description: 'Dimmable LED desk lamp with adjustable color temperature and USB charging.',
    category: 'Home', price: '44.99', stock: 21, imageUrl: 'https://placehold.co/600x600?text=Desk+Lamp',
  },
  {
    sku: 'HOME-006', name: 'FreshAir HEPA Desktop Purifier', slug: 'freshair-hepa-desktop-purifier',
    description: 'Small-room HEPA air purifier with quiet sleep mode and replaceable filter.',
    category: 'Home', price: '89.99', stock: 13, imageUrl: 'https://placehold.co/600x600?text=HEPA+Purifier',
  },
  {
    sku: 'LIFE-003', name: 'RoamReady 20L Commuter Backpack', slug: 'roamready-20l-backpack',
    description: 'Weather-resistant commuter backpack with a padded laptop sleeve and organizer pockets.',
    category: 'Lifestyle', price: '79.99', stock: 18, imageUrl: 'https://placehold.co/600x600?text=Commuter+Backpack',
  },
  {
    sku: 'LIFE-004', name: 'HydraLoop Insulated Steel Bottle', slug: 'hydraloop-steel-bottle',
    description: 'Reusable insulated stainless-steel bottle with a leak-resistant lid.',
    category: 'Lifestyle', price: '24.99', stock: 35, imageUrl: 'https://placehold.co/600x600?text=Steel+Bottle',
  },
  {
    sku: 'LIFE-005', name: 'FocusBand 2 Wireless Headphones', slug: 'focusband-2-headphones',
    description: 'Lightweight wireless headphones with active noise reduction and 30-hour battery life.',
    category: 'Lifestyle', price: '149.99', stock: 14, imageUrl: 'https://placehold.co/600x600?text=Wireless+Headphones',
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

  // Seed Demo User and Credentials
  const demoEmail = 'demo@paypilot.dev';
  const demoPassword = process.env.DEMO_USER_PASSWORD || 'Password123!';
  const hashedPassword = await hashPassword(demoPassword);

  let demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        id: 'usr_demo_paypilot_hackathon',
        email: demoEmail,
        name: 'PayPilot Demo Judge',
        emailVerified: true,
      },
    });
  }

  // Upsert credential account for demo login
  const existingAccount = await prisma.account.findFirst({
    where: { userId: demoUser.id, providerId: 'credential' },
  });

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        id: 'acc_demo_paypilot_hackathon',
        accountId: demoUser.id,
        providerId: 'credential',
        userId: demoUser.id,
        password: hashedPassword,
      },
    });
  } else {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    });
  }

  // Seed UserPolicy for Demo User:
  // maxTransaction 500, daily 600, monthly 1500, requireApprovalAbove 100, allowNegotiation true
  await prisma.userPolicy.upsert({
    where: { userId: demoUser.id },
    create: {
      userId: demoUser.id,
      currency: 'USD',
      maxTransactionAmount: 500,
      dailySpendingLimit: 600,
      monthlySpendingLimit: 1500,
      requireApprovalAbove: 100,
      allowNegotiation: true,
      allowAutoExecute: false,
      autonomyMode: 'ASK_EVERY_TIME',
    },
    update: {
      currency: 'USD',
      maxTransactionAmount: 500,
      dailySpendingLimit: 600,
      monthlySpendingLimit: 1500,
      requireApprovalAbove: 100,
      allowNegotiation: true,
      allowAutoExecute: false,
      autonomyMode: 'ASK_EVERY_TIME',
    },
  });

  console.log(`Successfully seeded ${products.length} PayPilot products.`);
  console.log(`Successfully seeded demo user (${demoEmail}) and deterministic UserPolicy.`);
}

main()
  .catch((error: unknown) => {
    console.error('Product seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
