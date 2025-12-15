// seed.js - Automatic daily data generator for testing reports
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  daysToGenerate: 7, // Generate data for last 7 days
  ordersPerDay: { min: 4, max: 5 },
  customersToCreate: { min: 2, max: 3 },
  productsToCreate: { min: 1, max: 2 },
  productsPerOrder: { min: 1, max: 3 },
  quantityPerProduct: { min: 1, max: 3 },
  baseProducts: [
    "Coffee", "Tea", "Sandwich", "Cake", "Muffin", 
    "Croissant", "Cookie", "Brownie", "Bagel", "Smoothie",
    "Juice", "Salad", "Wrap", "Soup", "Pasta"
  ],
  categories: ["Food", "Beverage", "Snack", "Breakfast", "Lunch"],
  paymentMethods: ["cash", "upi", "card", "qr"],
  orderStatuses: ["pending", "completed", "processing", "refunded","cancelled"] // Weighted: 75% completed, 25% refunded
};

// Helper: Generate random date within range
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper: Generate product with random data
function generateProduct(name, index) {
  const category = faker.helpers.arrayElement(CONFIG.categories);
  const price = faker.number.float({ min: 20, max: 200, precision: 0.01 });
  
  return {
    name: name || `${category} Item ${index + 1}`,
    price,
    costPrice: faker.number.float({ min: price * 0.4, max: price * 0.7, precision: 0.01 }),
    stock: faker.number.int({ min: 50, max: 200 }),
    sku: `SKU${String(index + 1).padStart(4, '0')}${faker.string.alphanumeric(4).toUpperCase()}`,
    category,
    isActive: true,
    description: faker.commerce.productDescription(),
  };
}

// Helper: Generate customer with random data
function generateCustomer(index) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  
  return {
    name: `${firstName} ${lastName}`,
    phone: faker.phone.number('+91##########'),
    email: faker.internet.email({ firstName, lastName }),
    altPhone: faker.phone.number('+91##########'),
    tags: faker.helpers.arrayElements(["vip", "repeat", "new", "frequent"], { min: 1, max: 3 }),
  };
}

