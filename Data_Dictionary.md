# DocuDB Data Dictionary

## Overview

This data dictionary describes the main MongoDB collections used by the DocuDB system based on the current Mongoose schemas in [server/models](/c:/Users/HP/Documents/CAPSTONE/docudb/server/models).

## 1. `users`

Stores system user accounts and role information.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the user |
| `email` | String | Yes | User email address used for login |
| `password` | String | Yes | User password value stored in the database |
| `role` | String | Yes | User role: `superadmin`, `qa_admin`, `dept_chair`, `faculty`, `evaluator` |
| `active` | Boolean | No | Indicates whether the account is active |
| `profilePicture` | String | No | Filename of the uploaded profile picture |

## 2. `file`

Stores uploaded document metadata and review information.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the file |
| `filename` | String | Yes | Stored filename in the uploads directory |
| `originalName` | String | Yes | Original uploaded filename |
| `mimetype` | String | Yes | MIME type of the file |
| `size` | Number | Yes | File size in bytes |
| `uploadDate` | Date | No | Date the file was uploaded |
| `lastAccessedAt` | Date | No | Last access timestamp |
| `userId` | String | Yes | Legacy/string identifier used by the frontend |
| `owner` | ObjectId | Yes | Reference to the owning user in `users` |
| `parentFolder` | ObjectId | No | Reference to parent folder in `Folder` |
| `sharedWith` | ObjectId[] | No | List of users with whom the file is shared |
| `permissions` | String | No | Access level such as `viewer`, `editor`, `owner`, `read`, `write` |
| `deletedAt` | Date | No | Soft-delete timestamp |
| `favoritedBy` | String[] | No | List of user identifiers who favorited the file |
| `pinnedBy` | String[] | No | List of user identifiers who pinned the file |
| `contentHash` | String | No | Hash used for duplicate detection |
| `duplicateOf` | ObjectId | No | Reference to canonical file if duplicate |
| `classification` | Embedded Object | No | Classification metadata for category and tags |
| `reviewWorkflow` | Embedded Object | No | Review and verification workflow data |

### `file.classification`

| Field | Type | Required | Description |
|---|---|---:|---|
| `category` | String | No | Assigned category of the document |
| `confidence` | Number | No | Classification confidence score |
| `tags` | String[] | No | Tags assigned to the file |
| `classifiedAt` | Date | No | Classification timestamp |
| `classifierVersion` | String | No | Version of the classifier logic |

### `file.reviewWorkflow`

| Field | Type | Required | Description |
|---|---|---:|---|
| `requiresReview` | Boolean | No | Indicates whether review is required |
| `status` | String | No | Overall review status |
| `assignedProgramChairs` | ObjectId[] | No | Assigned department chairs |
| `assignedQaOfficers` | ObjectId[] | No | Assigned QA officers |
| `programChair` | Embedded Object | No | Department chair review result |
| `qaOfficer` | Embedded Object | No | QA review result |
| `verificationBadge` | Embedded Object | No | Verification label details |

### `file.reviewWorkflow.programChair` and `file.reviewWorkflow.qaOfficer`

| Field | Type | Required | Description |
|---|---|---:|---|
| `status` | String | No | Review status: `pending`, `approved`, `rejected`, `not_required` |
| `reviewedBy` | ObjectId | No | User who completed the review |
| `reviewedAt` | Date | No | Review timestamp |
| `notes` | String | No | Review remarks |

### `file.reviewWorkflow.verificationBadge`

| Field | Type | Required | Description |
|---|---|---:|---|
| `verified` | Boolean | No | Indicates whether the file is verified |
| `verifiedBy` | ObjectId | No | User who verified the file |
| `verifiedAt` | Date | No | Verification timestamp |
| `label` | String | No | Display label for verification state |

## 3. `folder`

Stores folder hierarchy, assignments, compliance tasks, and COPC workflow data.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the folder |
| `name` | String | Yes | Folder name |
| `owner` | ObjectId | Yes | Reference to owning user |
| `parentFolder` | ObjectId | No | Reference to parent folder |
| `isPredefinedRoot` | Boolean | No | Indicates whether the folder is a predefined root |
| `predefinedTemplateKey` | String | No | Template key for predefined structures |
| `sharedWith` | ObjectId[] | No | Users with shared access |
| `permissions` | String | No | Folder permission level |
| `complianceProfileKey` | String | No | Compliance profile identifier |
| `complianceTasks` | Embedded Array | No | List of embedded compliance tasks |
| `folderAssignments` | Embedded Object | No | Assigned uploaders and reviewers |
| `complianceReviews` | Embedded Array | No | Review entries for compliance checks |
| `copc` | Embedded Object | No | COPC program metadata and workflow state |
| `deletedAt` | Date | No | Soft-delete timestamp |
| `createdAt` | Date | No | Folder creation timestamp |

### `folder.complianceTasks`

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique task identifier |
| `title` | String | Yes | Task title |
| `description` | String | No | Task description |
| `percentage` | Number | No | Completion percentage or weight |
| `status` | String | No | Task status: `not_started`, `in_progress`, `complete` |
| `scope` | String | No | Coverage or scope of the task |
| `checks` | String[] | No | Checklist items |
| `assignedUploaders` | ObjectId[] | No | Assigned uploaders |
| `assignedProgramChairs` | ObjectId[] | No | Assigned department chairs |
| `assignedQaOfficers` | ObjectId[] | No | Assigned QA officers |
| `children` | Array | No | Nested child tasks |

### `folder.folderAssignments`

| Field | Type | Required | Description |
|---|---|---:|---|
| `uploaders` | ObjectId[] | No | Users allowed to upload |
| `programChairs` | ObjectId[] | No | Assigned department chairs |
| `qaOfficers` | ObjectId[] | No | Assigned QA officers |
| `evaluators` | ObjectId[] | No | Assigned evaluators |

### `folder.complianceReviews`

| Field | Type | Required | Description |
|---|---|---:|---|
| `reviewer` | ObjectId | Yes | Reviewing user |
| `role` | String | Yes | Reviewer role |
| `scope` | String | No | Scope reviewed |
| `checks` | String[] | No | Checklist items used in review |
| `notes` | String | No | Reviewer notes |
| `createdAt` | Date | No | Review timestamp |

### `folder.copc`

| Field | Type | Required | Description |
|---|---|---:|---|
| `isProgramRoot` | Boolean | No | Indicates COPC root folder |
| `programCode` | String | No | Program code |
| `programName` | String | No | Program name |
| `departmentName` | String | No | Department name |
| `year` | Number | No | Program year |
| `workflowStage` | String | No | Current COPC workflow stage |
| `workflowStatus` | String | No | Current COPC status text |
| `packageMeta` | Embedded Object | No | Generated package metadata |
| `submissionMeta` | Embedded Object | No | Submission metadata |
| `archiveMeta` | Embedded Object | No | Archive metadata |
| `observations` | Embedded Array | No | COPC observations |
| `locked` | Embedded Object | No | Folder lock status |

## 4. `fileversion`

Stores historical versions of files.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the file version |
| `fileId` | ObjectId | Yes | Reference to the source file |
| `versionNumber` | Number | Yes | Version number |
| `originalName` | String | Yes | Original file name at that version |
| `filename` | String | Yes | Stored version filename |
| `mimetype` | String | Yes | File MIME type |
| `size` | Number | Yes | File size |
| `createdBy` | ObjectId | Yes | User who created the version |
| `createdAt` | Date | No | Version creation timestamp |
| `changeDescription` | String | No | Description of changes |
| `isCurrent` | Boolean | No | Indicates whether the version is current |

## 5. `folderversion`

Stores historical versions of folders.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the folder version |
| `folderId` | ObjectId | Yes | Reference to the source folder |
| `versionNumber` | Number | Yes | Version number |
| `name` | String | Yes | Folder name at that version |
| `createdBy` | ObjectId | Yes | User who created the version |
| `createdAt` | Date | No | Version creation timestamp |
| `changeDescription` | String | No | Description of changes |
| `changes` | Mixed | No | Serialized details of folder changes |
| `isCurrent` | Boolean | No | Indicates whether the version is current |

## 6. `comment`

Stores comments and replies for files and folders.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the comment |
| `itemId` | ObjectId | Yes | Referenced file or folder identifier |
| `itemType` | String | Yes | Target type: `file` or `folder` |
| `content` | String | Yes | Comment text |
| `createdBy` | ObjectId | Yes | User who created the comment |
| `createdAt` | Date | No | Comment creation timestamp |
| `parentCommentId` | ObjectId | No | Parent comment reference for replies |
| `replies` | ObjectId[] | No | Child reply identifiers |

## 7. `formtemplate`

Stores reusable document generation templates.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the template |
| `name` | String | Yes | Template name |
| `description` | String | No | Template description |
| `owner` | ObjectId | Yes | User who created the template |
| `fields` | Embedded Array | No | List of dynamic form fields |
| `templateBody` | String | Yes | Template body with placeholders |
| `outputType` | String | No | Output format: `txt`, `docx`, or `pdf` |
| `destinationFolder` | ObjectId | No | Output folder reference |
| `createdAt` | Date | No | Creation timestamp |
| `updatedAt` | Date | No | Last update timestamp |

### `formtemplate.fields`

| Field | Type | Required | Description |
|---|---|---:|---|
| `key` | String | Yes | Internal field key |
| `label` | String | Yes | Display field label |
| `type` | String | No | Input type: `text`, `textarea`, `number`, `date`, `email` |
| `required` | Boolean | No | Indicates whether the field is mandatory |
| `placeholder` | String | No | Input placeholder text |

## 8. `group`

Stores collaboration groups and embedded shared content records.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the group |
| `name` | String | Yes | Group name |
| `description` | String | No | Group description |
| `members` | ObjectId[] | No | Member user references |
| `leaders` | ObjectId[] | No | Group leader references |
| `createdBy` | ObjectId | Yes | User who created the group |
| `createdAt` | Date | No | Group creation timestamp |
| `notifications` | Embedded Array | No | Group notification entries |
| `announcements` | Embedded Array | No | Group announcement entries |
| `sharedFiles` | Embedded Array | No | Files shared to the group |
| `sharedFolders` | Embedded Array | No | Folders shared to the group |

### `group.notifications`

| Field | Type | Required | Description |
|---|---|---:|---|
| `title` | String | Yes | Notification title |
| `message` | String | Yes | Notification message |
| `createdBy` | ObjectId | No | User who created it |
| `createdAt` | Date | No | Creation timestamp |

### `group.announcements`

| Field | Type | Required | Description |
|---|---|---:|---|
| `title` | String | Yes | Announcement title |
| `content` | String | Yes | Announcement content |
| `createdBy` | ObjectId | No | User who posted it |
| `createdAt` | Date | No | Creation timestamp |

### `group.sharedFiles`

| Field | Type | Required | Description |
|---|---|---:|---|
| `fileId` | ObjectId | Yes | Shared file reference |
| `permission` | String | No | Permission granted to the group |
| `sharedBy` | ObjectId | Yes | User who shared the file |
| `sharedAt` | Date | No | Sharing timestamp |

### `group.sharedFolders`

| Field | Type | Required | Description |
|---|---|---:|---|
| `folderId` | ObjectId | Yes | Shared folder reference |
| `permission` | String | No | Permission granted to the group |
| `sharedBy` | ObjectId | Yes | User who shared the folder |
| `sharedAt` | Date | No | Sharing timestamp |

## 9. `log`

Stores general system activity logs.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the log entry |
| `user` | ObjectId | No | User associated with the action |
| `action` | String | No | Action name |
| `details` | String | No | Additional action details |
| `date` | Date | No | Action date |
| `timeStamp` | Date | No | Full timestamp of the action |

## 10. `auditlog`

Stores structured audit trail entries.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the audit log |
| `userId` | ObjectId | Yes | User who performed the action |
| `action` | String | Yes | Action type such as upload, view, download, share |
| `resourceType` | String | Yes | Resource type: `file`, `folder`, or `user` |
| `resourceId` | ObjectId | No | Identifier of the affected resource |
| `details` | Mixed | No | Extended audit information |
| `ipAddress` | String | No | Source IP address |
| `userAgent` | String | No | Request user agent |
| `createdAt` | Date | No | Audit log creation timestamp |
| `updatedAt` | Date | No | Audit log update timestamp |

## 11. `notification`

Stores user notifications for system events.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the notification |
| `userId` | ObjectId | Yes | User receiving the notification |
| `type` | String | Yes | Notification type |
| `title` | String | Yes | Notification title |
| `message` | String | Yes | Notification message |
| `details` | String | No | Extra message details |
| `isRead` | Boolean | No | Read status flag |
| `relatedId` | ObjectId | No | Related entity identifier |
| `relatedModel` | String | No | Related model: `File`, `Folder`, `Group`, `Comment`, `User` |
| `createdAt` | Date | No | Notification timestamp |
| `date` | Date | No | Secondary date field used by the app |

## 12. `passwordrequest`

Stores user password change requests for admin approval.

| Field | Type | Required | Description |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Unique identifier of the password request |
| `userId` | ObjectId | Yes | User requesting the change |
| `currentPassword` | String | Yes | Current password submitted in the request |
| `newPassword` | String | Yes | New password submitted in the request |
| `status` | String | No | Request status: `pending`, `approved`, `rejected` |
| `createdAt` | Date | No | Request creation timestamp |
| `reviewedAt` | Date | No | Review completion timestamp |
| `reviewedBy` | ObjectId | No | Admin who reviewed the request |
| `reviewNotes` | String | No | Notes added during review |

## Relationship Summary

| Source Collection | Field | Target Collection | Relationship |
|---|---|---|---|
| `file` | `owner` | `users` | Many files belong to one user |
| `file` | `parentFolder` | `folder` | Many files can belong to one folder |
| `fileversion` | `fileId` | `file` | Many versions belong to one file |
| `folder` | `owner` | `users` | Many folders belong to one user |
| `folder` | `parentFolder` | `folder` | Recursive parent-child folder structure |
| `folderversion` | `folderId` | `folder` | Many versions belong to one folder |
| `comment` | `createdBy` | `users` | Many comments can be written by one user |
| `formtemplate` | `owner` | `users` | Many templates can be owned by one user |
| `formtemplate` | `destinationFolder` | `folder` | Generated output may target one folder |
| `group` | `members`, `leaders`, `createdBy` | `users` | Group membership and ownership references |
| `notification` | `userId` | `users` | Many notifications belong to one user |
| `passwordrequest` | `userId`, `reviewedBy` | `users` | Requester and reviewer references |
| `log` | `user` | `users` | Log may reference one user |
| `auditlog` | `userId` | `users` | Audit entry belongs to one user |

## Notes

- Collection names in code are not perfectly uniform. Some schemas use refs like `users`, while others use `User`, `File`, or `Folder`.
- Several documents use embedded subdocuments instead of separate collections, especially `file`, `folder`, and `group`.
- `currentPassword` and `newPassword` in `passwordrequest` are stored fields in the current schema and should be treated as sensitive data.
