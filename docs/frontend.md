# 🚀 **Gmail Assistant Frontend - MVP Implementation Plan**

## 🎯 **Phase Overview**

**Objective:** Create a simple two-panel dashboard that proves the entire backend pipeline works in real environment.

**Goal:** Get email-to-draft workflow working with basic UI, not polished UX (that comes later).

**Success Metric:** User can see email arrive → AI draft generated → take action (approve/send/edit/delete)

---

## 📱 **Dashboard Architecture - MVP**

### **Simple Two-Panel Layout**
```
┌─ DASHBOARD ─────────────────────────────────────────────┐
│  [Status Bar] 🟢 Live | 📧 1 new email | 📝 1 new draft  │
├─────────────────────────────────────────────────────────┤
│  ┌─ LEFT: EMAIL PANEL ──┬─ RIGHT: DRAFT PANEL ─────────┐ │
│  │                      │                              │ │
│  │   📧 LATEST EMAIL    │    📝 AI-GENERATED DRAFT     │ │
│  │                      │                              │ │
│  │   From: Boss         │    To: Boss                  │ │
│  │   Subject: Urgent... │    Subject: Re: Urgent...   │ │
│  │   Time: 2 min ago    │    Generated: 30 sec ago    │ │
│  │   Status: 🆕 NEW     │    Status: ⏳ PENDING        │ │
│  │                      │                              │ │
│  │   [Preview text...]  │    [Draft content...]       │ │
│  │                      │                              │ │
│  │   [📄 VIEW FULL]     │    [✅ APPROVE & SEND]       │ │
│  │                      │    [✏️ EDIT] [🗑️ DELETE]    │ │
│  └──────────────────────┴──────────────────────────────┘ │
│                                                         │
│  🔄 Auto-refresh: 30s   📊 Last update: 2 min ago      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 **Real-Time Update Strategy**

### **Polling Approach (MVP)**
- **Every 30 seconds:** Fetch latest email and latest draft
- **Visual indicators:** Show "NEW!" when data updates
- **Status tracking:** Connected email ↔ draft relationship
- **Simple & reliable:** No WebSocket complexity for MVP

### **API Endpoints to Use**
```javascript
// Get latest email (left panel)
GET /emails?limit=1&sort=date_desc

// Get latest draft (right panel)  
GET /auto-drafts?limit=1&sort=created_at_desc

// Draft actions (right panel buttons)
POST /auto-drafts/:id/approve
POST /auto-drafts/:id/send  
PUT /auto-drafts/:id (for editing)
DELETE /auto-drafts/:id
```

---

## 📊 **Component Architecture (Best Practices)**

```
src/
├── components/
│   ├── ui/                     # Reusable UI components (shadcn/ui style)
│   │   ├── Button.tsx          # Consistent button component
│   │   ├── Card.tsx            # Card wrapper component  
│   │   ├── Badge.tsx           # Status badges
│   │   ├── Spinner.tsx         # Loading indicators
│   │   └── Toast.tsx           # Notification component
│   ├── layout/
│   │   ├── Dashboard.tsx       # Main container with grid
│   │   └── StatusBar.tsx       # Top status indicator
│   ├── email/
│   │   ├── EmailPanel.tsx      # Left panel - latest email
│   │   ├── EmailCard.tsx       # Individual email display
│   │   └── EmailPreview.tsx    # Email content preview
│   └── draft/
│       ├── DraftPanel.tsx      # Right panel - AI draft
│       ├── DraftCard.tsx       # Individual draft display
│       ├── DraftActions.tsx    # Action buttons group
│       └── DraftEditor.tsx     # Edit draft component
├── hooks/
│   ├── usePolling.ts          # 30s polling hook with cleanup
│   ├── useEmails.ts           # Email data with React Query
│   ├── useDrafts.ts           # Draft data with React Query
│   ├── useToast.ts            # Toast notifications
│   └── useLocalStorage.ts     # Persist user preferences
├── services/
│   ├── api.ts                 # Axios instance with interceptors
│   ├── emailService.ts        # Email-specific API calls
│   └── draftService.ts        # Draft-specific API calls
├── lib/
│   ├── utils.ts               # Utility functions (cn, formatDate, etc.)
│   └── constants.ts           # App constants
├── types/
│   ├── email.ts               # Email-related interfaces
│   ├── draft.ts               # Draft-related interfaces
│   └── api.ts                 # API response interfaces
└── styles/
    └── globals.css            # Tailwind base styles
