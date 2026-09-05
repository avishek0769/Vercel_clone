import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { isoToReadable } from "../lib/date";
import logoImg from "../assets/logo.png";
import CreateProjectModal from "../components/CreateProjectModal";

function ProjectsPage({
    projects,
    projectsLoading,
    projectForm,
    setProjectForm,
    slugState,
    checkSlug,
    projectMutationLoading,
    projectError,
    handleProjectCreate,
}) {
    const navigate = useNavigate();
    const { signOut } = useClerk();
    const { user } = useUser();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleLogout = () => {
        signOut({ redirectUrl: "/" });
    };

    return (
        <div className="projects-page-container">
            {/* Nav Bar for branding */}
            <header className="db-navbar">
                <div className="db-navbar-container">
                    <div className="db-navbar-left">
                        <div 
                            className="db-logo" 
                            onClick={() => navigate("/")} 
                            style={{ cursor: "pointer" }}
                        >
                            <img src={logoImg} alt="Cloudify Logo" className="db-logo-img" />
                            <span className="db-logo-text">Cloudify</span>
                        </div>
                        <nav className="db-nav-links">
                            <span className="db-nav-link active">Projects</span>
                        </nav>
                    </div>
                    <div className="db-navbar-right">
                        {user && (
                            <div className="db-user-section">
                                <span className="db-user-chip mono">
                                    {user.fullName || user.primaryEmailAddress?.emailAddress}
                                </span>
                                <button 
                                    className="db-logout-btn btn btn-ghost" 
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="db-main-content screen shell">
                <div className="db-page-header">
                    <div className="db-title-group">
                        <h1 className="db-page-title">Projects</h1>
                        <p className="db-page-subtitle muted">
                            Create, configure, and monitor your deployed frontend applications.
                        </p>
                    </div>
                    <button 
                        className="btn btn-primary db-create-btn"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        + New Project
                    </button>
                </div>

                {projectsLoading && (
                    <div className="db-loading-state">
                        <span className="muted">Retrieving your projects...</span>
                    </div>
                )}

                {!projectsLoading && projects.length === 0 && (
                    <div className="db-empty-state">
                        <p className="muted">No projects found. Deploy your first application to get started.</p>
                        <button 
                            className="btn btn-primary"
                            onClick={() => setIsCreateModalOpen(true)}
                            style={{ marginTop: "1rem" }}
                        >
                            Create a Project
                        </button>
                    </div>
                )}

                {!projectsLoading && projects.length > 0 && (
                    <div className="db-projects-grid">
                        {projects.map((project) => (
                            <article
                                key={project.id}
                                className="db-project-card"
                                onClick={() => navigate(`/projects/${project.id}/deployments`)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        navigate(`/projects/${project.id}/deployments`);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="db-project-card-header">
                                    <h3 className="db-project-name">{project.name}</h3>
                                    <span className="db-project-date mono">
                                        {isoToReadable(project.createdAt)}
                                    </span>
                                </div>

                                <div className="db-project-card-body">
                                    <div className="db-project-domain-item">
                                        <span className="db-meta-label mono">DEPLOYED SUBDOMAIN</span>
                                        <a
                                            href={`https://${project.subdomain}.cloudify.avishekadhikary.in`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="db-project-link mono"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            https://{project.subdomain}.cloudify.avishekadhikary.in
                                        </a>
                                    </div>

                                    {project.customDomain && (
                                        <div className="db-project-domain-item">
                                            <span className="db-meta-label mono">CUSTOM DOMAIN</span>
                                            <a
                                                href={`https://${project.customDomain}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="db-project-link custom-domain mono"
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                https://{project.customDomain}
                                            </a>
                                        </div>
                                    )}

                                    <div className="db-project-repo-item">
                                        <span className="db-meta-label mono">REPOSITORY</span>
                                        <span className="db-project-repo-text mono muted">
                                            {project.githubUrl}
                                        </span>
                                    </div>
                                </div>

                                <div className="db-project-card-footer">
                                    <span className="db-card-cta mono">
                                        View Deployments →
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Project Modal */}
            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                projectForm={projectForm}
                setProjectForm={setProjectForm}
                slugState={slugState}
                checkSlug={checkSlug}
                projectMutationLoading={projectMutationLoading}
                projectError={projectError}
                handleProjectCreate={handleProjectCreate}
            />
        </div>
    );
}

export default ProjectsPage;
