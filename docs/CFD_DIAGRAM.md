# UNIFY — Context Flow & Data Flow Diagrams

## Level 0 — Context Flow Diagram (System Boundary)

```mermaid
graph TB
    subgraph External["External Actors"]
        ST["Student"]
        EM["Employer"]
        MN["Mentor"]
        PO["Placement Officer"]
        AD["Admin"]
        AI["OpenAI GPT-4o"]
        RS["Resend Email"]
        GA["Google OAuth"]
    end

    subgraph UNIFY["UNIFY Intelligence Platform"]
        SYS["Decision Engine<br/>+ Self-Learning Model<br/>+ All Business Logic"]
    end

    ST -->|"Login, Apply, Upload Resume,<br/>View Recommendations"| SYS
    SYS -->|"Next Action, Hire Probability,<br/>Alerts, Certificates"| ST

    EM -->|"Post Jobs, Review Apps,<br/>Schedule Interviews, Feedback"| SYS
    SYS -->|"Ranked Candidates,<br/>Application Stats"| EM

    MN -->|"Approve/Reject Apps,<br/>View Students"| SYS
    SYS -->|"Pending Reviews,<br/>Student Progress"| MN

    PO -->|"View Analytics, Export Data,<br/>Send Digest"| SYS
    SYS -->|"Charts, Reports, Health"| PO

    AD -->|"Manage Users, Seed Data,<br/>System Config"| SYS
    SYS -->|"System Health, Model Weights"| AD

    SYS <-->|"Recommendations,<br/>Interview Prep,<br/>Cover Letters,<br/>Resume Analysis"| AI
    SYS -->|"Weekly Digest,<br/>Notifications"| RS
    SYS <-->|"Social Login"| GA
```

---

## Level 1 — Data Flow Diagram (Process Decomposition)

```mermaid
graph TB
    subgraph Inputs
        U_IN["User Input<br/>(forms, clicks, uploads)"]
        OAUTH["Google OAuth<br/>Session"]
    end

    subgraph P1["P1: Auth System"]
        AUTH["Authentication<br/>& Authorization"]
        JWT["JWT Token<br/>Generation"]
        BRUTE["Brute Force<br/>Protection"]
    end

    subgraph P2["P2: Profile Engine"]
        PROF["Profile CRUD"]
        STRENGTH["Strength<br/>Calculator"]
        RESUME["Resume<br/>Upload & Parse"]
    end

    subgraph P3["P3: Job & Application Engine"]
        JOBS["Job CRUD"]
        APPLY["Application<br/>Pipeline"]
        MENTOR_R["Mentor<br/>Review Gate"]
        INTERVIEW["Interview<br/>Scheduler"]
        FEEDBACK["Employer<br/>Feedback"]
        CERT["Certificate<br/>Generator"]
    end

    subgraph P4["P4: Intelligence Layer"]
        MATCH["AI Match<br/>Engine"]
        NEXT["Next-Action<br/>Decision Engine"]
        PROB["Hiring<br/>Probability"]
        CONTROL["Control<br/>System"]
        ALERT["Predictive<br/>Alerts"]
        PREP["Interview<br/>Prep AI"]
        COVER["Cover Letter<br/>Generator"]
        RES_AI["Resume AI<br/>Analyzer"]
    end

    subgraph P5["P5: Self-Learning Loop"]
        WEIGHTS["Adaptive<br/>Model Weights"]
        OUTCOMES["Outcome<br/>Recorder"]
        ADAPT["Weight<br/>Adaptation"]
    end

    subgraph P6["P6: Engagement & Analytics"]
        MOMENTUM["Momentum /<br/>XP System"]
        LEADER["Leaderboard"]
        BEHAV["Behavior<br/>Tracker"]
        ANALYTICS["Analytics<br/>& Charts"]
        HEALTH["System<br/>Health Monitor"]
        HEATMAP["Activity<br/>Heatmap"]
    end

    subgraph P7["P7: Communication"]
        NOTIF["Notification<br/>Engine"]
        WS["WebSocket<br/>Push"]
        DIGEST["Weekly<br/>Digest Email"]
    end

    subgraph Stores["Data Stores"]
        DB[(MongoDB Atlas)]
    end

    subgraph External
        GPT["OpenAI<br/>GPT-4o"]
        EMAIL["Resend<br/>API"]
    end

    U_IN --> AUTH --> JWT
    OAUTH --> AUTH
    AUTH --> BRUTE
    AUTH --> DB

    U_IN --> PROF --> STRENGTH
    U_IN --> RESUME
    PROF --> DB
    RESUME --> DB

    U_IN --> JOBS --> DB
    U_IN --> APPLY --> MENTOR_R --> APPLY
    APPLY --> DB
    APPLY --> INTERVIEW --> DB
    FEEDBACK --> CERT --> DB
    FEEDBACK --> OUTCOMES

    MATCH <--> GPT
    MATCH --> DB
    NEXT --> DB
    PROB --> WEIGHTS
    PROB --> DB
    CONTROL --> DB
    ALERT --> PROB
    PREP <--> GPT
    COVER <--> GPT
    RES_AI <--> GPT

    OUTCOMES --> ADAPT --> WEIGHTS
    WEIGHTS --> DB

    BEHAV --> DB
    MOMENTUM --> DB
    LEADER --> DB
    ANALYTICS --> DB
    HEALTH --> DB
    HEATMAP --> DB

    NOTIF --> DB
    NOTIF --> WS
    DIGEST --> EMAIL
```

