import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

// In-memory conversation store
const conversationStore = new Map();

// Enhanced Schemas with comprehensive validation
const CommandRequestSchema = z.object({
  text: z
    .string()
    .min(1, "Command text cannot be empty.")
    .max(500, "Command too long"),
  conversationId: z.string().optional().nullable(),
});

const ConfirmRequestSchema = z.object({
  conversationId: z.string(),
  confirmed: z.boolean(),
  actionType: z.string().optional(),
  customerData: z
    .object({
      id: z.string().optional(),
      name: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name too long")
        .optional(),
      email: z.string().email("Invalid email format").optional().nullable(),
      phone: z.string().max(20, "Phone number too long").optional().nullable(),
    })
    .optional(),
  productData: z
    .object({
      id: z.string().optional(),
      name: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name too long")
        .optional(),
      description: z
        .string()
        .max(500, "Description too long")
        .optional()
        .nullable(),
      price: z
        .number()
        .positive("Price must be positive")
        .min(0.01, "Price must be at least 0.01")
        .optional(),
      stock: z
        .number()
        .int("Stock must be an integer")
        .min(0, "Stock cannot be negative")
        .optional(),
    })
    .optional(),
  orderData: z
    .object({
      id: z.string().optional(),
      customerId: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            qty: z
              .number()
              .int("Quantity must be an integer")
              .min(1, "Quantity must be at least 1"),
            price: z.number().positive("Price must be positive"),
          })
        )
        .min(1, "Order must have at least one item")
        .optional(),
      total: z.number().positive("Total must be positive").optional(),
    })
    .optional(),
  fieldToEdit: z.string().optional(),
});

// Generate conversation ID
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate customer ID like c1, c2, c3...
async function generateNextCustomerId() {
  try {
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (lastCustomer && lastCustomer.id.startsWith("c")) {
      const lastNumber = parseInt(lastCustomer.id.substring(1));
      return `c${lastNumber + 1}`;
    }
    return "c1";
  } catch (error) {
    console.error("Error generating customer ID:", error);
    return `c${Date.now()}`;
  }
}

// Generate product ID like p1, p2, p3...
async function generateNextProductId() {
  try {
    const lastProduct = await prisma.product.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (lastProduct && lastProduct.id.startsWith("p")) {
      const lastNumber = parseInt(lastProduct.id.substring(1));
      return `p${lastNumber + 1}`;
    }
    return "p1";
  } catch (error) {
    console.error("Error generating product ID:", error);
    return `p${Date.now()}`;
  }
}

// Generate order ID like o1, o2, o3...
async function generateNextOrderId() {
  try {
    const lastOrder = await prisma.order.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (lastOrder && lastOrder.id.startsWith("o")) {
      const lastNumber = parseInt(lastOrder.id.substring(1));
      return `o${lastNumber + 1}`;
    }
    return "o1";
  } catch (error) {
    console.error("Error generating order ID:", error);
    return `o${Date.now()}`;
  }
}

// Customer flow states
const CUSTOMER_FLOW_STATES = {
  // Create customer flow
  CREATE_START: "create_start",
  CREATE_ASK_EMAIL: "create_ask_email",
  CREATE_ASK_PHONE: "create_ask_phone",
  CREATE_CONFIRM_DETAILS: "create_confirm_details",

  // Edit customer flow
  EDIT_SELECT_CUSTOMER: "edit_select_customer",
  EDIT_SELECT_FIELD: "edit_select_field",
  EDIT_ENTER_NEW_VALUE: "edit_enter_new_value",
  EDIT_CONFIRM_CHANGE: "edit_confirm_change",

  // Delete customer flow
  DELETE_SELECT_CUSTOMER: "delete_select_customer",
  DELETE_CONFIRM: "delete_confirm",

  COMPLETED: "completed",
};

// Product flow states
const PRODUCT_FLOW_STATES = {
  // Create product flow
  CREATE_START: "create_start",
  CREATE_ASK_DESCRIPTION: "create_ask_description",
  CREATE_ASK_PRICE: "create_ask_price",
  CREATE_ASK_STOCK: "create_ask_stock",
  CREATE_CONFIRM_DETAILS: "create_confirm_details",

  // Edit product flow
  EDIT_SELECT_PRODUCT: "edit_select_product",
  EDIT_SELECT_FIELD: "edit_select_field",
  EDIT_ENTER_NEW_VALUE: "edit_enter_new_value",
  EDIT_CONFIRM_CHANGE: "edit_confirm_change",

  // Delete product flow
  DELETE_SELECT_PRODUCT: "delete_select_product",
  DELETE_CONFIRM: "delete_confirm",

  COMPLETED: "completed",
};

// Order flow states
const ORDER_FLOW_STATES = {
  // Create order flow
  CREATE_SELECT_CUSTOMER: "create_select_customer",
  CREATE_ADD_PRODUCTS: "create_add_products",
  CREATE_ENTER_QUANTITY: "create_enter_quantity",
  CREATE_ADD_MORE: "create_add_more",
  CREATE_CONFIRM_DETAILS: "create_confirm_details",

  // View order flow
  VIEW_SELECT_ORDER: "view_select_order",

  // Delete order flow
  DELETE_SELECT_ORDER: "delete_select_order",
  DELETE_CONFIRM: "delete_confirm",

  COMPLETED: "completed",
};

// Parse customer commands
function parseCustomerCommand(text, context = null) {
  const lowerText = text.toLowerCase().trim();
  console.log("Parsing customer command:", text, "Context:", context);

  // Handle conversational flows FIRST (most important)
  if (context && context.flowState && context.domain === "customer") {
    return handleCustomerFlow(text, context);
  }

  // ORDER MATTERS! Most specific commands first

  // DELETE customer commands - HIGH PRIORITY
  const deleteMatch = lowerText.match(/^(?:delete|remove)\s+customer\s+(.+)$/i);
  if (deleteMatch) {
    const customerIdentifier = deleteMatch[1].trim();
    return {
      intent: "delete_customer",
      customerIdentifier: customerIdentifier,
      response: `⚠️ Are you sure you want to delete customer "${customerIdentifier}"? This will also delete all their orders and cannot be undone.`,
      flowState: CUSTOMER_FLOW_STATES.DELETE_CONFIRM,
      actionType: "delete_customer",
      needsConfirmation: true,
      domain: "customer",
    };
  }

  // EDIT customer commands - MEDIUM PRIORITY
  const editMatch = lowerText.match(
    /^(?:edit|update|modify|change)\s+customer\s+(.+)$/i
  );
  if (editMatch) {
    const customerIdentifier = editMatch[1].trim();
    return {
      intent: "edit_customer",
      customerIdentifier: customerIdentifier,
      response: `✏️ Let's edit customer "${customerIdentifier}". Which field would you like to edit? (name, email, phone)`,
      flowState: CUSTOMER_FLOW_STATES.EDIT_SELECT_FIELD,
      actionType: "edit_customer",
      domain: "customer",
    };
  }

  // CREATE customer commands - LOW PRIORITY
  const createMatch =
    lowerText.match(/^(?:create|add|make)\s+(?:a\s+)?customer\s+(.+)$/i) ||
    lowerText.match(/^(?:new\s+)?customer\s+(.+)$/i);
  if (createMatch) {
    const customerName = createMatch[1].trim();
    // Don't allow creating customers with IDs like c1, c2, etc.
    if (customerName.match(/^c\d+$/i)) {
      return {
        intent: "unknown",
        response: `"${customerName}" looks like a customer ID. To edit or delete a customer, use: "Edit customer ${customerName}" or "Delete customer ${customerName}"`,
        actionType: "unknown",
      };
    }
    return {
      intent: "create_customer",
      customerName: customerName,
      response: `👤 Great! Let's create customer "${customerName}". What's their email address? (or type 'skip')`,
      flowState: CUSTOMER_FLOW_STATES.CREATE_ASK_EMAIL,
      actionType: "create_customer",
      domain: "customer",
    };
  }

  // List customers command
  if (lowerText.match(/^(?:list|show|view)\s+customers$/i)) {
    return {
      intent: "list_customers",
      response: "📋 Let me fetch the list of customers...",
      actionType: "list_customers",
      domain: "customer",
    };
  }

  // View specific customer
  const viewMatch = lowerText.match(/^(?:view|show|get)\s+customer\s+(.+)$/i);
  if (viewMatch) {
    const customerIdentifier = viewMatch[1].trim();
    return {
      intent: "view_customer",
      customerIdentifier: customerIdentifier,
      response: `🔍 Let me get details for customer "${customerIdentifier}"...`,
      actionType: "view_customer",
      domain: "customer",
    };
  }

  return null;
}

