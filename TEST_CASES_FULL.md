# DocuDB Full Test Cases by Feature

This document follows the same format as your attached `Test Cases.docx`:

- Test Case ID
- Test Scenario
- Test Steps
- Test Data
- Prerequisites
- Expected Result
- Status
- Remarks

## Seeded Test Data (Already Populated)

- Seed file: `test-data/seed-summary.json`
- Base URL: `http://localhost:3001`
- Default password: `TcFtr#2026`
- Test users:
  - `tcftr.superadmin@llcc.edu.ph`
  - `tcftr.user1@llcc.edu.ph`
  - `tcftr.user2@llcc.edu.ph`
  - `tcftr.deptchair@llcc.edu.ph`
  - `tcftr.qa@llcc.edu.ph`
  - `tcftr.evaluator@llcc.edu.ph`
- Seeded objects:
  - Folder: `TCFTR Root`
  - Folder: `TCFTR Shared Target`
  - Folder: `TCFTR Move Target`
  - Group: `TCFTR Collaboration Group`
  - COPC Program: `TCFTR COPC Program`

---

## 1.1 Title: User Authentication & Account Access

User Story: As a user, I want secure login and access control so I can reach only pages allowed for my role.

Acceptance Criteria

- Valid credentials allow access.
- Invalid credentials are rejected.
- Role-based redirection works.
- Inactive users cannot sign in.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-001 | User login redirects to user dashboard | Open login > Enter valid user credentials > Click Sign in | `tcftr.user1@llcc.edu.ph` / `TcFtr#2026` | User exists and active | Redirect to user workspace (`/`) | Not Run | |
| TC-002 | Superadmin login redirects to admin dashboard | Open login > Enter superadmin credentials > Click Sign in | `tcftr.superadmin@llcc.edu.ph` / `TcFtr#2026` | Superadmin exists and active | Redirect to admin workspace (`/admin`) | Not Run | |
| TC-003 | Dept chair login success | Login with dept chair account | `tcftr.deptchair@llcc.edu.ph` / `TcFtr#2026` | Dept chair exists and active | Login succeeds with dept-chair COPC tabs visible | Not Run | |
| TC-004 | QA admin login success | Login with QA admin account | `tcftr.qa@llcc.edu.ph` / `TcFtr#2026` | QA admin exists and active | Login succeeds with QA review access | Not Run | |
| TC-005 | Evaluator login success | Login with evaluator account | `tcftr.evaluator@llcc.edu.ph` / `TcFtr#2026` | Evaluator exists and active | Login succeeds with evaluation-stage access | Not Run | |
| TC-006 | Invalid password rejected | Login > Enter valid email + wrong password | `tcftr.user1@llcc.edu.ph` / `WrongPass123` | User exists | Error message shown, no login | Not Run | Negative case |
| TC-007 | Unknown email rejected | Login with unknown email | `nouser@llcc.edu.ph` / `TcFtr#2026` | None | Error message shown, no login | Not Run | Negative case |
| TC-008 | Deactivated user cannot login | Deactivate user in admin > Try login | `tcftr.user2@llcc.edu.ph` / `TcFtr#2026` | User deactivated by admin | Login blocked with account status error | Not Run | Negative case |
| TC-009 | Session persists after refresh | Login as user > Refresh browser | Valid user account | Login success | Session remains active | Not Run | |
| TC-010 | Logout clears session | Login > Click Logout > Try opening protected route | Valid user account | Login success | Redirect to login page | Not Run | |

---

## 1.2 Title: Registration, Forgot Password, and Reset

User Story: As a new or existing user, I want account recovery and registration OTP so I can access the system securely.

Acceptance Criteria

