# Chief AI - Email & Calendar Assistant

An AI-powered executive assistant that manages your email and calendar autonomously. Built for busy professionals who want to automate repetitive communication tasks while maintaining personal control.

## 🎯 Problem

- Inbox overwhelm with repetitive requests
- Time-consuming meeting scheduling
- Current tools only track tasks - they don't do them

## 🌟 Solution

Chief AI acts as your personal executive assistant:
- **Reads your incoming emails** automatically
- **Drafts responses** matching your tone and style
- **Handles meeting scheduling** with calendar integration
- **Requires your approval** before sending anything

## 🚀 Features

### Phase 1: Email Foundation ✅
- Gmail API integration with OAuth2 authentication
- Real-time email ingestion and parsing
- PostgreSQL database for email storage
- Web interface for testing and monitoring

### Phase 2: AI Draft Generation (Coming Soon)
- Learn writing style from your sent emails
- Generate contextually appropriate responses
- Smart categorization (meetings, questions, requests)
- Quality scoring for generated drafts

### Phase 3: Calendar Intelligence (Coming Soon)  
- Google Calendar integration
- Smart scheduling with your preferences
- Automatic meeting time suggestions
- Conflict detection and resolution

### Phase 4: Approval Workflow (Coming Soon)
- Slack bot notifications
- One-click approve/edit/decline
- Web dashboard for review
- Complete send automation

## 🛠 Tech Stack

- **Backend:** Node.js + TypeScript + Express
- **Database:** PostgreSQL with pgvector
- **APIs:** Gmail API, Google Calendar API, OpenAI/Anthropic
- **Frontend:** React/Next.js (planned)
- **Notifications:** Slack API integration (planned)

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Google Cloud Project with Gmail API enabled
- Gmail account for testing

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:parth012001/Chief.git
   cd Chief
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL**
   ```bash
   # Install PostgreSQL (macOS with Homebrew)
   brew install postgresql@15
   brew services start postgresql@15
   
   # Create database
   createdb chief_ai
   ```

4. **Configure Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project and enable Gmail API
   - Create OAuth2 credentials (Web application)
   - Add `http://localhost:3000/auth/callback` as authorized redirect URI

5. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your values:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   DATABASE_URL=postgresql://username@localhost:5432/chief_ai
   OPENAI_API_KEY=your_openai_key_here
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

### Testing Phase 1

1. **Authorize Gmail access**
   - Visit: `http://localhost:3000/auth`
   - Complete Google OAuth flow

2. **Fetch your emails**
   - Visit: `http://localhost:3000/emails/fetch`
   - Check results: `http://localhost:3000/emails`

3. **Verify database**
   ```bash
   npm run dev test
   ```

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth` | GET | Start Gmail OAuth flow |
| `/auth/callback` | GET | OAuth callback handler |
| `/emails/fetch` | GET | Fetch emails from Gmail |
| `/emails` | GET | View stored emails |

## 🔐 Security

- OAuth2 for secure Gmail access
- Environment variables for sensitive data
- Row-level security planned for multi-tenant
- No email content logged or exposed

## 📈 Development Roadmap

- **Week 1-2:** ✅ Phase 1 - Email Foundation
- **Week 3-4:** 🔄 Phase 2 - AI Draft Generation  
- **Week 5-6:** 📅 Phase 3 - Calendar Integration
- **Week 7-8:** ✨ Phase 4 - Approval Workflow

## 🧪 Testing

```bash
# Test database connection and email parsing
npm run dev test

# Run all tests (when available)
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚧 Status

**Current Status:** Phase 1 Complete ✅
- Gmail integration working
- Email parsing functional  
- Database storage operational
- Ready for Phase 2 development

---

*Built for busy professionals who want to reclaim their time while maintaining control over their communications.*