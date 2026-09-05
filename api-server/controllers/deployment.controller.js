import dotenv from "dotenv";
dotenv.config();
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../utils/prisma.js";

const ecsClient = new ECSClient({
    region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET,
    },
});

const deployProject = asyncHandler(async (req, res) => {
    const { pathToPackageJson } = req.query;
    const { projectId } = req.params;
    const normalizedPath = String(pathToPackageJson || "").trim();

    const project = await prisma.project.findUnique({
        where: {
            id: projectId
        },
    });

    if (!project) {
        return res.status(404).json({ status: "error", message: "Project not found" });
    }

    const deployment = await prisma.deployment.create({
        data: {
            projectId: project.id,
            pathToPackageJson: normalizedPath,
        },
    });

    const command = new RunTaskCommand({
        cluster: process.env.ECS_CLUSTER_NAME,
        taskDefinition: process.env.ECS_TASK_DEFINITION,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: "ENABLED",
                subnets: [
                    process.env.SUBNET_ID_1,
                    process.env.SUBNET_ID_2,
                    process.env.SUBNET_ID_3,
                ],
                // securityGroups: ['']
            },
        },
        overrides: {
            containerOverrides: [
                {
                    name: process.env.CONTAINER_NAME,
                    environment: [
                        { name: "GITHUB_REPO_URL", value: project.githubUrl },
                        { name: "PROJECT_ID", value: projectId },
                        { name: "PATH_", value: deployment.pathToPackageJson || "" },
                        { name: "DEPLOYMENT_ID", value: deployment.id || "" },
                        { name: "WEBHOOK_SECRET", value: process.env.WEBHOOK_SECRET || "" },
                        { name: "AWS_ACCESS_KEY_ID", value: process.env.AWS_ACCESS_KEY_ID },
                        { name: "AWS_ACCESS_KEY_SECRET", value: process.env.AWS_ACCESS_KEY_SECRET },
                        { name: "API_SERVER_HOST", value: process.env.API_SERVER_HOST || "" },
                    ],
                },
            ],
        },
    });

    await ecsClient.send(command);

    return res.json({
        status: "queued",
        data: {
            ...deployment,
            url: `http://${project.subdomain}.cloudify.avishekadhikary.in`,
        },
    });
});

const getDeploymentsForProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const deployments = await prisma.deployment.findMany({
        where: {
            projectId: projectId,
        },
    });

    return res.json({ status: "success", data: { deployments } });
});

const fetchDeploymentDetails = asyncHandler(async (req, res) => {
    const { deploymentId } = req.params;

    const deployment = await prisma.deployment.findUnique({
        where: {
            id: deploymentId,
        },
    });

    if (!deployment) {
        return res.status(404).json({ status: "error", message: "Deployment not found" });
    }

    return res.json({ status: "success", data: { deployment } });
});

export { deployProject, getDeploymentsForProject, fetchDeploymentDetails };
