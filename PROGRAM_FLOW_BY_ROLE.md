# DocuDB Complete Program Flow by Role (Feature-Based)

This document provides full role-based flowcharts based on the implemented frontend routes, role guards, and backend workflow permissions.

## 1. Common Authentication and Role Routing

```mermaid
flowchart TD
    A([Open DocuDB]) --> B[Enter email and password]
    B --> C{Credentials valid and account active?}
    C -- No --> D[Show login error and retry]
    C -- Yes --> E[Normalize role alias]
    E --> F{Role is superadmin?}
    F -- Yes --> G[/Admin Workspace: /admin/]
    F -- No --> H[/User Workspace: /]
    G --> I[Open role-specific modules]
    H --> I
```

Role aliases normalized by system:

- `admin` -> `superadmin`
- `faculty` -> `user`
- `program_chair`, `department_chair`, `program_head` -> `dept_chair`
- `qa_officer`, `quality_assurance_admin`, `copc_reviewer` -> `qa_admin`
- `reviewer` -> `evaluator`

## 2. User (`user`) Complete Feature Flow

```mermaid
flowchart TD
    A([User Dashboard]) --> B[My Drive]
    B --> B1[Create folders and organize tree]
    B --> B2[Upload files button or drag and drop]
    B --> B3[File and folder actions]
    B3 --> B31[Preview and download]
    B3 --> B32[Rename, move, share, manage shares]
    B3 --> B33[Comments and version history]
    B3 --> B34[Favorite and pin]

    A --> C[Shared with me and Recent]
    C --> C1[Open shared/group items]
    C --> C2[Search and filter to locate files]

    A --> D[Groups]
    D --> D1[View members, announcements, shared content]

    A --> E[Smart Forms]
    E --> E1[Build or use templates]
    E --> E2[Generate documents to destination folder]

    A --> F[Document Editor]
    F --> F1[Edit supported files]
    F --> F2[Save content as new version]

    A --> G[COPC Dashboard]
    G --> G1[Workflow and status overview]
    G --> G2[COPC Upload workspace]
    G2 --> G21[Select assigned program and folder]
    G21 --> G22[Upload evidence files]
    G22 --> G23[Track my upload status]
    G23 --> G24{Review outcome}
    G24 -- Approved --> G25[Document progresses to verified package]
    G24 -- Rejected by Dept Chair or QA --> G26[Revise file and re-upload]
    G26 --> G22

    G --> G3[Tasks Assigned to Me]
    G3 --> G31[Open folder from task card]

    A --> H[Notifications]
    H --> H1[Open target pages from alerts]
    H --> H2[Mark single or all as read]

    A --> I[Settings]
    I --> I1[Update profile and profile picture]
    I --> I2[Reset password via email OTP]
    I --> I3[Save preferences]

    A --> J[Help and feedback]
```

## 3. Department Chair (`dept_chair`) Complete Feature Flow

```mermaid
flowchart TD
    A([Department Chair Dashboard]) --> B[All standard user modules]

    A --> C[COPC Dashboard]
    C --> C1[Workflow overview and program metrics]
    C --> C2[Department Review queue]
    C2 --> C21[Select program and filter pending/completed/revision]
    C21 --> C22[Open submission preview and notes]
    C22 --> C23{Review decision}
    C23 -- Approve --> C24[Move file to pending QA and notify QA]
    C23 -- Request revision --> C25[Mark rejected at dept stage and notify uploader]
    C23 -- Reject --> C25
    C25 --> C26[Uploader revises and re-uploads]
    C26 --> C21

    C --> C3[Task Management]
    C3 --> C31[Select COPC program and folder]
    C31 --> C32[Create, edit, remove checklist tasks]
    C32 --> C33[Assign uploaders to tasks]
    C33 --> C34[Update task status board]

    A --> D[COPC Upload Activity]
    D --> D1[Monitor newest uploads and top uploaders]
```

## 4. QA Admin (`qa_admin`) Complete Feature Flow

```mermaid
flowchart TD
    A([QA Admin Dashboard]) --> B[All standard user modules]

    A --> C[COPC Dashboard]
    C --> C1[Workflow overview and compliance counts]
    C --> C2[QA Compliance Review queue]
    C2 --> C21[Select program and filter pending/completed/revision]
    C21 --> C22[Open file preview and review details]
    C22 --> C23[Optional: tag compliance category and tags]
    C23 --> C24{QA decision}
    C24 -- Approve --> C25[Mark file approved and verified]
    C25 --> C26[Include file in approved compilation tree]
    C24 -- Request missing files --> C27[Reject with missing-file note]
    C24 -- Reject --> C27
    C27 --> C28[Notify uploader for correction]
    C28 --> C21

    C --> C3[Compilation stage]
    C3 --> C31[Generate COPC package]
    C31 --> C32[Download compiled ZIP]

    C --> C4[Workflow action archive]

    A --> D[COPC Upload Activity]
    D --> D1[Monitor recent submission patterns]
```

## 5. Evaluator (`evaluator`) Complete Feature Flow

```mermaid
flowchart TD
    A([Evaluator Dashboard]) --> B[Read-oriented file modules]
    B --> B1[My Drive, Shared with me, Recent, Groups]

    A --> C[COPC Dashboard]
    C --> C1[Evaluation Stage]
    C1 --> C11[Select assigned program]
    C11 --> C12[View compliance dashboard and approved document tree]
    C12 --> C13[Search and inspect verified evidence]
    C13 --> C14[Download COPC package]
    C13 --> C15[Download evaluation report CSV]

    C --> C2[Workflow observations]
    C2 --> C21[Add internal evaluation observation]

    A --> D[Notifications and Settings]
    A --> E[Restriction]
    E --> E1[No COPC upload actions]
    E --> E2[No edit/delete permissions in evaluation scope]
```