// Parse product commands
function parseProductCommand(text, context = null) {
  const lowerText = text.toLowerCase().trim();
  console.log("Parsing product command:", text, "Context:", context);

  // Handle conversational flows FIRST (most important)
  if (context && context.flowState && context.domain === "product") {
    return handleProductFlow(text, context);
  }

  // DELETE product commands - HIGH PRIORITY
  const deleteMatch = lowerText.match(/^(?:delete|remove)\s+product\s+(.+)$/i);
  if (deleteMatch) {
    const productIdentifier = deleteMatch[1].trim();
    return {
      intent: "delete_product",
      productIdentifier: productIdentifier,
      response: `⚠️ Are you sure you want to delete product "${productIdentifier}"? This cannot be undone.`,
      flowState: PRODUCT_FLOW_STATES.DELETE_CONFIRM,
      actionType: "delete_product",
      needsConfirmation: true,
      domain: "product",
    };
  }

  // EDIT product commands - MEDIUM PRIORITY
  const editMatch = lowerText.match(
    /^(?:edit|update|modify|change)\s+product\s+(.+)$/i
  );
  if (editMatch) {
    const productIdentifier = editMatch[1].trim();
    return {
      intent: "edit_product",
      productIdentifier: productIdentifier,
      response: `✏️ Let's edit product "${productIdentifier}". Which field would you like to edit? (name, description, price, stock)`,
      flowState: PRODUCT_FLOW_STATES.EDIT_SELECT_FIELD,
      actionType: "edit_product",
      domain: "product",
    };
  }

  // CREATE product commands - LOW PRIORITY
  const createMatch =
    lowerText.match(/^(?:create|add|make)\s+(?:a\s+)?product\s+(.+)$/i) ||
    lowerText.match(/^(?:new\s+)?product\s+(.+)$/i);
  if (createMatch) {
    const productName = createMatch[1].trim();
    // Don't allow creating products with IDs like p1, p2, etc.
    if (productName.match(/^p\d+$/i)) {
      return {
        intent: "unknown",
        response: `"${productName}" looks like a product ID. To edit or delete a product, use: "Edit product ${productName}" or "Delete product ${productName}"`,
        actionType: "unknown",
      };
    }
    return {
      intent: "create_product",
      productName: productName,
      response: `📦 Great! Let's create product "${productName}". What's the description? (or type 'skip')`,
      flowState: PRODUCT_FLOW_STATES.CREATE_ASK_DESCRIPTION,
      actionType: "create_product",
      domain: "product",
    };
  }

  // List products command
  if (lowerText.match(/^(?:list|show|view)\s+products$/i)) {
    return {
      intent: "list_products",
      response: "📋 Let me fetch the list of products...",
      actionType: "list_products",
      domain: "product",
    };
  }

  // View specific product
  const viewMatch = lowerText.match(/^(?:view|show|get)\s+product\s+(.+)$/i);
  if (viewMatch) {
    const productIdentifier = viewMatch[1].trim();
    return {
      intent: "view_product",
      productIdentifier: productIdentifier,
      response: `🔍 Let me get details for product "${productIdentifier}"...`,
      actionType: "view_product",
      domain: "product",
    };
  }

  return null;
}

// Parse order commands
function parseOrderCommand(text, context = null) {
  const lowerText = text.toLowerCase().trim();
  console.log("Parsing order command:", text, "Context:", context);

  // Handle conversational flows FIRST (most important)
  if (context && context.flowState && context.domain === "order") {
    return handleOrderFlow(text, context);
  }

  // DELETE order commands - HIGH PRIORITY
  const deleteMatch = lowerText.match(
    /^(?:delete|remove|cancel)\s+order\s+(.+)$/i
  );
  if (deleteMatch) {
    const orderIdentifier = deleteMatch[1].trim();
    return {
      intent: "delete_order",
      orderIdentifier: orderIdentifier,
      response: `⚠️ Are you sure you want to delete order "${orderIdentifier}"? This cannot be undone.`,
      flowState: ORDER_FLOW_STATES.DELETE_CONFIRM,
      actionType: "delete_order",
      needsConfirmation: true,
      domain: "order",
    };
  }

  // CREATE order commands - MEDIUM PRIORITY
  const createMatch =
    lowerText.match(
      /^(?:create|add|make)\s+(?:a\s+)?order\s+(?:for\s+)?(.+)$/i
    ) || lowerText.match(/^(?:new\s+)?order\s+(?:for\s+)?(.+)$/i);
  if (createMatch) {
    const customerIdentifier = createMatch[1].trim();
    return {
      intent: "create_order",
      customerIdentifier: customerIdentifier,
      response: `🛒 Great! Let's create an order for customer "${customerIdentifier}". Let me find this customer...`,
      flowState: ORDER_FLOW_STATES.CREATE_SELECT_CUSTOMER,
      actionType: "create_order",
      domain: "order",
    };
  }

  // List orders command
  if (lowerText.match(/^(?:list|show|view)\s+orders$/i)) {
    return {
      intent: "list_orders",
      response: "📋 Let me fetch the list of orders...",
      actionType: "list_orders",
      domain: "order",
    };
  }

  // View specific order
  const viewMatch = lowerText.match(/^(?:view|show|get)\s+order\s+(.+)$/i);
  if (viewMatch) {
    const orderIdentifier = viewMatch[1].trim();
    return {
      intent: "view_order",
      orderIdentifier: orderIdentifier,
      response: `🔍 Let me get details for order "${orderIdentifier}"...`,
      actionType: "view_order",
      domain: "order",
    };
  }

  // View customer orders
  const customerOrdersMatch = lowerText.match(
    /^(?:view|show|list)\s+orders\s+(?:for|of)\s+(.+)$/i
  );
  if (customerOrdersMatch) {
    const customerIdentifier = customerOrdersMatch[1].trim();
    return {
      intent: "view_customer_orders",
      customerIdentifier: customerIdentifier,
      response: `📋 Let me fetch orders for customer "${customerIdentifier}"...`,
      actionType: "view_customer_orders",
      domain: "order",
    };
  }

  return null;
}