- Registration email domain policy is enforced.
- OTP flows work for register/reset.
- Password reset updates credentials.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-011 | Registration send-code with valid domain | Open Create account > Enter `@llcc.edu.ph` email > Send code | `new.test@llcc.edu.ph` | Email not yet registered | Verification code is sent | Not Run | |
| TC-012 | Registration send-code invalid domain blocked | Enter non-llcc email > Send code | `new.test@gmail.com` | None | Request rejected by domain rule | Not Run | Negative case |
| TC-013 | Complete registration with correct code | Create account > Enter code > Submit | Valid name/email/password/code | Valid OTP issued | Account created successfully | Not Run | |
| TC-014 | Registration with wrong code blocked | Create account > Enter invalid code > Submit | Valid email + wrong code | OTP issued | Registration fails with code error | Not Run | Negative case |
| TC-015 | Forgot password sends reset code | Login > Forgot password > Submit email | `tcftr.user1@llcc.edu.ph` | User exists | Reset code sent | Not Run | |
| TC-016 | Reset password with valid code | Enter email + valid code + new password | `NewPass#2026` | Valid reset code | Password updated | Not Run | |
| TC-017 | Reset password with invalid code blocked | Enter wrong code + submit | Wrong reset code | Reset initiated | Reset fails with validation error | Not Run | Negative case |
| TC-018 | Login with updated password | Login after successful reset | `tcftr.user1@llcc.edu.ph` / `NewPass#2026` | Password changed | Login succeeds | Not Run | Restore password after test |

---

## 2.1 Title: User Profile, Settings, and Preferences

User Story: As a user, I want to manage my profile and preferences.

Acceptance Criteria

- Profile details update correctly.
- Department validation is enforced.
- Preferences persist.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-019 | Update profile name | Settings > Profile > Edit name > Save | `TCFTR User One Updated` | User logged in | Name updates in profile/header | Not Run | |
| TC-020 | Update department valid value | Settings > Edit department > Save | `COT` | User logged in | Department saved | Not Run | |
| TC-021 | Update department invalid value rejected | Settings > Enter invalid department > Save | `INVALID_DEPT` | User logged in | Save blocked with validation error | Not Run | Negative case |
| TC-022 | Upload profile picture valid type | Settings > Upload image > Save | `profile.png` | User logged in | Profile picture appears in navbar/sidebar | Not Run | |
| TC-023 | Upload profile picture invalid type rejected | Upload unsupported file | `.exe` | User logged in | Upload blocked with error message | Not Run | Negative case |
| TC-024 | Remove profile picture | Settings > Remove profile picture > Save | N/A | Existing profile picture | Placeholder avatar is shown | Not Run | |
| TC-025 | Enable dark mode preference | Settings > Toggle dark mode > Save | Dark mode ON | User logged in | Theme updates and persists | Not Run | |
| TC-026 | Notification preference save | Settings > Change notification pref > Save | Email notifications OFF | User logged in | Preferences stored and reflected | Not Run | |

---

## 2.2 Title: Document & Folder Management (Create and Upload)

User Story: As a user, I want to upload files and organize folders.

Acceptance Criteria

- Upload works for supported formats.
- Folder creation works at root and nested levels.
- Drag-and-drop upload works.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-027 | Create root folder | My Drive > New Folder > Save | `TCFTR Root` | User logged in | Folder created in root | Not Run | Seeded |
| TC-028 | Create nested folder | Open root folder > New Folder > Save | `TCFTR Shared Target` | Parent folder exists | Child folder created | Not Run | Seeded |
| TC-029 | Create additional target folder | Open root folder > New Folder > Save | `TCFTR Move Target` | Parent folder exists | Child folder created | Not Run | Seeded |
| TC-030 | Upload text file | Open root folder > Upload file | `TCFTR-Searchable.txt` | User logged in | File uploaded and visible | Not Run | Seeded |
| TC-031 | Upload PDF file | Upload in root folder | `TCFTR-Policy.pdf` | User logged in | File uploaded | Not Run | Seeded |
| TC-032 | Upload DOCX file | Upload in root folder | `TCFTR-Report.docx` | User logged in | File uploaded | Not Run | Seeded |
| TC-033 | Upload image file | Open shared folder > Upload | `TCFTR-Image.jpg` | Shared folder exists | File uploaded | Not Run | Seeded |
| TC-034 | Drag-and-drop upload | Drag file from desktop to workspace | `drag-file.txt` | User logged in | Upload completes and appears in list | Not Run | |
| TC-035 | Upload duplicate-content file #1 | Upload first duplicate file | `TCFTR-Duplicate-1.txt` | User logged in | File uploaded | Not Run | Seeded |
| TC-036 | Upload duplicate-content file #2 | Upload second duplicate file with same content | `TCFTR-Duplicate-2.txt` | Duplicate #1 exists | File uploaded and duplicate flag available | Not Run | Seeded |