## 6. Superadmin (`superadmin`) Complete Feature Flow

```mermaid
flowchart TD
    A([Superadmin Admin Workspace]) --> B[System Governance]
    B --> B1[Manage Users]
    B1 --> B11[Create single users]
    B1 --> B12[Bulk import users]
    B1 --> B13[Edit profile and role]
    B1 --> B14[Activate or deactivate accounts]

    B --> B2[Group Administration]
    B2 --> B21[Create, edit, delete groups]
    B2 --> B22[Manage members and leaders]

    B --> B3[Admin Files]
    B3 --> B31[System-wide file and folder operations]

    B --> B4[Trash Management]
    B4 --> B41[Restore or permanently delete]

    B --> B5[System Logs and Admin Search]

    A --> C[COPC Lifecycle Control]
    C --> C1[Initialize COPC Program]
    C1 --> C11[Set code, name, description, year]

    C --> C2[Assign COPC Roles]
    C2 --> C21[Uploaders and uploader groups]
    C2 --> C22[Department chairs]
    C2 --> C23[QA admins]
    C2 --> C24[Evaluators]

    C --> C3[Workflow Monitoring]
    C3 --> C31[Submission tracker]
    C3 --> C32[Progress and compliance summary]

    C --> C4[Task Management]
    C4 --> C41[Create and edit folder tasks]
    C4 --> C42[Assign task uploaders]
    C4 --> C43[Track task board progress]

    C --> C5[Program Management]
    C5 --> C51[Edit program metadata]
    C5 --> C52[Lock and unlock scope]
    C5 --> C53[Archive program]
    C5 --> C54[Delete program workspace]

    C --> C6[Finalization]
    C6 --> C61[Compile package]
    C6 --> C62[Final approval]
    C62 --> C63[Auto-lock after COPC Ready]
    C63 --> C64[Download final package]

    A --> D[Archived Programs]
    D --> D1[Review archived records]
    D --> D2[Unarchive when needed]

    A --> E[Recent COPC Upload Monitoring]
```

## 7. Cross-Role Exception and Control Flows

### 7.1 Rejection and Revision Loop

```mermaid
flowchart TD
    A[Uploader submits file] --> B[Department Chair review]
    B --> C{Approved by Dept Chair?}
    C -- No --> D[Rejected or revision requested]
    D --> E[Uploader updates file and re-uploads]
    E --> B
    C -- Yes --> F[QA review]
    F --> G{Approved by QA?}
    G -- No --> H[Rejected or missing files requested]
    H --> E
    G -- Yes --> I[Fully approved and included in compilation]
```

### 7.2 Locked COPC Scope Path

```mermaid
flowchart TD
    A[Superadmin final approval] --> B[Program becomes COPC Ready]
    B --> C[System locks COPC scope]
    C --> D{Any upload, move, rename, delete, edit request?}
    D -- Yes --> E[Block action with locked-scope response]
    D -- No --> F[Read and download actions continue]
    C --> G[Superadmin unlock required to modify again]
```

### 7.3 Access Denied Path

```mermaid
flowchart TD
    A[User attempts restricted route or action] --> B[Role and assignment check]
    B --> C{Authorized?}
    C -- Yes --> D[Proceed]
    C -- No --> E[Return authorization error and block action]
    E --> F[Request role or assignment update from superadmin]
```

## 8. Role-to-Feature Coverage Matrix

| Feature / Module | User | Dept Chair | QA Admin | Evaluator | Superadmin |
|---|---|---|---|---|---|
| My Drive core file and folder operations | Yes | Yes | Yes | Limited read | Yes |
| Shared with me and Recent | Yes | Yes | Yes | Yes | Yes |
| Groups collaboration | Yes | Yes | Yes | Yes | Admin + user-side |
| Smart Forms and document generation | Yes | Yes | Yes | Limited/optional | Yes |
| Document editor and version save | Yes | Yes | Yes | Limited read-only use | Yes |
| COPC workflow overview | Yes | Yes | Yes | Yes | Yes |
| COPC upload workspace | Yes | Yes | Yes | No | Via user-side route if needed |
| Tasks Assigned to Me | Yes | Yes | Yes | Yes | In user-context only |
| Task Management board | No | Yes | No | No | Yes |
| Department review queue | No | Yes | No | No | Yes |
| QA compliance review queue | No | No | Yes | No | Yes |
| Compliance tagging (QA) | No | No | Yes | No | Yes |
| Evaluation stage | No | No | No | Yes | Yes |
| Compile COPC package | No | No | Yes | No | Yes |
| Final approval (COPC Ready + lock) | No | No | No | No | Yes |
| Program lock/unlock, archive, delete, unarchive | No | No | Archive support only | No | Yes |
| COPC upload activity dashboard | No | Yes | Yes | No | Yes |
| Manage users and roles | No | No | No | No | Yes |
| Admin files, trash management, logs | No | No | No | No | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes |
| Settings (profile + OTP password reset) | Yes | Yes | Yes | Yes | Yes |

---

If you want, I can also generate a separate `.mmd` file version of each role diagram so you can export PNG/SVG directly for your documentation or defense slides.
