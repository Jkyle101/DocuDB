# DocuDB Full Data Dictionary

This dictionary follows the format: **Field Name | Data Type | Key | Description**.
It is based on the current Mongoose schemas in `server/models`.

## 1. USERS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique identifier of the user |
| Email | VARCHAR(255) |  | User email address used for login |
| Password | VARCHAR(255) |  | Hashed user password |
| Name | VARCHAR(255) |  | Full name of the user |
| Department | VARCHAR(255) |  | Department name (default: Unassigned) |
| Role | VARCHAR(50) |  | User role (`superadmin`, `qa_admin`, `dept_chair`, `user`, `faculty`, `evaluator`) |
| Active | BOOLEAN |  | Account status (active/inactive) |
| ProfilePicture | VARCHAR(255) |  | Profile picture filename/path |
| CreatedAt | DATETIME |  | Date and time account was created |

## 2. FILES TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique identifier of the file |
| FileName | VARCHAR(255) |  | System-stored file name |
| OriginalName | VARCHAR(255) |  | Original uploaded file name |
| MimeType | VARCHAR(100) |  | File MIME type |
| Size | BIGINT |  | File size in bytes |
| UploadDate | DATETIME |  | Date file was uploaded |
| LastAccessedAt | DATETIME |  | Last access timestamp |
| UserId | VARCHAR(255) |  | Legacy string user identifier used by frontend |
| Owner | OBJECTID | FK (Users._id) | User who owns the file |
| ParentFolder | OBJECTID | FK (Folders._id) | Folder where file is stored |
| SharedWith | OBJECTID[] | FK (Users._id) | Users with whom the file is shared |
| Permissions | VARCHAR(20) |  | Access permission (`viewer`, `editor`, `owner`, `read`, `write`) |
| DeletedAt | DATETIME |  | Soft delete timestamp |
| FavoritedBy | VARCHAR(255)[] |  | User IDs who favorited the file |
| PinnedBy | VARCHAR(255)[] |  | User IDs who pinned the file |
| ContentHash | VARCHAR(255) |  | Content hash for duplicate detection |
| DuplicateOf | OBJECTID | FK (Files._id) | Canonical file reference if duplicate |
| Classification | JSON |  | Embedded classification metadata |
| ReviewWorkflow | JSON |  | Embedded review and verification workflow |

## 2.1 FILE_CLASSIFICATION (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Category | VARCHAR(255) |  | Predicted or assigned document category |
| Confidence | DECIMAL(5,2) |  | Classification confidence score |
| Tags | VARCHAR(255)[] |  | Classification tags |
| ClassifiedAt | DATETIME |  | Classification timestamp |
| ClassifierVersion | VARCHAR(50) |  | Classifier version |

## 2.2 FILE_REVIEW_WORKFLOW (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| RequiresReview | BOOLEAN |  | Indicates if file requires review |
| Status | VARCHAR(50) |  | Overall review state |
| AssignedProgramChairs | OBJECTID[] | FK (Users._id) | Assigned department chairs |
| AssignedQaOfficers | OBJECTID[] | FK (Users._id) | Assigned QA officers |
| ProgramChair | JSON |  | Program chair review block |
| QaOfficer | JSON |  | QA officer review block |
| VerificationBadge | JSON |  | Verification details block |

## 2.3 FILE_REVIEW_DECISION (ProgramChair / QaOfficer Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Status | VARCHAR(20) |  | Decision status (`pending`, `approved`, `rejected`, `not_required`) |
| ReviewedBy | OBJECTID | FK (Users._id) | Reviewer user ID |
| ReviewedAt | DATETIME |  | Review timestamp |
| Notes | TEXT |  | Review remarks |

## 2.4 FILE_VERIFICATION_BADGE (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Verified | BOOLEAN |  | Whether file is verified |
| VerifiedBy | OBJECTID | FK (Users._id) | User who verified the file |
| VerifiedAt | DATETIME |  | Verification timestamp |
| Label | VARCHAR(100) |  | Verification label |

