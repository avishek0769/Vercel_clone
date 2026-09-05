import path from "path";

export const PROJECT_ID = process.env.PROJECT_ID;
export const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
export const PATH_TO_PACKAGE_JSON = process.env.PATH_ || "";
export const API_SERVER_HOST = process.env.API_SERVER_HOST || "https://cloudify.avishekadhikary.in";

export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_ACCESS_KEY_SECRET = process.env.AWS_ACCESS_KEY_SECRET;
export const S3_BUCKET = "vercel.output";

// Resolve build output paths based on working directory
export const PROJECT_ROOT_DIR = path.join(process.cwd(), "output", PATH_TO_PACKAGE_JSON);

// Timeout limit: 15 minutes in milliseconds
export const TIMEOUT_MS = 15 * 60 * 1000;