---

## 2.3 Title: Document & Folder Management (Actions, Versioning, Trash)

User Story: As a user/admin, I want full lifecycle control of files and folders.

Acceptance Criteria

- Rename/move/delete actions work with permission rules.
- Version history is available.
- Trash restore/permanent delete works.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-037 | Preview file | Click Preview on PDF | `TCFTR-Policy.pdf` | File exists | File preview opens | Not Run | |
| TC-038 | Download file | Click Download on DOCX | `TCFTR-Report.docx` | File exists | Browser download starts | Not Run | |
| TC-039 | Rename file | Context menu > Rename > Save | `TCFTR-Policy.pdf -> TCFTR-Policy-v2.pdf` | File exists | File name updated | Not Run | |
| TC-040 | Rename folder | Context menu > Rename > Save | `TCFTR Move Target -> TCFTR Move Target A` | Folder exists | Folder name updated | Not Run | |
| TC-041 | Move file between folders | Context menu > Move > Select folder | Move `TCFTR-Report.docx` to `TCFTR Move Target` | Source and target exist | File appears in target folder | Not Run | |
| TC-042 | Move folder inside root | Context menu > Move > Select parent | Move folder under root | Parent exists | Folder location changes | Not Run | |
| TC-043 | Add file to favorites | Click favorite/star action | `TCFTR-Searchable.txt` | File exists | Favorite flag enabled | Not Run | |
| TC-044 | Pin file | Click pin action | `TCFTR-Searchable.txt` | File exists | Pinned flag enabled | Not Run | |
| TC-045 | View version history | Context menu > Version History | `TCFTR-Searchable.txt` | File has at least one update | Version list displayed | Not Run | |
| TC-046 | Restore previous file version | Version History > Restore selected version | Existing version record | File has previous versions | Selected version restored | Not Run | |
| TC-047 | Soft-delete file | Context menu > Delete | `TCFTR-Policy-v2.pdf` | Role allows delete | File removed from active list | Not Run | Role-sensitive |
| TC-048 | Restore and permanently delete from trash | Admin Trash > Restore / Delete Permanently | Deleted file/folder | Item exists in trash | Restore returns item; permanent delete removes permanently | Not Run | |

---

## 3.1 Title: Document Sharing & Permission Control

User Story: As a user, I want to share files/folders with controlled permission.

Acceptance Criteria

- Share/unshare works for user and folder targets.
- Permission mode is enforced.
- Shared content appears in receiver views.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-049 | Share file with viewer permission | File > Share > Set View | Share to `tcftr.user2@llcc.edu.ph` | Owner logged in | Receiver can view only | Not Run | Seeded |
| TC-050 | Share folder with editor permission | Folder > Share > Set Edit | Share to `tcftr.user2@llcc.edu.ph` | Owner logged in | Receiver can modify allowed items | Not Run | Seeded |
| TC-051 | File appears in receiver Shared with me | Login as receiver > Open Shared with me | Shared file/folder | Share exists | Shared item is listed | Not Run | |
| TC-052 | Manage shares revoke access | Manage Shares > Remove user | Remove `tcftr.user2@llcc.edu.ph` | Existing share | Receiver loses access | Not Run | |
| TC-053 | Unshare file endpoint behavior | Trigger unshare action | File share entry | Shared file exists | User removed from shared list | Not Run | |
| TC-054 | Unshare folder endpoint behavior | Trigger folder unshare action | Folder share entry | Shared folder exists | User removed from folder shared list | Not Run | |
| TC-055 | Share to non-existing email rejected | Share > Enter unknown email | `ghost@llcc.edu.ph` | Owner logged in | Error: no matching users | Not Run | Negative case |
| TC-056 | Non-owner cannot share file | Login as non-owner > try share | File owned by another user | Non-owner user logged in | 403 unauthorized share attempt | Not Run | Negative case |
| TC-057 | Viewer cannot edit shared file | Receiver open shared file and try edit | Viewer permission | Shared viewer access exists | Edit denied | Not Run | Permission case |
| TC-058 | Editor can edit shared file | Receiver with edit permission modifies file | Editor permission | Shared editor access exists | Edit succeeds | Not Run | Permission case |