// Main command parser
function parseCommand(text, context = null) {
  // Try customer commands first
  const customerPlan = parseCustomerCommand(text, context);
  if (customerPlan && customerPlan.intent !== "unknown") {
    return customerPlan;
  }

  // Try product commands second
  const productPlan = parseProductCommand(text, context);
  if (productPlan && productPlan.intent !== "unknown") {
    return productPlan;
  }

  // Try order commands third
  const orderPlan = parseOrderCommand(text, context);
  if (orderPlan && orderPlan.intent !== "unknown") {
    return orderPlan;
  }

  // Default response
  return {
    intent: "unknown",
    response:
      "I can help you with customer, product, or order management. Try:\n\n**Customers:**\n• 'Create customer John'\n• 'Edit customer c1'  \n• 'Delete customer c2'\n• 'List customers'\n• 'View customer c1'\n\n**Products:**\n• 'Create product Laptop'\n• 'Edit product p1'\n• 'Delete product p2'\n• 'List products'\n• 'View product p1'\n\n**Orders:**\n• 'Create order for c1'\n• 'View order o1'\n• 'Delete order o2'\n• 'List orders'\n• 'View orders for c1'",
    actionType: "unknown",
  };
}

// Handle customer conversational flows
function handleCustomerFlow(text, context) {
  const lowerText = text.toLowerCase().trim();

  switch (context.flowState) {
    // CREATE CUSTOMER FLOW
    case CUSTOMER_FLOW_STATES.CREATE_ASK_EMAIL:
      if (
        lowerText === "skip" ||
        lowerText === "no email" ||
        lowerText === "none"
      ) {
        return {
          intent: "create_customer",
          response:
            "Okay, no email. What's their phone number? (or type 'skip')",
          flowState: CUSTOMER_FLOW_STATES.CREATE_ASK_PHONE,
          customerData: {
            ...context.customerData,
            email: null,
          },
          actionType: "create_customer",
          domain: "customer",
        };
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(text.trim())) {
          return {
            intent: "create_customer",
            response: `📧 Email set to: ${text.trim()}. What's their phone number? (or type 'skip')`,
            flowState: CUSTOMER_FLOW_STATES.CREATE_ASK_PHONE,
            customerData: {
              ...context.customerData,
              email: text.trim(),
            },
            actionType: "create_customer",
            domain: "customer",
          };
        } else {
          return {
            intent: "create_customer",
            response:
              "That doesn't look like a valid email. Please provide a valid email or type 'skip'.",
            flowState: CUSTOMER_FLOW_STATES.CREATE_ASK_EMAIL,
            customerData: context.customerData,
            actionType: "create_customer",
            domain: "customer",
          };
        }
      }

    case CUSTOMER_FLOW_STATES.CREATE_ASK_PHONE:
      if (
        lowerText === "skip" ||
        lowerText === "no phone" ||
        lowerText === "none"
      ) {
        const customerData = {
          ...context.customerData,
          phone: null,
        };

        return {
          intent: "create_customer",
          response: `✅ Perfect! Let me confirm the details:\n\n📋 Customer Details:\n• Name: ${
            customerData.name
          }\n• Email: ${customerData.email || "Not provided"}\n• Phone: ${
            customerData.phone || "Not provided"
          }\n\nShould I create this customer?`,
          flowState: CUSTOMER_FLOW_STATES.CREATE_CONFIRM_DETAILS,
          customerData: customerData,
          actionType: "create_customer",
          domain: "customer",
          needsConfirmation: true,
        };
      } else {
        const customerData = {
          ...context.customerData,
          phone: text.trim(),
        };

        return {
          intent: "create_customer",
          response: `📞 Phone set to: ${text.trim()}. ✅ Perfect! Let me confirm the details:\n\n📋 Customer Details:\n• Name: ${
            customerData.name
          }\n• Email: ${customerData.email || "Not provided"}\n• Phone: ${
            customerData.phone || "Not provided"
          }\n\nShould I create this customer?`,
          flowState: CUSTOMER_FLOW_STATES.CREATE_CONFIRM_DETAILS,
          customerData: customerData,
          actionType: "create_customer",
          domain: "customer",
          needsConfirmation: true,
        };
      }

    // EDIT CUSTOMER FLOW
    case CUSTOMER_FLOW_STATES.EDIT_SELECT_FIELD:
      const validCustomerFields = ["name", "email", "phone"];
      if (validCustomerFields.includes(lowerText)) {
        return {
          intent: "edit_customer",
          response: `What's the new ${lowerText} for customer ${context.customerData.name}?`,
          flowState: CUSTOMER_FLOW_STATES.EDIT_ENTER_NEW_VALUE,
          customerData: context.customerData,
          fieldToEdit: lowerText,
          actionType: "edit_customer",
          domain: "customer",
        };
      } else {
        return {
          intent: "edit_customer",
          response:
            "Please choose a valid field to edit: name, email, or phone",
          flowState: CUSTOMER_FLOW_STATES.EDIT_SELECT_FIELD,
          customerData: context.customerData,
          actionType: "edit_customer",
          domain: "customer",
        };
      }

    case CUSTOMER_FLOW_STATES.EDIT_ENTER_NEW_VALUE:
      let newValue = text.trim();
      const oldValue = context.customerData[context.fieldToEdit];

      // Validate email if editing email field
      if (
        context.fieldToEdit === "email" &&
        newValue.toLowerCase() !== "skip"
      ) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newValue)) {
          return {
            intent: "edit_customer",
            response:
              "That doesn't look like a valid email. Please provide a valid email or type 'skip' to remove it.",
            flowState: CUSTOMER_FLOW_STATES.EDIT_ENTER_NEW_VALUE,
            customerData: context.customerData,
            fieldToEdit: context.fieldToEdit,
            actionType: "edit_customer",
            domain: "customer",
          };
        }
      }

      // Handle "skip" for optional fields
      if (newValue.toLowerCase() === "skip") {
        newValue = null;
      }

      // Create updated customer data
      const updatedCustomerData = {
        ...context.customerData,
        [context.fieldToEdit]: newValue,
      };

      return {
        intent: "edit_customer",
        response: `Confirm change:\n${context.fieldToEdit}: "${
          oldValue || "Not set"
        }" → "${newValue || "Not set"}"\n\nShould I update this customer?`,
        flowState: CUSTOMER_FLOW_STATES.EDIT_CONFIRM_CHANGE,
        customerData: updatedCustomerData,
        fieldToEdit: context.fieldToEdit,
        actionType: "edit_customer",
        domain: "customer",
        needsConfirmation: true,
      };

    default:
      return {
        intent: "unknown",
        response: "I'm not sure what you want to do. Let's start over.",
        actionType: "unknown",
      };
  }
}