// Helper: Generate order with random data
function generateOrder(date, customerId, products, userId) {
  const status = faker.helpers.arrayElement(CONFIG.orderStatuses);
  const paymentMethod = faker.helpers.arrayElement(CONFIG.paymentMethods);
  const orderDate = getRandomDate(
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0), // 9 AM
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 21, 0, 0) // 9 PM
  );

  // Select random products for this order
  const selectedProducts = faker.helpers.arrayElements(
    products,
    faker.number.int({ min: CONFIG.productsPerOrder.min, max: CONFIG.productsPerOrder.max })
  );

  // Calculate total
  const items = selectedProducts.map(product => {
    const qty = faker.number.int({ min: CONFIG.quantityPerProduct.min, max: CONFIG.quantityPerProduct.max });
    return {
      productId: product.id,
      qty,
      price: product.price,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const total = Math.round(subtotal * 100) / 100;

  return {
    customerId: customerId || null,
    total,
    status,
    paymentMethod,
    cashierId: userId,
    createdAt: orderDate,
    items: {
      create: items,
    },
  };
}

// Main seeding function
async function seedDailyData() {
  console.log("🌱 Generating daily test data for reports...");

  try {
    // Clean up existing test data (optional - comment out if you want to keep existing data)
    console.log("🧹 Cleaning up existing test data...");
    await prisma.stockMovement.deleteMany({});
    await prisma.refund.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.customer.deleteMany({});
    // Note: We're not deleting users/sessions/expenses

    // Get or create admin user
    let admin = await prisma.user.findFirst({
      where: { email: "admin@peninsula.app" },
    });

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: "Admin User",
          email: "admin@peninsula.app",
          password: "hashedpassword",
          role: "ADMIN",
        },
      });
      console.log("✅ Created admin user");
    }

    // Generate customers
    console.log("👥 Generating customers...");
    const customerCount = faker.number.int({ 
      min: CONFIG.customersToCreate.min, 
      max: CONFIG.customersToCreate.max 
    });
    
    const customers = [];
    for (let i = 0; i < customerCount; i++) {
      const customerData = generateCustomer(i);
      const customer = await prisma.customer.create({
        data: customerData,
      });
      customers.push(customer);
    }
    console.log(`✅ Created ${customers.length} customers`);

    // Generate products
    console.log("🛍️ Generating products...");
    const productCount = faker.number.int({ 
      min: CONFIG.productsToCreate.min, 
      max: CONFIG.productsToCreate.max 
    });

    const products = [];
    for (let i = 0; i < productCount; i++) {
      const productName = faker.helpers.arrayElement(CONFIG.baseProducts);
      const productData = generateProduct(productName, i);
      const product = await prisma.product.create({
        data: productData,
      });
      products.push(product);
    }
    console.log(`✅ Created ${products.length} products`);

    // Generate daily orders for the last N days
    console.log(`📊 Generating daily orders for last ${CONFIG.daysToGenerate} days...`);
    
    const allOrders = [];
    const today = new Date();

    for (let dayOffset = CONFIG.daysToGenerate; dayOffset >= 0; dayOffset--) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() - dayOffset);
      
      const ordersForDay = faker.number.int({ 
        min: CONFIG.ordersPerDay.min, 
        max: CONFIG.ordersPerDay.max 
      });

      console.log(`📅 ${currentDate.toISOString().split('T')[0]}: Creating ${ordersForDay} orders`);

      for (let orderIndex = 0; orderIndex < ordersForDay; orderIndex++) {
        // Randomly assign customer (or null for walk-in customers)
        const customer = faker.datatype.boolean(0.7) ? faker.helpers.arrayElement(customers) : null;
        
        const orderData = generateOrder(currentDate, customer?.id, products, admin.id);
        
        const order = await prisma.order.create({
          data: orderData,
          include: {
            items: true,
          },
        });
        allOrders.push(order);

        // Create payment record
        if (order.status !== "refunded") {
          await prisma.payment.create({
            data: {
              orderId: order.id,
              method: order.paymentMethod,
              amount: order.total,
            },
          });
        } else {
          // For refunded orders, create both payment and refund records
          await prisma.payment.create({
            data: {
              orderId: order.id,
              method: order.paymentMethod,
              amount: order.total,
            },
          });

          await prisma.refund.create({
            data: {
              orderId: order.id,
              amount: order.total,
              reason: faker.helpers.arrayElement([
                "Customer changed mind",
                "Product not as expected",
                "Duplicate order",
                "Wrong item delivered"
              ]),
            },
          });
        }

        // Update product stock and create stock movements
        for (const item of order.items) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const oldStock = product.stock;
            const newStock = oldStock - item.qty;
            
            await prisma.stockMovement.create({
              data: {
                productId: product.id,
                type: "sale",
                quantity: item.qty,
                oldStock,
                newStock,
                reason: "Order placed",
              },
            });

            // Update product stock
            await prisma.product.update({
              where: { id: product.id },
              data: { stock: newStock },
            });

            // Update product object for next iteration
            product.stock = newStock;
          }
        }
      }
    }

    // Create a session for today
    console.log("💼 Creating today's session...");
    const session = await prisma.session.create({
      data: {
        userId: admin.id,
        startTime: new Date(new Date().setHours(9, 0, 0, 0)), // Start at 9 AM
        endTime: new Date(new Date().setHours(21, 0, 0, 0)), // End at 9 PM
        totalSales: allOrders
          .filter(order => order.status === "completed" && 
                 order.createdAt >= new Date(new Date().setHours(0, 0, 0, 0)))
          .reduce((sum, order) => sum + order.total, 0),
      },
    });

    // Add some expenses for realism
    console.log("💰 Adding sample expenses...");
    await prisma.expense.createMany({
      data: [
        {
          title: "Daily Supplies",
          amount: faker.number.float({ min: 500, max: 2000, precision: 0.01 }),
          category: "Supplies",
        },
        {
          title: "Staff Wages",
          amount: faker.number.float({ min: 2000, max: 5000, precision: 0.01 }),
          category: "Labor",
        },
        {
          title: "Utility Bills",
          amount: faker.number.float({ min: 1000, max: 3000, precision: 0.01 }),
          category: "Utilities",
        },
      ],
    });

    // Generate summary statistics
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.status === "completed").length;
    const refundedOrders = allOrders.filter(o => o.status === "refunded").length;
    const totalRevenue = allOrders
      .filter(o => o.status === "completed")
      .reduce((sum, order) => sum + order.total, 0);
    const totalRefunds = allOrders
      .filter(o => o.status === "refunded")
      .reduce((sum, order) => sum + order.total, 0);
    const netRevenue = totalRevenue - totalRefunds;

    console.log("\n📈 GENERATION SUMMARY:");
    console.log("=" .repeat(40));
    console.log(`📅 Days covered: ${CONFIG.daysToGenerate + 1} days`);
    console.log(`👥 Customers created: ${customers.length}`);
    console.log(`🛍️ Products created: ${products.length}`);
    console.log(`📦 Total orders: ${totalOrders}`);
    console.log(`✅ Completed orders: ${completedOrders}`);
    console.log(`↩️ Refunded orders: ${refundedOrders}`);
    console.log(`💰 Gross revenue: ₹${totalRevenue.toFixed(2)}`);
    console.log(`💸 Total refunds: ₹${totalRefunds.toFixed(2)}`);
    console.log(`📊 Net revenue: ₹${netRevenue.toFixed(2)}`);
    console.log(`🏪 Today's session: ${session.id}`);
    console.log("=" .repeat(40));
    console.log("✅ Daily test data generation completed successfully!");
    console.log("\n💡 You can now test the following report endpoints:");
    console.log("   - GET /api/reports/sales/daily");
    console.log("   - GET /api/reports/analytics/payment");
    console.log("   - GET /api/reports/dashboard");
    console.log("   - GET /api/reports/inventory/low-stock");
    console.log("   - GET /api/reports/debug (for testing all reports)");

  } catch (error) {
    console.error("❌ Error generating test data:", error);
    throw error;
  }
}