```

---

## 🏗️ **Best Practices & Standards**

### **Code Quality Standards**
```json
// ESLint + Prettier Configuration
{
  "extends": ["@next/next/recommended", "@typescript-eslint/recommended"],
  "rules": {
    "prefer-const": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### **TypeScript Standards**
- **Strict mode enabled:** `strict: true, noImplicitAny: true`
- **Proper interfaces:** No `any` types, explicit return types
- **Generic constraints:** Proper type safety for API responses
- **Discriminated unions:** For status types and variants

### **React Patterns**
- **Custom hooks:** Extract logic from components
- **Compound components:** For complex UI patterns  
- **Error boundaries:** Graceful error handling
- **Suspense:** Proper loading states with React Query
- **Memoization:** React.memo for expensive components

### **State Management**
- **React Query:** Server state with caching, invalidation, background updates
- **useState/useReducer:** Local component state only
- **Context:** Only for truly global state (theme, user)
- **No prop drilling:** Max 2 levels, then use context

### **Performance Standards**
- **Code splitting:** Lazy load components not needed immediately
- **Bundle analysis:** Keep bundle size minimal
- **Image optimization:** Proper next/image usage
- **Lighthouse scores:** 90+ on all metrics

### **Tailwind Best Practices**
```tsx
// Use utility classes with proper organization
<div className={cn(
  // Layout
  "grid grid-cols-1 lg:grid-cols-2 gap-6",
  // Spacing  
  "p-6 mx-auto max-w-7xl",
  // Visual
  "bg-white rounded-xl shadow-sm border border-slate-200",
  // Interactive
  "hover:shadow-md transition-all duration-200",
  // Responsive
  "sm:p-4 lg:p-8"
)}>
```

### **API Standards**
```typescript
// Proper error handling with typed responses
interface APIResponse<T> {
  data?: T;
  error?: string;
  message: string;
}

// React Query with proper types
const { data, isLoading, error } = useQuery({
  queryKey: ['emails'],
  queryFn: () => emailService.getEmails(),
  refetchInterval: 30000,
  staleTime: 25000
});
```

---

## 🛠 **Implementation Steps**

### **Step 1: Project Setup & Best Practices Foundation (30 min)**
- [ ] Set up proper TypeScript configuration with strict mode
- [ ] Install and configure React Query for data fetching
- [ ] Install and configure Axios with interceptors
- [ ] Create reusable UI components (Button, Card, Badge, Spinner)
- [ ] Set up Tailwind utility functions and constants
- [ ] Configure ESLint + Prettier for consistent code style
- [ ] Set up proper error boundaries and loading states

### **Step 2: Basic Layout (30 min)**
- [ ] Create Dashboard.tsx with two-panel layout
- [ ] Build EmailPanel.tsx with placeholder content
- [ ] Build DraftPanel.tsx with placeholder content
- [ ] Add StatusBar.tsx with connection indicators
- [ ] Basic responsive CSS

### **Step 3: API Integration (45 min)**
- [ ] Create API service functions
- [ ] Connect EmailPanel to GET /emails endpoint
- [ ] Connect DraftPanel to GET /auto-drafts endpoint
- [ ] Display real data from backend
- [ ] Handle loading and error states

### **Step 4: Polling System (30 min)**
- [ ] Create usePolling hook for 30s intervals
- [ ] Implement auto-refresh functionality
- [ ] Add visual indicators for new data
- [ ] Track email ↔ draft relationships
- [ ] Add last-updated timestamps

### **Step 5: Draft Actions (45 min)**
- [ ] Implement Approve & Send button
- [ ] Implement Edit functionality (simple textarea)
- [ ] Implement Delete button
- [ ] Add success/error notifications
- [ ] Update UI state after actions

### **Step 6: Visual Polish (30 min)**
- [ ] Add status indicators (🟢🟡🔴)
- [ ] Improve visual connection between related email/draft
- [ ] Add hover states and transitions
- [ ] Mobile responsiveness check
- [ ] Loading spinners and empty states

**Total Estimated Time: ~3 hours**

---

## 📋 **Data Models**

### **Email Interface**
```typescript
interface Email {
  id: number;
  subject: string;
  from: string;
  date: string; // ISO timestamp
  preview: string; // First ~100 chars
  isRead: boolean;
  gmailId: string;
}
```

### **Draft Interface**  
```typescript
interface AutoGeneratedDraft {
  id: number;
  draftId: string;
  originalEmailId: number;
  subject: string;
  body: string;
  tone: string;
  urgencyLevel: 'high' | 'medium' | 'low';
  relationshipType: string;
  status: 'pending' | 'reviewed' | 'edited' | 'sent' | 'deleted';
  createdAt: string; // ISO timestamp
  reviewedAt?: string;
  sentAt?: string;
  userEdited: boolean;
  editCount: number;
  processingTime: string; // "1000ms" format
}
```

---

## ⚡ **User Interactions**

### **Left Panel (Email)**
- **Click email:** Expand to show full email content
- **Visual indicator:** Show if this email has a generated draft
- **Status badge:** New/Seen based on timestamp

### **Right Panel (Draft)**
- **Approve & Send:** POST /auto-drafts/:id/approve → POST /auto-drafts/:id/send
- **Edit:** Open simple textarea editor → PUT /auto-drafts/:id with new content
- **Delete:** Confirm dialog → DELETE /auto-drafts/:id
- **Visual connection:** Highlight when email ↔ draft are related

### **Status Updates**
- **Success notifications:** "✅ Email sent successfully!"
- **Error handling:** "❌ Failed to send. Try again."
- **Loading states:** "📤 Sending..." during API calls

---

## 🎨 **Visual Design (Tailwind + Best Practices)**

### **Design System with Tailwind**
```css
/* Color Palette */
--success: text-emerald-600 bg-emerald-50 border-emerald-200
--warning: text-amber-600 bg-amber-50 border-amber-200  
--error: text-red-600 bg-red-50 border-red-200
--info: text-blue-600 bg-blue-50 border-blue-200
--muted: text-slate-500 bg-slate-50 border-slate-200

/* Typography Scale */
--text-xl: text-xl font-semibold      # Email subjects
--text-base: text-base font-medium    # Sender info
--text-sm: text-sm text-slate-600     # Preview text  
--text-xs: text-xs text-slate-400     # Timestamps
```

### **Component Styling Standards**
```tsx
// Card Pattern
<Card className="p-6 space-y-4 border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">

// Button Variants
<Button variant="primary" size="sm">Approve & Send</Button>
<Button variant="secondary" size="sm">Edit</Button>  
<Button variant="destructive" size="sm">Delete</Button>

// Status Badges
<Badge variant="success">Sent</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>

// Grid Layout
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
```

### **Responsive Design Pattern**
```tsx
// Desktop: Side by side panels
// Tablet: Side by side with smaller gaps  
// Mobile: Stacked vertically
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
  <EmailPanel className="order-1" />
  <DraftPanel className="order-2" />
</div>
```

### **Accessibility Standards**
- **ARIA labels** for all interactive elements
- **Keyboard navigation** with proper focus management
- **Color contrast** meets WCAG 2.1 AA standards
- **Screen reader** friendly status announcements
- **Focus visible** indicators with ring-2 ring-blue-500

---

## 🔍 **Testing Strategy**

### **Manual Testing Workflow**
1. **Send test email** to your Gmail account
2. **Wait ~30 seconds** for webhook processing
3. **Check dashboard** - email appears in left panel
4. **Wait ~30 seconds** for polling to update
5. **Check right panel** - AI draft appears
6. **Test actions:** Approve, edit, send, delete
7. **Verify backend** using curl to confirm API calls worked

### **Edge Cases to Test**
- **No emails:** Empty state handling
- **No drafts:** Empty state handling  
- **API failures:** Error state handling
- **Long content:** Text truncation and overflow
- **Mobile view:** Responsive layout

---

## 📊 **Success Criteria**

### **MVP is Complete When:**
- [ ] Dashboard loads and shows real data from backend
- [ ] Left panel displays latest received email
- [ ] Right panel displays AI-generated draft for that email
- [ ] User can approve and send draft with one click
- [ ] Draft actions (edit, delete) work correctly
- [ ] System auto-updates every 30 seconds
- [ ] Visual connection between related email/draft is clear
- [ ] Basic error handling and loading states work
- [ ] Mobile-friendly responsive design

### **End-to-End Workflow Works:**
```
📧 Email arrives → Webhook processes → AI generates draft → 
Frontend polls → User sees both → User takes action → 
Backend updates → Frontend reflects changes
```

---

## 🚀 **Next Phase (After MVP)**

**Once MVP is working, we can enhance with:**
- Real-time WebSocket updates (no polling delay)
- Rich text editor for draft editing
- Multiple email/draft history view
- Advanced filtering and search
- Bulk actions and keyboard shortcuts
- Desktop notifications
- Advanced UI/UX improvements from our earlier brainstorm

---

## 🎯 **Key MVP Principles**

1. **Functionality over Beauty** - Make it work first, make it pretty later
2. **Real Data Only** - No mock data, connect to actual backend APIs
3. **Prove the Pipeline** - Demonstrate webhook → AI → user workflow
4. **Simple Interactions** - Basic buttons and forms, no complex UX
5. **Test Daily** - Use it yourself to find real issues
6. **Document Issues** - Track what breaks for next iteration

---

**🎉 Let's build the future of email automation, one simple panel at a time!**