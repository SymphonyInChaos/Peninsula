import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ---------------- USERS ----------------
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@peninsula.app",
      password: "hashedpassword",
      role: "ADMIN",
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: "Staff User",
      email: "staff@peninsula.app",
      password: "hashedpassword",
      role: "STAFF",
    },
  });

  // ---------------- CUSTOMERS ----------------
  const customers = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      prisma.customer.create({
        data: {
          name: faker.person.fullName(),
          phone: faker.phone.number(),
          email: faker.internet.email(),
          altPhone: faker.phone.number(),
          tags: ["vip", "repeat"],
          addresses: {
            home: faker.location.streetAddress(),
          },
        },
      })
    )
  );

  // ---------------- PRODUCTS ----------------
  const products = await Promise.all(
    ["Coffee", "Tea", "Sandwich", "Cake", "Muffin"].map((name) =>
      prisma.product.create({
        data: {
          name,
          price: faker.number.float({ min: 20, max: 200, precision: 0.01 }),
          costPrice: faker.number.float({ min: 10, max: 100, precision: 0.01 }),
          stock: faker.number.int({ min: 20, max: 100 }),
          sku: faker.string.alphanumeric(8),
          category: "Food",
        },
      })
    )
  );

  // ---------------- SESSIONS ----------------
  const session = await prisma.session.create({
    data: {
      userId: admin.id,
      startTime: new Date(),
    },
  });

  // ---------------- ORDERS ----------------
  for (let i = 0; i < 15; i++) {
    const customer =
      Math.random() > 0.3 ? faker.helpers.arrayElement(customers) : null;

    const product = faker.helpers.arrayElement(products);
    const qty = faker.number.int({ min: 1, max: 5 });

    const total = Number((product.price * qty).toFixed(2));

    const order = await prisma.order.create({
      data: {
        customerId: customer?.id,
        total,
        status: "completed",
        paymentMethod: faker.helpers.arrayElement(["cash", "upi", "card"]),
        cashierId: admin.id,
        items: {
          create: [
            {
              productId: product.id,
              qty,
              price: product.price,
            },
          ],
        },
      },
    });

    // ---------------- PAYMENTS ----------------
    if (Math.random() > 0.7) {
      // Split payment
      const half = Number((total / 2).toFixed(2));

      await prisma.payment.createMany({
        data: [
          {
            orderId: order.id,
            method: "cash",
            amount: half,
          },
          {
            orderId: order.id,
            method: "upi",
            amount: half,
          },
        ],
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: order.paymentMethod || "cash",
          amount: total,
        },
      });
    }

    // ---------------- STOCK MOVEMENTS ----------------
    const oldStock = product.stock;
    const newStock = oldStock - qty;

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: "sale",
        quantity: qty,
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

    // ---------------- RANDOM REFUNDS ----------------
    if (Math.random() > 0.8) {
      await prisma.refund.create({
        data: {
          orderId: order.id,
          amount: Number((total * 0.5).toFixed(2)),
          reason: "Customer complaint",
        },
      });
    }
  }

  // ---------------- EXPENSES ----------------
  await prisma.expense.createMany({
    data: [
      {
        title: "Shop Rent",
        amount: 15000,
        category: "Rent",
      },
      {
        title: "Electricity Bill",
        amount: 3000,
        category: "Utilities",
      },
      {
        title: "Supplier Payment",
        amount: 8000,
        category: "Stock",
      },
    ],
  });

  // ---------------- END SESSION ----------------
  await prisma.session.update({
    where: { id: session.id },
    data: {
      endTime: new Date(),
      totalSales: 50000,
    },
  });

  console.log("✅ Seeding completed.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
