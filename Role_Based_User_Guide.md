# DocuDB Role-Based User Guide

## Overview

This guide explains how each role uses DocuDB. The system has two main working areas:

- The Google Drive-like document management side
- The COPC document workflow side

The roles covered in this guide are:

- `user`
- `dept_chair`
- `qa_admin`
- `evaluator`
- `superadmin`

## Common Login Steps

1. Open the DocuDB login page.
2. Enter your email address.
3. Enter your password.
4. Click `Sign in`.
5. The system opens the pages allowed for your role.

## Common User Interface Areas

- `My Drive`: Main document workspace
- `Shared with me`: Files and folders shared by other users
- `Recent`: Recently accessed or uploaded content
- `Groups`: Collaboration groups
- `Smart Forms`: Template-based document generation
- `Notifications`: Alerts for sharing, review, and workflow actions
- `Settings`: Profile picture and password request page
- `COPC Workflow`: Program workflow overview

## User Guide

### Main Access

Users can access:

- `My Drive`
- `Shared with me`
- `Recent`
- `Groups`
- `Smart Forms`
- `COPC Workflow`
- `COPC Upload`
- `Notifications`
- `Settings`
- `Help`

### Main Responsibilities

- Upload and organize academic or office documents
- Create folders for document organization
- Share files and folders with other users
- Join and use collaboration groups
- Submit required COPC files
- Revise documents when review feedback is given

### How Users Use the Google Drive-like Side

1. Open `My Drive`.
2. Create a folder if needed.
3. Upload files using the upload button or drag and drop.
4. Open files to preview or download them.
5. Use actions such as rename, move, favorite, pin, share, comment, or version history.
6. Check `Shared with me` for files sent by other users.
7. Check `Recent` for recently uploaded or modified files.
8. Open `Groups` for team collaboration.
9. Use `Smart Forms` to generate documents from templates.

### How Users Use the COPC Side

1. Open `COPC Workflow` to view the status of assigned programs.
2. Open `COPC Upload` to submit required files.
3. Upload files into the correct COPC folders.
4. Check completeness and required document status.
5. Monitor notifications for requested revisions or approval progress.
6. Re-upload or update documents when a department chair or QA reviewer requests changes.

### Important Notes for Users

- Users can upload files, but access still depends on assigned folders and permissions.
- Evaluator-only pages are not available to users.
- Password change requests are submitted through `Settings` and reviewed by an administrator.

## Department Chair Guide

### Main Access

Department chairs can access everything available to users, plus:

- `COPC Review`
- Folder task and assignment features for review-related work

### Main Responsibilities

- Review user submissions
- Monitor folder tasks and assigned checklist work
- Request missing or incomplete documents
- Approve or reject submissions during department review
- Forward acceptable submissions to QA review

### How Department Chairs Use the Google Drive-like Side

1. Open `My Drive`.
2. Review folders assigned to your department or COPC program.
3. Upload and organize department-level documents when needed.
4. Open comments and shared files for collaboration.
5. Use `Groups`, `Shared with me`, and `Recent` to manage related files.
6. Request missing documents from users when requirements are incomplete.

### How Department Chairs Use the COPC Side

1. Open `COPC Workflow`.
2. Select a program from the list.
3. Review submission counts and progress indicators.
4. Open `COPC Review`.
5. Check user submissions against the checklist.
6. Approve documents that satisfy requirements.
7. Reject documents that need revision and provide notes.
8. Monitor the program until submissions move to the QA stage.

### Important Notes for Department Chairs

- Department chairs can access the department review page but not the QA review page unless they are also a superadmin.
- Their review actions directly affect file workflow status.

## QA Admin Guide

### Main Access

QA admins can access most user features, plus:

- `QA Compliance Review`
- Folder review and verification features
- Compliance dashboard-related content

### Main Responsibilities

- Review compliance of submitted COPC documents
- Tag document categories when needed
- Approve or reject submissions after QA review
- Add observations for missing or non-compliant evidence
- Monitor folder tasks, progress, and verification indicators

### How QA Admins Use the Google Drive-like Side

1. Open `My Drive`.
2. Access folders assigned for QA review.
3. Use preview, download, version history, comments, and sharing tools.
4. Check checklist progress and dashboard widgets.
5. Restore or manage review-related documents when necessary.
6. Use `Notifications`, `Shared with me`, and `Groups` to coordinate work.

### How QA Admins Use the COPC Side