## 3. FOLDERS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique folder identifier |
| Name | VARCHAR(255) |  | Folder name |
| Owner | OBJECTID | FK (Users._id) | Folder owner |
| ParentFolder | OBJECTID | FK (Folders._id) | Parent folder for nested folders |
| IsPredefinedRoot | BOOLEAN |  | Marks predefined root folders |
| PredefinedTemplateKey | VARCHAR(100) |  | Template key for predefined structures |
| SharedWith | OBJECTID[] | FK (Users._id) | Users with folder access |
| Permissions | VARCHAR(20) |  | Folder access permissions |
| ComplianceProfileKey | VARCHAR(100) |  | Compliance profile identifier |
| ComplianceTasks | JSON[] |  | Embedded compliance task tree |
| FolderAssignments | JSON |  | Embedded folder role assignments |
| ComplianceReviews | JSON[] |  | Embedded compliance review records |
| Copc | JSON |  | Embedded COPC workflow metadata |
| DeletedAt | DATETIME |  | Soft delete timestamp |
| CreatedAt | DATETIME |  | Date folder was created |

## 3.1 FOLDER_COMPLIANCE_TASKS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique compliance task identifier |
| TaskId | VARCHAR(100) |  | External task code/identifier |
| TaskType | VARCHAR(30) |  | Task type (`document`, `review`, `approval`, `monitoring`, `general`) |
| Title | VARCHAR(255) |  | Task title |
| Description | TEXT |  | Task description |
| FolderPath | VARCHAR(500) |  | Folder path context |
| AssignedTo | OBJECTID | FK (Users._id) | Assigned primary user |
| AssignedRole | VARCHAR(50) |  | Assigned role target |
| Priority | VARCHAR(20) |  | Priority (`low`, `medium`, `high`, `critical`) |
| DueDate | DATETIME |  | Due date |
| CreatedBy | OBJECTID | FK (Users._id) | User who created task |
| Percentage | INT |  | Completion percentage (0-100) |
| Status | VARCHAR(30) |  | Task status |
| Scope | VARCHAR(255) |  | Scope/category context |
| Checks | TEXT[] |  | Checklist entries |
| Attachments | JSON[] |  | Task attachments |
| Comments | JSON[] |  | Task comments |
| History | JSON[] |  | Task history events |
| Source | VARCHAR(20) |  | Source (`manual`, `folder_auto`, `recurring`) |
| Recurrence | JSON |  | Recurrence configuration |
| AssignedUploaders | OBJECTID[] | FK (Users._id) | Assigned uploader users |
| AssignedProgramChairs | OBJECTID[] | FK (Users._id) | Assigned department chair users |
| AssignedQaOfficers | OBJECTID[] | FK (Users._id) | Assigned QA users |
| Children | JSON[] |  | Nested child tasks |
| CreatedAt | DATETIME |  | Task creation timestamp |
| UpdatedAt | DATETIME |  | Task update timestamp |

## 3.2 FOLDER_TASK_ATTACHMENTS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique attachment identifier |
| FileId | OBJECTID | FK (Files._id) | Linked file ID |
| Name | VARCHAR(255) |  | Attachment display name |
| Url | VARCHAR(500) |  | Attachment URL/path |
| UploadedBy | OBJECTID | FK (Users._id) | User who uploaded attachment |
| UploadedAt | DATETIME |  | Attachment upload timestamp |

## 3.3 FOLDER_TASK_COMMENTS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique task comment identifier |
| Message | TEXT |  | Comment content |
| CreatedBy | OBJECTID | FK (Users._id) | Comment author |
| Mentions | OBJECTID[] | FK (Users._id) | Mentioned users |
| Attachments | JSON[] |  | Comment attachments |
| CreatedAt | DATETIME |  | Comment creation timestamp |
| UpdatedAt | DATETIME |  | Comment update timestamp |

## 3.4 FOLDER_TASK_HISTORY (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique task history entry identifier |
| Action | VARCHAR(100) |  | Action performed |
| FromStatus | VARCHAR(30) |  | Previous status |
| ToStatus | VARCHAR(30) |  | New status |
| Notes | TEXT |  | History notes |
| Actor | OBJECTID | FK (Users._id) | User who triggered action |
| At | DATETIME |  | Timestamp of action |

## 3.5 FOLDER_TASK_RECURRENCE (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Enabled | BOOLEAN |  | Recurrence enabled flag |
| Frequency | VARCHAR(20) |  | Recurrence frequency (`yearly`, `quarterly`, `monthly`, `custom`) |
| Interval | INT |  | Repeat interval |
| NextDueDate | DATETIME |  | Next scheduled due date |
| LastGeneratedAt | DATETIME |  | Last auto-generation timestamp |

## 3.6 FOLDER_ASSIGNMENTS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Uploaders | OBJECTID[] | FK (Users._id) | Assigned uploader users |
| UploaderGroups | OBJECTID[] | FK (Groups._id) | Assigned uploader groups |
| ProgramChairs | OBJECTID[] | FK (Users._id) | Assigned department chairs |
| QaOfficers | OBJECTID[] | FK (Users._id) | Assigned QA officers |
| Evaluators | OBJECTID[] | FK (Users._id) | Assigned evaluators |

## 3.7 FOLDER_COMPLIANCE_REVIEWS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Reviewer | OBJECTID | FK (Users._id) | Reviewer user ID |
| Role | VARCHAR(50) |  | Reviewer role |
| Scope | VARCHAR(255) |  | Review scope |
| Checks | TEXT[] |  | Checks applied during review |
| Notes | TEXT |  | Review notes |
| CreatedAt | DATETIME |  | Review timestamp |

## 3.8 FOLDER_COPC (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| IsProgramRoot | BOOLEAN |  | Marks folder as COPC program root |
| ProgramCode | VARCHAR(100) |  | Program code |
| ProgramName | VARCHAR(255) |  | Program name |
| Description | TEXT |  | Program description |
| DepartmentName | VARCHAR(255) |  | Department name |
| Year | INT |  | Program year |
| WorkflowStage | VARCHAR(50) |  | Current COPC workflow stage |
| WorkflowStatus | VARCHAR(100) |  | Status label for workflow |
| PackageMeta | JSON |  | Generated package metadata |
| SubmissionMeta | JSON |  | Submission metadata |
| ArchiveMeta | JSON |  | Archive metadata |
| Observations | JSON[] |  | COPC observations |
| Locked | JSON |  | COPC lock metadata |

## 3.9 FOLDER_COPC_PACKAGE_META (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| FileName | VARCHAR(255) |  | Generated package filename |
| GeneratedAt | DATETIME |  | Package generation timestamp |
| GeneratedBy | OBJECTID | FK (Users._id) | User who generated package |

## 3.10 FOLDER_COPC_SUBMISSION_META (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Method | VARCHAR(100) |  | Submission method |
| Reference | VARCHAR(255) |  | Submission reference number/code |
| SubmittedAt | DATETIME |  | Submission timestamp |
| SubmittedBy | OBJECTID | FK (Users._id) | User who submitted |

## 3.11 FOLDER_COPC_ARCHIVE_META (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| ArchiveYear | INT |  | Archive year |
| ArchivedAt | DATETIME |  | Date archived |

## 3.12 FOLDER_COPC_OBSERVATIONS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| By | OBJECTID | FK (Users._id) | User who added observation |
| Role | VARCHAR(50) |  | Role of observer |
| Message | TEXT |  | Observation note |
| CreatedAt | DATETIME |  | Observation timestamp |

## 3.13 FOLDER_COPC_LOCKED (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| IsLocked | BOOLEAN |  | Lock state |
| LockedAt | DATETIME |  | Lock timestamp |
| LockedBy | OBJECTID | FK (Users._id) | User who locked program |

## 4. FILE_VERSIONS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique version ID |
| FileID | OBJECTID | FK (Files._id) | Associated file |
| VersionNumber | INT |  | Version number |
| OriginalName | VARCHAR(255) |  | Original filename at that version |
| FileName | VARCHAR(255) |  | Stored filename of this version |
| MimeType | VARCHAR(100) |  | File type |
| Size | BIGINT |  | File size of this version |
| CreatedBy | OBJECTID | FK (Users._id) | User who uploaded this version |
| CreatedAt | DATETIME |  | Version upload date |
| ChangeDescription | TEXT |  | Description of change |
| IsCurrent | BOOLEAN |  | Indicates current active version |

## 5. FOLDER_VERSIONS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique folder version ID |
| FolderID | OBJECTID | FK (Folders._id) | Related folder |
| VersionNumber | INT |  | Folder version number |
| Name | VARCHAR(255) |  | Folder name for that version |
| CreatedBy | OBJECTID | FK (Users._id) | User who created version |
| CreatedAt | DATETIME |  | Date created |
| ChangeDescription | TEXT |  | Summary of changes |
| Changes | JSON |  | Structured change details |
| IsCurrent | BOOLEAN |  | Current version indicator |