// Function to add today's orders (for daily updates)
async function addTodaysOrders() {
  console.log("🔄 Adding today's orders...");
  
  try {
    // Get existing data
    const admin = await prisma.user.findFirst({
      where: { email: "admin@peninsula.app" },
    });
    
    const customers = await prisma.customer.findMany({ take: 5 });
    const products = await prisma.product.findMany({ take: 10 });
    
    if (!admin || customers.length === 0 || products.length === 0) {
      console.log("⚠️  Please run the full seed first");
      return;
    }

    const today = new Date();
    const ordersForToday = faker.number.int({ min: 4, max: 6 });

    for (let i = 0; i < ordersForToday; i++) {
      const customer = faker.datatype.boolean(0.7) ? faker.helpers.arrayElement(customers) : null;
      const orderData = generateOrder(today, customer?.id, products, admin.id);
      
      const order = await prisma.order.create({
        data: orderData,
        include: {
          items: true,
        },
      });

      // Create payment
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: order.paymentMethod,
          amount: order.total,
        },
      });

      // Update stock
      for (const item of order.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const newStock = product.stock - item.qty;
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: newStock },
          });
          product.stock = newStock;
        }
      }
    }

    console.log(`✅ Added ${ordersForToday} orders for today`);
    
  } catch (error) {
    console.error("❌ Error adding today's orders:", error);
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case '--today':
      await addTodaysOrders();
      break;
    case '--clean':
      console.log("🧹 Cleaning up all test data...");
      await prisma.stockMovement.deleteMany({});
      await prisma.refund.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.orderItem.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.product.deleteMany({});
      await prisma.customer.deleteMany({});
      console.log("✅ All test data cleaned up");
      break;
    case '--help':
      console.log(`
Usage: node seed.js [command]

Commands:
  (no command)    Generate full test data for last ${CONFIG.daysToGenerate} days
  --today         Add today's orders only
  --clean         Clean up all test data
  --help          Show this help message

Examples:
  node seed.js              # Full data generation
  node seed.js --today      # Add today's orders
  node seed.js --clean      # Clean all test data
      `);
      break;
    default:
      await seedDailyData();
  }
}

// Run the script
main()
  .catch((e) => {
    console.error("❌ Script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });