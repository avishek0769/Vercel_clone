# Cloudify 

Checkout the live website: [Cloudify](https://avishek.short.gy/cloudify)

A full-stack, scalable application deployment platform inspired by Vercel. It allows users to authenticate, connect their GitHub repositories, sequence builds, and automatically deploy static assets to custom subdomains.

## Architecture

This project is split into four main services:

- **`api-server`**: An Express.js backend using Prisma ORM with PostgreSQL. It handles user authentication, project details, deployment queuing via AWS ECS (Fargate), and log streaming from the build container.
- **`build-server`**: A containerized task (Docker) that clones a user's GitHub repository, installs dependencies, builds the project, and pushes the built static assets to AWS S3.
- **`s3-reverse-proxy`**: A Node.js reverse proxy that dynamically maps subdomains (e.g., `https://my-app.cloudify.avishekadhikary.in`) to the correct S3 bucket prefix, streaming the built files back to the user.
- **`frontend`**: A React single-page application built with Vite. It features a modern dark-themed dashboard to manage projects and track deployments in real-time.

## Key Features

- **User Authentication**: Secure Sign up & Log in using JWT auth.
- **Project Management**: Create projects linked to public GitHub URLs and claim custom subdomains.
- **Serverless Build Pipeline**: Deployments spin up isolated AWS ECS Fargate tasks to securely build projects in an automated, scalable fashion.
- **Real-Time Logs**: View both persistent build logs and live streaming events from the build container.
- **Wildcard Subdomain Routing**: Deployed apps are instantly accessible via your custom `*.cloudify.avishekadhikary.in` subdomain.
- **Monorepo Support**: Optionally specify a `pathToPackageJson` to build specific apps within a larger repository.

## 🛠 Tech Stack

- **Frontend**: React (JSX), Vite, React Router DOM, Vanilla CSS
- **Backend Services**: Express.js
- **Database**: PostgreSQL, Prisma ORM
- **Cloud & Infra**: AWS ECS (Fargate), AWS S3, AWS ECR, Docker
- **Package Manager**: pnpm

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- AWS Account (for ECS, ECR, and S3 functionality)
- Docker (for building the `build-server` image)

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/avishek0769/Cloudify
   cd Cloudify
   ```

2. **Environment Setup**
   Configure `.env` files for the respective services (`api-server`, `s3-reverse-proxy`). You will need AWS credentials (Access Key ID, Secret Access Key, ECS Cluster info, S3 Bucket details) to simulate the full build and deploy pipeline.

3. **Install Dependencies & Start Services**

   ```bash
   # Terminal 1: Backend
   cd api-server
   pnpm install
   pnpm dlx prisma migrate dev
   pnpm run dev

   # Terminal 2: Frontend
   cd frontend
   pnpm install
   pnpm run dev

   # Terminal 3: Reverse Proxy
   cd s3-reverse-proxy
   pnpm install
   pnpm run dev
   ```

4. **Build Server Image**
   Configure and push the `build-server` Dockerfile to an AWS ECR repository so ECS Fargate can pull and run it dynamically during deployments.