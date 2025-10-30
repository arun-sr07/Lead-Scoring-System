# Lead Scoring System

A complete lead scoring system with Node.js/Express backend, Groq AI integration, and React frontend.

**Deployment Options:**
- 🐳 **Docker** - Containerized local deployment with SQLite
- ☁️ **Vercel** - Serverless cloud deployment with Vercel Postgres (FREE tier)
- 💻 **Local** - Traditional Node.js/Express with SQLite

## 🎯 Features

- **Dual-Layer Scoring**: Combines rule-based scoring (0-50 points) with AI-powered intent classification (0-50 points)
- **CSV Lead Upload**: Bulk upload leads via CSV file
- **Groq Llama AI**: Uses Groq's hosted Llama model for intelligent lead qualification
- **SQLite Database**: Persistent storage for offers, leads, and scoring results
- **Export Results**: Download scored leads as CSV
- **REST API**: Complete API for programmatic access

## 🏗️ Architecture

```
lead-scoring-system/
├── backend/              # Node.js/Express server
│   ├── server.js         # Main Express application
│   ├── db.js             # SQLite database setup
│   ├── package.json      # Backend dependencies
│   └── .env              # Environment variables (create from .env.example)
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── pages/           # Page components
│   └── main.tsx         # App entry point
├── sample_leads.csv     # Sample lead data
└── README.md            # This file
```


## 🚀 Deployment Options

Choose one of the following deployment methods:

### Option 1: Docker Deployment 

**Prerequisites:** Docker and Docker Compose installed

1. **Create `.env` file in project root:**
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ```

2. **Start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3001

4. **Stop the services:**
   ```bash
   docker-compose down
   ```



---

### Option 2: Vercel Cloud Deployment 

-Link lead-scoring-system1-hpun86ufn-aruns-projects-7268cc34.vercel.app
**Step-by-step:**

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set up Vercel Postgres:**
   - Go to your project dashboard on vercel.com
   - Navigate to Storage → Create Database → Postgres
   - Select FREE tier (256MB)
   - Connect database to your project

5. **Add environment variables in Vercel dashboard:**
   ```
   GROQ_API_KEY=gsk_your_groq_api_key
   GROQ_MODEL=llama-3.1-8b-instant
   ```

6. **Initialize database (one-time):**
   ```bash
   curl -X POST https://lead-scoring-system1-hpun86ufn-aruns-projects-7268cc34.vercel.app/api/init-db
   ```

7. **Update frontend API URL:**
   Edit `src/pages/Index.tsx`:
   ```typescript
   const API_BASE = 'https://lead-scoring-system1-hpun86ufn-aruns-projects-7268cc34.vercel.app/api';
   ```

8. **Redeploy:**
   ```bash
   vercel --prod
   ```

**Your app is now live!** 


---

### Option 3: Local Setup (Traditional)

### Step 1: Clone/Download the Project

If using git:
```bash
git clone <your-repo-url>
cd lead-scoring-system
```

### Step 2: Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` and add your Groq API key:**
   ```env
   PORT=3001
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   GROQ_MODEL=llama-3.1-8b-instant
   DATABASE_PATH=./data.db
   ```

5. **Start the backend server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

   You should see:
   ```
   ✅ Database initialized at: ./data.db
   🚀 Server running on http://localhost:3001
   📊 Database: ./data.db
   🤖 AI Model: llama-3.1-8b-instant
   ```

### Step 3: Frontend Setup

1. **Open a new terminal and navigate to project root:**
   ```bash
   cd ..  # If you're still in /backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

   The React app will be available at `http://localhost:8080`

### Step 4: Test the System

1. Open your browser to `http://localhost:8080`
2. Create an offer using the form
3. Upload `sample_leads.csv` 
4. Click "Run Scoring"
5. View and export results

## 📡 API Documentation

Base URL: `http://localhost:3001`

### 1. Create Offer

**POST** `/offer`

Create a new product/offer to score leads against.

