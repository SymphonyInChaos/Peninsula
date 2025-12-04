// utils/idGenerator.js
import prisma from "./db.js";

export async function generateNextId(prefix, tableName) {
  try {
    // Convert table name to Prisma model name format
    const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
    
    // Get all existing IDs with this prefix
    const existingItems = await prisma[tableName].findMany({
      where: {
        id: {
          startsWith: prefix
        }
      },
      select: { id: true },
      orderBy: { id: 'desc' }
    });

    if (existingItems.length === 0) {
      return `${prefix}1`;
    }

    // Find the highest number
    let maxNumber = 0;
    for (const item of existingItems) {
      const numberPart = parseInt(item.id.replace(prefix, '')) || 0;
      if (numberPart > maxNumber) {
        maxNumber = numberPart;
      }
    }

    return `${prefix}${maxNumber + 1}`;
  } catch (error) {
    console.error('Failed to generate ID:', error);
    // Fallback to timestamp
    return `${prefix}${Date.now()}`;
  }
}