// Handle product conversational flows
function handleProductFlow(text, context) {
  const lowerText = text.toLowerCase().trim();

  switch (context.flowState) {
    // CREATE PRODUCT FLOW
    case PRODUCT_FLOW_STATES.CREATE_ASK_DESCRIPTION:
      if (
        lowerText === "skip" ||
        lowerText === "no description" ||
        lowerText === "none"
      ) {
        return {
          intent: "create_product",
          response: "Okay, no description. What's the price? (e.g., 99.99)",
          flowState: PRODUCT_FLOW_STATES.CREATE_ASK_PRICE,
          productData: {
            ...context.productData,
            description: null,
          },
          actionType: "create_product",
          domain: "product",
        };
      } else {
        return {
          intent: "create_product",
          response: `📝 Description set to: ${text.trim()}. What's the price? (e.g., 99.99)`,
          flowState: PRODUCT_FLOW_STATES.CREATE_ASK_PRICE,
          productData: {
            ...context.productData,
            description: text.trim(),
          },
          actionType: "create_product",
          domain: "product",
        };
      }

    case PRODUCT_FLOW_STATES.CREATE_ASK_PRICE:
      const price = parseFloat(text.trim());
      if (isNaN(price) || price < 0.01) {
        return {
          intent: "create_product",
          response:
            "Please provide a valid price (e.g., 99.99) - must be at least 0.01",
          flowState: PRODUCT_FLOW_STATES.CREATE_ASK_PRICE,
          productData: context.productData,
          actionType: "create_product",
          domain: "product",
        };
      } else {
        return {
          intent: "create_product",
          response: `💰 Price set to: $${price.toFixed(
            2
          )}. What's the stock quantity? (e.g., 100)`,
          flowState: PRODUCT_FLOW_STATES.CREATE_ASK_STOCK,
          productData: {
            ...context.productData,
            price: price,
          },
          actionType: "create_product",
          domain: "product",
        };
      }

    case PRODUCT_FLOW_STATES.CREATE_ASK_STOCK:
      const stock = parseInt(text.trim());
      if (isNaN(stock) || stock < 0) {
        return {
          intent: "create_product",
          response:
            "Please provide a valid stock quantity (e.g., 100) - cannot be negative",
          flowState: PRODUCT_FLOW_STATES.CREATE_ASK_STOCK,
          productData: context.productData,
          actionType: "create_product",
          domain: "product",
        };
      } else {
        const productData = {
          ...context.productData,
          stock: stock,
        };

        return {
          intent: "create_product",
          response: `📊 Stock set to: ${stock}. ✅ Perfect! Let me confirm the details:\n\n📋 Product Details:\n• Name: ${
            productData.name
          }\n• Description: ${
            productData.description || "Not provided"
          }\n• Price: $${productData.price.toFixed(2)}\n• Stock: ${
            productData.stock
          }\n\nShould I create this product?`,
          flowState: PRODUCT_FLOW_STATES.CREATE_CONFIRM_DETAILS,
          productData: productData,
          actionType: "create_product",
          domain: "product",
          needsConfirmation: true,
        };
      }

    // EDIT PRODUCT FLOW
    case PRODUCT_FLOW_STATES.EDIT_SELECT_FIELD:
      const validProductFields = ["name", "description", "price", "stock"];
      if (validProductFields.includes(lowerText)) {
        return {
          intent: "edit_product",
          response: `What's the new ${lowerText} for product ${context.productData.name}?`,
          flowState: PRODUCT_FLOW_STATES.EDIT_ENTER_NEW_VALUE,
          productData: context.productData,
          fieldToEdit: lowerText,
          actionType: "edit_product",
          domain: "product",
        };
      } else {
        return {
          intent: "edit_product",
          response:
            "Please choose a valid field to edit: name, description, price, or stock",
          flowState: PRODUCT_FLOW_STATES.EDIT_SELECT_FIELD,
          productData: context.productData,
          actionType: "edit_product",
          domain: "product",
        };
      }

    case PRODUCT_FLOW_STATES.EDIT_ENTER_NEW_VALUE:
      let newValue = text.trim();
      const oldValue = context.productData[context.fieldToEdit];

      // Handle numeric fields with validation
      if (context.fieldToEdit === "price") {
        const priceValue = parseFloat(newValue);
        if (isNaN(priceValue) || priceValue < 0.01) {
          return {
            intent: "edit_product",
            response:
              "Please provide a valid price (e.g., 99.99) - must be at least 0.01",
            flowState: PRODUCT_FLOW_STATES.EDIT_ENTER_NEW_VALUE,
            productData: context.productData,
            fieldToEdit: context.fieldToEdit,
            actionType: "edit_product",
            domain: "product",
          };
        }
        newValue = priceValue;
      } else if (context.fieldToEdit === "stock") {
        const stockValue = parseInt(newValue);
        if (isNaN(stockValue) || stockValue < 0) {
          return {
            intent: "edit_product",
            response:
              "Please provide a valid stock quantity (e.g., 100) - cannot be negative",
            flowState: PRODUCT_FLOW_STATES.EDIT_ENTER_NEW_VALUE,
            productData: context.productData,
            fieldToEdit: context.fieldToEdit,
            actionType: "edit_product",
            domain: "product",
          };
        }
        newValue = stockValue;
      } else if (
        context.fieldToEdit === "description" &&
        newValue.toLowerCase() === "skip"
      ) {
        newValue = null;
      }

      // Create updated product data
      const updatedProductData = {
        ...context.productData,
        [context.fieldToEdit]: newValue,
      };

      const displayOldValue =
        context.fieldToEdit === "price"
          ? `$${oldValue?.toFixed(2) || "Not set"}`
          : context.fieldToEdit === "stock"
          ? oldValue || "Not set"
          : oldValue || "Not set";

      const displayNewValue =
        context.fieldToEdit === "price"
          ? `$${newValue.toFixed(2)}`
          : context.fieldToEdit === "stock"
          ? newValue
          : newValue || "Not set";

      return {
        intent: "edit_product",
        response: `Confirm change:\n${context.fieldToEdit}: "${displayOldValue}" → "${displayNewValue}"\n\nShould I update this product?`,
        flowState: PRODUCT_FLOW_STATES.EDIT_CONFIRM_CHANGE,
        productData: updatedProductData,
        fieldToEdit: context.fieldToEdit,
        actionType: "edit_product",
        domain: "product",
        needsConfirmation: true,
      };

    default:
      return {
        intent: "unknown",
        response: "I'm not sure what you want to do. Let's start over.",
        actionType: "unknown",
      };
  }
}

