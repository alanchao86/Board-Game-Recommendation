# Board Recommendation App

This is a board game recommend application built using the PERN stack (PostgreSQL, Express.js, React.js, Node.js) and Material-UI (MUI). The application includes user authentication via JWT, recommend board games based on user preference and game rating using content-based filtering and collaborative-based filtering, and user profile management.


## Features

- **User Authentication**: Sign up and sign in using JWT-based authentication.
- **Game Recommend**: Recommend games.
- **Game Search**: Search for games.
- **Profile Modification**: Modify your own profile.
- **Sign Out**: Sign out from the application.

## Technologies Used

- **Backend**: Node.js, Express.js
- **Frontend**: React.js, Material-UI (MUI)
- **Database**: PostgreSQL
- **Authentication**: JSON Web Tokens (JWT)

## Database Schema

- Schema design document: `docs/DB_SCHEMA.md`
- Rule: any schema change must update both Sequelize migration(s) and `docs/DB_SCHEMA.md` in the same PR.

## Security

- Security guidance and secret-handling rules: `SECURITY.md`

## Run with Docker Compose

1. Start the full stack:
   - `docker compose up -d --build`
   - Compose will run one-shot services in order:
     1. `migrate` (initialize/update schema)
     2. `seed_board_games` (upsert data from `api_cf/model_data/games.pkl`)
2. Open the app:
   - `http://localhost:3000/recommendweb/`
3. Open pgAdmin:
   - `http://localhost:5050`

### pgAdmin Login (UI account)

- Email: `admin@example.com`
- Password: `admin-change-me`
- Note: these are local-development defaults only. Override before any shared environment.

You can override both values using environment variables before starting:
- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`

### PostgreSQL Connection in pgAdmin

After logging into pgAdmin, add a new server with:
- Host: `postgres`
- Port: `5432`
- Database: `recommend`
- Username: `postgres`
- Password: `postgres`

### Board Games Seed

- Seed source: `api_cf/model_data/games.pkl`
- Target table: `board_games`
- Seed mode: idempotent upsert on `bggid` (safe to rerun)
- Startup behavior: if `board_games` is not empty, seeding is skipped for faster startup.
- To force reseed: set `SEED_FORCE=1` for `seed_board_games`.

## Environment Profiles

- Local profile template: `.env.local.example`
- EC2 production profile template: `.env.prod.example`
- Recommended:
  1. Copy the template you need (`.env.local` or `.env.prod`)
  2. Fill in values for your environment
  3. Keep real `.env*` files out of git

## Deploy to EC2 (Single Host + Docker Compose)

- Production compose file: `docker-compose.prod.yml`
- Frontend production image: `client/Dockerfile.prod` (Vite build + Nginx)
- Detailed step-by-step runbook: `docs/DEPLOY_EC2_COMPOSE.md`
- Current production routing pattern:
  - Before HTTPS proxy: `http://<EC2_PUBLIC_IP>:3000/` -> frontend
  - With Caddy + HTTPS: `https://<DOMAIN>/` -> frontend
  - API path: `https://<DOMAIN>/api/*` -> backend API (proxied by client Nginx)

## Cost Notes for EC2

- Stopping an EC2 instance stops compute charges for that instance.
- You still pay for persisted resources while stopped:
  - EBS volumes
  - Elastic IP (when not attached/running association conditions)
  - Snapshots and other storage resources
- If you do not need testing, stopping the instance is still the right default for cost control.
<!-- ## Usage

1. **Sign Up**: Create a new account.
2. **Sign In**: Log in with your credentials.
3. **Search Users**: Use the search functionality to find other users by their username.
4. **Chat**: Start a real-time chat with other users.
5. **View Profiles**: Check out other users' profiles.
6. **Edit Profile**: Modify your own profile information.
7. **Sign Out**: Log out from your account. -->
