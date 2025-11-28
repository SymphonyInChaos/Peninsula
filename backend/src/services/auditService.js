// services/auditService.js
import prisma from "../utils/db.js";

export class AuditService {
  static async logAction(
    action,
    entity,
    entityId,
    oldValues,
    newValues,
    userId = null,
    userRole = null,
    ipAddress = null
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId,
          oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
          newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
          userId,
          userRole,
          ipAddress,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error("Failed to create audit log:", error);
      // Don't throw - audit failures shouldn't break main functionality
    }
  }

  static async logProductChange(
    action,
    productId,
    oldProduct,
    newProduct,
    userId,
    userRole,
    ipAddress
  ) {
    await this.logAction(
      action,
      "PRODUCT",
      productId,
      oldProduct,
      newProduct,
      userId,
      userRole,
      ipAddress
    );
  }

  static async logCustomerChange(
    action,
    customerId,
    oldCustomer,
    newCustomer,
    userId,
    userRole,
    ipAddress
  ) {
    await this.logAction(
      action,
      "CUSTOMER",
      customerId,
      oldCustomer,
      newCustomer,
      userId,
      userRole,
      ipAddress
    );
  }

  static async logOrderChange(
    action,
    orderId,
    oldOrder,
    newOrder,
    userId,
    userRole,
    ipAddress
  ) {
    await this.logAction(
      action,
      "ORDER",
      orderId,
      oldOrder,
      newOrder,
      userId,
      userRole,
      ipAddress
    );
  }
}