## 6. COMMENTS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique comment ID |
| ItemID | OBJECTID |  | File or folder ID |
| ItemType | VARCHAR(50) |  | Indicates file or folder |
| Content | TEXT |  | Comment message |
| CreatedBy | OBJECTID | FK (Users._id) | User who posted comment |
| CreatedAt | DATETIME |  | Date comment was posted |
| ParentCommentID | OBJECTID | FK (Comments._id) | Parent comment for threaded replies |
| Replies | OBJECTID[] | FK (Comments._id) | Reply comment IDs |

## 7. LOGS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique log ID |
| User | OBJECTID | FK (Users._id) | User who performed action |
| Action | VARCHAR(100) |  | Action performed |
| Details | TEXT |  | Additional action details |
| Date | DATETIME |  | Date field used by system |
| TimeStamp | DATETIME |  | Date and time of action |

## 8. GROUPS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique group ID |
| Name | VARCHAR(100) |  | Group name |
| Description | TEXT |  | Group description |
| Members | OBJECTID[] | FK (Users._id) | Group member user IDs |
| Leaders | OBJECTID[] | FK (Users._id) | Group leader user IDs |
| CreatedBy | OBJECTID | FK (Users._id) | Group creator |
| CreatedAt | DATETIME |  | Date created |
| Notifications | JSON[] |  | Group-level notifications |
| Announcements | JSON[] |  | Group announcements |
| SharedFiles | JSON[] |  | File shares granted to group |
| SharedFolders | JSON[] |  | Folder shares granted to group |

## 8.1 GROUP_NOTIFICATIONS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Title | VARCHAR(255) |  | Notification title |
| Message | TEXT |  | Notification message |
| CreatedBy | OBJECTID | FK (Users._id) | User who created the notification |
| CreatedAt | DATETIME |  | Date created |

## 8.2 GROUP_ANNOUNCEMENTS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Title | VARCHAR(255) |  | Announcement title |
| Content | TEXT |  | Announcement content |
| CreatedBy | OBJECTID | FK (Users._id) | User who posted announcement |
| CreatedAt | DATETIME |  | Date created |

## 8.3 GROUP_SHARED_FILES (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| FileId | OBJECTID | FK (Files._id) | Shared file reference |
| Permission | VARCHAR(20) |  | Share permission |
| SharedBy | OBJECTID | FK (Users._id) | User who shared the file |
| SharedAt | DATETIME |  | Date shared |

## 8.4 GROUP_SHARED_FOLDERS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| FolderId | OBJECTID | FK (Folders._id) | Shared folder reference |
| Permission | VARCHAR(20) |  | Share permission |
| SharedBy | OBJECTID | FK (Users._id) | User who shared the folder |
| SharedAt | DATETIME |  | Date shared |

## 9. NOTIFICATIONS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique notification ID |
| UserId | OBJECTID | FK (Users._id) | Recipient user |
| Type | VARCHAR(100) |  | Notification type |
| ActorId | OBJECTID | FK (Users._id) | User who triggered the event |
| Title | VARCHAR(255) |  | Notification title |
| Message | TEXT |  | Notification message |
| Details | TEXT |  | Additional detail text |
| IsRead | BOOLEAN |  | Read status (`true`/`false`) |
| RelatedId | OBJECTID |  | Related entity ID |
| RelatedModel | VARCHAR(100) |  | Related model name |
| Metadata | JSON |  | Additional structured metadata |
| CreatedAt | DATETIME |  | Date created |
| Date | DATETIME |  | Secondary date field |

## 10. FORM_TEMPLATES TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique template ID |
| Name | VARCHAR(255) |  | Template name |
| Description | TEXT |  | Template description |
| Owner | OBJECTID | FK (Users._id) | Template owner |
| Fields | JSON[] |  | Dynamic template fields |
| TemplateBody | LONGTEXT |  | Template body with placeholders |
| OutputType | VARCHAR(20) |  | Output format (`txt`, `docx`, `pdf`) |
| DestinationFolder | OBJECTID | FK (Folders._id) | Default destination folder |
| CreatedAt | DATETIME |  | Date created |
| UpdatedAt | DATETIME |  | Date last updated |

