# MaintenanceHub User Documentation

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Equipment Management](#equipment-management)
4. [Work Order Management](#work-order-management)
5. [Inventory & Parts](#inventory--parts)
6. [Preventive Maintenance (PM) Schedules](#preventive-maintenance-pm-schedules)
7. [Downtime Analysis](#downtime-analysis)
8. [Root Cause Analysis (RCA)](#root-cause-analysis-rca)
9. [AI Troubleshooting](#ai-troubleshooting)
10. [C4 University Training](#c4-university-training)
11. [Path to Excellence](#path-to-excellence)
12. [Reports & Analytics](#reports--analytics)
13. [Admin Settings](#admin-settings)
14. [Billing & Subscription](#billing--subscription)

---

## Getting Started

### First-Time Login
1. Navigate to your MaintenanceHub URL
2. Click "Sign In" on the landing page
3. Enter your email and password provided by your administrator
4. Upon first login, you'll be directed to the Dashboard

### Requesting Access (New Users)
1. Click "Request Access" on the login page
2. Enter your email address
3. Wait for an administrator to approve your request
4. You'll receive an email with login credentials once approved

### Password Recovery
1. Click "Forgot Password" on the login page
2. Enter your registered email address
3. Check your email for a password reset link
4. Follow the link to set a new password

> **Note**: Email delivery may take a few minutes. Check your spam folder if you don't receive the email promptly. Contact your administrator if issues persist.

---

## Dashboard Overview

The Dashboard provides a real-time snapshot of your maintenance operations:

### Key Metrics Displayed
- **Open Work Orders**: Total active work orders requiring attention
- **Overdue Work Orders**: Work orders past their due date
- **PM Compliance**: Percentage of preventive maintenance tasks completed on time
- **Equipment Uptime**: Overall equipment availability percentage

### Recent Activity
- Latest work orders created or updated
- Recently completed maintenance tasks
- Equipment status changes

### Quick Actions
- Create new work order
- View pending approvals (Managers/Admins)
- Access AI troubleshooting

---

## Equipment Management

### Viewing Equipment
1. Navigate to **Equipment** in the sidebar
2. Browse the equipment list or use search/filters
3. Click on any equipment to view details

### Adding New Equipment
1. Click the **+ Add Equipment** button
2. Fill in required fields:
   - Equipment Name
   - Equipment ID/Tag
   - Category (Production, Utilities, HVAC, etc.)
   - Location
   - Criticality Level
3. Optional: Add specifications, manufacturer info, purchase date
4. Click **Save**

### Importing Equipment from Files
1. Go to **Equipment** > **Import**
2. Upload your file (PDF, Excel, Word, or CSV)
3. AI will automatically extract equipment data
4. Review the extracted information
5. Click **Import All Data** to confirm

### Equipment Hierarchy
MaintenanceHub supports a multi-level asset hierarchy:
- **Site** > **Area** > **Line** > **Equipment** > **Component**

To set up hierarchy:
1. Open equipment details
2. Click **Set Parent Equipment**
3. Select the parent asset from the list
4. Save changes

### QR Codes
Each equipment generates a unique QR code for quick mobile access:
1. Open equipment details
2. Click **View QR Code**
3. Print or download for physical labeling

### Equipment Manual Analysis (AI-Powered)
Upload equipment manuals and let AI extract valuable information:

1. Open equipment details
2. Go to the **Manuals & Documents** section
3. Click **Upload Manual**
4. Select your PDF, Word, or Excel file
5. AI automatically extracts:
   - Maintenance procedures
   - Parts lists
   - Safety warnings
   - Troubleshooting guides
   - Specifications

**Using Extracted Information:**
- Click on any extracted section to view details
- Link maintenance procedures to PM schedules
- Import parts directly to inventory
- Generate work orders from procedures

---

## Work Order Management

### Creating a Work Order
1. Navigate to **Work Orders**
2. Click **+ New Work Order**
3. Complete the form:
   - Title (brief description)
   - Equipment (select from list)
   - Priority (Low, Medium, High, Critical)
   - Type (Corrective, Preventive, Predictive, etc.)
   - Description (detailed problem/task)
   - Assigned To (optional)
   - Due Date
4. Click **Submit**

### Work Order Approval Workflow
**For Technicians:**
- Create work orders as "Draft"
- Click **Submit for Approval** when ready
- Work order moves to "Pending Approval" status

**For Managers/Admins:**
1. View pending work orders in the **Pending Approval** tab
2. Review details and click **Approve** or **Reject**
3. Provide rejection reason if declining

### Status Transitions
- **Draft** → Submit → **Pending Approval**
- **Pending Approval** → Approve → **Open**
- **Open** → Start Work → **In Progress**
- **In Progress** → Complete → **Completed**

### Timer System
1. Open your assigned work order
2. Click **Start Timer** to begin tracking
3. Use **Pause** for breaks (select reason: Lunch, Waiting for Parts, Meeting, etc.)
4. Click **Resume** to continue
5. Click **Stop** when finished

---

## Inventory & Parts

### Viewing Inventory
1. Go to **Inventory** in the sidebar
2. View all parts with stock levels
3. Use filters: In Stock, Low Stock, Out of Stock

### Adding Parts
1. Click **+ Add Part**
2. Enter part information:
   - Part Number
   - Description
   - Category
   - Current Quantity
   - Minimum Stock Level
   - Unit Cost
   - Location
3. Click **Save**

### Low Stock Alerts
- Parts below minimum stock level are highlighted
- Dashboard shows low stock notification count
- Set up email alerts in Admin Settings

### Barcode Scanner
1. Click the barcode icon in the search bar
2. Grant camera permissions if prompted
3. Scan a part barcode
4. Part details appear automatically

### Adding Parts to Work Orders
1. Open a work order
2. Scroll to **Parts Required** section
3. Click **Add Part**
4. Search and select part
5. Enter quantity needed
6. Click **Add**

---

## Preventive Maintenance (PM) Schedules

### Creating PM Schedules
1. Go to **PM Schedules**
2. Click **+ New PM Schedule**
3. Complete the form:
   - Name/Title
   - Equipment
   - Frequency (Daily, Weekly, Monthly, etc.)
   - Tasks (list of maintenance steps)
   - Required Parts
   - Estimated Duration
4. Click **Save**

### Importing PM Schedules
1. Go to **PM Schedules** > **Import**
2. Upload your PM documentation (PDF, Excel, Word)
3. AI extracts schedule information
4. Review and edit as needed
5. Click **Import**

### PM Optimization (AI-Powered)
1. Open a PM Schedule
2. Click **Optimize with AI**
3. Review AI recommendations:
   - Frequency adjustments
   - Task consolidation
   - Cost savings opportunities
4. Accept or modify suggestions

### PM Due Dates
- View upcoming PMs in the **Calendar** view
- Overdue PMs appear in red
- System auto-generates work orders for due PMs

---

## Downtime Analysis

### Recording Downtime
1. Go to **Downtime**
2. Click **+ New Downtime Record**
3. Enter details:
   - Equipment
   - Start Time
   - End Time
   - Reason Category
   - Description
4. Click **Save**

### Importing Downtime Data
1. Click **Import Data**
2. Upload Excel/CSV file with downtime records
3. Map columns to system fields
4. Click **Import**

### AI-Powered Analysis
1. Select a date range
2. Click **Analyze with AI**
3. Review insights:
   - Top downtime causes
   - Pattern identification
   - Recommended actions
   - Cost impact analysis

### PDF Reports
1. Configure report parameters
2. Click **Generate Report**
3. Download professional PDF with:
   - Executive summary
   - Trend charts
   - Root cause breakdown
   - Recommendations

---

## Root Cause Analysis (RCA)

### Creating an RCA
1. Navigate to **RCA**
2. Click **+ New RCA**
3. Complete the multi-tab form:

**Tab 1: Problem & 5 Whys**
- Define the problem statement
- Answer the 5 Whys progressively
- Each "Why" drills deeper into causes

**Tab 2: Fishbone Diagram**
- Analyze causes across categories:
  - Man (People)
  - Machine (Equipment)
  - Method (Process)
  - Material (Supplies)
  - Measurement (Data)
  - Environment

**Tab 3: Root Causes**
- Document identified root causes
- Link to specific equipment/work orders

**Tab 4: Corrective Actions**
- Define action items
- Assign responsible parties
- Set due dates
- Track completion

### AI Assistance
- Click **Get AI Insights** at any step
- AI provides suggestions based on your data
- Accept, modify, or ignore recommendations

---

## AI Troubleshooting

### Starting a Session
1. Go to **Troubleshooting**
2. Click **New Session**
3. Describe your problem in the text box
4. Click **Start**

### Guided Coaching Process
The AI guides you through a 6-step troubleshooting method:

1. **Identify** - Define the specific problem
2. **Gather** - Collect relevant information
3. **Analyze** - Examine possible causes
4. **Plan** - Develop solution approach
5. **Implement** - Execute the solution
6. **Observe** - Verify results

### Using the Session
- Respond to AI questions thoughtfully
- Provide specific details about symptoms
- Follow recommended diagnostic steps
- Document findings for future reference

### Session History
- All sessions are saved automatically
- Access past sessions from the Troubleshooting page
- Review successful solutions for similar problems

---

## C4 University Training

### Accessing Training
1. Go to **Training** in the sidebar
2. Browse available modules by category:
   - Maintenance Fundamentals
   - Equipment-Specific Training
   - Safety Procedures
   - Soft Skills

### Completing Modules
1. Click on a module to open it
2. Review all content sections
3. Complete any quizzes or assessments
4. Mark sections as complete

### Progress Tracking
- View your completion percentage
- Track time spent on training
- See upcoming required modules

### Earning Certificates
1. Complete all module requirements
2. Pass the final assessment (if required)
3. Certificate generates automatically
4. Download and print your certificate

### Badges
- Earn badges for achievements:
  - First Module Complete
  - Quick Learner
  - Expert Level
  - Perfect Score

---

## Path to Excellence

The Path to Excellence module guides your organization through a proven 6-step maintenance improvement program.

### The Six Steps

**Step 1: Equipment Criticality Assessment (20 tasks)**
- Rank equipment by operational importance
- Define criticality criteria
- Document justifications

**Step 2: Root Cause Analysis System (22 tasks)**
- Establish RCA processes
- Train team members
- Implement tracking systems

**Step 3: Storeroom MRO Optimization (22 tasks)**
- Organize inventory
- Set min/max levels
- Improve parts availability

**Step 4: PM Excellence (22 tasks)**
- Review PM schedules
- Optimize frequencies
- Ensure effectiveness

**Step 5: Data-Driven Performance Management (22 tasks)**
- Define KPIs
- Implement tracking
- Create dashboards

**Step 6: Continuous Improvement & Sustainability (23 tasks)**
- Establish review cycles
- Document improvements
- Sustain gains

### Using the Tool
1. Navigate to **Path to Excellence**
2. Select your current step
3. Work through each checklist item
4. Check off completed tasks
5. Add notes and deliverables
6. Progress automatically saves

### Generating Reports
1. Click **Generate Report** in any step
2. Professional PDF includes:
   - Step progress summary
   - Completed tasks
   - Notes and findings
   - Recommendations

---

## Reports & Analytics

### Available Reports
- **Work Order Summary**: Open, completed, overdue counts
- **Equipment Performance**: Uptime, failure rates
- **PM Compliance**: Schedule adherence
- **Inventory Status**: Stock levels, usage trends
- **Downtime Analysis**: Causes, duration, costs
- **Technician Performance**: Response times, completion rates

### Generating Reports
1. Go to **Reports**
2. Select report type
3. Set date range and filters
4. Click **Generate**
5. View on-screen or download PDF

### Scheduled Reports
1. Configure report parameters
2. Click **Schedule**
3. Set frequency (Daily, Weekly, Monthly)
4. Add email recipients
5. Reports send automatically

---

## Admin Settings

### User Management
**Adding Users:**
1. Go to **Admin** > **Users**
2. Click **Invite User**
3. Enter email and select role:
   - **Tech**: Basic access, own work orders
   - **Manager**: Team oversight, approvals
   - **Admin**: Full company access
4. Click **Send Invitation**

**Managing Users:**
- Edit user details
- Change roles
- Deactivate accounts
- Reset passwords

### Company Settings
1. Go to **Admin** > **Company**
2. Update:
   - Company name
   - Logo
   - Contact information
   - Time zone
   - Work order number format

### Module Permissions
Control which features are available to your team:
1. Go to **Admin** > **Modules**
2. Toggle modules on/off:
   - AI Features
   - RCA
   - Training
   - Path to Excellence
   - Integrations

---

## Billing & Subscription

### Viewing Subscription
1. Go to **Admin** > **Billing**
2. View current plan details:
   - Subscription tier
   - User seats (Manager: $100/month, Tech: $50/month)
   - Current usage
   - Next billing date

### Managing Payment
1. Click **Payment Methods**
2. Add or update credit card
3. View payment history
4. Download invoices

### Upgrading/Downgrading
1. Click **Change Plan**
2. Select new tier
3. Review price change
4. Confirm update

### Adding Seats
1. Invite new users (seats auto-added)
2. View seat summary in billing
3. Charges pro-rated for partial months

---

## Support & Help

### Getting Help
- Click the **?** icon in the bottom-right corner
- Access in-app help articles
- View video tutorials

### Contacting Support
- Email: support@maintenancehub.org
- Include:
  - Your company name
  - Description of issue
  - Screenshots if applicable

### Reporting Bugs
1. Describe the issue clearly
2. Note steps to reproduce
3. Include browser and device info
4. Submit via support email

---

## Mobile Access

MaintenanceHub is fully responsive and works on mobile devices:

1. Open your browser on any smartphone or tablet
2. Navigate to your MaintenanceHub URL
3. Log in with your credentials
4. Access all features optimized for touch

**Mobile-Optimized Features:**
- QR code scanning for equipment
- Quick work order updates
- Photo attachments
- Timer controls

---

## Frequently Asked Questions

**Q: Can I access MaintenanceHub offline?**
A: Currently, an internet connection is required. Offline mode is planned for future releases.

**Q: How do I export my data?**
A: Use the Reports section to generate PDFs, or contact support for data exports.

**Q: Can I customize work order fields?**
A: Custom fields are available on Enterprise plans. Contact support for details.

**Q: How is my data backed up?**
A: Data is automatically backed up daily to secure cloud storage.

**Q: Can I integrate with other systems?**
A: Yes, use the Integrations module to connect with CMMS, ERP, and other systems.

---

*Last Updated: December 2025*
*Version: 1.0*
