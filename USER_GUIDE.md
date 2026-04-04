# DocuDB User Guide (Step-by-Step)

This guide follows the process flow from your reference file: `User Guide.docx`.

## 1. Introduction

DocuDB is a document management and COPC workflow system for educational institutions. It helps users upload, organize, review, and share documents through role-based access.

This manual covers:

- Member/User side processes
- Organization Admin side processes
- Advanced features
- Troubleshooting and security practices

## 2. Accessing the System

### 2.1 System Requirements

- Browser: Chrome, Firefox, Safari, or Edge
- Internet connection
- Valid DocuDB account

### 2.2 Open DocuDB

1. Open your web browser.
2. Enter the system URL.
3. Use `http://localhost:5173` for local setup, or your deployment URL.

### 2.3 Sign In

1. Go to the login page.
2. Enter your institutional email.
3. Enter your password.
4. Click `Sign in`.
5. Wait for redirect to your dashboard.

### 2.4 Create Account (If enabled)

1. On login page, click `Create account`.
2. Enter your name, email, and password.
3. Request a verification code.
4. Enter the code.
5. Complete registration.

### 2.5 Forgot Password

1. On login page, click `Forgot password?`.
2. Enter your account email.
3. Submit request.
4. Check your email for reset code.
5. Enter code and set a new password.

## 3. Member/User Side Guide

### 3.1 Home Dashboard Navigation

Use the main navigation areas listed in your reference guide:

- `My Drive`
- `Shared with me`
- `Recent`
- `Groups`
- `Trash` (if available for your role/build)
- `Search`
- `Back`
- `Grid/List view`
- `COPC Dashboard`
- `Notifications`
- `Settings`
- `Help`
- `Log out`

Step-by-step:

1. Open `My Drive` to view your own files and folders.
2. Open `Shared with me` to view content shared by other users.
3. Open `Recent` to quickly access recently touched files.
4. Open `Groups` to access collaboration groups.
5. Open `Trash` if your role has trash access.
6. Use the search bar to find files by name or indexed text content.
7. Use the back/breadcrumb controls to go up one folder level.
8. Switch between `Grid` and `List` view as needed.
9. Open `COPC Dashboard`, `Notifications`, `Settings`, and `Help` when needed.
10. Use logout when you finish your session.

### 3.2 File Management

#### 3.2.1 Uploading Files

1. Open the target folder in `My Drive`.
2. Click `Upload`.
3. Select one or more files.
4. Confirm upload.
5. Wait for upload completion and status updates.

Alternative drag-and-drop process:

1. Open target folder.
2. Drag files from your desktop into the page.
3. Drop files in workspace or specific folder card.
4. Wait for upload confirmation.

#### 3.2.2 Creating Folders

1. Go to the destination location.
2. Click `New Folder`.
3. Enter folder name.
4. Click `Create`.

#### 3.2.3 Opening and Previewing Files

1. Locate the file.
2. Click `Preview` to open in-browser preview.
3. Use full view tools if needed.
4. Close preview to return.

#### 3.2.4 Downloading Files

1. Locate the file.
2. Click `Download`.
3. Wait for browser download to finish.

#### 3.2.5 File/Folder Context Actions

1. Right-click the item or click its action menu.
2. Choose one action from the list below.
- `Open`
- `Preview`
- `Download`
- `Share`
- `Move`
- `Rename`
- `Delete`
- `Version History`
- `Comments`
3. Complete the selected action in modal/dialog.

#### 3.2.6 Moving Files/Folders

1. Right-click file or folder.
2. Click `Move`.
3. Select destination folder.
4. Confirm move.
5. Verify item appears in destination.

#### 3.2.7 Renaming Files/Folders

1. Right-click file or folder.
2. Click `Rename`.
3. Enter new name.
4. Save changes.

#### 3.2.8 Deleting Files/Folders

1. Right-click file or folder.
2. Click `Delete`.
3. Confirm delete action.
4. Item is moved to trash (role/feature dependent).

#### 3.2.9 Version Control

1. Right-click a file.
2. Select `Version History`.
3. Review list of versions with timestamps.
4. Open needed version.
5. Restore previous version if required.

#### 3.2.10 Favorites and Pinning (Current Build)