// Handle order conversational flows
function handleOrderFlow(text, context) {
  const lowerText = text.toLowerCase().trim();

  switch (context.flowState) {
    // CREATE ORDER FLOW - Select customer
    case ORDER_FLOW_STATES.CREATE_SELECT_CUSTOMER:
      // Customer should already be found in the main endpoint
      return {
        intent: "create_order",
        response: `👤 Order for ${context.customerData.name}. Now let's add products. Which product would you like to add? (use product ID or name)`,
        flowState: ORDER_FLOW_STATES.CREATE_ADD_PRODUCTS,
        orderData: {
          customerId: context.customerData.id,
          customerName: context.customerData.name,
          items: [],
        },
        actionType: "create_order",
        domain: "order",
      };

    // CREATE ORDER FLOW - Add products
    case ORDER_FLOW_STATES.CREATE_ADD_PRODUCTS:
      // Find the product
      return {
        intent: "create_order",
        response: `📦 Adding "${text}". How many would you like to order?`,
        flowState: ORDER_FLOW_STATES.CREATE_ENTER_QUANTITY,
        productIdentifier: text.trim(),
        orderData: context.orderData,
        actionType: "create_order",
        domain: "order",
      };

    // CREATE ORDER FLOW - Enter quantity
    case ORDER_FLOW_STATES.CREATE_ENTER_QUANTITY:
      const quantity = parseInt(text.trim());
      if (isNaN(quantity) || quantity <= 0) {
        return {
          intent: "create_order",
          response:
            "Please provide a valid quantity (e.g., 2) - must be at least 1",
          flowState: ORDER_FLOW_STATES.CREATE_ENTER_QUANTITY,
          orderData: context.orderData,
          productIdentifier: context.productIdentifier,
          actionType: "create_order",
          domain: "order",
        };
      }

      // Check stock availability
      if (context.productData.stock < quantity) {
        return {
          intent: "create_order",
          response: `❌ Insufficient stock! Only ${context.productData.stock} available, but you requested ${quantity}. Please enter a smaller quantity.`,
          flowState: ORDER_FLOW_STATES.CREATE_ENTER_QUANTITY,
          orderData: context.orderData,
          productIdentifier: context.productIdentifier,
          actionType: "create_order",
          domain: "order",
        };
      }

      // Add product to order
      const updatedItems = [...(context.orderData.items || [])];
      const product = context.productData;

      if (product) {
        updatedItems.push({
          productId: product.id,
          productName: product.name,
          qty: quantity,
          price: product.price,
          subtotal: product.price * quantity,
        });
      }

      const updatedOrderData = {
        ...context.orderData,
        items: updatedItems,
      };

      // Calculate total
      const total = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      updatedOrderData.total = total;

      const itemsList = updatedItems
        .map(
          (item) =>
            `  • ${item.productName} × ${item.qty} = $${item.subtotal.toFixed(
              2
            )}`
        )
        .join("\n");

      return {
        intent: "create_order",
        response: `✅ Added ${quantity} × ${
          context.productData.name
        }. Current order:\n\n${itemsList}\n\n💰 Total: $${total.toFixed(
          2
        )}\n\nWould you like to add another product? (yes/no)`,
        flowState: ORDER_FLOW_STATES.CREATE_ADD_MORE,
        orderData: updatedOrderData,
        actionType: "create_order",
        domain: "order",
      };

    // CREATE ORDER FLOW - Add more products
    case ORDER_FLOW_STATES.CREATE_ADD_MORE:
      if (
        lowerText === "yes" ||
        lowerText === "y" ||
        lowerText === "add more"
      ) {
        return {
          intent: "create_order",
          response:
            "Which product would you like to add? (use product ID or name)",
          flowState: ORDER_FLOW_STATES.CREATE_ADD_PRODUCTS,
          orderData: context.orderData,
          actionType: "create_order",
          domain: "order",
        };
      } else if (
        lowerText === "no" ||
        lowerText === "n" ||
        lowerText === "done"
      ) {
        const itemsList = context.orderData.items
          .map(
            (item) =>
              `  • ${item.productName} × ${item.qty} = $${item.subtotal.toFixed(
                2
              )}`
          )
          .join("\n");

        return {
          intent: "create_order",
          response: `✅ Perfect! Let me confirm the order details:\n\n📋 Order for ${
            context.orderData.customerName
          }\n\nItems:\n${itemsList}\n\n💰 Total: $${context.orderData.total.toFixed(
            2
          )}\n\nShould I create this order?`,
          flowState: ORDER_FLOW_STATES.CREATE_CONFIRM_DETAILS,
          orderData: context.orderData,
          actionType: "create_order",
          domain: "order",
          needsConfirmation: true,
        };
      } else {
        return {
          intent: "create_order",
          response:
            "Please answer 'yes' to add more products or 'no' to finish the order.",
          flowState: ORDER_FLOW_STATES.CREATE_ADD_MORE,
          orderData: context.orderData,
          actionType: "create_order",
          domain: "order",
        };
      }

    default:
      return {
        intent: "unknown",
        response: "I'm not sure what you want to do. Let's start over.",
        actionType: "unknown",
      };
  }
}

// Find customer by ID or name
async function findCustomer(identifier) {
  if (!identifier) {
    console.log("❌ No identifier provided to findCustomer");
    return null;
  }

  console.log("🔍 Finding customer with identifier:", identifier);

  try {
    let customer = await prisma.customer.findUnique({
      where: { id: identifier },
    });

    if (customer) {
      console.log("✅ Found customer by ID:", customer.name);
      return customer;
    }

    // If not found by ID, try by name
    customer = await prisma.customer.findFirst({
      where: {
        name: {
          equals: identifier,
          mode: "insensitive",
        },
      },
    });

    if (customer) {
      console.log("✅ Found customer by name:", customer.name);
    } else {
      console.log("❌ Customer not found:", identifier);
    }

    return customer;
  } catch (error) {
    console.error("❌ Error finding customer:", error);
    return null;
  }
}

// Find product by ID or name
async function findProduct(identifier) {
  if (!identifier) {
    console.log("❌ No identifier provided to findProduct");
    return null;
  }

  console.log("🔍 Finding product with identifier:", identifier);

  try {
    let product = await prisma.product.findUnique({
      where: { id: identifier },
    });

    if (product) {
      console.log("✅ Found product by ID:", product.name);
      return product;
    }

    // If not found by ID, try by name
    product = await prisma.product.findFirst({
      where: {
        name: {
          equals: identifier,
          mode: "insensitive",
        },
      },
    });

    if (product) {
      console.log("✅ Found product by name:", product.name);
    } else {
      console.log("❌ Product not found:", identifier);
    }

    return product;
  } catch (error) {
    console.error("❌ Error finding product:", error);
    return null;
  }
}

// Find order by ID
async function findOrder(identifier) {
  if (!identifier) {
    console.log("❌ No identifier provided to findOrder");
    return null;
  }

  console.log("🔍 Finding order with identifier:", identifier);

  try {
    const order = await prisma.order.findUnique({
      where: { id: identifier },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (order) {
      console.log("✅ Found order by ID:", order.id);
    } else {
      console.log("❌ Order not found:", identifier);
    }

    return order;
  } catch (error) {
    console.error("❌ Error finding order:", error);
    return null;
  }
}

// Validate customer data before creation/update
async function validateCustomerData(customerData, existingCustomerId = null) {
  const errors = [];

  // Check for duplicate email
  if (customerData.email) {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        email: customerData.email,
        ...(existingCustomerId && { NOT: { id: existingCustomerId } }),
      },
    });
    if (existingCustomer) {
      errors.push(
        `Email "${customerData.email}" already exists for customer ${existingCustomer.name}`
      );
    }
  }

  // Check for duplicate phone
  if (customerData.phone) {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        phone: customerData.phone,
        ...(existingCustomerId && { NOT: { id: existingCustomerId } }),
      },
    });
    if (existingCustomer) {
      errors.push(
        `Phone "${customerData.phone}" already exists for customer ${existingCustomer.name}`
      );
    }
  }

  return errors;
}

// Validate product data before creation/update
async function validateProductData(productData, existingProductId = null) {
  const errors = [];

  // Check for duplicate product name
  if (productData.name) {
    const existingProduct = await prisma.product.findFirst({
      where: {
        name: {
          equals: productData.name,
          mode: "insensitive",
        },
        ...(existingProductId && { NOT: { id: existingProductId } }),
      },
    });
    if (existingProduct) {
      errors.push(`Product name "${productData.name}" already exists`);
    }
  }

  return errors;
}

// Validate order data before creation
async function validateOrderData(orderData) {
  const errors = [];

  // Check if customer exists
  if (orderData.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: orderData.customerId },
    });
    if (!customer) {
      errors.push(`Customer with ID "${orderData.customerId}" not found`);
    }
  }

  // Check if all products exist and have sufficient stock
  for (const item of orderData.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!product) {
      errors.push(`Product with ID "${item.productId}" not found`);
    } else if (product.stock < item.qty) {
      errors.push(
        `Insufficient stock for "${product.name}": requested ${item.qty}, available ${product.stock}`
      );
    }
  }

  return errors;
}

