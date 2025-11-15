// parsing/simpleParser.js
export function simpleParse(text, context = null) {
  const lowerText = text.toLowerCase();

  // Enhanced patterns for conversational understanding
  const patterns = {
    create_order: [
      /(\d+)\s+([\w\s]+?)\s+for\s+([\w\s]+)/i,
      /order\s+(\d+)\s+([\w\s]+?)\s+for\s+([\w\s]+)/i,
      /i\s+want\s+(\d+)\s+([\w\s]+)/i,
      /get\s+me\s+(\d+)\s+([\w\s]+)/i,
    ],
    check_stock: [
      /(?:check|show|what.s|how much)\s+(?:stock|inventory)\s+(?:for|of)\s+([\w\s]+)/i,
      /(?:is there|do we have)\s+([\w\s]+)\s+in stock/i,
      /stock\s+for\s+([\w\s]+)/i,
    ],
    update_order: [
      /update\s+order\s+([\w\d]+)/i,
      /change\s+order\s+([\w\d]+)/i,
      /modify\s+order\s+([\w\d]+)/i,
    ],
    delete_order: [
      /delete\s+order\s+([\w\d]+)/i,
      /cancel\s+order\s+([\w\d]+)/i,
      /remove\s+order\s+([\w\d]+)/i,
    ],
    create_customer: [
      /create\s+customer\s+([\w\s]+)/i,
      /add\s+customer\s+([\w\s]+)/i,
      /new\s+customer\s+([\w\s]+)/i,
    ],
  };

  // Check for confirmation responses
  if (context?.pendingAction) {
    if (/(yes|yeah|yep|sure|ok|confirm)/i.test(text)) {
      return {
        intent:
          context.pendingAction === "create_customer"
            ? "create_customer"
            : "unknown",
        response: `Confirmed. ${
          context.pendingAction === "create_customer"
            ? "Creating customer..."
            : "Proceeding..."
        }`,
        customer: context.customer,
        items: context.items,
        orderId: context.lastOrderId,
        needsConfirmation: false,
      };
    }
    if (/(no|nope|cancel|stop)/i.test(text)) {
      return {
        intent: "unknown",
        response: "Action cancelled.",
        needsConfirmation: false,
      };
    }
  }

  // Try to match patterns
  for (const [intent, intentPatterns] of Object.entries(patterns)) {
    for (const pattern of intentPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        return createPlanFromMatch(intent, match, text, context);
      }
    }
  }

  // Default response for unknown commands
  return {
    intent: "unknown",
    response:
      "I'm here to help with orders, inventory, and customers. What would you like to do?",
    customer: null,
    items: [],
    orderId: null,
    needsConfirmation: false,
  };
}

function createPlanFromMatch(intent, match, originalText, context) {
  switch (intent) {
    case "create_order": {
      const [, qty, itemName, customerName] = match;
      return {
        intent: "create_order",
        response: `Creating order for ${
          customerName || "Walk-in"
        }: ${qty} ${itemName}`,
        customer: customerName ? { name: customerName.trim() } : null,
        items: [{ name: itemName.trim(), qty: parseInt(qty, 10) }],
        orderId: null,
        needsConfirmation: false,
      };
    }

    case "check_stock": {
      const [, productName] = match;
      return {
        intent: "check_stock",
        response: `Checking stock for ${productName}`,
        customer: null,
        items: [{ name: productName.trim() }],
        orderId: null,
        needsConfirmation: false,
      };
    }

    case "update_order":
    case "delete_order": {
      const [, orderId] = match;
      return {
        intent,
        response: `${
          intent === "update_order" ? "Updating" : "Deleting"
        } order ${orderId}`,
        customer: null,
        items: [],
        orderId: orderId.trim(),
        needsConfirmation: intent === "delete_order",
      };
    }

    case "create_customer": {
      const [, customerName] = match;
      return {
        intent: "create_customer",
        response: `Creating customer: ${customerName}`,
        customer: { name: customerName.trim() },
        items: [],
        orderId: null,
        needsConfirmation: false,
      };
    }

    default:
      return {
        intent: "unknown",
        response: "I understand you want help. Can you provide more details?",
        customer: null,
        items: [],
        orderId: null,
        needsConfirmation: false,
      };
  }
}