1. Open file actions.
2. Click star icon to add/remove favorite.
3. Click pin icon to pin/unpin important files.
4. Use `Favorites` or `Pinned` filter buttons to view only tagged files.

### 3.3 Sharing Files and Folders

#### 3.3.1 Share with Users

1. Right-click target file/folder.
2. Click `Share`.
3. Enter user email(s).
4. Select permission level (`View` or `Edit`).
5. Confirm share.

#### 3.3.2 Manage Shares

1. Right-click shared item.
2. Click `Manage Shares`.
3. Review active users/groups.
4. Update permissions if needed.
5. Remove share entries that are no longer needed.
6. Close the dialog.

#### 3.3.3 Comments and Collaboration

1. Right-click file.
2. Click `Comments`.
3. Type comment.
4. Submit comment.
5. Reply to existing comments as needed.

### 3.4 Group Collaboration

#### 3.4.1 View Your Groups

1. Open `Groups`.
2. Review your group list.
3. Click `View Details` on a group.

#### 3.4.2 Share Content with Groups

1. Open group details.
2. Open shared content area.
3. Click share action.
4. Select file/folder.
5. Set permission level.
6. Confirm sharing.

#### 3.4.3 Review Group Activities

1. Open group details.
2. Check member list.
3. Check notifications.
4. Check announcements.
5. Open shared files/folders from the shared tab.

### 3.5 Settings

#### 3.5.1 Profile Settings

1. Open `Settings`.
2. Go to `Profile` tab.
3. Update name and department.
4. Click save/update.

#### 3.5.2 Profile Picture

1. Open `Settings`.
2. Choose profile picture upload option.
3. Select image file.
4. Save profile.

#### 3.5.3 Password Change

Reference process in your file is security-based password change. Current build uses reset-code flow:

1. Open `Settings`.
2. Go to password/security section.
3. Request OTP/reset code.
4. Enter reset code.
5. Enter new password and confirm.
6. Submit password update.

#### 3.5.4 Preferences

1. Open `Settings`.
2. Go to preferences.
3. Set theme and notification preferences.
4. Save changes.

### 3.6 Notifications

#### 3.6.1 View Notifications

1. Open `Notifications` page or bell icon.
2. Review unread notifications first.
3. Click an item to open the related page.

#### 3.6.2 Notification Types

You may receive:

- File shares
- Group updates
- Comments and mentions
- COPC workflow actions
- Password-related notices
- System announcements

#### 3.6.3 Manage Notifications

1. Open `Notifications`.
2. Use filter tabs (`All`, `Unread`, and type filters).
3. Click one notification to mark as read.
4. Click `Mark all as read` when needed.

### 3.7 Smart Forms (Current Build)

1. Open `Smart Forms`.
2. Select or create a template.
3. Fill required fields.
4. Generate/save the output document.
5. Verify the generated file in destination folder.

### 3.8 Shared with Me (Detailed Flow)

1. Open `Shared with me`.
2. Locate file/folder from another user.
3. Open the item.
4. Use allowed actions based on permission (`viewer` or `editor`).
5. If edit is blocked, request `Edit` permission from owner.

### 3.9 Recent (Detailed Flow)

1. Open `Recent`.
2. Sort or scan by latest activity.
3. Click item to open.
4. Continue with preview/download/share actions as needed.

### 3.10 Help (Detailed Flow)

1. Open `Help`.
2. Read FAQ/tutorial content.
3. Open feedback form.
4. Submit issue details and contact information.

## 4. COPC Workflow (Step-by-Step)

### 4.1 Open COPC Dashboard

1. Click `COPC Dashboard` from sidebar.
2. Review available tabs based on your role.
3. Select the COPC program if prompted.

### 4.2 COPC Upload Stage

1. Open `COPC Upload` tab.
2. Select program.
3. Select target COPC folder.
4. Upload required evidence files.
5. Check status labels (pending, approved, needs revision).
6. Re-upload corrected files if rejected.

### 4.3 Department Review Stage (`dept_chair`)

1. Open `Department Review` tab.
2. Select COPC program.
3. Review each submission.
4. Add review notes.
5. Approve compliant submissions.
6. Reject incomplete/non-compliant submissions with remarks.

