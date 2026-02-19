# Architecture (Diagrams as Code)

This document provides recruiter-friendly architecture views rendered by Mermaid on GitHub.

## 1) Container View (Local Compose)

```mermaid
flowchart LR
    U[User Browser]

    subgraph APP[Board Game Recommendation Platform]
      C[Client\nReact + Vite]
      S[Server API\nNode.js + Express]
      R[Recommender\nFlask Hybrid CF+CB]
      DB[(PostgreSQL)]
      PGA[pgAdmin]
      MIG[Migrate Job\nSequelize CLI]
      SEED[Seed Job\nseed_board_games.py]
      MODEL[(model_data/*.pkl)]
    end

    U -->|UI| C
    C -->|REST API| S
    S -->|read/write| DB
    S -->|POST /recommend| R
    R -->|loads model artifacts| MODEL
    S -->|lookup game metadata| DB
    PGA -->|DB admin| DB
    MIG -->|db:migrate| DB
    SEED -->|upsert board_games| DB
```

## 2) Startup Dependency Graph (Compose)

```mermaid
flowchart TD
    P[postgres: healthy] --> M[migrate: completed]
    P --> R[recommender: healthy]
    M --> SB[seed_board_games: completed]
    P --> S[server: healthy]
    SB --> S
    R --> C[client: healthy]
    S --> C
    P --> PG[pgadmin]
```

## 3) Recommendation Request Flow

```mermaid
sequenceDiagram
    actor User
    participant Client as Client (React)
    participant API as Server (Express)
    participant DB as PostgreSQL
    participant Rec as Recommender (Flask)

    User->>Client: Set preferences / submit ratings
    Client->>API: POST /setGamePreference or GET /getGameId
    API->>DB: Read preferences + user_ratings
    API->>Rec: POST /recommend {ratings, preferences}
    Rec->>Rec: Compute CF + CB + dynamic alpha
    Rec-->>API: recommended bggid list
    API->>DB: SELECT board_games by bggid
    API-->>Client: game IDs / game metadata
    Client-->>User: Render personalized recommendations
```

## 4) EC2 Production Topology

```mermaid
flowchart LR
    U[Internet User]
    D[Domain / DNS]
    Caddy[Caddy HTTPS Proxy\nEC2 host]
    Nginx[Client Container\nNginx + Built SPA]
    API[Server Container\nExpress API]
    Rec[Recommender Container\nFlask]
    PG[(PostgreSQL Container)]

    U --> D --> Caddy --> Nginx
    Nginx -->|/api/*| API
    API --> Rec
    API --> PG
```

