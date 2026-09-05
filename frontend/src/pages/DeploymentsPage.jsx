import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import CreateDeploymentModal from "../components/CreateDeploymentModal";
import { useApi } from "../lib/api";
import { isoToReadable } from "../lib/date";
import logoImg from "../assets/logo.png";

function DeploymentsPage({ projects, loadProjectById, refreshTick, refreshAll }) {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const callApi = useApi();
    const { signOut } = useClerk();
    const { user } = useUser();

    const [deployments, setDeployments] = useState([]);
    const [deploymentsLoading, setDeploymentsLoading] = useState(false);
    const [selectedDeploymentId, setSelectedDeploymentId] = useState("");
    const [persistedLogs, setPersistedLogs] = useState([]);
    const [liveLogs, setLiveLogs] = useState([]);
    const [logsStatus, setLogsStatus] = useState("");
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState("");

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [deployPath, setDeployPath] = useState("");
    const [deploying, setDeploying] = useState(false);
    const [deployError, setDeployError] = useState("");
    const hasInitialSelection = useRef(false);

    const [domainModalOpen, setDomainModalOpen] = useState(false);
    const [domainInput, setDomainInput] = useState("");
    const [savingDomain, setSavingDomain] = useState(false);
    const [domainError, setDomainError] = useState("");
    const [verifyingDns, setVerifyingDns] = useState(false);
    const [dnsVerificationStatus, setDnsVerificationStatus] = useState(null);

    const [deletingProject, setDeletingProject] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState("");
    const [deleteError, setDeleteError] = useState("");

    const [copiedCname, setCopiedCname] = useState(false);

    const selectedProject = useMemo(
        () => projects.find((project) => project.id === projectId) || null,
        [projects, projectId],
    );

    const selectedDeployment = useMemo(
        () =>
            deployments.find(
                (deployment) => deployment.id === selectedDeploymentId,
            ) || null,
        [deployments, selectedDeploymentId],
    );

    const loadDeployments = useCallback(async () => {
        if (!projectId) return;
        setDeploymentsLoading(true);
        try {
            const response = await callApi(`/deployment/all/${projectId}`);
            const list = [...(response?.data?.deployments || [])].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
            );
            setDeployments(list);

            let nextSelectedId = "";
            setSelectedDeploymentId((previous) => {
                if (list.length === 0) {
                    nextSelectedId = "";
                    return "";
                }

                if (!hasInitialSelection.current) {
                    hasInitialSelection.current = true;
                    nextSelectedId = list[0].id;
                    return list[0].id;
                }

                if (
                    previous &&
                    list.some((deployment) => deployment.id === previous)
                ) {
                    nextSelectedId = previous;
                    return previous;
                }

                nextSelectedId = list[0].id;
                return list[0].id;
            });

            return nextSelectedId;
        } finally {
            setDeploymentsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        hasInitialSelection.current = false;
        setSelectedDeploymentId("");
    }, [projectId]);

    const loadPersistedLogs = useCallback(async (deploymentId) => {
        if (!deploymentId) {
            setPersistedLogs([]);
            setLiveLogs([]);
            setLogsStatus("");
            return;
        }

        setLogsLoading(true);
        setLogsError("");
        try {
            const response = await callApi(
                `/logs/deployment/all/${deploymentId}`,
            );
            setPersistedLogs(response?.data?.logs || []);
        } catch (error) {
            setLogsError(error.message || "Could not load logs");
        } finally {
            setLogsLoading(false);
        }
    }, []);

    const loadDeploymentDetails = useCallback(async (deploymentId) => {
        if (!deploymentId) return null;

        try {
            const response = await callApi(
                `/deployment/details/${deploymentId}`,
            );
            const deployment = response?.data?.deployment || null;
            if (!deployment?.id) return null;

            setDeployments((previous) =>
                previous.map((entry) =>
                    entry.id === deployment.id ? { ...entry, ...deployment } : entry,
                ),
            );
            return deployment;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (!selectedProject && projectId) {
            loadProjectById(projectId);
        }
    }, [selectedProject, projectId, loadProjectById]);

    useEffect(() => {
        loadDeployments();
    }, [loadDeployments]);

    useEffect(() => {
        setLiveLogs([]);
        setLogsStatus("");
        loadPersistedLogs(selectedDeploymentId);
    }, [selectedDeploymentId, loadPersistedLogs]);

    useEffect(() => {
        if (!selectedDeploymentId) return undefined;
        if (selectedDeployment?.status === "READY") return undefined;

        let stop = false;
        const interval = setInterval(async () => {
            if (stop) return;
            try {
                const response = await callApi(
                    `/logs/deployment/${selectedDeploymentId}`,
                );
                const nextLogs = response?.data?.logs || [];
                const nextStatus = response?.data?.logsStatus || "";

                if (nextLogs.length) {
                    setLiveLogs((previous) => [
                        ...previous,
                        ...nextLogs.map((log) => ({
                            id: crypto.randomUUID(),
                            log,
                            createdAt: new Date().toISOString(),
                        })),
                    ]);
                }

                if (nextStatus) {
                    setLogsStatus(selectedDeployment?.status || "");
                    if (nextStatus === "end") {
                        stop = true;
                        clearInterval(interval);
                        loadPersistedLogs(selectedDeploymentId);
                    }
                }
            } catch {
                // Ignore polling failures
            }
        }, 3000);

        return () => {
            stop = true;
            clearInterval(interval);
        };
    }, [selectedDeploymentId, selectedDeployment?.status, loadPersistedLogs]);

    useEffect(() => {
        const refreshPage = async () => {
            const activeDeploymentId = await loadDeployments();
            if (activeDeploymentId) {
                await loadDeploymentDetails(activeDeploymentId);
                await loadPersistedLogs(activeDeploymentId);
            }
        };

        refreshPage();
    }, [refreshTick, loadDeployments, loadPersistedLogs, loadDeploymentDetails]);

    const createDeployment = async () => {
        if (!projectId) return;

        setDeploying(true);
        setDeployError("");
        try {
            const query = deployPath.trim()
                ? `?pathToPackageJson=${encodeURIComponent(deployPath.trim())}`
                : "";
            const response = await callApi(
                `/deployment/create/${projectId}${query}`,
                {
                    method: "POST",
                },
            );
            const created = response?.data;
            if (created?.id) {
                setDeployments((previous) => [created, ...previous]);
                setSelectedDeploymentId(created.id);
            }
            setCreateModalOpen(false);
            setDeployPath("");
        } catch (error) {
            setDeployError(error.message || "Deployment failed to queue");
        } finally {
            setDeploying(false);
        }
    };

    const handleLogout = () => {
        signOut({ redirectUrl: "/" });
    };

    const handleSaveDomain = async () => {
        setSavingDomain(true);
        setDomainError("");
        try {
            await callApi(`/project/${projectId}/domain`, {
                method: "PATCH",
                body: JSON.stringify({ customDomain: domainInput.trim() || null })
            });
            await loadProjectById(projectId);
            setDomainModalOpen(false);
        } catch (err) {
            setDomainError(err.message || "Failed to update custom domain");
        } finally {
            setSavingDomain(false);
        }
    };

    const handleRemoveDomain = async () => {
        const confirmed = confirm("Are you sure you want to remove the custom domain configuration for this project?");
        if (!confirmed) return;

        try {
            await callApi(`/project/${projectId}/domain`, {
                method: "PATCH",
                body: JSON.stringify({ customDomain: null })
            });
            await loadProjectById(projectId);
        } catch (err) {
            alert(err.message || "Failed to remove custom domain");
        }
    };

    const handleVerifyDns = async () => {
        if (!domainInput.trim()) return;
        setVerifyingDns(true);
        setDnsVerificationStatus(null);
        try {
            const response = await callApi("/project/verify-dns", {
                method: "POST",
                body: JSON.stringify({
                    customDomain: domainInput.trim(),
                    subdomain: selectedProject?.subdomain,
                }),
            });
            if (response && response.verified) {
                setDnsVerificationStatus("success");
            } else {
                setDnsVerificationStatus("error");
            }
        } catch (error) {
            console.error("DNS verification failed:", error);
            setDnsVerificationStatus("error");
        } finally {
            setVerifyingDns(false);
        }
    };

    const handleDeleteProject = async () => {
        if (deleteConfirmName !== selectedProject?.name) return;

        setDeletingProject(true);
        setDeleteError("");
        try {
            await callApi(`/project/${projectId}`, {
                method: "DELETE"
            });
            setDeleteModalOpen(false);
            navigate("/projects", { replace: true });
        } catch (err) {
            setDeleteError(err.message || "Could not delete project");
        } finally {
            setDeletingProject(false);
        }
    };

    // Calculate dynamic preview URL based on domain availability
    const previewUrl = useMemo(() => {
        if (selectedProject?.customDomain) {
            return `https://${selectedProject.customDomain}`;
        }
        if (selectedProject?.subdomain) {
            return `https://${selectedProject.subdomain}.cloudify.avishekadhikary.in`;
        }
        return null;
    }, [selectedProject]);

    return (
        <div className="projects-page-container">
            {/* Branded Navigation Bar */}
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
                            <span className="db-nav-link" onClick={() => navigate("/projects")} style={{ cursor: "pointer" }}>Projects</span>
                            <span className="db-nav-link active">Deployments</span>
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

            {/* Main Page Layout Grid */}
            <main className="db-main-content screen shell">
                <section className="page-grid">
                    <div className="db-sidebar-col" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {/* Sidebar Panel 1: Info, Domain Status, & Deployments List */}
                        <aside className="panel">
                            <div className="panel-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
                                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--text)" }}>Project Specs</h3>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", minHeight: "auto", height: "auto" }}
                                    onClick={() => navigate("/projects")}
                                >
                                    Back
                                </button>
                            </div>

                            <div className="project-specs" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
                                {/* Spec 1: Project Name */}
                                <div className="spec-item">
                                    <span className="mono-eyebrow" style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>PROJECT</span>
                                    <span className="spec-value" style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text)" }}>
                                        {selectedProject?.name || "Loading..."}
                                    </span>
                                </div>

                                {/* Spec 2: Git Repository */}
                                <div className="spec-item">
                                    <span className="mono-eyebrow" style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>REPOSITORY</span>
                                    <span className="spec-value mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                                        {selectedProject?.githubUrl || "Loading..."}
                                    </span>
                                </div>

                                {/* Spec 3: Custom Domain */}
                                <div className="spec-item">
                                    <span className="mono-eyebrow" style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>CUSTOM DOMAIN</span>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                        {selectedProject?.customDomain ? (
                                            <>
                                                <a
                                                    href={`https://${selectedProject.customDomain}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mono"
                                                    style={{ fontSize: "0.8rem", color: "var(--success)", textDecoration: "none", borderBottom: "1px dashed var(--success)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "240px" }}
                                                >
                                                    {selectedProject.customDomain}
                                                </a>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost"
                                                    style={{ padding: "2px 6px", fontSize: "0.72rem", minHeight: "auto", height: "auto", borderRadius: "4px" }}
                                                    onClick={() => {
                                                        setDomainInput(selectedProject.customDomain);
                                                        setDnsVerificationStatus(null);
                                                        setDomainModalOpen(true);
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="muted mono" style={{ fontSize: "0.8rem" }}>None configured</span>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost"
                                                    style={{ padding: "2px 6px", fontSize: "0.72rem", minHeight: "auto", height: "auto", borderRadius: "4px" }}
                                                    onClick={() => {
                                                        setDomainInput("");
                                                        setDnsVerificationStatus(null);
                                                        setDomainModalOpen(true);
                                                    }}
                                                >
                                                    Setup
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="deployments-section-header" style={{ marginTop: "16px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="mono-eyebrow" style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>DEPLOYMENTS</span>
                                <button
                                    className="btn btn-primary"
                                    type="button"
                                    onClick={() => {
                                        setDeployError("");
                                        setCreateModalOpen(true);
                                    }}
                                    style={{ padding: "4px 10px", fontSize: "0.75rem", borderRadius: "4px", minHeight: "auto", height: "auto" }}
                                >
                                    New Deployment
                                </button>
                            </div>

                            <div className="list-wrap">
                                {deploymentsLoading && (
                                    <p className="muted">Loading deployments...</p>
                                )}
                                {!deploymentsLoading && deployments.length === 0 && (
                                    <p className="muted">No deployments yet.</p>
                                )}

                                {deployments.map((deployment) => (
                                    <button
                                        key={deployment.id}
                                        className={`list-item ${deployment.id === selectedDeploymentId
                                            ? "active"
                                            : ""
                                            }`}
                                        onClick={() =>
                                            setSelectedDeploymentId(deployment.id)
                                        }
                                        type="button"
                                    >
                                        <p className="item-title mono">
                                            {deployment.id.slice(0, 12)}
                                        </p>
                                        <p className="muted">
                                            {deployment.status || "QUEUED"}
                                        </p>
                                        <span className="item-pill">
                                            {isoToReadable(deployment.createdAt)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </aside>

                        {/* Sidebar Panel 2: Danger Zone / Delete Project */}
                        <article className="panel" style={{ borderColor: "#451e1e" }}>
                            <div className="panel-head">
                                <h3 style={{ color: "#ff6b6b" }}>Danger Zone</h3>
                            </div>
                            <p className="muted" style={{ fontSize: "0.8rem", margin: "8px 0 16px 0", lineHeight: "1.4" }}>
                                Permanently delete this project and all its deployments. This action is irreversible.
                            </p>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                    setDeleteConfirmName("");
                                    setDeleteError("");
                                    setDeleteModalOpen(true);
                                }}
                                disabled={deletingProject}
                                style={{
                                    width: "100%",
                                    background: "#2a1515",
                                    color: "#ff6b6b",
                                    border: "1px solid #4a2323",
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    transition: "background 150ms ease"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#3c1c1c"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#2a1515"}
                            >
                                {deletingProject ? "Deleting Project..." : "Delete Project"}
                            </button>
                        </article>
                    </div>

                    {/* Right Panel: Deployment Details & Logs */}
                    <section className="panel">
                        <div className="panel-head">
                            <h3>Deployment Details & Logs</h3>
                        </div>

                        {!selectedDeployment && (
                            <p className="muted">
                                Choose a deployment from the left panel.
                            </p>
                        )}

                        {selectedDeployment && (
                            <>
                                <div className="stats-grid">
                                    <article>
                                        <h4>Status</h4>
                                        <p className="stat">
                                            {logsStatus ||
                                                selectedDeployment.status ||
                                                "-"}
                                        </p>
                                    </article>
                                    <article>
                                        <h4>Created</h4>
                                        <p className="stat">
                                            {isoToReadable(
                                                selectedDeployment.createdAt,
                                            )}
                                        </p>
                                    </article>
                                    <article>
                                        <h4>Updated</h4>
                                        <p className="stat">
                                            {isoToReadable(
                                                selectedDeployment.updatedAt,
                                            )}
                                        </p>
                                    </article>
                                    <article>
                                        <h4>Preview URL</h4>
                                        <p className="stat mono">
                                            {previewUrl ? (
                                                <a
                                                    href={previewUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="preview-link"
                                                >
                                                    {previewUrl}
                                                </a>
                                            ) : "-"}
                                        </p>
                                    </article>
                                </div>

                                {logsLoading && (
                                    <p className="muted">Loading persisted logs...</p>
                                )}
                                {logsError && <p className="error-text">{logsError}</p>}

                                <div
                                    className={`terminal ${selectedDeployment?.status === "READY"
                                        ? "terminal-full"
                                        : ""
                                        }`}
                                >
                                    <p className="terminal-title">Persisted Logs</p>
                                    {persistedLogs.length === 0 && (
                                        <p className="muted mono">
                                            No stored logs yet.
                                        </p>
                                    )}
                                    {persistedLogs.map((entry) => (
                                        <div className="log-line" key={entry.id}>
                                            <span className="mono dim">
                                                [{isoToReadable(entry.createdAt)}]
                                            </span>
                                            <span className="mono">{entry.log}</span>
                                        </div>
                                    ))}
                                </div>

                                {selectedDeployment?.status !== "READY" && (
                                    <div className="terminal">
                                        <p className="terminal-title">Live Stream</p>
                                        {liveLogs.length === 0 && (
                                            <p className="muted mono">
                                                Waiting for new log events...
                                            </p>
                                        )}
                                        {liveLogs.map((entry) => (
                                            <div className="log-line" key={entry.id}>
                                                <span className="mono dim">
                                                    [{isoToReadable(entry.createdAt)}]
                                                </span>
                                                <span className="mono">{entry.log}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </section>
            </main>

            {/* Custom Domain Settings Modal Pop-up */}
            {domainModalOpen && (
                <div className="modal-backdrop" role="presentation" onClick={() => setDomainModalOpen(false)}>
                    <div
                        className="modal-card create-project-modal"
                        role="dialog"
                        onClick={(event) => event.stopPropagation()}
                        style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "85vh", overflowY: "auto" }}
                    >
                        <div className="modal-header">
                            <h4>Configure Custom Domain</h4>
                            <p className="note-text">
                                Link your own custom domain to point to your Cloudify project.
                            </p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSaveDomain(); }} className="form-grid compact">
                            <label>
                                Custom Domain Name
                                <input
                                    value={domainInput}
                                    onChange={(e) => {
                                        setDomainInput(e.target.value);
                                        setDnsVerificationStatus(null);
                                    }}
                                    placeholder="example.com"
                                    required
                                    className="dns-val-input"
                                    style={{ width: "100%" }}
                                />
                            </label>

                            <div className="dns-instructions-card">
                                <span className="mono-eyebrow">DNS CONFIGURATION REQUIRED</span>
                                <p className="instruction-desc muted">
                                    Create a CNAME record with your DNS provider (e.g. Cloudflare, GoDaddy) pointing to the address below:
                                </p>

                                <div className="dns-record-details">
                                    <div className="dns-field">
                                        <span className="dns-label mono">TYPE</span>
                                        <span className="dns-val mono font-bold">CNAME</span>
                                    </div>
                                    <div className="dns-field">
                                        <span className="dns-label mono">NAME</span>
                                        <span className="dns-val mono">@ or www</span>
                                    </div>
                                    <div className="dns-field">
                                        <span className="dns-label mono">VALUE (DNS TARGET)</span>
                                        <div className="dns-target-row">
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${selectedProject?.subdomain || "your-slug"}.cloudify.avishekadhikary.in`}
                                                className="dns-val-input mono"
                                            />
                                            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-copy"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${selectedProject?.subdomain || "your-slug"}.cloudify.avishekadhikary.in`);
                                                        setCopiedCname(true);
                                                        setTimeout(() => setCopiedCname(false), 2000);
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                                {copiedCname && (
                                                    <span style={{
                                                        position: "absolute",
                                                        bottom: "calc(100% + 6px)",
                                                        left: "50%",
                                                        transform: "translateX(-50%)",
                                                        background: "var(--success, #22c55e)",
                                                        color: "#000",
                                                        fontSize: "0.7rem",
                                                        fontWeight: "600",
                                                        fontFamily: "monospace",
                                                        padding: "3px 8px",
                                                        borderRadius: "4px",
                                                        whiteSpace: "nowrap",
                                                        pointerEvents: "none",
                                                        animation: "fadeInUp 0.15s ease",
                                                        zIndex: 100,
                                                    }}>
                                                        ✓ Copied!
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <p className="dns-a-record-notice muted" style={{ fontSize: "0.75rem", marginTop: "8px", color: "var(--muted)" }}>
                                    * Support for configuring A records is coming soon.
                                </p>

                                <div className="dns-verification-action">
                                    <button
                                        type="button"
                                        className="btn btn-ghost dns-verify-btn"
                                        onClick={handleVerifyDns}
                                        disabled={verifyingDns}
                                    >
                                        {verifyingDns ? "Checking propagation..." : "Verify DNS Connection"}
                                    </button>

                                    {dnsVerificationStatus === "success" && (
                                        <div className="dns-status-badge success reveal">
                                            <span className="success-text mono">✓ DNS Configured Correctly</span>
                                        </div>
                                    )}

                                    {dnsVerificationStatus === "error" && (
                                        <div className="dns-status-badge error reveal">
                                            <span className="error-text mono">✗ Verification Failed</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="dns-notice muted" style={{ fontSize: "0.74rem", marginTop: "4px", lineHeight: "1.4", color: "var(--muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                                <strong>Note:</strong> DNS propagation can take time. You can safely proceed to save the custom domain now even if it is not verified; you can always fix and verify your domain records later.
                            </p>

                            {domainError && <p className="error-text">{domainError}</p>}

                            <div className="modal-actions" style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                                {selectedProject?.customDomain && (
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        style={{ color: "var(--danger)", marginRight: "auto" }}
                                        onClick={() => {
                                            handleRemoveDomain();
                                            setDomainModalOpen(false);
                                        }}
                                    >
                                        Remove Domain
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setDomainModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={savingDomain}
                                >
                                    {savingDomain ? "Saving..." : "Save Domain"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <CreateDeploymentModal
                isOpen={createModalOpen}
                pathValue={deployPath}
                setPathValue={setDeployPath}
                onClose={() => setCreateModalOpen(false)}
                onConfirm={createDeployment}
                deploying={deploying}
                deployError={deployError}
            />

            {deleteModalOpen && (
                <div className="modal-backdrop" role="presentation" onClick={() => setDeleteModalOpen(false)}>
                    <div
                        className="modal-card"
                        role="dialog"
                        onClick={(event) => event.stopPropagation()}
                        style={{ maxWidth: "480px" }}
                    >
                        <div className="modal-header">
                            <h3 style={{ color: "var(--danger)" }}>Delete Project</h3>
                        </div>
                        <div className="modal-body" style={{ marginTop: "12px" }}>
                            <p style={{ color: "var(--text)", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "12px" }}>
                                This action <strong style={{ color: "var(--danger)" }}>cannot be undone</strong>. This will permanently delete the project <strong>{selectedProject?.name}</strong>, all its associated deployments, custom domains, and build logs.
                            </p>

                            <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "16px" }}>
                                Please type <span style={{ fontFamily: "var(--mono)", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", color: "#ff6b6b" }}>{selectedProject?.name}</span> to confirm.
                            </p>

                            <input
                                type="text"
                                className="input-field"
                                value={deleteConfirmName}
                                onChange={(e) => setDeleteConfirmName(e.target.value)}
                                placeholder={selectedProject?.name}
                                style={{ width: "100%", marginBottom: "12px" }}
                            />

                            {deleteError && (
                                <p className="error-text" style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "12px" }}>
                                    {deleteError}
                                </p>
                            )}

                            <div className="modal-actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={deletingProject}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn animate-pulse"
                                    onClick={handleDeleteProject}
                                    disabled={deletingProject || deleteConfirmName !== selectedProject?.name}
                                    style={{
                                        background: "var(--danger)",
                                        color: "white",
                                        border: "none",
                                        opacity: (deletingProject || deleteConfirmName !== selectedProject?.name) ? 0.5 : 1,
                                        cursor: (deletingProject || deleteConfirmName !== selectedProject?.name) ? "not-allowed" : "pointer"
                                    }}
                                >
                                    {deletingProject ? "Deleting..." : "Permanently Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DeploymentsPage;
