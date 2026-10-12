import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema';
import {
  users,
  roles,
  organizations,
  memberships,
  addresses,
  categories,
  products,
  productVariants,
  productImages,
  inventoryItems,
  stockMovements,
  fieldSellers,
  fieldSales,
  fieldSaleItems,
  auditLogs,
} from './schema';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function seed(): Promise<void> {
  console.log('🌱 Starting database seed...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Roles & Permissions
  console.log('Seeding roles...');
  const roleData = [
    {
      name: 'SUPER_ADMIN',
      permissions: [
        'org.view',
        'org.approve',
        'org.suspend',
        'category.view',
        'category.edit',
        'order.view.all',
        'shipment.update',
        'shipment.view',
        'product.view',
        'product.edit',
        'order.view',
        'order.accept',
      ],
    },
    {
      name: 'ADMIN',
      permissions: [
        'org.view',
        'org.approve',
        'org.suspend',
        'category.view',
        'category.edit',
        'order.view.all',
        'shipment.update',
        'shipment.view',
      ],
    },
    {
      name: 'OWNER',
      permissions: [
        'product.view',
        'product.create',
        'product.edit',
        'stock.adjust',
        'order.view',
        'order.accept',
        'order.reject',
        'order.mark_ready',
        'order.mark_refunded',
        'fieldseller.manage',
        'fieldsale.view_all',
        'fieldsale.void',
        'fieldanalytics.view',
        'report.view',
        'team.manage_staff',
        'team.manage_managers',
        'audit.view',
        'checkout.place',
        'gateway.manage',
        'billing.manage',
        'org.edit',
      ],
    },
    {
      name: 'MANAGER',
      permissions: [
        'product.view',
        'product.create',
        'product.edit',
        'stock.adjust',
        'order.view',
        'order.accept',
        'order.reject',
        'order.mark_ready',
        'fieldseller.manage',
        'fieldsale.view_all',
        'fieldanalytics.view',
        'report.view',
        'team.manage_staff',
      ],
    },
    {
      name: 'STAFF',
      permissions: [
        'product.view',
        'product.edit',
        'stock.adjust',
        'order.view',
      ],
    },
    {
      name: 'FIELD_SELLER',
      permissions: [
        'fieldsale.create',
        'fieldsale.view_own',
        'fieldcatalog.view',
      ],
    },
  ];

  const roleMap = new Map<string, string>();
  for (const r of roleData) {
    const existing = await db
      .select()
      .from(roles)
      .where(eq(roles.name, r.name))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(roles)
        .set({ permissions: r.permissions })
        .where(eq(roles.name, r.name));
      roleMap.set(r.name, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(roles)
        .values({ name: r.name, permissions: r.permissions })
        .returning();
      roleMap.set(r.name, inserted.id);
    }
  }

  // 2. Categories
  console.log('Seeding categories...');
  const categoryNames = [
    'Grains & Pulses',
    'Beverages & Snacks',
    'Edible Oils & Spices',
    'Construction & Hardware',
    'Electrical & Lighting',
    'Packaged Foods',
  ];

  const categoryMap = new Map<string, string>();
  for (const catName of categoryNames) {
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.name, catName))
      .limit(1);

    if (existing.length > 0) {
      categoryMap.set(catName, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(categories)
        .values({ name: catName })
        .returning();
      categoryMap.set(catName, inserted.id);
    }
  }

  // Helper to create user, org and membership
  async function createOrUpdateUserOrg(data: {
    userName: string;
    email: string;
    phone: string;
    orgName: string;
    orgType: 'PLATFORM' | 'BUSINESS';
    canBuy: boolean;
    canSell: boolean;
    status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
    panNumber?: string;
    roleName: string;
    documentFileName?: string;
    documentData?: string;
    documentMimeType?: string;
    address?: {
      label: string;
      line1: string;
      city: string;
      district: string;
      province: string;
      phone: string;
    };
  }): Promise<{ userId: string; orgId: string }> {
    let userId: string;
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await db
        .update(users)
        .set({ passwordHash, name: data.userName, phone: data.phone })
        .where(eq(users.id, userId));
    } else {
      const [u] = await db
        .insert(users)
        .values({
          name: data.userName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          status: 'ACTIVE',
        })
        .returning();
      userId = u.id;
    }

    let orgId: string;
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, data.orgName))
      .limit(1);

    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      await db
        .update(organizations)
        .set({
          type: data.orgType,
          canBuy: data.canBuy,
          canSell: data.canSell,
          status: data.status,
          panNumber: data.panNumber,
          documentFileName: data.documentFileName ?? null,
          documentData: data.documentData ?? null,
          documentMimeType: data.documentMimeType ?? null,
        })
        .where(eq(organizations.id, orgId));
    } else {
      const [o] = await db
        .insert(organizations)
        .values({
          name: data.orgName,
          type: data.orgType,
          canBuy: data.canBuy,
          canSell: data.canSell,
          status: data.status,
          panNumber: data.panNumber,
          documentFileName: data.documentFileName ?? null,
          documentData: data.documentData ?? null,
          documentMimeType: data.documentMimeType ?? null,
        })
        .returning();
      orgId = o.id;
    }

    // Membership
    const roleId = roleMap.get(data.roleName)!;
    const existingMem = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.orgId, orgId),
        ),
      )
      .limit(1);

    if (existingMem.length === 0) {
      await db.insert(memberships).values({
        userId,
        orgId,
        roleId,
      });
    }

    // Address
    if (data.address) {
      const existingAddr = await db
        .select()
        .from(addresses)
        .where(eq(addresses.orgId, orgId))
        .limit(1);

      if (existingAddr.length === 0) {
        await db.insert(addresses).values({
          orgId,
          label: data.address.label,
          line1: data.address.line1,
          city: data.address.city,
          district: data.address.district,
          province: data.address.province,
          phone: data.address.phone,
          isDefault: true,
        });
      }
    }

    return { userId, orgId };
  }

  // 3. Platform Admin & Super Admin
  console.log('Seeding platform users...');
  await createOrUpdateUserOrg({
    userName: 'Super Admin',
    email: 'superadmin@demo.test',
    phone: '9800000001',
    orgName: 'Bitaran Platform',
    orgType: 'PLATFORM',
    canBuy: false,
    canSell: false,
    status: 'APPROVED',
    roleName: 'SUPER_ADMIN',
  });

  const platformOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, 'Bitaran Platform'))
    .limit(1)
    .then((r) => r[0]);

  let adminUser = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@demo.test'))
    .limit(1)
    .then((r) => r[0]);

  if (!adminUser) {
    const [inserted] = await db
      .insert(users)
      .values({
        name: 'Platform Admin',
        email: 'admin@demo.test',
        phone: '9800000002',
        passwordHash,
        status: 'ACTIVE',
      })
      .returning();
    adminUser = inserted;
  }

  const existingAdminMem = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, adminUser.id),
        eq(memberships.orgId, platformOrg.id),
      ),
    )
    .limit(1);

  if (existingAdminMem.length === 0) {
    await db.insert(memberships).values({
      userId: adminUser.id,
      orgId: platformOrg.id,
      roleId: roleMap.get('ADMIN')!,
    });
  }

  // Helper to add products with variants and stock
  async function seedProducts(
    sellerOrgId: string,
    productList: Array<{
      name: string;
      categoryName: string;
      description: string;
      imageUrl: string;
      variants: Array<{
        sku: string;
        unit: string;
        packSize: number;
        pricePaisa: number;
        minOrderQty: number;
        stockOnHand: number;
      }>;
    }>,
  ): Promise<void> {
    for (const p of productList) {
      const categoryId = categoryMap.get(p.categoryName)!;
      let productId: string;
      const existingProduct = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.sellerOrgId, sellerOrgId),
            eq(products.name, p.name),
          ),
        )
        .limit(1);

      if (existingProduct.length > 0) {
        productId = existingProduct[0].id;
      } else {
        const [prod] = await db
          .insert(products)
          .values({
            sellerOrgId,
            categoryId,
            name: p.name,
            description: p.description,
            status: 'ACTIVE',
          })
          .returning();
        productId = prod.id;

        await db.insert(productImages).values({
          productId,
          url: p.imageUrl,
          position: 0,
        });
      }

      for (const v of p.variants) {
        const existingVariant = await db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.productId, productId),
              eq(productVariants.sku, v.sku),
            ),
          )
          .limit(1);

        let variantId: string;
        if (existingVariant.length > 0) {
          variantId = existingVariant[0].id;
        } else {
          const [variant] = await db
            .insert(productVariants)
            .values({
              productId,
              sku: v.sku,
              unit: v.unit,
              packSize: v.packSize,
              pricePaisa: v.pricePaisa,
              minOrderQty: v.minOrderQty,
              isActive: true,
            })
            .returning();
          variantId = variant.id;

          await db.insert(inventoryItems).values({
            variantId,
            qtyOnHand: v.stockOnHand,
            qtyReserved: 0,
          });

          await db.insert(stockMovements).values({
            variantId,
            delta: v.stockOnHand,
            reason: 'RECEIPT',
          });
        }
      }
    }
  }

  // 4. Approved Seller 1: Himalayan Wholesale Distributors
  console.log('Seeding Seller 1...');
  const seller1 = await createOrUpdateUserOrg({
    userName: 'Ramesh Adhikari',
    email: 'seller1@demo.test',
    phone: '9841111111',
    orgName: 'Himalayan Wholesale Distributors',
    orgType: 'BUSINESS',
    canBuy: false,
    canSell: true,
    status: 'APPROVED',
    panNumber: '100000001',
    roleName: 'OWNER',
    address: {
      label: 'Main Warehouse',
      line1: 'New Road, Ward 22',
      city: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati',
      phone: '9841111111',
    },
  });

  await seedProducts(seller1.orgId, [
    {
      name: 'Basmati Rice Premium 25kg',
      categoryName: 'Grains & Pulses',
      description: 'Long-grain aromatic aged Basmati rice packed in moisture-resistant 25kg sacks.',
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'HWD-RICE-25KG', unit: 'bag', packSize: 1, pricePaisa: 280000, minOrderQty: 5, stockOnHand: 100 },
        { sku: 'HWD-RICE-50KG', unit: 'bag', packSize: 1, pricePaisa: 540000, minOrderQty: 3, stockOnHand: 50 },
      ],
    },
    {
      name: 'Mustard Oil Pure 10L Carton',
      categoryName: 'Edible Oils & Spices',
      description: 'Cold-pressed traditional mustard oil in 1-litre bottles packed 10 to a carton.',
      imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'HWD-OIL-10L', unit: 'carton', packSize: 10, pricePaisa: 320000, minOrderQty: 2, stockOnHand: 80 },
      ],
    },
    {
      name: 'Chana Dal Desi 30kg Sack',
      categoryName: 'Grains & Pulses',
      description: 'Double-polished yellow chana dal sourced directly from Terai farmers.',
      imageUrl: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'HWD-DAL-30KG', unit: 'sack', packSize: 1, pricePaisa: 360000, minOrderQty: 3, stockOnHand: 60 },
      ],
    },
    {
      name: 'Refined Sugar 50kg Sack',
      categoryName: 'Packaged Foods',
      description: 'Sparkling crystal refined white sugar, Grade 1 for commercial baking and wholesale.',
      imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'HWD-SUGAR-50KG', unit: 'sack', packSize: 1, pricePaisa: 450000, minOrderQty: 4, stockOnHand: 50 },
      ],
    },
    {
      name: 'Red Lentils (Musuro) 25kg',
      categoryName: 'Grains & Pulses',
      description: 'Cleaned and graded split red lentils with rich natural colour and flavour.',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'HWD-MUS-25KG', unit: 'bag', packSize: 1, pricePaisa: 310000, minOrderQty: 2, stockOnHand: 70 },
      ],
    },
    {
      name: 'Iodized Table Salt Carton (25 x 1kg)',
      categoryName: 'Edible Oils & Spices',
      description: 'Fine vacuum-evaporated table salt fortified with iodine.',
      imageUrl: 'https://images.unsplash.com/photo-1518110903415-38dbbe1e7f3c?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'HWD-SALT-25KG', unit: 'carton', packSize: 25, pricePaisa: 75000, minOrderQty: 5, stockOnHand: 150 },
      ],
    },
  ]);

  // 5. Approved Seller 2: Everest Beverages & Snacks
  console.log('Seeding Seller 2...');
  const seller2 = await createOrUpdateUserOrg({
    userName: 'Bikash Shrestha',
    email: 'seller2@demo.test',
    phone: '9851222222',
    orgName: 'Everest Beverages & Snacks',
    orgType: 'BUSINESS',
    canBuy: false,
    canSell: true,
    status: 'APPROVED',
    panNumber: '100000002',
    roleName: 'OWNER',
    address: {
      label: 'Depot Birgunj',
      line1: 'Birgunj Industrial Area',
      city: 'Birgunj',
      district: 'Parsa',
      province: 'Madhesh',
      phone: '9851222222',
    },
  });

  await seedProducts(seller2.orgId, [
    {
      name: 'Wai Wai Instant Noodles Box (30 Packs)',
      categoryName: 'Packaged Foods',
      description: 'Famous pre-cooked instant noodles chicken flavour, box of 30 individual 75g packets.',
      imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'EBS-WAI-30', unit: 'carton', packSize: 30, pricePaisa: 72000, minOrderQty: 5, stockOnHand: 200 },
      ],
    },
    {
      name: 'Real Mixed Fruit Juice Case (12 x 1L)',
      categoryName: 'Beverages & Snacks',
      description: 'Refreshing fruit nectar beverage packaged in aseptic 1-litre tetra paks.',
      imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'EBS-REAL-12', unit: 'case', packSize: 12, pricePaisa: 240000, minOrderQty: 3, stockOnHand: 120 },
      ],
    },
    {
      name: 'Classic Instant Coffee Case (6 x 200g)',
      categoryName: 'Beverages & Snacks',
      description: '100% pure soluble coffee crystals in airtight glass jars.',
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'EBS-COF-6', unit: 'box', packSize: 6, pricePaisa: 300000, minOrderQty: 2, stockOnHand: 90 },
      ],
    },
    {
      name: 'Ilam CTC Golden Tea 5kg Bag',
      categoryName: 'Beverages & Snacks',
      description: 'High-grown tea pearls from eastern hills of Nepal, strong liquor and brisk flavour.',
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'EBS-TEA-5KG', unit: 'bag', packSize: 1, pricePaisa: 220000, minOrderQty: 4, stockOnHand: 110 },
      ],
    },
    {
      name: 'Wheat Digestive Biscuits Box (24 Packs)',
      categoryName: 'Packaged Foods',
      description: 'High-fibre crispy whole wheat biscuits suitable for daily tea-time retailing.',
      imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'EBS-BISC-24', unit: 'carton', packSize: 24, pricePaisa: 144000, minOrderQty: 4, stockOnHand: 140 },
      ],
    },
    {
      name: 'Himalayan Spring Mineral Water (24 x 1L)',
      categoryName: 'Beverages & Snacks',
      description: 'Pure artesian bottled drinking water in shrink-wrapped 24-bottle flats.',
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'EBS-WAT-24', unit: 'pack', packSize: 24, pricePaisa: 96000, minOrderQty: 5, stockOnHand: 80 },
      ],
    },
  ]);

  // 6. Approved Seller 3: Valley Hardware Supplies
  console.log('Seeding Seller 3...');
  const seller3 = await createOrUpdateUserOrg({
    userName: 'Kiran Shakya',
    email: 'seller3@demo.test',
    phone: '9841333333',
    orgName: 'Valley Hardware Supplies',
    orgType: 'BUSINESS',
    canBuy: false,
    canSell: true,
    status: 'APPROVED',
    panNumber: '100000003',
    roleName: 'OWNER',
    address: {
      label: 'Main Yard',
      line1: 'Patan Industrial Estate',
      city: 'Lalitpur',
      district: 'Lalitpur',
      province: 'Bagmati',
      phone: '9841333333',
    },
  });

  await seedProducts(seller3.orgId, [
    {
      name: 'Shivshikhar OPC Cement 50kg Sack',
      categoryName: 'Construction & Hardware',
      description: 'Grade 53 high-strength Ordinary Portland Cement for structural concrete casting.',
      imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'VHS-CEM-50', unit: 'sack', packSize: 1, pricePaisa: 75000, minOrderQty: 20, stockOnHand: 500 },
      ],
    },
    {
      name: 'Fe500D TMT Rebar 12mm Bundle',
      categoryName: 'Construction & Hardware',
      description: 'Thermo-mechanically treated earthquake-resistant steel reinforcement rebar.',
      imageUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'VHS-TMT-12', unit: 'bundle', packSize: 1, pricePaisa: 820000, minOrderQty: 2, stockOnHand: 50 },
      ],
    },
    {
      name: 'LED Batten Tube Light 18W (Pack of 20)',
      categoryName: 'Electrical & Lighting',
      description: 'Energy-saving 6500K cool daylight commercial tube lights with aluminium heat sink.',
      imageUrl: 'https://images.unsplash.com/photo-1550985543-f47f38aeee65?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'VHS-LED-20', unit: 'carton', packSize: 20, pricePaisa: 400000, minOrderQty: 2, stockOnHand: 100 },
      ],
    },
    {
      name: 'Heavy Duty PVC Pipe 4-inch 10ft (Bundle of 5)',
      categoryName: 'Construction & Hardware',
      description: 'Rigid PVC drainage and plumbing conduits, pressure rated 6 kgf/cm².',
      imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'VHS-PVC-4IN', unit: 'bundle', packSize: 5, pricePaisa: 250000, minOrderQty: 4, stockOnHand: 80 },
      ],
    },
    {
      name: 'Weathercoat Exterior Paint White 20L',
      categoryName: 'Construction & Hardware',
      description: 'Anti-fungal all-weather acrylic emulsion formulated for intense UV protection.',
      imageUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'VHS-PNT-20L', unit: 'bucket', packSize: 1, pricePaisa: 650000, minOrderQty: 1, stockOnHand: 45 },
      ],
    },
  ]);

  // 7. Approved Dealers (Buyer-only)
  console.log('Seeding Buyer Dealers...');
  await createOrUpdateUserOrg({
    userName: 'Suman Thapa',
    email: 'dealer1@demo.test',
    phone: '9841000001',
    orgName: 'Kathmandu Valley Retail Mart',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: false,
    status: 'APPROVED',
    panNumber: '200000001',
    roleName: 'OWNER',
    address: {
      label: 'Retail Store Baneshwor',
      line1: 'Baneshwor Chowk, Ward 10',
      city: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati',
      phone: '9841000001',
    },
  });

  await createOrUpdateUserOrg({
    userName: 'Pooja Gurung',
    email: 'dealer2@demo.test',
    phone: '9841000002',
    orgName: 'Pokhara Lakeside Stores',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: false,
    status: 'APPROVED',
    panNumber: '200000002',
    roleName: 'OWNER',
    address: {
      label: 'Main Mart',
      line1: 'Lakeside Road, Ward 6',
      city: 'Pokhara',
      district: 'Kaski',
      province: 'Gandaki',
      phone: '9841000002',
    },
  });

  // Buyer aliases (convenience for demo testing)
  await createOrUpdateUserOrg({
    userName: 'Suman Thapa (Buyer 1)',
    email: 'buyer1@demo.test',
    phone: '9841000011',
    orgName: 'Kathmandu Valley Retail Mart',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: false,
    status: 'APPROVED',
    panNumber: '200000001',
    roleName: 'OWNER',
  });

  await createOrUpdateUserOrg({
    userName: 'Pooja Gurung (Buyer 2)',
    email: 'buyer2@demo.test',
    phone: '9841000012',
    orgName: 'Pokhara Lakeside Stores',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: false,
    status: 'APPROVED',
    panNumber: '200000002',
    roleName: 'OWNER',
  });

  await createOrUpdateUserOrg({
    userName: 'Demo Buyer',
    email: 'buyer@demo.test',
    phone: '9841000010',
    orgName: 'Kathmandu Valley Retail Mart',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: false,
    status: 'APPROVED',
    panNumber: '200000001',
    roleName: 'OWNER',
  });

  // 8. Seller that is also a Buyer (canBuy = true, canSell = true)
  console.log('Seeding Both Buyer & Seller (Apex Multi-Trade)...');
  const bothOrg = await createOrUpdateUserOrg({
    userName: 'Rajendra Poudel',
    email: 'both@demo.test',
    phone: '9841000003',
    orgName: 'Apex Multi-Trade Enterprise',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: true,
    status: 'APPROVED',
    panNumber: '300000001',
    roleName: 'OWNER',
    address: {
      label: 'Central Outlet',
      line1: 'Hospital Road',
      city: 'Butwal',
      district: 'Rupandehi',
      province: 'Lumbini',
      phone: '9841000003',
    },
  });

  await seedProducts(bothOrg.orgId, [
    {
      name: 'Organic Himalayan Honey Jar 1kg (Box of 12)',
      categoryName: 'Packaged Foods',
      description: 'Raw unprocessed forest honey collected by traditional mountain beekeepers.',
      imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'AMTE-HNY-12', unit: 'box', packSize: 12, pricePaisa: 720000, minOrderQty: 1, stockOnHand: 40 },
      ],
    },
    {
      name: 'Cardamom (Alainchi) Premium Grade 5kg',
      categoryName: 'Edible Oils & Spices',
      description: 'Jumbo dark large cardamom smoked over natural wood fire in Ilam.',
      imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=60',
      variants: [
        { sku: 'AMTE-ALA-5KG', unit: 'bag', packSize: 1, pricePaisa: 950000, minOrderQty: 1, stockOnHand: 25 },
      ],
    },
  ]);

  // 9. Pending Business for demo
  console.log('Seeding Pending Business...');
  const samplePanCert =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <rect width="600" height="380" fill="#f8fafc" stroke="#94a3b8" stroke-width="3" rx="8"/>
  <rect x="15" y="15" width="570" height="350" fill="none" stroke="#1e40af" stroke-width="2" rx="4" stroke-dasharray="6,4"/>
  <text x="300" y="55" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1e3a8a" text-anchor="middle">GOVERNMENT OF NEPAL</text>
  <text x="300" y="78" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#475569" text-anchor="middle">INLAND REVENUE DEPARTMENT</text>
  <text x="300" y="110" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#047857" text-anchor="middle">PERMANENT ACCOUNT NUMBER (PAN) CERTIFICATE</text>
  <line x1="60" y1="125" x2="540" y2="125" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="60" y="165" font-family="Arial, sans-serif" font-size="14" fill="#334155">Business Name:</text>
  <text x="210" y="165" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a">Sunrise General Suppliers</text>
  <text x="60" y="200" font-family="Arial, sans-serif" font-size="14" fill="#334155">Proprietor / Rep:</text>
  <text x="210" y="200" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">Dipendra Karki</text>
  <text x="60" y="235" font-family="Arial, sans-serif" font-size="14" fill="#334155">PAN Number:</text>
  <text x="210" y="235" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#b91c1c" letter-spacing="2">400000001</text>
  <text x="60" y="270" font-family="Arial, sans-serif" font-size="14" fill="#334155">Registration Date:</text>
  <text x="210" y="270" font-family="Arial, sans-serif" font-size="14" fill="#334155">2080-04-12 B.S.</text>
  <circle cx="480" cy="250" r="40" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="4,2"/>
  <text x="480" y="247" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#dc2626" text-anchor="middle">TAX OFFICE</text>
  <text x="480" y="262" font-family="Arial, sans-serif" font-size="9" fill="#dc2626" text-anchor="middle">VERIFIED</text>
