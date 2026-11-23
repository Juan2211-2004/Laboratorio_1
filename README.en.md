# 🎓 AcademicHub

*[Leer en español](README.md)*

AcademicHub is a web platform that helps university students keep every assignment, exam, presentation and project in one place, organized by subject, with a live countdown to the next deadline.

## Abstract

Students juggle deadlines scattered across course portals, chat groups and paper notes, so due dates get missed. AcademicHub centralizes those activities in a single dashboard that shows what is pending, what is due within seven days and how much time is left for the next one, and it flags overdue work automatically without reloading the page. The system follows a three-tier architecture: a vanilla HTML/CSS/JavaScript frontend served by Nginx, a REST API built with Node.js and Express secured with JWT, and a PostgreSQL 16 database whose constraints mirror the API's business rules. Each tier runs in its own Docker container, orchestrated by Docker Compose. Quality is enforced by 96 automated tests across four levels (unit, database, API and end-to-end browser tests), which run on every push in a GitHub Actions CI/CD pipeline that publishes the Docker images only when every test passes. The tests uncovered and helped fix four defects, including a validation bug that stored null dates as January 1, 1970.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS and vanilla JavaScript, served by Nginx 1.27 |
| Backend | Node.js 22, Express 4, JSON Web Tokens, scrypt password hashing |
| Database | PostgreSQL 16 |
| Infrastructure | Docker, Docker Compose |
| Testing | `node:test`, Playwright, `psql` |
| CI/CD | GitHub Actions, GitHub Container Registry |

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open **http://localhost:8080** and sign in with the demo user defined in `.env`.

## Tests

```bash
cd backend && npm test    # 32 unit tests, no Docker or npm install required
```

See [`tests/README.md`](tests/README.md) for the database, API and end-to-end suites.

## Contributing

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) style in English, for example `feat: add activity editing` or `fix(api): return 413 for oversized payloads`.