---

## 3.2 Title: Group Collaboration & Group Sharing

User Story: As users/admin, we want to collaborate via groups and shared resources.

Acceptance Criteria

- Group lifecycle operations work.
- Member/leader actions are enforced.
- Group sharing and activity feeds work.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-059 | Create group | Admin Groups > Create Group > Save | `TCFTR Collaboration Group` | Admin logged in | Group created successfully | Not Run | Seeded |
| TC-060 | Add group members | Group > Manage Members > Add users | user1, user2, dept_chair | Group exists | Members added | Not Run | Seeded |
| TC-061 | Remove group member | Group > Remove member | `tcftr.user2@llcc.edu.ph` | Group has member | Member removed | Not Run | |
| TC-062 | Assign leader to member | Group > Set leader | `tcftr.deptchair@llcc.edu.ph` | User is group member | Leader badge/role set | Not Run | Seeded |
| TC-063 | Prevent non-member leader assignment | Attempt leader assignment for non-member | evaluator user | User not in group | Validation error returned | Not Run | Negative case |
| TC-064 | Post group notification | Group > Add notification | Title + message | Group exists | Notification visible in group details | Not Run | |
| TC-065 | Post group announcement | Group > Add announcement | Title + content | Group exists | Announcement visible in group details | Not Run | |
| TC-066 | Share file to group | Group > Share Content > File | `TCFTR-Report.docx` | Group exists, file exists | Group-shared file available to members | Not Run | Seeded |
| TC-067 | Unshare file from group | Group > Remove shared content | Shared file entry | Group has shared file | Shared item removed | Not Run | |
| TC-068 | Member can view group details | Login as member > Open My Groups > View Details | Member account | Group membership exists | Members/announcements/shared content visible | Not Run | |

---

## 4.1 Title: Search, Filters, and Navigation

User Story: As a user/admin, I want fast search and clear navigation to locate items.

Acceptance Criteria

- Search supports file/folder names and text content where available.
- Filters narrow result sets.
- Breadcrumb and recent navigation work.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-069 | Search by file name | Type filename in search bar | `TCFTR-Policy` | File exists | Matching file appears in results | Not Run | |
| TC-070 | Search by text content | Search keyword from text file | `ALPHA123` | Searchable file exists | Matching file appears | Not Run | Seeded text file |
| TC-071 | Search by folder name | Search folder name | `TCFTR Root` | Folder exists | Folder appears in results | Not Run | |
| TC-072 | File type filter: PDF | Apply PDF filter | `application/pdf` | Mixed file types exist | Only PDF results shown | Not Run | |
| TC-073 | Favorites-only filter | Mark file favorite > enable filter | Favorite file | Favorite exists | Only favorite files shown | Not Run | |
| TC-074 | Pinned-only filter | Pin file > enable filter | Pinned file | Pinned file exists | Only pinned files shown | Not Run | |
| TC-075 | Breadcrumb navigation | Open nested folder > click breadcrumb parent | Nested folders | At least 2-level path | Returns to selected parent folder | Not Run | |
| TC-076 | Back button navigation | Open folder > click Back | Folder path | Not at root | Moves up one level | Not Run | |
| TC-077 | Grid/List view toggle | Switch view mode buttons | N/A | Drive page open | Layout changes accordingly | Not Run | |
| TC-078 | Recent page reflects latest activity | Open file > go to Recent | Uploaded/opened files | Recent module available | Recently touched file appears | Not Run | |

---

## 5.1 Title: Notifications and Comments

User Story: As a user, I want activity alerts and threaded comments for collaboration.

Acceptance Criteria