### 4.4 QA Compliance Review (`qa_admin`)

1. Open `QA Compliance Review` tab.
2. Select COPC program.
3. Review department-approved submissions.
4. Verify compliance evidence.
5. Add QA observations.
6. Approve or reject with notes.

### 4.5 Evaluation Stage (`evaluator`)

1. Open `Evaluation Stage` tab.
2. Select program.
3. Review approved document tree and workflow summary.
4. Download package/reports as needed.
5. Complete evaluator observations according to process.

### 4.6 Submissions Tracking

1. Open submissions/status view from COPC tabs.
2. Filter by status/program.
3. Search by file/folder/uploader.
4. Review department and QA notes per file.

### 4.7 Tasks Assigned to Me

1. Open `Tasks Assigned to Me`.
2. Review assigned deliverables.
3. Open related folder/file.
4. Complete requirement.
5. Confirm task status update.

### 4.8 COPC Upload Activity (Dept Chair/QA/Superadmin)

1. Open `COPC Upload Activity` or `Recent COPC Uploads`.
2. Filter by program/date if needed.
3. Review who uploaded, what was uploaded, and when.
4. Open related COPC folder from activity entry for follow-up review.

## 5. Organization Admin Side Guide

### 5.1 Admin Access

1. Sign in with admin/superadmin account.
2. Open admin workspace.
3. Use admin sidebar:
- `Manage Users`
- `Groups`
- `COPC Dashboard`
- `Archived COPC`
- `Recent COPC Uploads`
- `Admin Files` (View Files/Folders)
- `Trash Management`
- `System Logs`

### 5.2 User Management

#### 5.2.1 View Users

1. Open `Manage Users`.
2. Review user rows with name, email, role, status, and registration date.
3. Use search/filter tools for role and status.

#### 5.2.2 Add Single User

1. Open `Manage Users`.
2. Click `Add User`.
3. Enter email, password, name, department, and role.
4. Submit.
5. Confirm user appears in list.

#### 5.2.3 Bulk Import Users

1. Open `Manage Users`.
2. Click bulk import option.
3. Upload `CSV`, `JSON`, or `Excel` file.
4. Include required columns (`email`, `password`).
5. Include optional fields (`name`, `department`, `role`).
6. Run import.
7. Review success/failure result summary.

#### 5.2.4 Manage User Roles

1. Open `Manage Users`.
2. Locate target user.
3. Change role from role dropdown.
4. Confirm role update.

#### 5.2.5 Account Status

1. Open `Manage Users`.
2. Locate target user.
3. Click deactivate/activate action.
4. Confirm status change.

#### 5.2.6 Password Change Requests

1. Open `Manage Users` and notifications area.
2. Locate user password-related requests.
3. Review request details.
4. Approve or reject based on policy.

### 5.3 Group Management

#### 5.3.1 Create Group

1. Open admin `Groups`.
2. Click `Create Group`.
3. Enter group name and description.
4. Submit.

#### 5.3.2 Edit Group

1. Open admin `Groups`.
2. Select group.
3. Click edit action.
4. Update name/description.
5. Save.

#### 5.3.3 Manage Members

1. Open group details.
2. Open members management.
3. Add users to group.
4. Remove users if needed.
5. Confirm member list updates.

#### 5.3.4 Assign/Remove Group Leader

1. Open group members.
2. Use leader toggle action on a member.
3. Confirm role badge updates.

#### 5.3.5 Share Content to Group

1. Open selected group.
2. Open `Share` action.
3. Select files/folders.
4. Set permission.
5. Submit share.

#### 5.3.6 Group Notifications and Announcements

1. Open group details.
2. Add notification with title/message.
3. Add announcement with title/content.
4. Verify entries appear in group activity.

### 5.4 Admin Files / Folder Oversight

1. Open `Admin Files`.
2. Browse folders/files in admin scope.
3. Review ownership and structure.
4. Perform allowed management actions.

### 5.5 Trash Management

#### 5.5.1 View Trash

1. Open `Trash Management`.
2. Review deleted files and folders.
3. Use search and view mode tools.

#### 5.5.2 Restore Item

1. Locate deleted item.
2. Click `Restore`.
3. Verify item returns to original location.

#### 5.5.3 Permanently Delete Item

