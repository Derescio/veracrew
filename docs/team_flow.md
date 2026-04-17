### This is the initial Idea
The main idea is about having agencies/ teams be able to coordinate under one roof. The aim is to have a sponsor signup for a plan, the plans are to be decided based on service offerings. They will have the ability to create an organisation and allow for users/team members to join. The organization will require documentation such as images and pdf forms. So They can send a pdf document to be filled out and have documentation for each team member. This documentation will be mandatory for all members including team owners. There will be the ability to add locations by adding the address either directly or using the LNG+LAT or maybe the app will automatically convert the address to the LNG+LAT. This will allow for teams to be clocked in. The clock in feature will only allow clock in within a certain radius and will allow for breaks as well. So clock it at 6AM, break at 11:15-11:30, break again at 3:00-3:30 and clock out at 5PM should log the total hours worked for the day. There will also be a trigger to set the holiday/pay rate. So regular vs time and half or double, these parameters should be flexible for the owner to configure. Document collection, onsite issues, image uploads etc should also be allowed. The admin should also be able to have full visibility based on locations. Im not sure how to incorporate invoicing and crm functionality including how to incorporate emails let us plan out this SaaS app idea including a name and what else might be needed


### Overall App Perspective/Requirments
- workforce management
- ompliance/document tracking
- location-based time tracking
- operations + light CRM

### Core Idea (refined)

A platform where organizations:

- manage teams
- enforce compliance (documents, forms)
- track work (time + location)
- handle operations (issues, images, logs)

## App-Name
  ### Veracrew


## MVP Features

- Sponsor creates org
- Invite members (email link)
- Roles:
  - Owner
  - Manager
  - Worker

## Document Management

- Upload PDFs
- Assign required documents to all users
- Track:
- completed / missing
- Per-user document storage

## Locaton System/Capability

Add location via:
- address → convert to lat/lng (use Google Maps API)
- Store radius (e.g. 30m)

## Clock In / Out System
GPS validation:
must be within radius -> Track:
- clock in
- breaks
- clock out
- Auto-calculate:
   - total hours


## Pay Rules Engine (simple version)
configurable:
- regular
- overtime (1.5x)
- double time
- holiday toggle  functionality. Flexible payment system 

## Activity Logs
- Upload:
  - images
  - notes
  - issues

## Initial CRM (Open for more ideas*)
- clients / projects
- assign teams to jobs
- notes per client

Invoicing

- generate invoice from:
- hours worked
- allow for objections and updates if a mistake is flagged
- export PDF
    - Only specific employee and admin/manager can open or download. Strict privacy 


## 👉 Later: Nice to have

- integrate with Stripe
- add tax and deduction rules based on country
Depending on users: Compliance (future consideration)
- health → HIPAA
- EU → GDPR






## Email System
Resend
### Use cases (open to expansion *):
- invite users
- notify missing documents
- shift reminders
- email to clients with information such as team members, job progress etc

## Suggested Tech Stack (based on what you already use)

- Frontend: Next.js (App Router) ✅
- Backend: API routes / server actions
- DB: PostgreSQL + Prisma ✅
- Auth: NextAuth first, keep auth helpers abstracted so Clerk remains a later migration option if scale or product needs demand it
- Storage: Cloudinary (images) + S3 (docs) or R2 cloudflare
- Maps: Google Maps API
- Payments: Stripe
- Email: Resend

## Other Important Items
1. Permissions system (open to expansion)
Who can:
- view docs
- edit teams
- approve time
2. Audit trail (open to expansion)
  - Who uploaded what
  - When clock-ins happened
3. Offline Issues
 - What happens with no signal *


## Authentication and Authorization

- Default to `NextAuth` / `Auth.js` for Phase 0
- Keep app auth behind local helpers so a future move to `Clerk` does not require app-wide rewrites
- Session should expose at minimum: `userId`, active `organizationId`, and resolved membership `role`

## Prisma Schema (Core Models)

This is designed for but not limited to:

- multi-tenant SaaS
- teams + roles
      - A user can belong to multiple organizations*
- documents + compliance
- time tracking + locations

### Example:
- User:John
- Memberships:
 - Org A → ADMIN
 - Org B → MEMBER

    
# Example DB Models (to be vetted and refined)

```
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  createdAt     DateTime @default(now())

  memberships   Membership[]
  documents     UserDocument[]
  timeEntries   TimeEntry[]
}

model Organization {
  id            String   @id @default(cuid())
  name          String
  ownerId       String
  createdAt     DateTime @default(now())

  owner         User     @relation(fields: [ownerId], references: [id])
  memberships   Membership[]
  locations     Location[]
  documents     DocumentTemplate[]
}

model Membership {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  role            Role     @default(MEMBER)

  user            User     @relation(fields: [userId], references: [id])
  organization    Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
}

enum Role {
  OWNER
  ADMIN
  MANAGER
  MEMBER
}
```
```
model DocumentTemplate {
  id              String   @id @default(cuid())
  name            String
  fileUrl         String
  organizationId  String
  required        Boolean  @default(true)

  organization    Organization @relation(fields: [organizationId], references: [id])
  userDocuments   UserDocument[]
}

model UserDocument {
  id            String   @id @default(cuid())
  userId        String
  templateId    String
  fileUrl       String
  status        DocumentStatus @default(PENDING)

  user          User     @relation(fields: [userId], references: [id])
  template      DocumentTemplate @relation(fields: [templateId], references: [id])
}

enum DocumentStatus {
  PENDING
  SUBMITTED
  APPROVED
  REJECTED
}
```
```
model Location {
  id              String   @id @default(cuid())
  name            String
  address         String
  lat             Float
  lng             Float
  radiusMeters    Int      @default(100)

  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])

  timeEntries     TimeEntry[]
}
```
```
model TimeEntry {
  id            String   @id @default(cuid())
  userId        String
  locationId    String

  clockIn       DateTime
  clockOut      DateTime?

  user          User     @relation(fields: [userId], references: [id])
  location      Location @relation(fields: [locationId], references: [id])

  breaks        Break[]
}

model Break {
  id            String   @id @default(cuid())
  timeEntryId   String
  start         DateTime
  end           DateTime?

  timeEntry     TimeEntry @relation(fields: [timeEntryId], references: [id])
}
```
```
model Client {
  id              String   @id @default(cuid())
  name            String
  organizationId  String

  organization    Organization @relation(fields: [organizationId], references: [id])
}

model Invoice {
  id              String   @id @default(cuid())
  organizationId  String
  clientId        String
  total           Float
  status          String

  createdAt       DateTime @default(now())
}
```

