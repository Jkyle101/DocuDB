const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email function
const sendEmail = async (to, subject, html, text = '') => {
  try {
    const transporter = createTransporter();

    // Verify connection
    await transporter.verify();

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'DocuDB'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Email templates
const emailTemplates = {
  // File shared notification
  FILE_SHARED: (data) => ({
    subject: 'File Shared with You - DocuDB',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #007bff;">File Shared</h2>
        <p>Hello,</p>
        <p><strong>${data.sharerName || 'Someone'}</strong> has shared a file with you:</p>
        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
          <h4 style="margin: 0; color: #333;">${data.fileName}</h4>
          <p style="margin: 5px 0; color: #666;">${data.details || ''}</p>
        </div>
        <p>You can access the file by logging into your DocuDB account.</p>
        <a href="${data.loginUrl || process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
           style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
          Login to DocuDB
        </a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from DocuDB. Please do not reply to this email.
        </p>
      </div>
    `
  }),

  // Password change approved
  PASSWORD_CHANGE_APPROVED: (data) => ({
    subject: 'Password Change Approved - DocuDB',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Password Change Approved</h2>
        <p>Hello,</p>
        <p>Your password change request has been <strong>approved</strong> by an administrator.</p>
        <p>You can now log in to your DocuDB account using your new password.</p>
        <a href="${data.loginUrl || process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
           style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
          Login to DocuDB
        </a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from DocuDB. Please do not reply to this email.
        </p>
      </div>
    `
  }),

  // Password change rejected
  PASSWORD_CHANGE_REJECTED: (data) => ({
    subject: 'Password Change Rejected - DocuDB',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Password Change Rejected</h2>
        <p>Hello,</p>
        <p>Your password change request has been <strong>rejected</strong> by an administrator.</p>
        <p>If you need to change your password, please contact your system administrator for assistance.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from DocuDB. Please do not reply to this email.
        </p>
      </div>
    `
  }),

  // Group notification
  GROUP_NOTIFICATION: (data) => ({
    subject: `Group Notification: ${data.groupName} - DocuDB`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Group Notification</h2>
        <p>Hello,</p>
        <p>You have received a notification from the group <strong>${data.groupName}</strong>:</p>
        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #333;">${data.title}</h4>
          <p style="margin: 0; color: #666; white-space: pre-line;">${data.message}</p>
        </div>
        <p>You can view this notification in your DocuDB account.</p>
        <a href="${data.loginUrl || process.env.FRONTEND_URL || 'http://localhost:5173'}/notifications"
           style="background: #ffc107; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
          View Notifications
        </a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from DocuDB. Please do not reply to this email.
        </p>
      </div>
    `
  }),

  // Welcome notification
  WELCOME: (data) => ({
    subject: 'Welcome to DocuDB!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Welcome to DocuDB!</h2>
        <p>Hello <strong>${data.userName || 'User'}</strong>,</p>
        <p>Welcome to DocuDB! Your account has been successfully created.</p>
        <p>Get started by uploading your first file or creating a folder.</p>
        <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h5>Quick Start Guide:</h5>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Upload files using the upload button</li>
            <li>Create folders to organize your documents</li>
            <li>Share files and folders with other users</li>
            <li>Join or create groups for collaborative work</li>
          </ul>
        </div>
        <a href="${data.loginUrl || process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
           style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
          Login to DocuDB
        </a>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated welcome message from DocuDB. Please do not reply to this email.
        </p>
      </div>
    `
  })
};

// Send notification email
const sendNotificationEmail = async (userEmail, notificationType, data = {}) => {
  try {
    const template = emailTemplates[notificationType];
    if (!template) {
      console.warn(`No email template found for notification type: ${notificationType}`);
      return { success: false, error: 'Template not found' };
    }

    const emailContent = template(data);
    return await sendEmail(userEmail, emailContent.subject, emailContent.html);
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendNotificationEmail,
  emailTemplates
};