// Main command endpoint
router.post("/", async (req, res) => {
  try {
    console.log("📨 Command request:", req.body);

    const { text, conversationId } = CommandRequestSchema.parse(req.body);

    // Clear conversation if it's a completely new command (not in flow)
    let context = conversationId ? conversationStore.get(conversationId) : null;
    if (context) {
      // Only clear if it's definitely a new command, not a continuation
      const isContinuation = text.match(
        /^(skip|yes|no|cancel|name|email|phone|description|price|stock|\d+|[^@\s]+@[^@\s]+\.[^@\s]+)$/i
      );
      const isEditFlow =
        context.flowState && context.flowState.includes("edit_");
      const isOrderFlow =
        context.flowState && context.flowState.includes("create_");

      if (!isContinuation && !isEditFlow && !isOrderFlow) {
        console.log("🔄 Clearing old conversation for new command");
        conversationStore.delete(conversationId);
        context = null;
      }
    }

    // Parse the command
    const plan = parseCommand(text, context);
    console.log("📝 Parsed plan:", plan);

    let responseData = {
      response: plan.response,
      needsConfirmation: plan.needsConfirmation,
      actionType: plan.actionType,
      parsedBy: plan.domain || "unknown",
    };

    let newConversationId = conversationId;

    // Handle different intents
    if (plan.intent === "create_customer") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      const updatedContext = {
        flowState: plan.flowState,
        customerData: plan.customerData || { name: plan.customerName },
        intent: "create_customer",
        actionType: "create_customer",
        domain: "customer",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.customerData = plan.customerData;
      responseData.fieldToEdit = plan.fieldToEdit;
    } else if (plan.intent === "edit_customer") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      console.log("✏️ Edit customer flow - Current context:", {
        hasContext: !!context,
        flowState: context?.flowState,
        customerData: context?.customerData,
      });

      let customer;

      if (context && context.customerData) {
        // Use customer from existing context
        customer = context.customerData;
        console.log("✅ Using customer from context:", customer.name);
      } else {
        // Find the customer to edit (only on first call)
        customer = await findCustomer(plan.customerIdentifier);
        if (!customer) {
          return res.json({
            response: `❌ Customer "${plan.customerIdentifier}" not found.`,
            actionType: "edit_customer",
          });
        }
        console.log("✅ Found customer for editing:", customer.name);
      }

      const updatedContext = {
        flowState: plan.flowState,
        customerData: plan.customerData || customer,
        originalCustomerData: customer,
        intent: "edit_customer",
        actionType: "edit_customer",
        fieldToEdit: plan.fieldToEdit,
        domain: "customer",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.customerData = updatedContext.customerData;
      responseData.fieldToEdit = plan.fieldToEdit;

      console.log("✅ Edit flow updated - FlowState:", plan.flowState);
    } else if (plan.intent === "delete_customer") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      // Find the customer to delete
      const customer = await findCustomer(plan.customerIdentifier);
      if (!customer) {
        return res.json({
          response: `❌ Customer "${plan.customerIdentifier}" not found.`,
          actionType: "delete_customer",
        });
      }

      const updatedContext = {
        flowState: plan.flowState,
        customerData: customer,
        intent: "delete_customer",
        actionType: "delete_customer",
        domain: "customer",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.customerData = customer;
      responseData.needsConfirmation = true;
    } else if (plan.intent === "list_customers") {
      const customers = await prisma.customer.findMany({
        orderBy: { name: "asc" },
        include: {
          orders: {
            select: { id: true },
          },
        },
      });

      if (customers.length === 0) {
        responseData.response = "📋 No customers found.";
      } else {
        const customerList = customers
          .map(
            (cust) =>
              `• ${cust.name} (ID: ${cust.id}) - ${
                cust.orders.length
              } orders - 📞 ${cust.phone || "No phone"} - 📧 ${
                cust.email || "No email"
              }`
          )
          .join("\n");

        responseData.response = `📋 Customers (${customers.length}):\n\n${customerList}`;
        responseData.data = { customers: customers };
      }
    } else if (plan.intent === "view_customer") {
      // Find the customer to view
      const customer = await findCustomer(plan.customerIdentifier);
      if (!customer) {
        responseData.response = `❌ Customer "${plan.customerIdentifier}" not found.`;
      } else {
        const orders = await prisma.order.findMany({
          where: { customerId: customer.id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        const orderDetails = orders
          .map(
            (order) =>
              `  • Order ${order.id}: $${order.total.toFixed(2)} (${
                order.items.length
              } items)`
          )
          .join("\n");

        responseData.response =
          `📋 Customer Details:\n\n` +
          `• ID: ${customer.id}\n` +
          `• Name: ${customer.name}\n` +
          `• Email: ${customer.email || "Not provided"}\n` +
          `• Phone: ${customer.phone || "Not provided"}\n` +
          `• Orders: ${orders.length}\n` +
          `${orderDetails ? `\nRecent Orders:\n${orderDetails}` : ""}`;

        responseData.data = { customer: customer, orders: orders };
      }
    }
    // PRODUCT INTENTS
    else if (plan.intent === "create_product") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      const updatedContext = {
        flowState: plan.flowState,
        productData: plan.productData || { name: plan.productName },
        intent: "create_product",
        actionType: "create_product",
        domain: "product",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.productData = plan.productData;
      responseData.fieldToEdit = plan.fieldToEdit;
    } else if (plan.intent === "edit_product") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      console.log("✏️ Edit product flow - Current context:", {
        hasContext: !!context,
        flowState: context?.flowState,
        productData: context?.productData,
      });

      let product;

      if (context && context.productData) {
        // Use product from existing context
        product = context.productData;
        console.log("✅ Using product from context:", product.name);
      } else {
        // Find the product to edit (only on first call)
        product = await findProduct(plan.productIdentifier);
        if (!product) {
          return res.json({
            response: `❌ Product "${plan.productIdentifier}" not found.`,
            actionType: "edit_product",
          });
        }
        console.log("✅ Found product for editing:", product.name);
      }

      const updatedContext = {
        flowState: plan.flowState,
        productData: plan.productData || product,
        originalProductData: product,
        intent: "edit_product",
        actionType: "edit_product",
        fieldToEdit: plan.fieldToEdit,
        domain: "product",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.productData = updatedContext.productData;
      responseData.fieldToEdit = plan.fieldToEdit;

      console.log("✅ Edit flow updated - FlowState:", plan.flowState);
    } else if (plan.intent === "delete_product") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      // Find the product to delete
      const product = await findProduct(plan.productIdentifier);
      if (!product) {
        return res.json({
          response: `❌ Product "${plan.productIdentifier}" not found.`,
          actionType: "delete_product",
        });
      }

      // Check if product is in any orders
      const orderItems = await prisma.orderItem.findMany({
        where: { productId: product.id },
        take: 1,
      });

      if (orderItems.length > 0) {
        return res.json({
          response: `❌ Cannot delete product "${product.name}" because it is used in existing orders.`,
          actionType: "delete_product",
        });
      }

      const updatedContext = {
        flowState: plan.flowState,
        productData: product,
        intent: "delete_product",
        actionType: "delete_product",
        domain: "product",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.productData = product;
      responseData.needsConfirmation = true;
    } else if (plan.intent === "list_products") {
      const products = await prisma.product.findMany({
        orderBy: { name: "asc" },
      });

      if (products.length === 0) {
        responseData.response = "📋 No products found.";
      } else {
        const productList = products
          .map(
            (prod) =>
              `• ${prod.name} (ID: ${prod.id}) - $${prod.price.toFixed(
                2
              )} - Stock: ${prod.stock} - ${
                prod.description || "No description"
              }`
          )
          .join("\n");

        responseData.response = `📋 Products (${products.length}):\n\n${productList}`;
        responseData.data = { products: products };
      }
    } else if (plan.intent === "view_product") {
      // Find the product to view
      const product = await findProduct(plan.productIdentifier);
      if (!product) {
        responseData.response = `❌ Product "${plan.productIdentifier}" not found.`;
      } else {
        responseData.response =
          `📋 Product Details:\n\n` +
          `• ID: ${product.id}\n` +
          `• Name: ${product.name}\n` +
          `• Description: ${product.description || "Not provided"}\n` +
          `• Price: $${product.price.toFixed(2)}\n` +
          `• Stock: ${product.stock}\n` +
          `• Created: ${product.createdAt.toLocaleDateString()}`;

        responseData.data = { product: product };
      }
    }
    // ORDER INTENTS
    else if (plan.intent === "create_order") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      let customer;

      if (context && context.customerData) {
        // Use customer from existing context
        customer = context.customerData;
        console.log("✅ Using customer from context:", customer.name);
      } else {
        // Find the customer for the order
        customer = await findCustomer(plan.customerIdentifier);
        if (!customer) {
          return res.json({
            response: `❌ Customer "${plan.customerIdentifier}" not found.`,
            actionType: "create_order",
          });
        }
        console.log("✅ Found customer for order:", customer.name);
      }

      const updatedContext = {
        flowState: plan.flowState,
        customerData: customer,
        orderData: plan.orderData || {
          customerId: customer.id,
          customerName: customer.name,
          items: [],
        },
        intent: "create_order",
        actionType: "create_order",
        domain: "order",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.customerData = customer;
      responseData.orderData = updatedContext.orderData;
    } else if (plan.intent === "delete_order") {
      if (!newConversationId) {
        newConversationId = generateConversationId();
      }

      // Find the order to delete
      const order = await findOrder(plan.orderIdentifier);
      if (!order) {
        return res.json({
          response: `❌ Order "${plan.orderIdentifier}" not found.`,
          actionType: "delete_order",
        });
      }

      const updatedContext = {
        flowState: plan.flowState,
        orderData: order,
        intent: "delete_order",
        actionType: "delete_order",
        domain: "order",
      };

      conversationStore.set(newConversationId, updatedContext);
      responseData.conversationId = newConversationId;
      responseData.orderData = order;
      responseData.needsConfirmation = true;
    } else if (plan.intent === "list_orders") {
      const orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        take: 20, // Limit to recent orders
      });

      if (orders.length === 0) {
        responseData.response = "📋 No orders found.";
      } else {
        const orderList = orders
          .map(
            (order) =>
              `• Order ${order.id} - Customer: ${
                order.customer.name
              } - Total: $${order.total.toFixed(2)} - Items: ${
                order.items.length
              } - Date: ${order.createdAt.toLocaleDateString()}`
          )
          .join("\n");

        responseData.response = `📋 Recent Orders (${orders.length}):\n\n${orderList}`;
        responseData.data = { orders: orders };
      }
    } else if (plan.intent === "view_order") {
      // Find the order to view
      const order = await findOrder(plan.orderIdentifier);
      if (!order) {
        responseData.response = `❌ Order "${plan.orderIdentifier}" not found.`;
      } else {
        const itemsList = order.items
          .map(
            (item) =>
              `  • ${item.product.name} × ${item.qty} = $${(
                item.price * item.qty
              ).toFixed(2)}`
          )
          .join("\n");

        responseData.response =
          `📋 Order Details:\n\n` +
          `• ID: ${order.id}\n` +
          `• Customer: ${order.customer.name} (${order.customer.id})\n` +
          `• Total: $${order.total.toFixed(2)}\n` +
          `• Items: ${order.items.length}\n` +
          `• Date: ${order.createdAt.toLocaleDateString()}\n\n` +
          `Items:\n${itemsList}`;

        responseData.data = { order: order };
      }
    } else if (plan.intent === "view_customer_orders") {
      // Find customer and their orders
      const customer = await findCustomer(plan.customerIdentifier);
      if (!customer) {
        responseData.response = `❌ Customer "${plan.customerIdentifier}" not found.`;
      } else {
        const orders = await prisma.order.findMany({
          where: { customerId: customer.id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        if (orders.length === 0) {
          responseData.response = `📋 No orders found for customer "${customer.name}".`;
        } else {
          const orderList = orders
            .map(
              (order) =>
                `• Order ${order.id} - Total: $${order.total.toFixed(
                  2
                )} - Items: ${
                  order.items.length
                } - Date: ${order.createdAt.toLocaleDateString()}`
            )
            .join("\n");

          responseData.response = `📋 Orders for ${customer.name} (${orders.length}):\n\n${orderList}`;
          responseData.data = { customer: customer, orders: orders };
        }
      }
    } else if (plan.intent === "unknown") {
      responseData.response = plan.response;
    }

    // Handle product lookup for order flow
    if (plan.intent === "create_order" && plan.productIdentifier) {
      const product = await findProduct(plan.productIdentifier);
      if (!product) {
        responseData.response = `❌ Product "${plan.productIdentifier}" not found. Please try again.`;
        responseData.conversationId = newConversationId;
      } else {
        // Update context with product data
        const currentContext = conversationStore.get(newConversationId);
        if (currentContext) {
          currentContext.productData = product;
          conversationStore.set(newConversationId, currentContext);
        }
        responseData.productData = product;
      }
    }

    console.log("📤 Sending response:", responseData);
    return res.json(responseData);
  } catch (error) {
    console.error("❌ Command error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        response: "Invalid request format.",
        details: error.errors,
      });
    }

    return res.status(500).json({
      response: "I encountered an error. Please try again.",
    });
  }
});

// Confirmation endpoint - FIXED FOR CUSTOMER, PRODUCT AND ORDER
router.post("/confirm", async (req, res) => {
  try {
    console.log("✅ Confirm request:", req.body);

    const {
      conversationId,
      confirmed,
      actionType,
      customerData,
      productData,
      orderData,
      fieldToEdit,
    } = ConfirmRequestSchema.parse(req.body);
    const context = conversationStore.get(conversationId);

    if (!context) {
      console.log("❌ Conversation not found:", conversationId);
      return res.status(400).json({
        response: "Conversation expired or not found. Please start over.",
      });
    }

    if (!confirmed) {
      conversationStore.delete(conversationId);
      return res.json({
        response: "❌ Action cancelled.",
      });
    }

    let response;
    let data = {};

    // Handle different action types
    if (actionType === "create_customer") {
      const customerDataToUse = customerData || context.customerData;

      // Validate customer data
      const validationErrors = await validateCustomerData(customerDataToUse);
      if (validationErrors.length > 0) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Validation failed:\n${validationErrors.join("\n")}`,
        });
      }

      const customerId = await generateNextCustomerId();
      const newCustomer = await prisma.customer.create({
        data: {
          id: customerId,
          name: customerDataToUse.name,
          email: customerDataToUse.email || null,
          phone: customerDataToUse.phone || null,
        },
      });

      conversationStore.delete(conversationId);
      response = `✅ Customer created successfully!\n\n📋 Customer Details:\n• ID: ${
        newCustomer.id
      }\n• Name: ${newCustomer.name}\n• Email: ${
        newCustomer.email || "Not provided"
      }\n• Phone: ${newCustomer.phone || "Not provided"}`;
      data = { customer: newCustomer };
    } else if (actionType === "edit_customer") {
      // Use the context data which contains the UPDATED values from the conversation flow
      const customerDataToUse = context.customerData;
      const field = fieldToEdit || context.fieldToEdit;
      const newValue = customerDataToUse[field];

      console.log("🔄 Updating customer:", {
        customerId: customerDataToUse.id,
        field: field,
        oldValue:
          context.originalCustomerData?.[field] || customerDataToUse[field],
        newValue: newValue,
      });

      // Validate customer data
      const validationErrors = await validateCustomerData(
        customerDataToUse,
        customerDataToUse.id
      );
      if (validationErrors.length > 0) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Validation failed:\n${validationErrors.join("\n")}`,
        });
      }

      // Build update data object
      const updateData = {};
      updateData[field] = newValue || null;

      console.log("📝 Update data:", updateData);

      const updatedCustomer = await prisma.customer.update({
        where: { id: customerDataToUse.id },
        data: updateData,
      });

      console.log("✅ Customer updated in database:", updatedCustomer);

      conversationStore.delete(conversationId);
      response = `✅ Customer updated successfully!\n\n📋 Updated Details:\n• ID: ${
        updatedCustomer.id
      }\n• Name: ${updatedCustomer.name}\n• Email: ${
        updatedCustomer.email || "Not provided"
      }\n• Phone: ${updatedCustomer.phone || "Not provided"}`;
      data = { customer: updatedCustomer };
    } else if (actionType === "delete_customer") {
      const customerDataToUse = customerData || context.customerData;

      // Delete customer and their orders (Prisma will handle cascading deletes based on your schema)
      await prisma.customer.delete({
        where: { id: customerDataToUse.id },
      });

      conversationStore.delete(conversationId);
      response = `✅ Customer "${customerDataToUse.name}" (ID: ${customerDataToUse.id}) has been deleted successfully.`;
      data = { deletedCustomer: customerDataToUse };
    }
    // PRODUCT ACTIONS
    else if (actionType === "create_product") {
      const productDataToUse = productData || context.productData;

      // Validate product data
      const validationErrors = await validateProductData(productDataToUse);
      if (validationErrors.length > 0) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Validation failed:\n${validationErrors.join("\n")}`,
        });
      }

      const productId = await generateNextProductId();
      const newProduct = await prisma.product.create({
        data: {
          id: productId,
          name: productDataToUse.name,
          description: productDataToUse.description || null,
          price: productDataToUse.price || 0,
          stock: productDataToUse.stock || 0,
        },
      });

      conversationStore.delete(conversationId);
      response = `✅ Product created successfully!\n\n📋 Product Details:\n• ID: ${
        newProduct.id
      }\n• Name: ${newProduct.name}\n• Description: ${
        newProduct.description || "Not provided"
      }\n• Price: $${newProduct.price.toFixed(2)}\n• Stock: ${
        newProduct.stock
      }`;
      data = { product: newProduct };
    } else if (actionType === "edit_product") {
      // Use the context data which contains the UPDATED values from the conversation flow
      const productDataToUse = context.productData;
      const field = fieldToEdit || context.fieldToEdit;
      const newValue = productDataToUse[field];

      console.log("🔄 Updating product:", {
        productId: productDataToUse.id,
        field: field,
        oldValue:
          context.originalProductData?.[field] || productDataToUse[field],
        newValue: newValue,
      });

      // Validate product data
      const validationErrors = await validateProductData(
        productDataToUse,
        productDataToUse.id
      );
      if (validationErrors.length > 0) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Validation failed:\n${validationErrors.join("\n")}`,
        });
      }

      // Build update data object
      const updateData = {};
      updateData[field] = newValue;

      console.log("📝 Update data:", updateData);

      const updatedProduct = await prisma.product.update({
        where: { id: productDataToUse.id },
        data: updateData,
      });

      console.log("✅ Product updated in database:", updatedProduct);

      conversationStore.delete(conversationId);
      response = `✅ Product updated successfully!\n\n📋 Updated Details:\n• ID: ${
        updatedProduct.id
      }\n• Name: ${updatedProduct.name}\n• Description: ${
        updatedProduct.description || "Not provided"
      }\n• Price: $${updatedProduct.price.toFixed(2)}\n• Stock: ${
        updatedProduct.stock
      }`;
      data = { product: updatedProduct };
    } else if (actionType === "delete_product") {
      const productDataToUse = productData || context.productData;

      // Delete product
      await prisma.product.delete({
        where: { id: productDataToUse.id },
      });

      conversationStore.delete(conversationId);
      response = `✅ Product "${productDataToUse.name}" (ID: ${productDataToUse.id}) has been deleted successfully.`;
      data = { deletedProduct: productDataToUse };
    }
    // ORDER ACTIONS
    else if (actionType === "create_order") {
      const orderDataToUse = orderData || context.orderData;

      // Validate order data
      const validationErrors = await validateOrderData(orderDataToUse);
      if (validationErrors.length > 0) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Validation failed:\n${validationErrors.join("\n")}`,
        });
      }

      // Create the order
      const orderId = await generateNextOrderId();

      // Create order first
      const newOrder = await prisma.order.create({
        data: {
          id: orderId,
          customerId: orderDataToUse.customerId,
          total: orderDataToUse.total,
        },
      });

      // Create order items
      for (const item of orderDataToUse.items) {
        await prisma.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            qty: item.qty,
            price: item.price,
          },
        });

        // Update product stock
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.qty,
            },
          },
        });
      }

      // Fetch the complete order with relationships
      const completeOrder = await prisma.order.findUnique({
        where: { id: newOrder.id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      const itemsList = completeOrder.items
        .map(
          (item) =>
            `  • ${item.product.name} × ${item.qty} = $${(
              item.price * item.qty
            ).toFixed(2)}`
        )
        .join("\n");

      conversationStore.delete(conversationId);
      response = `✅ Order created successfully!\n\n📋 Order Details:\n• ID: ${
        completeOrder.id
      }\n• Customer: ${
        completeOrder.customer.name
      }\n• Total: $${completeOrder.total.toFixed(2)}\n• Items: ${
        completeOrder.items.length
      }\n\nItems:\n${itemsList}`;
      data = { order: completeOrder };
    } else if (actionType === "delete_order") {
      const orderDataToUse = orderData || context.orderData;

      // First, restore product stock from order items
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: orderDataToUse.id },
        include: { product: true },
      });

      // Restore stock for each product
      for (const item of orderItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.qty,
            },
          },
        });
      }

      // Delete order (cascading delete will handle order items)
      await prisma.order.delete({
        where: { id: orderDataToUse.id },
      });

      conversationStore.delete(conversationId);
      response = `✅ Order "${orderDataToUse.id}" has been deleted successfully. Product stock has been restored.`;
      data = { deletedOrder: orderDataToUse };
    } else {
      response = `✅ Action completed: ${actionType}`;
      conversationStore.delete(conversationId);
    }

    console.log("📤 Confirmation response:", { response, data });
    return res.json({ response, data });
  } catch (error) {
    console.error("❌ Confirm error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        response: "Invalid confirmation data.",
      });
    }

    return res.status(500).json({
      response: "Action failed. Please try again.",
    });
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  const activeConversations = Array.from(conversationStore.entries()).map(
    ([id, context]) => ({
      id,
      flowState: context.flowState,
      actionType: context.actionType,
      domain: context.domain,
      customerName: context.customerData?.name,
      productName: context.productData?.name,
      orderId: context.orderData?.id,
    })
  );

  res.json({
    status: "ok",
    activeConversations: activeConversations,
    totalConversations: conversationStore.size,
    message: "Customer, product, and order management service is running",
  });
});

// Clean up old conversations
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  for (const [id, context] of conversationStore.entries()) {
    const conversationTime = parseInt(id.split("_")[1]);
    if (conversationTime < oneHourAgo) {
      conversationStore.delete(id);
      console.log(`🧹 Cleaned up old conversation: ${id}`);
    }
  }
}, 10 * 60 * 1000);

export default router;