## Data Isolation

Every query MUST include:

organizationId

Example:
```
where: {
  organizationId: session.orgId
}
```
```
prisma.location.findMany({
  where: { organizationId }
})
OR
prisma.db.location.findMany({
  where: { organizationId }
})
```
## Example session steps
Step 1: Get session

Using NextAuth:

const session = await getServerSession(authOptions);

session.user.id
session.orgId
session.role

Step 2: Permission helper

Create a utility:

export function requireRole(role: Role, userRole: Role) {
  const hierarchy = {
    OWNER: 4,
    ADMIN: 3,
    MANAGER: 2,
    MEMBER: 1,
  };

  if (hierarchy[userRole] < hierarchy[role]) {
    throw new Error("Unauthorized");
  }
}
📡 Example API Routes
✅ Create Location
POST /api/locations
requireRole("MANAGER", session.role);

await prisma.location.create({
  data: {
    name,
    lat,
    lng,
    organizationId: session.orgId,
  }
});
✅ Clock In
POST /api/time/clock-in

Steps:

- Get user location
- Fetch location from DB
- Calculate distance
- Allow or reject
- Distance check (important)

    - function getDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula
}

## Example Permissions Matrix (open to expansion)

|  Action        | Role     |
| ------------- | -------- |
| Create org    | OWNER    |
| Invite users  | ADMIN+   |
| Add locations | MANAGER+ |
| Approve docs  | MANAGER+ |
| Clock in      | MEMBER   |

## Data Storage - Exmaple

```
const path = `org_${orgId}/documents/user_${userId}/${fileName}`;
- Store in DB:
fileUrl: "https://s3.amazonaws.com/opsatlas/org_123/documents/user_456/file.pdf"
- then organizationId: orgId
```

- logical isolation
- easy querying
- secure access control

## Enforcement Example
```
if (file.organizationId !== session.orgId) {
  throw new Error("Unauthorized");
}
```

- Prefix by organizationId
- Store metadata in DB
- Use signed URLs
- Enforce access in backend
- use signed URLs
- NEVER expose raw bucket publicly
- validate organizationId in backend

## Every query must include:
```
where: { organizationId: session.orgId }

And for single records:

if (resource.organizationId !== session.orgId) {
  throw new Error("Unauthorized");
}

requireRole("MANAGER", session.role);

validate inputs (zod)
never trust client data

👉 Apply this to EVERY sensitive route
```

## File Upload Security (BIG ONE)
The app allowscfle uploads:
- PDFs
- images
- uploads
Risks:
- malware uploads
- huge files (DoS / cost spike)
- unauthorized access
- file overwrite attacks

## Distance risk Mitigation
Check distance (Haversine)
Add:
timestamp validation
IP rough location check (optional)
Flag suspicious behavior:
frequent out-of-radius attempts

## Strict Validation rules  needed

## Time Tracking Integrity
- Risk:
  - workers editing time entries
  - fake breaks
  - manipulating hours
- Fix
 - Make entries immutable after submission
 - Admin approval flow (optional)
 - Log all edits (audit trail clock-in, uploads, approvals, role changes, time updates if any by admin or manager etc)

## Email Abuse
Risk:
spam
account takeover via links
✅ Fix
rate limit email sends
expire invite links
single-use tokens 

## API Abuse / Rate Limiting
Risk:
- bots hitting endpoints
- brute force attacks
- cost spikes
## ✅ Fix
Use middleware/proxy(Nextjs 16) rate limiting
Example tools:
Upstash Redis (prefered)
simple in-memory throttle (early stage)

# Caching Strategy

## Static Assets (AGGRESSIVE CACHE)
Includes:
images
PDFs
uploaded files
Policy:
  - Cache-Control: public, max-age=31536000, immutable

## Organization-Level Data (MODERATE CACHE)

Includes:
locations
document templates
team list (read-only views)
Policy:
   - Cache-Control: private, max-age=60, stale-while-revalidate=300
   ```
   fetch(url, {
  next: { revalidate: 60 }
});
```

## User-Specific / Real-Time Data (NO CACHE or VERY SHORT)

Includes:
clock-in status
active sessions
time tracking
Policy:
  -Cache-Control: no-store

## Sample Cache Rule 
Cache data that changes rarely,
NEVER cache data that affects money, time, or permissions

Next.js Data Cache (built-in) → for most reads
Tag-based revalidation → for consistency
Redis (optional layer) → for hot data + rate limiting

👉 Think:

Next.js = smart caching
Redis = performance boost under load

Layer 1 (CDN)
- static assets (images, PDFs)
Layer 2 (Next.js Cache)
- org data
- tags + revalidation
Layer 3 (Redis)
- hot/shared data
- rate limiting
Layer 4 (DB)
- source of truth