**Request Body:**
```json
{
  "name": "AI Sales Assistant Pro",
  "value_props": [
    "Automate 80% of sales follow-ups",
    "Increase conversion rates by 35%",
    "Integrate with existing CRM"
  ],
  "ideal_use_cases": [
    "B2B SaaS companies",
    "Sales teams 10-50 people",
    "High-volume outbound sales"
  ]
}
```

**Response:**
```json
{
  "id": 1,
  "name": "AI Sales Assistant Pro",
  "value_props": ["..."],
  "ideal_use_cases": ["..."],
  "created_at": "2025-01-15T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3001/offer \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Sales Assistant Pro",
    "value_props": ["Automate follow-ups", "Increase conversions"],
    "ideal_use_cases": ["B2B SaaS", "Sales teams"]
  }'
```

---

### 2. Upload Leads (CSV)

**POST** `/leads/upload`

Upload leads from a CSV file.

**CSV Format:**
```csv
name,role,company,industry,location,linkedin_bio
Sarah Johnson,VP of Sales,TechCorp,Technology,San Francisco,"Sales leader..."
```

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- File: CSV file

**Response:**
```json
{
  "message": "Leads uploaded successfully",
  "count": 10
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3001/leads/upload \
  -F "file=@sample_leads.csv"
```

**Postman:**
1. Select POST method
2. Enter URL: `http://localhost:3001/leads/upload`
3. Go to "Body" tab
4. Select "form-data"
5. Add key `file` (change type to "File")
6. Choose your CSV file
7. Click Send

---

### 3. Run Scoring

**POST** `/score`

Score all uploaded leads against the most recent offer.

**Scoring Logic:**

**Rule Layer (0-50 points):**
- Role relevance: Decision maker (+20), Influencer (+10), Other (0)
- Industry match: Exact ICP (+20), Adjacent (+10), Other (0)
- Data completeness: All fields present (+10)

**AI Layer (0-50 points):**
- Groq Llama analyzes lead + offer context
- Intent classification: High (50), Medium (30), Low (10)

**Final Score:** Rule Score + AI Points (0-100)

**Response:**
```json
{
  "message": "Scoring completed",
  "count": 10,
  "results": [
    {
      "lead_id": 1,
      "name": "Sarah Johnson",
      "role": "VP of Sales",
      "company": "TechCorp",
      "intent": "High",
      "score": 95,
      "reasoning": "Strong role-product fit, decision-maker in target industry."
    }
  ]
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3001/score
```

---

### 4. Get Results

**GET** `/results`

Retrieve all scored leads, sorted by score (descending).

**Response:**
```json
[
  {
    "id": 1,
    "name": "Sarah Johnson",
    "role": "VP of Sales",
    "company": "TechCorp",
    "intent": "High",
    "score": 95,
    "reasoning": "Strong fit...",
    "created_at": "2025-01-15T10:35:00Z"
  }
]
```

**cURL Example:**
```bash
curl http://localhost:3001/results
```

---

### 5. Export Results (CSV)

**GET** `/results/export`

Download scored leads as CSV file.

**Response:**
- Content-Type: `text/csv`
- File download: `lead_scores.csv`

**CSV Columns:**
- name, role, company, industry, location, intent, score, reasoning

**cURL Example:**
```bash
curl http://localhost:3001/results/export -o lead_scores.csv
```

**Browser:**
Simply navigate to `http://localhost:3001/results/export` to download.

---

### 6. Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:40:00Z"
}
```

**cURL Example:**
```bash
curl http://localhost:3001/health

```

### 2. Create an Offer (cURL)
```bash
curl -X POST http://localhost:3001/offer \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marketing Automation Platform",
    "value_props": ["Automate campaigns", "AI-powered insights", "CRM integration"],
    "ideal_use_cases": ["B2B marketers", "Mid-market companies", "Growth teams"]
  }'
```

### 3. Upload Leads
```bash
curl -X POST http://localhost:3001/leads/upload \
  -F "file=@sample_leads.csv"
```

### 4. Run Scoring
```bash
curl -X POST http://localhost:3001/score
```

### 5. Get Results
```bash
curl http://localhost:3001/results
```

### 6. Export to CSV
```bash
curl http://localhost:3001/results/export -o my_scored_leads.csv
```
