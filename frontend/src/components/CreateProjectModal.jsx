import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../lib/api";

function CreateProjectModal({
    isOpen,
    onClose,
    projectForm,
    setProjectForm,
    slugState,
    checkSlug,
    projectMutationLoading,
    projectError,
    handleProjectCreate,
}) {
    const callApi = useApi();
    const navigate = useNavigate();
    const [verifyingDns, setVerifyingDns] = useState(false);
    const [dnsVerificationStatus, setDnsVerificationStatus] = useState(null);

    // Reset DNS verification status when slug or custom domain changes
    useEffect(() => {
        setDnsVerificationStatus(null);
    }, [projectForm.slug, projectForm.customDomain, projectForm.useCustomDomain]);

    if (!isOpen) return null;

    const handleSubmit = async (event) => {
        event.preventDefault();
        const result = await handleProjectCreate(event);
        if (result) {
            onClose();
            // result is the new project ID if returned, otherwise true
            if (typeof result === "string") {
                navigate(`/projects/${result}/deployments`);
            }
        }
    };

    const handleVerifyDns = async () => {
        if (!projectForm.customDomain) return;
        setVerifyingDns(true);
        setDnsVerificationStatus(null);
        try {
            const response = await callApi("/project/verify-dns", {
                method: "POST",
                body: JSON.stringify({
                    customDomain: projectForm.customDomain,
                    subdomain: projectForm.slug,
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

    const handleCopyTarget = () => {
        const target = `${projectForm.slug || "your-slug"}.cloudify.avishekadhikary.in`;
        navigator.clipboard.writeText(target);
        alert(`Copied: ${target}`);
    };

    return (
        <div className="modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="modal-card create-project-modal"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="modal-header">
                    <h4>Create New Project</h4>
                    <p className="note-text">
                        Reserve your subdomain and link a repository to launch your website.
                    </p>
                </div>

                <form className="form-grid compact" onSubmit={handleSubmit}>
                    <label>
                        Project name
                        <input
                            value={projectForm.name}
                            onChange={(event) =>
                                setProjectForm((previous) => ({
                                    ...previous,
                                    name: event.target.value,
                                }))
                            }
                            placeholder="my-cool-app"
                            required
                        />
                    </label>

                    <label>
                        Subdomain slug
                        <div className="input-with-suffix">
                            <input
                                value={projectForm.slug}
                                onChange={(event) =>
                                    setProjectForm((previous) => ({
                                        ...previous,
                                        slug: event.target.value,
                                    }))
                                }
                                onBlur={checkSlug}
                                placeholder="my-cool-app"
                                required
                            />
                            <span className="input-suffix">.cloudify.avishekadhikary.in</span>
                        </div>
                    </label>

                    {slugState.checking && (
                        <p className="muted mono-status">Checking slug availability...</p>
                    )}
                    {slugState.available === true && (
                        <p className="success-text mono-status">✓ Subdomain slug is available.</p>
                    )}
                    {slugState.available === false && (
                        <p className="error-text mono-status">✗ Subdomain slug is already taken.</p>
                    )}

                    {projectForm.useCustomDomain && (
                        <p className="slug-explanation-notice muted" style={{ fontSize: "0.78rem", marginTop: "-6px", marginBottom: "12px", lineHeight: "1.4", color: "var(--muted)" }}>
                            A subdomain slug is required. Even when using a custom domain, Cloudify uses this internal subdomain address to host your files and route incoming traffic from your custom domain.
                        </p>
                    )}

                    <label>
                        GitHub URL
                        <input
                            value={projectForm.githubUrl}
                            onChange={(event) =>
                                setProjectForm((previous) => ({
                                    ...previous,
                                    githubUrl: event.target.value,
                                }))
                            }
                            placeholder="https://github.com/username/repository"
                            required
                        />
                    </label>

                    {/* Custom Domain Toggle Option */}
                    <div className="toggle-container">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={projectForm.useCustomDomain || false}
                                onChange={(event) =>
                                    setProjectForm((previous) => ({
                                        ...previous,
                                        useCustomDomain: event.target.checked,
                                    }))
                                }
                            />
                            <span className="toggle-slider"></span>
                        </label>
                        <span className="toggle-label mono">
                            Configure your own custom domain name
                        </span>
                    </div>

                    {/* Unhidden fields when custom domain is toggled on */}
                    {projectForm.useCustomDomain && (
                        <div className="custom-domain-setup reveal">
                            <label>
                                Your Custom Domain
                                <input
                                    value={projectForm.customDomain}
                                    onChange={(event) =>
                                        setProjectForm((previous) => ({
                                            ...previous,
                                            customDomain: event.target.value,
                                        }))
                                    }
                                    placeholder="yourdomain.com"
                                    required
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
                                                value={`${projectForm.slug || "your-slug"}.cloudify.avishekadhikary.in`}
                                                className="dns-val-input mono"
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-copy"
                                                onClick={handleCopyTarget}
                                            >
                                                Copy
                                            </button>
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
                                            <span className="error-text mono">✗ DNS Not Propagated Yet</span>
                                        </div>
                                    )}
                                </div>

                                <p className="dns-notice muted" style={{ fontSize: "0.74rem", marginTop: "12px", lineHeight: "1.4", color: "var(--muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                                    <strong>Note:</strong> DNS propagation can take time. You can safely proceed to create the project now even if it is not verified; you can always fix and verify your domain records later.
                                </p>
                            </div>
                        </div>
                    )}

                    {projectError && <p className="error-text">{projectError}</p>}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={onClose}
                            disabled={projectMutationLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={projectMutationLoading}
                        >
                            {projectMutationLoading ? "Creating..." : "Create Project"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateProjectModal;