---

## Level 2 — Self-Learning Feedback Loop

```mermaid
graph LR
    A["Student Applies"] --> B["Application Created"]
    B --> C["Employer Reviews"]
    C -->|Selected| D["Outcome: HIRED"]
    C -->|Rejected| E["Outcome: REJECTED"]
    D --> F["Retrieve Stored<br/>Prediction Factors"]
    E --> F
    F --> G{"Adapt Weights"}
    G -->|"Hired: Reward<br/>contributing factors"| H["Increase weight<br/>of high-scoring factors"]
    G -->|"Rejected: Penalise<br/>misleading factors"| I["Decrease weight<br/>(at 50% rate)"]
    H --> J["Normalise weights<br/>(sum = 1.0)"]
    I --> J
    J --> K["Store in<br/>model_weights"]
    K --> L["Next prediction<br/>uses NEW weights"]
    L --> M["Decayed learning rate<br/>(min 0.005)"]
    M --> A

    style G fill:#00E5FF,color:#000
    style K fill:#22C55E,color:#000
    style M fill:#EAB308,color:#000
```

---

## Application State Machine

```mermaid
stateDiagram-v2
    [*] --> submitted : Student applies
    submitted --> under_review : Mentor approves
    submitted --> rejected : Mentor rejects
    under_review --> shortlisted : Employer shortlists
    under_review --> rejected : Employer rejects
    shortlisted --> interview_scheduled : Interview booked
    shortlisted --> rejected : Employer rejects
    interview_scheduled --> selected : Employer selects
    interview_scheduled --> rejected : Employer rejects
    selected --> [*] : Certificate issued
    rejected --> [*] : Outcome recorded

    note right of selected : Triggers weight adaptation (HIRED)
    note right of rejected : Triggers weight adaptation (REJECTED)
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph Client["Client Browser"]
        FE["Next.js 14<br/>Vercel"]
    end

    subgraph Backend["Render"]
        API["FastAPI<br/>uvicorn"]
        WP["WeasyPrint<br/>PDF Engine"]
    end

    subgraph Data["Cloud Services"]
        MONGO[(MongoDB Atlas)]
        REDIS[(Redis Cloud)]
        OPENAI["OpenAI API"]
        RESEND["Resend Email"]
        GAUTH["Google OAuth<br/>(Emergent)"]
    end

    FE <-->|"HTTPS + JWT"| API
    FE <-->|"WebSocket"| API
    FE -->|"OAuth redirect"| GAUTH
    API <--> MONGO
    API <--> REDIS
    API <--> OPENAI
    API --> RESEND
    API <--> GAUTH

    style FE fill:#000,stroke:#00E5FF,color:#fff
    style API fill:#111,stroke:#22C55E,color:#fff
    style MONGO fill:#116149,color:#fff
    style REDIS fill:#D82C20,color:#fff
```
