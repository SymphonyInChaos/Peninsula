import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

// In-memory conversation store
const conversationStore = new Map();

// Schemas
const CommandRequestSchema = z.object({
  text: z.string().min(1, "Command text cannot be empty."),
  conversationId: z.string().optional().nullable(),
});

const ConfirmRequestSchema = z.object({
  conversationId: z.string(),
  confirmed: z.boolean(),
  actionType: z.string().optional(),
  customerData: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
    .optional(),
  productData: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional().nullable(),
      price: z.number().optional(),
      stock: z.number().optional(),
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

  // Default response
  return {
    intent: "unknown",
    response:
      "I can help you with customer or product management. Try:\n\n**Customers:**\n• 'Create customer John'\n• 'Edit customer c1'  \n• 'Delete customer c2'\n• 'List customers'\n• 'View customer c1'\n\n**Products:**\n• 'Create product Laptop'\n• 'Edit product p1'\n• 'Delete product p2'\n• 'List products'\n• 'View product p1'",
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
      const newValue = text.trim();
      const oldValue = context.customerData[context.fieldToEdit];

      // Create updated customer data
      const updatedCustomerData = {
        ...context.customerData,
        [context.fieldToEdit]: newValue,
      };

      return {
        intent: "edit_customer",
        response: `Confirm change:\n${context.fieldToEdit}: "${
          oldValue || "Not set"
        }" → "${newValue}"\n\nShould I update this customer?`,
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
      if (isNaN(price) || price < 0) {
        return {
          intent: "create_product",
          response: "Please provide a valid price (e.g., 99.99)",
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
          response: "Please provide a valid stock quantity (e.g., 100)",
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

      // Handle numeric fields
      if (context.fieldToEdit === "price") {
        const priceValue = parseFloat(newValue);
        if (isNaN(priceValue) || priceValue < 0) {
          return {
            intent: "edit_product",
            response: "Please provide a valid price (e.g., 99.99)",
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
            response: "Please provide a valid stock quantity (e.g., 100)",
            flowState: PRODUCT_FLOW_STATES.EDIT_ENTER_NEW_VALUE,
            productData: context.productData,
            fieldToEdit: context.fieldToEdit,
            actionType: "edit_product",
            domain: "product",
          };
        }
        newValue = stockValue;
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
          : newValue;

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

      if (!isContinuation && !isEditFlow) {
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
    } else if (plan.intent === "unknown") {
      responseData.response = plan.response;
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

// Confirmation endpoint - FIXED FOR BOTH CUSTOMER AND PRODUCT
router.post("/confirm", async (req, res) => {
  try {
    console.log("✅ Confirm request:", req.body);

    const {
      conversationId,
      confirmed,
      actionType,
      customerData,
      productData,
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

      // Check if customer already exists
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          name: {
            equals: customerDataToUse.name,
            mode: "insensitive",
          },
        },
      });

      if (existingCustomer) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Customer "${customerDataToUse.name}" already exists with ID: ${existingCustomer.id}`,
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

      // Check if product already exists
      const existingProduct = await prisma.product.findFirst({
        where: {
          name: {
            equals: productDataToUse.name,
            mode: "insensitive",
          },
        },
      });

      if (existingProduct) {
        conversationStore.delete(conversationId);
        return res.json({
          response: `❌ Product "${productDataToUse.name}" already exists with ID: ${existingProduct.id}`,
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
    })
  );

  res.json({
    status: "ok",
    activeConversations: activeConversations,
    totalConversations: conversationStore.size,
    message: "Customer and product management service is running",
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