- Notifications can be viewed and marked read.
- Comment lifecycle works (create/edit/delete).
- Notification links resolve to relevant context.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-079 | Fetch notifications list | Open Notifications page | user2 account | User has notifications | Notification list loads | Not Run | |
| TC-080 | Mark single notification as read | Click one unread notification | Any unread notif | Notification exists | Notification marked read | Not Run | |
| TC-081 | Mark all notifications as read | Click Mark all as read | Multiple unread | Notifications exist | All unread notifications become read | Not Run | |
| TC-082 | Generate test notifications endpoint | Call notification test endpoint | user2 id | Backend running | Sample notifications created | Not Run | Seeded |
| TC-083 | Share action creates receiver notification | Share file to another user | PDF file + receiver | Users exist | Receiver gets SHARE_FILE notification | Not Run | |
| TC-084 | Group invite creates notification | Add member to group | user2 + group | Group exists | Receiver gets GROUP_INVITE notification | Not Run | |
| TC-085 | Create root comment on file | Open file comments > Add comment | `TCFTR root comment seed` | File exists | Comment saved and visible | Not Run | Seeded |
| TC-086 | Reply to existing comment | Open comment thread > Reply | Reply text | Root comment exists | Reply appears under parent | Not Run | |
| TC-087 | Edit comment | Edit existing comment > Save | Updated comment text | Author has comment | Comment text updated | Not Run | |
| TC-088 | Delete comment | Delete existing comment | Existing comment | Author/admin access | Comment removed from thread | Not Run | |

---

## 6.1 Title: Smart Forms and Document Editor

User Story: As a user, I want template-based document generation and in-app editing.

Acceptance Criteria

- Form templates can be created/listed/deleted.
- Generated files are saved.
- Editor can load and save content with version tracking.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-089 | Create form template | Smart Forms > Create template > Save | Template: `TCFTR Template A` | User has forms access | Template saved | Not Run | |
| TC-090 | List form templates | Open templates list | N/A | At least one template exists | Template list returns created template | Not Run | |
| TC-091 | Generate document from template | Open template > Fill fields > Generate | Field values sample | Template exists | Generated document saved to destination | Not Run | |
| TC-092 | Delete form template | Select template > Delete | `TCFTR Template A` | Template exists | Template removed | Not Run | |
| TC-093 | Open editor content | Open editable file in editor | `TCFTR-Searchable.txt` | File exists and editable | Content loads in editor | Not Run | |
| TC-094 | Save editor changes creates new version | Edit content > Save | Add line `Editor update` | Editable file opened | Save succeeds and version history updates | Not Run | |

---

## 7.1 Title: COPC Workflow and Role-based Stages

  User Story: As COPC stakeholders, we want a controlled multi-stage review workflow.

  Acceptance Criteria

  - Superadmin can initialize and assign COPC programs.
  - Role-restricted stage access is enforced.
  - Stage actions update workflow statuses.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-095 | Initialize COPC program | Superadmin triggers init endpoint | Program `TCFTR`, year `2026` | Superadmin logged in | Program root and folder tree created | Not Run | Seeded |
| TC-096 | Prevent duplicate COPC init for same code/year | Re-run init with same values | `TCFTR`, `2026` | Existing COPC program exists | 409 duplicate workspace error | Not Run | Negative case |
| TC-097 | Assign COPC roles | Superadmin updates assignments | uploader/deptchair/qa/evaluator ids | COPC program exists | Assignments saved and propagated | Not Run | Seeded |
| TC-098 | List visible COPC programs by role | Login as user/deptchair/qa/evaluator > open COPC list | Role accounts | Assignments configured | Program visibility matches role access | Not Run | |
| TC-099 | Uploader sees upload statuses | Open COPC Upload tab > check status list | uploader account | Program + folders exist | Upload status list loads | Not Run | |
| TC-100 | Dept chair review approve submission | Open Department Review > Approve with note | submission id + note | Pending submission exists | Status updates to pending QA/approved flow | Not Run | |
| TC-101 | Dept chair review reject submission | Open Department Review > Reject with note | submission id + reject note | Pending submission exists | Status updates to rejected_program_chair | Not Run | |
| TC-102 | QA review approve submission | Open QA Review > Approve | submission id | Submission pending QA exists | Status becomes approved | Not Run | |
| TC-103 | QA review reject submission | Open QA Review > Reject with note | submission id + note | Submission pending QA exists | Status becomes rejected_qa | Not Run | |
| TC-104 | QA tag category during review | QA review > Tag category | compliance category | QA review context exists | Category tag saved | Not Run | |
| TC-105 | Compile COPC package action | Trigger `compile_package` action | program id | Fully approved files exist | Workflow stage becomes package_compiled | Not Run | |
| TC-106 | Lock COPC program | Trigger `lock` action | program id | Superadmin role | Program lock enabled, upload/create blocked in scope | Not Run | |

