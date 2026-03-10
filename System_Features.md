# DocuDB System Features

## Overview

DocuDB is a web-based document management and COPC workflow system designed for educational institutions. It combines a Google Drive-like document workspace with a structured accreditation document workflow for faculty, department chairs, QA administrators, evaluators, and superadmins.

## 1. Core System Features

### 1.1 Secure User Login

- Email and password-based login
- Role-based access control
- Restricted page access based on assigned role
- Account activation and status checking

### 1.2 Role-Based User Access

The system supports the following roles:

- `faculty`
- `dept_chair`
- `qa_admin`
- `evaluator`
- `superadmin`

Each role sees only the pages and actions relevant to its responsibilities.

### 1.3 Responsive Web Interface

- Browser-based access
- Responsive layout for desktop and mobile screens
- Sidebar navigation for user and admin workspaces
- Fast client-side navigation using React Router

## 2. Document Management Features

### 2.1 File Upload and Storage

- Upload files to the system
- Drag-and-drop upload support
- Camera/image upload support
- Upload files into specific folders
- Store uploaded files in local server storage

### 2.2 Folder Management

- Create folders
- Rename folders
- Move folders
- Build hierarchical folder structures
- Navigate folders using breadcrumbs

### 2.3 File Operations

- Preview files
- Download files
- Rename files
- Move files between folders
- View file details
- Access files based on permission rules

### 2.4 Favorites and Pinning

- Mark files as favorites
- Pin important files
- Quickly identify priority documents

### 2.5 File Version Control

- Track file versions
- View version history
- Restore previous versions
- Track folder version history
- Restore previous folder states

### 2.6 Trash and Recovery

- Soft delete files and folders
- Restore deleted items from trash
- Permanently delete trashed items
- Admin-side trash management

## 3. Search and Navigation Features

### 3.1 Search

- Search files and folders by name
- Search document contents for supported file types
- Use advanced search on the admin side
- Retrieve recent search context through the interface

### 3.2 Navigation

- My Drive workspace
- Shared with Me page
- Recent files page
- Breadcrumb navigation
- Role-specific dashboard pages

### 3.3 Personalized Dashboard

- Personalized dashboard data
- Recent and shared content overview
- Review and task-related visibility

## 4. Collaboration Features

### 4.1 User-to-User Sharing

- Share files with other users
- Share folders with other users
- Assign viewer or editor permissions
- Manage and revoke sharing access

### 4.2 Group Collaboration

- Create groups
- Add and remove group members
- Assign group leaders
- Share files and folders to groups
- View group-shared content

### 4.3 Comments and Discussion

- Add comments to files and folders
- Reply to comments
- Edit comments
- Delete comments

### 4.4 Notifications

- In-app notifications
- Notification read/unread tracking
- Mark individual notifications as read
- Mark all notifications as read
- Smart notification generation based on activity

### 4.5 Email Notifications

- Send email notifications for selected system events
- Notify users about sharing and workflow actions
- Notify users about password request decisions

## 5. Smart Document Features

### 5.1 Smart Forms

- Create reusable form templates
- Define dynamic input fields
- Generate documents from templates
- Store generated files in destination folders

### 5.2 Document Editor

- Open editable document content
- Save document content updates
- Track edits through versioning

### 5.3 Automatic Report Generation

- Generate reports automatically
- Produce output documents from system data

### 5.4 Classification and Duplicate Detection

- Predict document destination
- Reclassify files
- Bulk reclassify files
- Detect duplicate files using content hash

## 6. COPC Document System Features

### 6.1 COPC Program Initialization

- Initialize COPC program folders
- Set program code, program name, department name, and year
- Create program-root document structures

### 6.2 COPC Role Assignment

- Assign uploaders
- Assign department chairs
- Assign QA administrators
- Assign evaluators

### 6.3 COPC Upload Workspace

- Upload program requirements into COPC folders
- Track upload status by program
- Organize evidence per requirement

### 6.4 Department Review Workflow

- View department chair submission lists
- Review faculty submissions
- Approve or reject documents
- Add review remarks

### 6.5 QA Compliance Review

- View QA submission lists
- Verify compliance evidence
- Tag document categories
- Approve or reject files
- Add QA observations

### 6.6 Evaluation Stage

- View approved document tree
- Access compiled COPC package
- Download evaluation reports
- Support evaluator review process

### 6.7 COPC Package Management

- Compile COPC package
- Download package as ZIP
- Finalize COPC-ready status
- Lock approved documents
- Submit program package
- Archive completed programs

### 6.8 Completeness and Compliance Tracking

- Folder task checklists
- Compliance dashboard
- Completeness checking for required documents
- Folder review records

### 6.9 Document Requests

- Request required documents from faculty
- Track document request status

## 7. Administrative Features

### 7.1 User Management

- View all users
- Create users individually
- Create users in bulk
- Update user information
- Change user roles
- Activate or deactivate accounts
- Delete users

### 7.2 Group Administration

- Manage all system groups
- Update group details
- Remove groups
- Control group memberships and leaders

### 7.3 Task and Assignment Management

- Create folder tasks
- Update folder tasks
- Delete folder tasks
- Check task completion
- Assign uploaders and reviewers to folders

### 7.4 Logs and Monitoring

- View system logs
- Monitor activity history
- Track user actions
- Access system usage statistics

### 7.5 Admin Search and Oversight

- Search files, folders, users, groups, and logs
- Review shared and owned resources
- Monitor administrative workspaces

### 7.6 Password Request Review

- View password change requests
- Approve requests
- Reject requests
- Notify users of the result

## 8. Profile and Settings Features

### 8.1 User Settings

- View account profile information
- Upload profile picture
- Manage display preferences

### 8.2 Password Change Requests

- Submit password change request
- Wait for admin approval workflow

### 8.3 Help and Support Page

- Access help information
- Submit feedback or support details through the help interface

## 9. Technical and Security Features

### 9.1 Backend and API

- REST-based backend using Express
- Modular endpoint structure for file, folder, group, COPC, and admin operations

### 9.2 Database Support

- MongoDB document database
- Mongoose schema modeling
- Embedded workflow and metadata structures

### 9.3 File Handling

- Secure file serving through backend routes
- Storage of file metadata and references
- Upload middleware support through Multer

### 9.4 Security Controls

- Role-based access restrictions
- Controlled resource access checks
- Account status enforcement
- Audit and log tracking

### 9.5 Deployment Support

- Local deployment support
- PM2 process management support
- Docker-ready deployment structure
- Nginx-compatible production serving

## Summary

DocuDB provides an integrated platform for:

- document storage and organization
- sharing and collaboration
- version control and recovery
- smart document generation
- COPC accreditation workflow management
- role-based review and evaluation
- administrative oversight and analytics

The system supports both everyday institutional document handling and structured compliance-driven document workflows in a single platform.