1. Open `COPC Workflow`.
2. Select the program assigned for QA review.
3. Examine compliance summary and pending QA items.
4. Open `QA Compliance Review`.
5. Verify supporting evidence and tag categories if needed.
6. Approve compliant files.
7. Reject files that require correction and provide notes.
8. Add observations for issues found during internal evaluation.
9. Prepare the program for package compilation.

### Important Notes for QA Admins

- QA admins cannot access evaluator-only pages unless they are also superadmin.
- Their actions affect final compliance readiness and package preparation.

## Evaluator Guide

### Main Access

Evaluators have a more limited workspace. They can access:

- `My Drive` with permitted content
- `Shared with me`
- `Recent`
- `Groups`
- `Notifications`
- `COPC Workflow`
- `Evaluation Stage`

Evaluators do not get the `COPC Upload` page.

### Main Responsibilities

- Review approved COPC materials
- Access final evidence and approved package contents
- Download evaluation materials
- Review compiled reports and evaluation documents

### How Evaluators Use the Google Drive-like Side

1. Log in to the user workspace.
2. Open `Shared with me` or `Recent` for assigned materials.
3. Preview and download documents you are allowed to access.
4. Use notifications to monitor evaluation assignments.

### How Evaluators Use the COPC Side

1. Open `COPC Workflow`.
2. Select the assigned program.
3. Open `Evaluation Stage`.
4. Access the approved program tree and compiled package.
5. Review evidence and final files.
6. Download the evaluation report or package files when needed.

### Important Notes for Evaluators

- Evaluators are read-focused users in the COPC process.
- Upload-related COPC pages are intentionally unavailable to them.

## Superadmin Guide

### Main Access

Superadmins have full system access, including:

- `Admin Workspace`
- `Admin Drive`
- `Manage Users`
- `Groups`
- `Task Management`
- `Trash Management`
- `System Logs`
- `COPC Workflow`
- `COPC Program Management`
- All regular user-side pages

### Main Responsibilities

- Manage users and roles
- Activate or deactivate user accounts
- Create users individually or in bulk
- Manage groups and memberships
- Monitor logs, statistics, and storage-related activities
- Manage administrative folders, tasks, and trash
- Initialize and control COPC workflows
- Assign uploaders, department chairs, QA admins, and evaluators
- Compile, finalize, submit, and archive COPC programs

### How Superadmins Use the Google Drive-like Side

1. Open `Admin Workspace` or `Admin Drive`.
2. Manage document structures at the system level.
3. Open `Manage Users` to create, edit, deactivate, or assign roles.
4. Open `Groups` to create or manage collaborative groups.
5. Open `Task Management` to configure folder assignments and task checklists.
6. Open `Trash Management` to restore or permanently remove items.
7. Open `System Logs` to review user actions and system activity.

### How Superadmins Use the COPC Side

1. Open `COPC Workflow`.
2. Initialize a new program structure.
3. Assign uploaders, department chairs, QA admins, and evaluators.
4. Monitor workflow stages and summary cards.
5. Review progress across submission, department review, QA review, and evaluation.
6. Compile the COPC package.
7. Finalize the program as `COPC Ready`.
8. Lock approved documents.
9. Submit the final package.
10. Archive completed programs.

### Important Notes for Superadmins

- Superadmins can access all role-restricted workflow pages.
- They are the only users with full administrative control over users, logs, system-wide tasks, and final COPC workflow actions.

## Notifications and Password Requests

All applicable roles can use notifications and settings.

### Notifications

Users may receive notifications for:

- File sharing
- Folder sharing
- Comments
- Group updates
- Document requests
- Review-required actions
- Password request decisions

### Password Requests

1. Open `Settings`.
2. Submit a password change request.
3. Wait for admin approval or rejection.
4. Check notifications for the decision.

## Best Practices

- Upload documents to the correct folder before sharing.
- Use clear filenames for COPC and compliance files.
- Review notifications regularly.
- Use comments instead of external messaging when feedback should stay attached to the file.
- For COPC submissions, always check whether a file was approved, rejected, or sent back for revision.

## Related Documents

- Existing general guide: [USER_GUIDE.md](/c:/Users/HP/Documents/CAPSTONE/docudb/USER_GUIDE.md)
- User flows: [User_Flows.md](/c:/Users/HP/Documents/CAPSTONE/docudb/User_Flows.md)
- Use case diagram: [Use_Case_Diagram.mmd](/c:/Users/HP/Documents/CAPSTONE/docudb/Use_Case_Diagram.mmd)
