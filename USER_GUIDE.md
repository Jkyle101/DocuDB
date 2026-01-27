# DocuDB User Guide

## Overview

DocuDB is a comprehensive document management system designed for educational institutions. It provides secure file sharing, version control, group collaboration, and administrative features. This guide covers both user and administrator functionalities.

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Guide](#user-guide)
   - [Login and Registration](#login-and-registration)
   - [Home/Dashboard](#home-dashboard)
   - [File Management](#file-management)
   - [Group Collaboration](#group-collaboration)
   - [Settings](#settings)
   - [Notifications](#notifications)
3. [Administrator Guide](#administrator-guide)
   - [Admin Dashboard](#admin-dashboard)
   - [User Management](#user-management)
   - [Group Management](#group-management)
   - [System Monitoring](#system-monitoring)
4. [Advanced Features](#advanced-features)
5. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites
- A valid email address and password
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

### Default Admin Credentials
- **Email:** admin@school.edu
- **Password:** admin123
- **Note:** Change these credentials immediately after first login!

---

## User Guide

### Login and Registration

#### Logging In
1. Navigate to the DocuDB login page
2. Enter your email address
3. Enter your password
4. Click "Login" or press Enter
5. If successful, you'll be redirected to your dashboard

#### Password Recovery
1. On the login page, click "Forgot Password?"
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email for password reset instructions
5. Follow the link to create a new password

#### Registration
1. Click "Register" on the login page
2. Fill in your details:
   - Full name
   - Email address
   - Password (must be at least 8 characters)
3. Click "Register"
4. Check your email for verification link
5. Click the verification link to activate your account

### Home/Dashboard

The home dashboard is your main workspace where you can:
- View your files and folders
- Upload new files
- Create folders
- Navigate through your file structure
- Search for files
- Switch between grid and list view

#### Navigation
- **Breadcrumbs:** Shows your current location in the folder hierarchy
- **Back button:** Go up one level in the folder structure
- **Search bar:** Search files by name or content (for text files)

#### File Actions
Right-click on any file or folder to access the context menu with options:
- **Open:** Navigate into folders
- **Preview:** View files in browser
- **Download:** Download files to your device
- **Share:** Share files with other users
- **Move:** Move files to different folders
- **Rename:** Change file/folder names
- **Delete:** Move files to trash
- **Version History:** View file version history
- **Comments:** Add/view comments on files

### File Management

#### Uploading Files
1. Click the "Upload" button in the top right
2. Select files from your device (drag and drop supported)
3. Choose the destination folder (optional)
4. Click "Upload" to complete

**Supported file types:** All common document formats including PDF, Word, Excel, images, etc.

#### Creating Folders
1. Click "New Folder" button
2. Enter folder name
3. Choose location (current folder by default)
4. Click "Create"

#### Sharing Files and Folders
1. Right-click on file/folder and select "Share"
2. Enter email addresses of users to share with
3. Set permission level (View or Edit)
4. Add optional message
5. Click "Share"

#### Managing Shares
1. Right-click on shared item and select "Manage Shares"
2. View current shares
3. Change permissions or remove shares
4. Click "Save Changes"

#### Moving Files
1. Right-click and select "Move"
2. Navigate to destination folder
3. Click "Move Here"

#### Version Control
DocuDB automatically tracks file versions:
1. Right-click file and select "Version History"
2. View all versions with timestamps
3. Download specific versions
4. Restore previous versions if needed

#### Comments and Collaboration
1. Right-click file and select "Comments"
2. Add comments to files
3. Reply to existing comments
4. @mention other users for notifications

### Group Collaboration

#### Creating Groups
1. Go to "My Groups" in the sidebar
2. Click "Create Group"
3. Enter group name and description
4. Click "Create"

#### Managing Group Members
1. In group details, click "Manage Members"
2. Add users by email
3. Assign roles (Member or Leader)
4. Remove members if needed

#### Sharing Content with Groups
1. In group details, click "Share Content"
2. Select files/folders to share
3. Set permission level
4. Click "Share"

#### Group Activities
- **Notifications:** Receive alerts for group activities
- **Announcements:** Leaders can post announcements
- **Shared Content:** Access all content shared with the group

### Settings

#### Profile Settings
1. Go to "Settings" in the sidebar
2. Update your profile information:
   - Full name
   - Profile picture
   - Contact information

#### Password Change
1. In Settings, go to "Security" tab
2. Click "Change Password"
3. Enter current password
4. Enter new password (twice for confirmation)
5. Click "Update Password"

**Note:** Password changes require admin approval for security.

#### Preferences
- **Theme:** Light/dark mode toggle
- **Notifications:** Configure notification preferences
- **Language:** Select interface language
- **File View:** Default view (grid/list)

### Notifications

#### Viewing Notifications
1. Click the bell icon in the navbar
2. View unread notifications
3. Click on notifications to navigate to relevant content

#### Notification Types
- File shares
- Group activities
- Comments and mentions
- System announcements
- Password change approvals

#### Managing Notifications
- Mark individual notifications as read
- Mark all as read
- Configure notification preferences in Settings

---

## Administrator Guide

### Admin Dashboard

The admin dashboard provides system overview and management tools.

#### Overview Metrics
- Total users and active users
- File storage statistics
- Recent registrations
- System activity logs

#### Quick Actions
- Add new users
- View system logs
- Manage groups
- Monitor trash

### User Management

#### Viewing Users
1. Go to "Manage Users" in admin sidebar
2. View user list with details:
   - Name, email, role
   - Account status (active/inactive)
   - Registration date

#### Adding Users
**Single User:**
1. Click "Add User" → "Add Single User"
2. Fill in user details (email, password, name, role)
3. Click "Add User"

**Bulk Import:**
1. Click "Add User" → "Bulk Import Users"
2. Upload CSV, JSON, or Excel file
3. Required columns: email, password
4. Optional: name
5. Click "Import"

#### Managing User Roles
1. In user list, click on role dropdown
2. Select new role (User or Admin)
3. Confirm change

#### Account Status
- **Activate/Deactivate:** Toggle user account status
- **Password Requests:** Approve or reject password change requests

### Group Management

#### Creating Groups
1. Go to "Manage Groups"
2. Click "Create Group"
3. Enter name and description
4. Click "Create"

#### Managing Group Members
1. Select group from list
2. Click "Manage Members"
3. Add users by email
4. Assign roles (Member/Leader)
5. Set permissions

#### Group Content Management
1. In group details, view shared content
2. Share additional files/folders
3. Manage sharing permissions
4. Remove content from group

#### Group Administration
- Delete groups
- View group activity
- Manage group settings

### System Monitoring

#### System Logs
1. Go to "System Logs"
2. View comprehensive activity logs
3. Filter by date, user, action type
4. Export logs if needed

#### Analytics
- User registration trends
- File upload statistics
- Storage usage by user/group
- System performance metrics

#### Trash Management
1. Go to "Trash" in admin panel
2. View deleted files and folders
3. Restore items to original locations
4. Permanently delete items

---

## Advanced Features

### Search and Filters
- **Global Search:** Search across all your files and folders
- **Content Search:** Search within text-based files (PDF, Word, etc.)
- **Advanced Filters:** Filter by file type, date, size, owner

### File Preview
- **Supported Formats:** PDF, images, text files, Office documents
- **Full-screen View:** Expand preview to full screen
- **Download from Preview:** Download files directly from preview

### Bulk Operations
- **Bulk Delete:** Select multiple items and delete
- **Bulk Move:** Move multiple files at once
- **Bulk Share:** Share multiple items with users/groups

### Keyboard Shortcuts
- **Ctrl+F:** Focus search bar
- **Enter:** Open selected folder/file
- **Delete:** Move to trash
- **Ctrl+A:** Select all items

### Mobile Access
- Responsive design works on tablets and phones
- Upload photos directly from mobile camera
- Touch-friendly interface

---

## Troubleshooting

### Common Issues

#### Can't Login
- Check email and password are correct
- Ensure account is activated (check email for verification link)
- Contact administrator if account is deactivated

#### Upload Failed
- Check file size limits (default: 100MB per file)
- Verify supported file formats
- Check internet connection
- Clear browser cache

#### File Not Found
- Check if file was moved or deleted
- Verify sharing permissions
- Contact file owner if shared file is missing

#### Slow Performance
- Clear browser cache and cookies
- Check internet connection speed
- Try different browser
- Contact administrator for server issues

#### Permission Errors
- Verify you have appropriate permissions
- Check if file is shared with you
- Contact file/folder owner for access

### Getting Help

#### In-App Help
- Click "Help" in the sidebar for FAQs and tutorials

#### Contact Support
- Use feedback form in Help section
- Contact system administrator
- Check system announcements for updates

#### System Requirements
- **Browser:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **JavaScript:** Must be enabled
- **Cookies:** Must be enabled for authentication
- **Storage:** Local storage for preferences

---

## Security Best Practices

### Password Security
- Use strong passwords (8+ characters, mixed case, numbers, symbols)
- Change default passwords immediately
- Enable two-factor authentication if available
- Don't share passwords

### File Sharing
- Only share with trusted users
- Use appropriate permission levels
- Regularly review shared content
- Remove shares when no longer needed

### Account Management
- Log out when using shared computers
- Report suspicious activity immediately
- Keep contact information updated

---

## API Documentation

For developers integrating with DocuDB:

### Authentication Endpoints
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`

### File Management
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload files
- `GET /api/files/:id` - Get file details
- `PUT /api/files/:id` - Update file
- `DELETE /api/files/:id` - Delete file

### User Management (Admin)
- `GET /api/users` - List users
- `PUT /api/users/:id/role` - Update role
- `PUT /api/users/:id/status` - Toggle status

Complete API documentation available in backend code or via Postman collection.

---

**Last Updated:** January 2026
**Version:** 1.0
**Contact:** system@school.edu

Happy documenting with DocuDB! 📚✨