---

## 8.1 Title: Admin Management (Users, Groups, Logs, Trash)

User Story: As admin, I want full governance of accounts, groups, logs, and recovery.

Acceptance Criteria

- Admin can manage users and groups.
- Logs and analytics are visible.
- Trash restore/permanent delete works.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-107 | View users list | Admin > Manage Users | N/A | Superadmin logged in | User table loads with role/status data | Not Run | |
| TC-108 | Add single user (admin endpoint) | Manage Users > Add User > Save | `new.qa.user@llcc.edu.ph` | Superadmin logged in | User created successfully | Not Run | |
| TC-109 | Add user with invalid department blocked | Add user with bad department | `INVALID_DEPT` | Superadmin logged in | Validation error returned | Not Run | Negative case |
| TC-110 | Bulk import users | Manage Users > Bulk Import | CSV/JSON/Excel dataset | Superadmin logged in | Successful/failed counts returned | Not Run | |
| TC-111 | Change user role | Manage Users > Role dropdown > Save | user -> dept_chair | Target user exists | Role updated | Not Run | |
| TC-112 | Deactivate user | Manage Users > Deactivate | `tcftr.user2@llcc.edu.ph` | User exists | User status set inactive | Not Run | |
| TC-113 | Reactivate user | Manage Users > Activate | `tcftr.user2@llcc.edu.ph` | User inactive | User status set active | Not Run | |
| TC-114 | Create admin group | Admin Groups > Create | `TCFTR Admin Group` | Superadmin logged in | Group created | Not Run | |
| TC-115 | Update group metadata | Admin Groups > Edit | New description | Group exists | Group details updated | Not Run | |
| TC-116 | Delete group | Admin Groups > Delete | Target group | Group exists | Group removed | Not Run | |
| TC-117 | View system logs | Admin > System Logs | N/A | Superadmin logged in | Logs list and charts load | Not Run | |
| TC-118 | Filter logs by action | System Logs > Action filter | `UPLOAD` | Logs exist | Only matching logs shown | Not Run | |
| TC-119 | Filter logs by user | System Logs > User filter | `tcftr.user1@llcc.edu.ph` | Logs exist | User-specific logs shown | Not Run | |
| TC-120 | View storage/user analytics | Open analytics tabs | N/A | Stats endpoint available | KPI cards/charts display data | Not Run | |
| TC-121 | Open admin trash and search items | Admin > Trash > Search | `TCFTR` | Trashed items exist | Matching trashed items displayed | Not Run | |
| TC-122 | Bulk restore from admin trash | Select items > Bulk Restore | Multiple trash items | Selected items in trash | Items restored and removed from trash view | Not Run | |
| TC-123 | Bulk permanent delete from admin trash | Select items > Bulk Delete | Multiple trash items | Selected items in trash | Items permanently removed | Not Run | |
| TC-124 | Verify action logging for share/upload/delete | Perform action > Check logs | Upload/share/delete events | Logging enabled | Corresponding log records appear with timestamp/user | Not Run | |

---

## 9.1 Title: API/Access Security and Validation

User Story: As system owner, I want security controls to protect data integrity.

Acceptance Criteria

- Unauthorized operations are blocked.
- Role restrictions are enforced.
- Validation rules prevent bad data.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-125 | Non-owner share attempt blocked | Login as unrelated user > attempt share | File owned by another account | Non-owner account | 403 unauthorized response | Not Run | Negative case |
| TC-126 | Evaluator cannot create folders | Login as evaluator > attempt New Folder | evaluator role | Evaluator account | Folder create blocked (read-only reviewer rules) | Not Run | Negative case |
| TC-127 | Invalid role update rejected | PATCH role with unsupported value | `role=invalid_role` | Superadmin role | 400 validation error | Not Run | Negative case |
| TC-128 | Missing required create-user fields rejected | POST /admin/users without email/password | Missing payload fields | Superadmin role | 400 validation error | Not Run | Negative case |
| TC-129 | Share with empty recipient list rejected | Share action with empty emails | `emails=[]` | File exists | Request rejected | Not Run | Negative case |
| TC-130 | COPC unauthorized assignment update blocked | Non-superadmin tries assignment patch | COPC program id | Non-superadmin role | 403 not authorized | Not Run | Negative case |