## 10.1 FORM_TEMPLATE_FIELDS (Embedded)

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| Key | VARCHAR(100) |  | Field key used in placeholders |
| Label | VARCHAR(255) |  | Display label |
| Type | VARCHAR(20) |  | Input type (`text`, `textarea`, `number`, `date`, `email`) |
| Required | BOOLEAN |  | Required flag |
| Placeholder | VARCHAR(255) |  | Input placeholder text |

## 11. PASSWORD_REQUESTS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique password request ID |
| UserId | OBJECTID | FK (Users._id) | User requesting password change |
| CurrentPassword | VARCHAR(255) |  | Current password input |
| NewPassword | VARCHAR(255) |  | New password input |
| Status | VARCHAR(20) |  | Request status (`pending`, `approved`, `rejected`) |
| CreatedAt | DATETIME |  | Date created |
| ReviewedAt | DATETIME |  | Date reviewed |
| ReviewedBy | OBJECTID | FK (Users._id) | Admin/reviewer user ID |
| ReviewNotes | TEXT |  | Review notes |

## 12. AUTH_CHALLENGES TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique verification challenge ID |
| UserId | OBJECTID | FK (Users._id) | User linked to challenge (nullable) |
| Email | VARCHAR(255) |  | Target email address |
| Purpose | VARCHAR(30) |  | Challenge purpose (`password_reset`, `registration`) |
| CodeHash | VARCHAR(255) |  | Hashed verification code |
| ExpiresAt | DATETIME |  | Code expiration timestamp |
| AttemptCount | INT |  | Number of verification attempts |
| ConsumedAt | DATETIME |  | Timestamp when code was used |
| CreatedAt | DATETIME |  | Date challenge was created |

## 13. AUDIT_LOGS TABLE

| Field Name | Data Type | Key | Description |
|---|---|---|---|
| _id | OBJECTID | PK | Unique audit log ID |
| UserId | OBJECTID | FK (Users._id) | User who performed action |
| Action | VARCHAR(50) |  | Action (`upload`, `view`, `download`, `share`, `delete`, `modify`, `login`, `logout`) |
| ResourceType | VARCHAR(50) |  | Resource type (`file`, `folder`, `user`) |
| ResourceId | OBJECTID |  | Affected resource ID |
| Details | JSON |  | Additional structured action details |
| IpAddress | VARCHAR(100) |  | Source IP address |
| UserAgent | VARCHAR(500) |  | Request user-agent string |
| CreatedAt | DATETIME |  | Auto timestamp: created time |
| UpdatedAt | DATETIME |  | Auto timestamp: last update time |

## Relationship Summary

| Source Table | Field | Target Table | Relationship |
|---|---|---|---|
| Files | Owner | Users | Many files belong to one user |
| Files | ParentFolder | Folders | Many files belong to one folder |
| File_Versions | FileID | Files | Many file versions belong to one file |
| Folders | Owner | Users | Many folders belong to one user |
| Folders | ParentFolder | Folders | Recursive parent-child folder hierarchy |
| Folder_Versions | FolderID | Folders | Many folder versions belong to one folder |
| Comments | CreatedBy | Users | Many comments can be created by one user |
| Comments | ParentCommentID | Comments | Threaded comment hierarchy |
| Groups | Members/Leaders/CreatedBy | Users | Group membership and ownership references |
| Notifications | UserId | Users | Many notifications belong to one user |
| Form_Templates | Owner | Users | Many templates owned by one user |
| Form_Templates | DestinationFolder | Folders | Template output can target one folder |
| Password_Requests | UserId/ReviewedBy | Users | Requester and reviewer references |
| Auth_Challenges | UserId | Users | Optional user linkage for verification challenge |
| Logs | User | Users | Log entry may reference one user |
| Audit_Logs | UserId | Users | Audit entry belongs to one user |

## Notes

- This project uses MongoDB (document database). The "TABLE" naming is used for documentation consistency with SQL-style dictionaries.
- `OBJECTID` fields represent MongoDB ObjectId values.
- Embedded sections (e.g., `Folder_COPC`, `Folder_Compliance_Tasks`) are subdocuments stored inside parent documents.
- Some fields are intentionally duplicated for compatibility (for example `Files.UserId` plus `Files.Owner`).
- Sensitive fields (for example password-related fields) should be protected in API responses and logs.