</svg>
`);

  await createOrUpdateUserOrg({
    userName: 'Dipendra Karki',
    email: 'pending@demo.test',
    phone: '9841000004',
    orgName: 'Sunrise General Suppliers',
    orgType: 'BUSINESS',
    canBuy: true,
    canSell: true,
    status: 'PENDING',
    panNumber: '400000001',
    roleName: 'OWNER',
    documentFileName: 'pan_certificate_400000001.svg',
    documentData: samplePanCert,
    documentMimeType: 'image/svg+xml',
  });

  // 12. Field Sellers for Seller 1 (Himalayan Wholesale Distributors)
  console.log('Seeding Field Sellers for Seller 1...');
  const fieldSellerConfigs = [
    { username: 'field1', displayName: 'Field Seller One', phone: '9841999111' },
    { username: 'field2', displayName: 'Field Seller Two', phone: '9841999222' },
  ];

  const seller1Variants = await db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      sku: productVariants.sku,
      unitPricePaisa: productVariants.pricePaisa,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(products.sellerOrgId, seller1.orgId));

  const paymentMethods: Array<'CASH' | 'ESEWA' | 'KHALTI' | 'OTHER'> = [
    'CASH',
    'ESEWA',
    'KHALTI',
    'CASH',
    'ESEWA',
    'OTHER',
    'CASH',
    'KHALTI',
    'ESEWA',
    'CASH',
  ];

  const customers = [
    { name: 'Hari Shrestha', phone: '9851011111' },
    { name: 'Gita Sharma', phone: '9851022222' },
    { name: 'Rajan Thapa', phone: '9851033333' },
    { name: 'Sita KC', phone: '9851044444' },
    { name: 'Bikash Tamang', phone: '9851055555' },
    { name: 'Deepak Rai', phone: '9851066666' },
    { name: 'Maya Gurung', phone: '9851077777' },
    { name: 'Pooja Koirala', phone: '9851088888' },
    { name: 'Nabin Basnet', phone: '9851099999' },
    { name: 'Kamal Adhikari', phone: '9851000000' },
  ];

  const dayOffsets = [13, 11, 9, 8, 7, 5, 4, 3, 1, 0];

  for (let sIdx = 0; sIdx < fieldSellerConfigs.length; sIdx++) {
    const fsc = fieldSellerConfigs[sIdx];
    let userRow = await db
      .select()
      .from(users)
      .where(eq(users.username, fsc.username))
      .limit(1)
      .then((r) => r[0]);

    if (!userRow) {
      const [insertedUser] = await db
        .insert(users)
        .values({
          name: fsc.displayName,
          username: fsc.username,
          phone: fsc.phone,
          passwordHash,
          mustChangePassword: false,
          status: 'ACTIVE',
        })
        .returning();
      userRow = insertedUser;
    }

    const existingMem = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userRow.id),
          eq(memberships.orgId, seller1.orgId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!existingMem) {
      await db.insert(memberships).values({
        userId: userRow.id,
        orgId: seller1.orgId,
        roleId: roleMap.get('FIELD_SELLER')!,
      });
    }

    let sellerProfile = await db
      .select()
      .from(fieldSellers)
      .where(eq(fieldSellers.userId, userRow.id))
      .limit(1)
      .then((r) => r[0]);

    if (!sellerProfile) {
      const [insertedProfile] = await db
        .insert(fieldSellers)
        .values({
          userId: userRow.id,
          orgId: seller1.orgId,
          displayName: fsc.displayName,
          phone: fsc.phone,
          status: 'ACTIVE',
          createdByUserId: seller1.userId,
        })
        .returning();
      sellerProfile = insertedProfile;
    }

    // Seed sales if none exist
    const existingSales = await db
      .select({ id: fieldSales.id })
      .from(fieldSales)
      .where(eq(fieldSales.fieldSellerId, sellerProfile.id))
      .limit(1);

    if (existingSales.length === 0 && seller1Variants.length > 0) {
      console.log(`Seeding 10 sales for ${fsc.username}...`);
      for (let i = 0; i < 10; i++) {
        const isVoided = i === 3; // 4th sale is voided
        const dayOffset = dayOffsets[i];
        const soldAt = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
        const paymentMethod = paymentMethods[i % paymentMethods.length];
        const cust = customers[(i + sIdx * 5) % customers.length];

        // Choose 1 or 2 items
        const itemVariants = [
          seller1Variants[(i + sIdx) % seller1Variants.length],
        ];
        if (i % 2 === 1 && seller1Variants.length > 1) {
          itemVariants.push(
            seller1Variants[(i + sIdx + 1) % seller1Variants.length],
          );
        }

        let totalPaisaBigInt = 0n;
        const lineItems = itemVariants.map((iv, itemIdx) => {
          const qty = 1 + ((i + itemIdx) % 3);
          const lineTotal = BigInt(iv.unitPricePaisa) * BigInt(qty);
          totalPaisaBigInt += lineTotal;
          return {
            variantId: iv.variantId,
            nameSnapshot: iv.productName,
            skuSnapshot: iv.sku,
            unitPricePaisa: iv.unitPricePaisa,
            qty,
          };
        });

        const [createdSale] = await db
          .insert(fieldSales)
          .values({
            orgId: seller1.orgId,
            fieldSellerId: sellerProfile.id,
            customerName: cust.name,
            customerPhone: cust.phone,
            paymentMethod,
            totalPaisa: totalPaisaBigInt,
            status: isVoided ? 'VOIDED' : 'ACTIVE',
            voidReason: isVoided ? 'Customer canceled order upon delivery' : null,
            voidedByUserId: isVoided ? seller1.userId : null,
            voidedAt: isVoided ? soldAt : null,
            note: `Field sale #${i + 1}`,
            soldAt,
          })
          .returning();

        for (const li of lineItems) {
          await db.insert(fieldSaleItems).values({
            saleId: createdSale.id,
            variantId: li.variantId,
            nameSnapshot: li.nameSnapshot,
            skuSnapshot: li.skuSnapshot,
            unitPricePaisa: li.unitPricePaisa,
            qty: li.qty,
          });
        }
      }
    }
  }

  // 5. Seed Manager and Staff for seller1
  console.log('Seeding manager and staff for seller1...');
  const managerRoleId = roleMap.get('MANAGER')!;
  const staffRoleId = roleMap.get('STAFF')!;

  // Manager 1
  let [manager1User] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'manager1@demo.test'))
    .limit(1);

  if (!manager1User) {
    [manager1User] = await db
      .insert(users)
      .values({
        name: 'Manager One',
        email: 'manager1@demo.test',
        passwordHash,
        mustChangePassword: false,
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(memberships).values({
      userId: manager1User.id,
      orgId: seller1.orgId,
      roleId: managerRoleId,
      status: 'ACTIVE',
      createdByUserId: seller1.userId,
    });
  }

  // Staff 1
  let [staff1User] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'staff1@demo.test'))
    .limit(1);

  if (!staff1User) {
    [staff1User] = await db
      .insert(users)
      .values({
        name: 'Staff One',
        email: 'staff1@demo.test',
        passwordHash,
        mustChangePassword: false,
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(memberships).values({
      userId: staff1User.id,
      orgId: seller1.orgId,
      roleId: staffRoleId,
      status: 'ACTIVE',
      createdByUserId: manager1User.id,
    });
  }

  // Seed sample audit rows for Activity screen
  console.log('Seeding sample audit logs...');
  const existingAudit = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, seller1.orgId))
    .limit(1);

  if (existingAudit.length === 0 && seller1Variants.length > 0) {
    const sampleVariant = seller1Variants[0];
    await db.insert(auditLogs).values([
      {
        actorId: seller1.userId,
        orgId: seller1.orgId,
        action: 'team.member_created',
        entity: 'membership',
        meta: {
          name: 'Manager One',
          email: 'manager1@demo.test',
          role: 'MANAGER',
        },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        actorId: manager1User.id,
        orgId: seller1.orgId,
        action: 'team.member_created',
        entity: 'membership',
        meta: {
          name: 'Staff One',
          email: 'staff1@demo.test',
          role: 'STAFF',
        },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        actorId: manager1User.id,
        orgId: seller1.orgId,
        action: 'product.price_changed',
        entity: 'product_variant',
        entityId: sampleVariant.variantId,
        meta: {
          variantId: sampleVariant.variantId,
          sku: sampleVariant.sku,
          oldPricePaisa: '10000',
          newPricePaisa: sampleVariant.unitPricePaisa.toString(),
        },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        actorId: staff1User.id,
        orgId: seller1.orgId,
        action: 'stock.adjusted',
        entity: 'inventory',
        entityId: sampleVariant.variantId,
        meta: {
          qtyBefore: 50,
          qtyAfter: 75,
          delta: 25,
          reason: 'ADJUSTMENT',
        },
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
    ]);
  }

  console.log('✅ Database seed completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Database seed failed:', err);
  process.exit(1);
});