---

## 10.1 Title: Extended Feature Coverage Addendum

User Story: As system owner and QA lead, I want coverage for remaining platform features so test completeness matches the full feature inventory.

Acceptance Criteria

- Smart document automation flows are covered.
- COPC completeness/request governance flows are covered.
- Admin oversight and support workflows are covered.

| Test Case ID | Test Scenario | Test Steps | Test Data | Prerequisites | Expected Result | Status | Remarks |
|---|---|---|---|---|---|---|---|
| TC-131 | Email notification on share event | Share file to another user with email notif enabled | Sender + receiver emails | SMTP configured | Receiver receives share email notification | Not Run | Extended coverage |
| TC-132 | Email notification on password request decision | Admin approves/rejects password request | Request id + decision | Pending password request exists | Requesting user receives decision email | Not Run | Extended coverage |
| TC-133 | Automatic report generation | Trigger report generation from smart docs/COPC module | Program/report params | Report feature enabled | Report file generated and downloadable | Not Run | Extended coverage |
| TC-134 | Classification prediction suggests destination | Upload/test classify document | Sample document | Classification service enabled | Suggested destination/category is returned | Not Run | Extended coverage |
| TC-135 | Reclassify single file | Run reclassify action on one file | file id + target category | File exists | File category/location metadata updates | Not Run | Extended coverage |
| TC-136 | Bulk reclassify files | Select multiple files > bulk reclassify | multiple file ids + category | Files exist | All selected files update classification | Not Run | Extended coverage |
| TC-137 | Duplicate detection flags same-content files | Upload/scan duplicate-content files | `TCFTR-Duplicate-1.txt`, `TCFTR-Duplicate-2.txt` | Files with same hash exist | Duplicate indicator is shown in results/details | Not Run | Extended coverage |
| TC-138 | COPC completeness checker flags missing requirements | Open completeness dashboard/checklist | COPC program id | COPC program initialized | Missing requirements are highlighted | Not Run | Extended coverage |
| TC-139 | COPC compliance dashboard reflects category status | Open compliance dashboard | COPC program id | Review data exists | Dashboard shows per-category compliance counts/status | Not Run | Extended coverage |
| TC-140 | Create document request to uploader | Reviewer submits request for missing evidence | program/folder + request note | COPC roles assigned | Request appears in target user request queue | Not Run | Extended coverage |
| TC-141 | Fulfill document request and update status | Uploader submits requested document | request id + uploaded evidence | Open request exists | Request status updates to fulfilled/in review | Not Run | Extended coverage |
| TC-142 | Create folder task assignment | Admin creates task for folder requirement | folder id + assignee + due date | Admin permissions | Task is created and visible to assignee | Not Run | Extended coverage |
| TC-143 | Complete assigned folder task | Assignee marks task as complete | task id | Assigned task exists | Task completion status updates with timestamp | Not Run | Extended coverage |
| TC-144 | Admin search across entities | Use admin search for file/user/group/log keywords | `TCFTR`, user email, action keyword | Admin search enabled | Aggregated results from multiple entity types are shown | Not Run | Extended coverage |
| TC-145 | Approve password request workflow | Admin approves pending password request | request id | Pending request exists | Request marked approved; user can proceed with reset/update flow | Not Run | Extended coverage |
| TC-146 | Reject password request workflow | Admin rejects pending password request | request id + reason | Pending request exists | Request marked rejected; user sees reason/notification | Not Run | Extended coverage |
| TC-147 | Help/support feedback submission | Open Help page > submit support details | feedback text + contact info | User logged in | Feedback is accepted and success confirmation is shown | Not Run | Extended coverage |

---

### Status Legend

- `Not Run`: Test case prepared and ready for execution.
- Update to `Pass` or `Fail` after execution in QA/UAT cycle.