1. Locate deleted item.
2. Click `Delete Permanently`.
3. Confirm permanent deletion.

#### 5.5.4 Bulk Restore / Bulk Delete

1. Select multiple trash items.
2. Click `Bulk Restore` or `Bulk Delete`.
3. Confirm action.
4. Review completion message.

### 5.6 System Monitoring

#### 5.6.1 Open System Logs

1. Open `System Logs`.
2. Review dashboard tabs (`Overview`, `Users`, `Storage`, `Activity Logs`).
3. Monitor key metrics and charts.

#### 5.6.2 Filter Activity Logs

1. Open activity logs tab.
2. Filter by action type.
3. Filter by user.
4. Use search for keywords in details.

#### 5.6.3 Analytics Review

Use metrics listed in your reference process:

- User trends
- Upload activity
- Storage usage
- System activity/performance indicators

### 5.7 COPC Admin Program Management (Superadmin)

1. Open `COPC Dashboard` in admin context.
2. Use `Workflow`, `Task Management`, and `Program Management` tabs.
3. In program management, use actions below.
- Edit program details
- Lock/Unlock program
- Archive program
- Delete program
4. Open archived programs from `Archived COPC` page.

### 5.8 Archived COPC and Recent COPC Uploads

1. Open `Archived COPC` to review archived program packages.
2. Use search/filter to locate a specific program/year.
3. Open `Recent COPC Uploads` to track latest submission events.
4. Use activity records to trigger review, QA, or follow-up actions.

## 6. Advanced Features

These are based on the advanced feature section of your reference file and current build behavior.

### 6.1 Search and Filters

1. Use global search in top navigation.
2. Enter filename, folder name, user, or keyword.
3. Apply advanced filters when available.
4. Sort by relevance/date as needed.

### 6.2 File Preview

1. Click `Preview` on a file.
2. Inspect content in preview window.
3. Use full-screen mode if available.
4. Download directly from preview if needed.

### 6.3 Bulk Operations

1. Select multiple files/folders (where supported).
2. Choose bulk action (`Delete`, `Move`, `Share`, or trash bulk actions).
3. Confirm operation.
4. Verify results in destination/status view.

### 6.4 Mobile Access

1. Open DocuDB on phone/tablet browser.
2. Sign in.
3. Use touch navigation for files and folders.
4. Upload camera photos/files as needed.

## 7. Troubleshooting

### 7.1 Cannot Login

1. Confirm email and password.
2. Check if account is active.
3. Use forgot password flow.
4. Contact admin if access is still blocked.

### 7.2 Upload Failed

1. Check internet connection.
2. Retry with smaller file.
3. Confirm file type is supported.
4. Refresh page and upload again.
5. Clear browser cache if issue persists.

### 7.3 File Not Found

1. Search file by name.
2. Check `Recent` and `Shared with me`.
3. Check if moved to another folder.
4. Ask owner/admin to verify permissions.

### 7.4 Slow Performance

1. Refresh the page.
2. Clear browser cache/cookies.
3. Test another browser.
4. Check connection speed.
5. Contact admin for server-side checks.

### 7.5 Permission Errors

1. Confirm your role.
2. Confirm sharing permission (`viewer` vs `editor`).
3. Request proper access from owner/admin.

## 8. Security Best Practices

### 8.1 Password Security

1. Use strong passwords (8+ characters).
2. Mix uppercase, lowercase, number, and symbol.
3. Never share credentials.
4. Change compromised passwords immediately.

### 8.2 File Sharing Safety

1. Share only with trusted users/groups.
2. Use minimum required permission.
3. Review shared items regularly.
4. Remove unnecessary shares.

### 8.3 Account Safety

1. Log out on shared computers.
2. Keep contact/profile details updated.
3. Report suspicious activity immediately.

## 9. System Requirements Reference

- Browser: modern Chrome, Firefox, Safari, Edge
- JavaScript: enabled
- Cookies: enabled
- Local storage: enabled for user preferences

## 10. Support

1. Open `Help` page in the app.
2. Submit feedback with screenshots and exact error text.
3. Contact your system administrator for urgent access issues.
4. Check system notifications for maintenance/update advisories.

---

Happy documenting with DocuDB.
