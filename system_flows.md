# DocuDB System Flows

This document outlines the complete user journey and administrative workflows for the DocuDB document management system.

## User Side Flow

### Authentication Flow
1. User accesses login page (`/login`)
2. User enters email and password
3. System validates credentials against database
4. If valid and user is active:
   - System logs login action
   - User is redirected to home page (`/`)
   - User data (userId, role) stored in localStorage
5. If invalid or inactive:
   - Error message displayed
   - User remains on login page

### Main File Management Flow (Home Page)
1. User views home page (`/`)
2. System fetches user's files and folders from current folder (default: root)
3. User can:
   - **Navigate folders**: Click folder to enter, use breadcrumbs to go back
   - **View modes**: Toggle between grid and list view
   - **Sort**: Sort by date/name (asc/desc)
   - **Create folder**: Click "New Folder" → modal → create folder → refresh view
   - **Upload files**: Click "Upload" → modal → select files → upload → refresh view
   - **Search**: Enter query → system searches file names and content (text files only) → display results

### File Operations Flow
For each file/folder, user can perform actions:

#### View/Preview Flow
1. Click eye icon or double-click file
2. System checks permissions (owner or shared with read/write access)
3. If permitted: Open file in browser (inline for supported types)
4. If not permitted: Show error message

#### Download Flow
1. Click download icon
2. System checks permissions (owner or shared with write access)
3. If permitted: Download file to user's device
4. If not permitted: Show error message

#### Share Flow
1. Click share icon → share modal
2. Enter email addresses and select permission (read/write)
3. System finds users by email
4. Add users to file's sharedWith array
5. Log share action
6. Refresh file data

#### Move Flow
1. Click move icon → move modal
2. Select destination folder
3. Update file's parentFolder
4. Create new file version with move description
5. Log move action
6. Refresh view

#### Rename Flow
1. Right-click → Rename or use list view rename button
2. Enter new name
3. Update file/folder name
4. Create new version with rename description
5. Log rename action
6. Refresh display

#### Delete Flow (Soft Delete)
1. Click trash icon → confirm dialog
2. Set deletedAt timestamp (soft delete)
3. Move to trash
4. Log delete action
5. Remove from current view

#### Version History Flow
1. Click history icon
2. Fetch all versions of file/folder
3. Display version list with changes
4. User can restore to previous version

#### Comments Flow
1. Click comments icon
2. View existing comments
3. Add new comments
4. System saves comments to database

### Groups Flow
1. User accesses groups page (`/groups`)
2. System fetches groups where user is a member
3. For each group, user can:
   - View group details (members, notifications, announcements)
   - View shared files/folders in group
   - Share new files/folders to group (if leader or creator)

#### Group Sharing Flow
1. In group details → Shared tab → Share New
2. Select files/folders from user's items
3. Choose permission (read/write)
4. Add to group's sharedFiles/sharedFolders
5. Log group share action

### Shared Files Flow
1. User accesses shared page (`/shared`)
2. System fetches files/folders shared with user
3. Display in folder structure
4. User can navigate and perform file operations (limited by permissions)

### Recent Files Flow
1. User accesses recent page (`/recent`)
2. System fetches all user's files (no folder filter)
3. Sort by upload date descending
4. Display recent files

### Trash Management Flow
1. User accesses trash page (`/trash`)
2. System fetches soft-deleted files/folders
3. User can:
   - **Restore**: Remove deletedAt timestamp → move back to original location
   - **Permanent Delete**: Remove from database entirely

## Admin Side Flow

### Admin Authentication
1. Admin logs in with admin/superadmin role
2. Same authentication flow as users
3. Redirected to admin home (`/admin`)

### Admin File Management Flow
1. Admin accesses admin home (`/admin`)
2. System fetches ALL files/folders (no user filter)
3. Same interface as user home but shows owner information
4. Admin can view/download any file (no permission checks)
5. Admin can delete any file/folder permanently

### User Management Flow (`/admin/manageusers`)
1. Admin views user management dashboard
2. System fetches all users with statistics
3. Admin can:
   - **View Overview**: User counts, role distribution, recent registrations
   - **Search/Filter**: By name/email, role, status
   - **Change Role**: user ↔ admin (superadmin can change any role)
   - **Activate/Deactivate**: Toggle user active status
   - **View Statistics**: Charts and metrics

#### User Role Change Flow
1. Select role dropdown for user
2. Confirm change
3. Update user role in database
4. Log role change action

#### User Status Toggle Flow
1. Click Activate/Deactivate button
2. Confirm action
3. Update user active status
4. Log status change

### Group Management Flow (`/admin/groups`)
1. Admin views group management dashboard
2. System fetches all groups with statistics
3. Admin can:
   - **View Overview**: Group counts, member counts, activity metrics
   - **Create Groups**: Name, description → create group
   - **Edit Groups**: Update name/description
   - **Delete Groups**: Remove group entirely
   - **Manage Members**: Add/remove users, promote/demote leaders
   - **Share Content**: Share files/folders to groups
   - **Send Notifications**: Add notifications to groups
   - **Post Announcements**: Add announcements to groups
   - **View Activity History**: Timeline of group activities

#### Group Creation Flow
1. Click "Create Group"
2. Enter name and description
3. Create group with admin as creator
4. Log group creation

#### Member Management Flow
1. Select group → Manage Members
2. **Add Members**: Search users → select → add to group
3. **Remove Members**: Remove from group (also removes leadership if applicable)
4. **Toggle Leaders**: Promote/demote members to/from leaders

#### Group Sharing Flow
1. Select group → Share Files/Folders
2. Select items and permissions
3. Add to group's shared content
4. Log share action

#### Group Communications Flow
1. **Notifications**: Add title/message → send to group members
2. **Announcements**: Add title/content → post to group

### System Logs Flow (`/admin/systemlogs`)
1. Admin views system analytics dashboard
2. System fetches logs and statistics
3. Admin can view:
   - **Overview**: Key metrics, charts (uploads, registrations, actions)
   - **Users Tab**: Most active users, top storage users
   - **Storage Tab**: File type breakdown, storage analytics
   - **Activity Logs**: Filtered system activity logs
4. Admin can search/filter logs by action, user, date
5. Can export logs to CSV

### Admin Navigation Flow
- Admin sidebar provides access to all admin functions
- Admin can access user features (with elevated permissions)
- Admin can switch between user and admin contexts

## Common Backend Flows

### Logging Flow
All significant actions trigger logging:
1. Create log entry with user, action, details, timestamp
2. Store in logs collection
3. Used for system analytics and audit trails

### Version Control Flow
For files and folders:
1. On change (upload, move, rename): Create new version record
2. Mark previous versions as not current
3. Store change description and metadata

### Permission Checking Flow
1. For file operations: Check if user is owner or in sharedWith array
2. For downloads: Additional check for write permission
3. For admin operations: Skip permission checks

### Search Flow
1. User enters query
2. Search file names (exact match)
3. For text files: Read content and search within
4. Return matching files

### Group Permissions Flow
1. Group members can view shared content
2. Group leaders can manage group (add members, share content, send communications)
3. Group creators have full control
