// utils/email.js
import nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Verify email connection
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email server connection established');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error);
    return false;
  }
};

// Email templates
const emailTemplates = {
  orderCreated: (order, customer) => ({
    subject: `Your Order #${order.id} has been placed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmation</h2>
        <p>Dear ${customer?.name || 'Customer'},</p>
        <p>Thank you for your order! Your order has been received and is currently pending.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #555;">Order Details</h3>
          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Total Amount:</strong> ₹${order.total.toFixed(2)}</p>
          <p><strong>Status:</strong> <span style="color: #ff9800;">Pending</span></p>
        </div>
        
        <h3>Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f1f1f1;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Item</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Price</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items?.map(item => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${item.product?.name || 'Product'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${item.qty}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">₹${item.price?.toFixed(2) || '0.00'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">₹${(item.qty * item.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>We'll notify you when your order is confirmed</li>
            <li>You'll receive another email when your order ships</li>
            <li>Expected delivery: 3-5 business days</li>
          </ul>
        </div>
        
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>Your Store Team</p>
      </div>
    `,
  }),

  orderStatusUpdated: (order, customer, oldStatus, newStatus) => ({
    subject: `Order #${order.id} Status Update: ${newStatus.toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Status Update</h2>
        <p>Dear ${customer?.name || 'Customer'},</p>
        <p>Your order status has been updated.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #555;">Order Details</h3>
          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Previous Status:</strong> ${oldStatus}</p>
          <p><strong>New Status:</strong> 
            <span style="color: ${
              newStatus === 'completed' ? '#4caf50' :
              newStatus === 'processing' ? '#2196f3' :
              newStatus === 'cancelled' ? '#f44336' :
              newStatus === 'refunded' ? '#9c27b0' : '#ff9800'
            };">${newStatus.toUpperCase()}</span>
          </p>
          <p><strong>Updated On:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Amount:</strong> ₹${order.total.toFixed(2)}</p>
        </div>
        
        ${newStatus === 'completed' ? `
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>🎉 Order Completed!</h3>
            <p>Your order has been successfully processed and completed. Thank you for shopping with us!</p>
          </div>
        ` : ''}
        
        ${newStatus === 'processing' ? `
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>🚚 Order Processing</h3>
            <p>Your order is now being processed. We'll notify you when it ships.</p>
          </div>
        ` : ''}
        
        ${newStatus === 'cancelled' ? `
          <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>❌ Order Cancelled</h3>
            <p>Your order has been cancelled. If you have any questions, please contact our support team.</p>
          </div>
        ` : ''}
        
        ${newStatus === 'refunded' ? `
          <div style="background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>💸 Order Refunded</h3>
            <p>Your order has been refunded. The amount will be credited back to your original payment method within 5-7 business days.</p>
          </div>
        ` : ''}
        
        <p>If you have any questions about this update, please contact our support team.</p>
        <p>Best regards,<br>Your Store Team</p>
      </div>
    `,
  }),
};

// Send email function
export const sendEmail = async (to, templateName, data) => {
  try {
    if (!to || !to.includes('@')) {
      console.log('No valid email address provided');
      return { success: false, error: 'Invalid email address' };
    }

    const template = emailTemplates[templateName];
    if (!template) {
      throw new Error(`Email template ${templateName} not found`);
    }

    const emailContent = template(data.order, data.customer, data.oldStatus, data.newStatus);

    const mailOptions = {
      from: `"Your Store" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

// Send order confirmation email
export const sendOrderConfirmationEmail = async (orderId) => {
  try {
    const prisma = (await import('./db.js')).default;
    
    // Fetch order with customer details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      console.log(`Order ${orderId} not found`);
      return { success: false, error: 'Order not found' };
    }

    // Only send email if customer has email
    if (order.customer?.email) {
      return await sendEmail(
        order.customer.email,
        'orderCreated',
        { order, customer: order.customer }
      );
    } else {
      console.log(`No email address for customer ${order.customerId}`);
      return { success: false, error: 'No customer email' };
    }
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    return { success: false, error: error.message };
  }
};

// Send order status update email
export const sendOrderStatusUpdateEmail = async (orderId, oldStatus, newStatus) => {
  try {
    const prisma = (await import('./db.js')).default;
    
    // Fetch order with customer details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    });

    if (!order) {
      console.log(`Order ${orderId} not found`);
      return { success: false, error: 'Order not found' };
    }

    // Only send email if customer has email
    if (order.customer?.email) {
      return await sendEmail(
        order.customer.email,
        'orderStatusUpdated',
        { order, customer: order.customer, oldStatus, newStatus }
      );
    } else {
      console.log(`No email address for customer ${order.customerId}`);
      return { success: false, error: 'No customer email' };
    }
  } catch (error) {
    console.error('Failed to send status update email:', error);
    return { success: false, error: error.message };
  }
};

export default transporter;