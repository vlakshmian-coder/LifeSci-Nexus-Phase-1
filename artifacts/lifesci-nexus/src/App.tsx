import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import {
  Activity, Archive, ArrowRight, Beaker, BookOpenCheck, Check, ChevronRight, CircleAlert,
  ClipboardCheck, Clock3, FileCheck2, FileText, Filter, FlaskConical, FolderKanban,
  History, LayoutDashboard, Menu, Plus, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, X, Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getListProjectsQueryKey, getGetDashboardQueryKey, getGetProjectQueryKey,
  getListProjectRunsQueryKey, getListProjectFindingsQueryKey, getListReviewQueueQueryKey,
  getListProjectReportsQueryKey, getListProjectAuditEventsQueryKey,
  useCreateProject, useCreateProjectRun, useGetDashboard, useGetProject,
  useListProjectAuditEvents, useListProjectFindings, useListProjectReports,
  useListProjectRuns, useListProjects, useListReviewQueue, useUpdateProject
} from '@workspace/api-client-react';
import type {
  Finding, Project, ProjectInput, ProjectScope, ProjectStatus, ReviewItem, WorkflowState
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();

const disclaimer = 'AI-generated preliminary assessment. This system does not provide regulatory, clinical, medical or legal advice. Outputs require qualified human review.';
const sourceLabels: Record<string, string> = {
  EXTERNAL_EVIDENCE: 'External evidence',
  PROJECT_MEMORY: 'Project memory',
  PROJECT_DOCUMENT: 'Project document',
  HUMAN_DECISION: 'Human decision',
};

function fmtDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}
function relative(value?: string) {
  if (!value) return '—';
  const diff = Math.max(0, Date.now() - new Date(value).valueOf());
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function titleCase(value?: string) {
  return value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  return <span className={`badge badge-${tone}`} data-testid={`status-${String(children).toLowerCase().replaceAll(' ', '-')}`}>{children}</span>;
}
function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} aria-label="Loading" />; }
function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof FileText; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={20} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
function PageIntro({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}
function Signal({ type }: { type: string }) {
  const tone = type === 'EXTERNAL_EVIDENCE' ? 'blue' : type === 'HUMAN_DECISION' ? 'amber' : type === 'PROJECT_MEMORY' ? 'green' : 'neutral';
  return <Badge tone={tone}>{sourceLabels[type] || titleCase(type)}</Badge>;
}
function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className="loading-stack">{Array.from({ length: count }).map((_, i) => <div className="loading-row" key={i}><Skeleton className="w-8 h-8 rounded-lg" /><div className="flex-1"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-2/3 mt-2" /></div></div>)}</div>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/findings', label: 'Traceability', icon: ShieldCheck },
    { href: '/review-queue', label: 'Review queue', icon: ClipboardCheck },
    { href: '/reports', label: 'Reports', icon: FileCheck2 },
    { href: '/audit-trail', label: 'Audit trail', icon: History },
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Beaker size={18} /></div><div><div className="brand-name">LifeSci <span>Nexus</span></div><div className="brand-caption">Evidence workspace</div></div></div>
      <div className="workspace-switcher"><div className="workspace-dot" /><div><div className="workspace-name">Northstar MedTech</div><div className="workspace-role">Qualified workspace</div></div><ChevronRight size={14} /></div>
      <nav className="sidebar-nav" aria-label="Primary navigation">{nav.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? location === '/' : location.startsWith(href);
        return <Link key={href} href={href} className={`nav-item ${active ? 'nav-active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setMobileOpen(false)}><Icon size={17} /><span>{label}</span>{label === 'Review queue' && <span className="nav-count">4</span>}</Link>;
      })}</nav>
      <div className="sidebar-bottom"><div className="integrity-card"><div className="integrity-icon"><ShieldCheck size={15} /></div><div><strong>Traceability on</strong><span>Every result has a source</span></div></div><div className="user-chip"><div className="avatar">AC</div><div><strong>Alex Chen</strong><span>Clinical operations</span></div><button className="icon-button" aria-label="Open profile" data-testid="button-open-profile"><SlidersHorizontal size={15} /></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-toggle-menu"><Menu size={19} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{nav.find((item) => location === item.href || (item.href !== '/' && location.startsWith(item.href)))?.label || 'Project workspace'}</strong></div><div className="topbar-actions"><div className="system-status"><span className="pulse-dot" /> All systems operational</div><button className="icon-button" aria-label="View activity" data-testid="button-view-activity"><Activity size={17} /></button><div className="avatar avatar-small">AC</div></div></header><div className="content">{children}</div><footer className="footer-disclaimer"><CircleAlert size={14} /><span>{disclaimer}</span></footer></main>
  </div>;
}

function Dashboard() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  const { data: projects } = useListProjects();
  const queueCount = data?.reviewQueueCount ?? 0;
  const metrics: { label: string; value: number | undefined; note: string; Icon: LucideIcon; tone: string }[] = [
    { label: 'Active projects', value: data?.activeProjects, note: 'Across this workspace', Icon: FolderKanban, tone: 'teal' },
    { label: 'Awaiting review', value: queueCount, note: 'Qualified decisions needed', Icon: ClipboardCheck, tone: 'amber' },
    { label: 'Verified findings', value: data?.verifiedFindingCount, note: 'With traceable support', Icon: ShieldCheck, tone: 'blue' },
  ];
  return <div className="page">
    <PageIntro eyebrow="Command center / 06 February 2025" title="Good morning, Alex." detail="A clear view of your clinical-validation workspace, with provenance at every step." action={<Link href="/projects" className="button button-primary" data-testid="link-start-project"><Plus size={16} /> New project</Link>} />
    <div className="notice-banner"><div className="notice-mark"><ShieldCheck size={17} /></div><div><strong>Human oversight is the control point.</strong><span>AI can organize evidence and surface gaps; qualified reviewers make the decision.</span></div><Link href="/review-queue" className="notice-link" data-testid="link-notice-review">Review queue <ArrowRight size={14} /></Link></div>
    {isError ? <div className="error-card"><CircleAlert size={18} /><div><strong>Overview could not load</strong><p>Try again to reconnect to the workspace.</p></div><button className="button button-secondary" onClick={() => refetch()} data-testid="button-retry-dashboard">Retry</button></div> :
      <><div className="metric-grid">
        {metrics.map(({ label, value, note, Icon, tone }) => <div className={`metric-card metric-${tone}`} key={label}><div className="metric-top"><span>{label}</span><Icon size={18} /></div><div className="metric-value">{isLoading ? <Skeleton className="h-9 w-16" /> : value ?? '—'}</div><div className="metric-note"><span className="metric-line" />{note}</div></div>)}
        <div className="metric-card metric-lilac"><div className="metric-top"><span>Evidence posture</span><Sparkles size={18} /></div><div className="metric-value">72<span className="metric-unit">%</span></div><div className="progress"><div style={{ width: '72%' }} /></div><div className="metric-note">Ready to move forward</div></div>
      </div><div className="dashboard-grid">
        <section className="panel activity-panel"><div className="panel-head"><div><div className="eyebrow">Recent activity</div><h2>What changed</h2></div><Link href="/audit-trail" className="text-link" data-testid="link-dashboard-audit">Full audit trail <ArrowRight size={14} /></Link></div>{isLoading ? <LoadingRows /> : data?.recentActivity?.length ? <div className="activity-list">{data.recentActivity.slice(0, 5).map((event) => <ActivityRow event={event} key={event.id} />)}</div> : <EmptyState icon={History} title="No activity yet" detail="Project changes and decisions will appear here." />}</section>
        <section className="panel queue-panel"><div className="panel-head"><div><div className="eyebrow">Qualified review</div><h2>Review queue</h2></div><Link href="/review-queue" className="round-arrow" data-testid="link-dashboard-queue"><ArrowRight size={16} /></Link></div><div className="queue-summary"><div className="queue-number">{queueCount}</div><div><strong>items need your attention</strong><span>Prioritized by risk and recency</span></div></div><div className="mini-priority"><span><i className="priority-dot priority-high" /> High priority</span><strong>{queueCount ? Math.min(queueCount, 2) : 0}</strong><span><i className="priority-dot priority-medium" /> Standard</span><strong>{queueCount > 2 ? queueCount - 2 : 0}</strong></div><Link href="/review-queue" className="button button-quiet w-full" data-testid="link-open-review-queue">Open review queue <ArrowRight size={15} /></Link></section>
      </div><section className="section-block"><div className="section-head"><div><div className="eyebrow">In motion</div><h2>Active projects</h2></div><Link href="/projects" className="text-link" data-testid="link-dashboard-projects">View all projects <ArrowRight size={14} /></Link></div><div className="project-strip">{projects?.slice(0, 3).map((project) => <ProjectCard project={project} key={project.id} />) || <LoadingRows count={3} />}</div></section></>}
  </div>;
}

function ActivityRow({ event }: { event: { id: string; actor: string; description: string; eventType: string; createdAt: string } }) {
  return <div className="activity-row" data-testid={`row-activity-${event.id}`}><div className="event-icon"><Zap size={14} /></div><div className="activity-copy"><strong>{event.description}</strong><span>{event.actor} · {relative(event.createdAt)}</span></div><span className="event-type">{titleCase(event.eventType)}</span></div>;
}
function ProjectCard({ project }: { project: Project }) {
  return <Link href={`/projects/${project.id}`} className="project-card" data-testid={`card-project-${project.id}`}><div className="project-card-top"><span className="project-code">{project.id.slice(0, 8).toUpperCase()}</span><Badge tone={project.status === 'ACTIVE' ? 'green' : 'neutral'}>{titleCase(project.status)}</Badge></div><h3>{project.name}</h3><p>{project.scope.productName} · {project.scope.projectPhase}</p><div className="project-card-bottom"><span>{project.findingCount} findings</span><span>{titleCase(project.workflowState)}</span><ChevronRight size={15} /></div></Link>;
}

function Projects() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState<ProjectStatus | undefined>();
  const { data, isLoading, isError, refetch } = useListProjects(status ? { status } : undefined);
  const filtered = useMemo(() => (data || []).filter((p) => `${p.name} ${p.scope.productName}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  return <div className="page"><PageIntro eyebrow="Workspace / projects" title="Projects" detail="Keep scope, evidence, findings, and decisions connected from first brief to preliminary readiness." action={<button className="button button-primary" onClick={() => setShowCreate(true)} data-testid="button-create-project"><Plus size={16} /> New project</button>} />
    <div className="toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects or product names" data-testid="input-search-projects" /></div><div className="filter-tabs"><button className={!status ? 'active' : ''} onClick={() => setStatus(undefined)} data-testid="button-filter-all">All projects</button><button className={status === 'ACTIVE' ? 'active' : ''} onClick={() => setStatus('ACTIVE')} data-testid="button-filter-active">Active</button><button className={status === 'ARCHIVED' ? 'active' : ''} onClick={() => setStatus('ARCHIVED')} data-testid="button-filter-archived">Archived</button></div><button className="icon-button" data-testid="button-project-filters"><Filter size={16} /></button></div>
    {isError ? <div className="error-card"><CircleAlert size={18} /><div><strong>Projects could not load</strong><p>Try again to reconnect to the workspace.</p></div><button className="button button-secondary" onClick={() => refetch()} data-testid="button-retry-projects">Retry</button></div> : isLoading ? <LoadingRows count={5} /> : filtered.length ? <div className="project-list">{filtered.map((project) => <ProjectListRow project={project} key={project.id} />)}</div> : <EmptyState icon={FolderKanban} title="No matching projects" detail={search ? 'Try a different project or product name.' : 'Create the first project to establish a traceable scope.'} action={<button className="button button-primary" onClick={() => setShowCreate(true)} data-testid="button-empty-create-project"><Plus size={15} /> Create project</button>} />}
    {showCreate && <CreateProjectDialog onClose={() => setShowCreate(false)} />}
  </div>;
}
function ProjectListRow({ project }: { project: Project }) {
  return <Link href={`/projects/${project.id}`} className="project-list-row" data-testid={`row-project-${project.id}`}><div className="project-avatar"><FlaskConical size={18} /></div><div className="project-list-main"><div className="project-list-title"><h3>{project.name}</h3><Badge tone={project.status === 'ACTIVE' ? 'green' : 'neutral'}>{titleCase(project.status)}</Badge></div><p>{project.scope.productName} · {project.scope.intendedUse}</p></div><div className="project-list-stat"><span>Workflow state</span><strong>{titleCase(project.workflowState)}</strong></div><div className="project-list-stat"><span>Findings</span><strong>{project.findingCount}</strong></div><div className="project-list-date"><span>Updated</span><strong>{relative(project.updatedAt)}</strong></div><ChevronRight size={17} /></Link>;
}
function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ProjectScope>({ productName: '', intendedUse: '', projectPhase: '', assessmentFramework: '', jurisdictionContext: '', scopeNotes: '' });
  const create = useCreateProject();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const submit = (e: React.FormEvent) => { e.preventDefault(); create.mutate({ data: { name, scope } as ProjectInput }, { onSuccess: (project) => { qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }); onClose(); setLocation(`/projects/${project.id}`); } }); };
  const setField = (key: keyof ProjectScope) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setScope((s) => ({ ...s, [key]: e.target.value }));
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><div className="eyebrow">New workspace</div><h2>Start a project</h2><p>Define the boundary before evidence enters the room.</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-create-project"><X size={18} /></button></div><form onSubmit={submit}><label>Project name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LumaSense clinical validation" data-testid="input-project-name" /></label><div className="form-grid"><label>Product name<input required value={scope.productName} onChange={setField('productName')} placeholder="Product or system" data-testid="input-product-name" /></label><label>Project phase<input required value={scope.projectPhase} onChange={setField('projectPhase')} placeholder="e.g. Design validation" data-testid="input-project-phase" /></label><label className="full-span">Intended use<input required value={scope.intendedUse} onChange={setField('intendedUse')} placeholder="Describe the intended use" data-testid="input-intended-use" /></label><label>Assessment framework<input required value={scope.assessmentFramework} onChange={setField('assessmentFramework')} placeholder="e.g. ISO 14971" data-testid="input-assessment-framework" /></label><label>Jurisdiction context<input value={scope.jurisdictionContext || ''} onChange={setField('jurisdictionContext')} placeholder="e.g. US / FDA" data-testid="input-jurisdiction" /></label><label className="full-span">Scope notes<textarea value={scope.scopeNotes || ''} onChange={setField('scopeNotes')} placeholder="Boundaries, exclusions, or assumptions" data-testid="input-scope-notes" /></label></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose} data-testid="button-cancel-create-project">Cancel</button><button disabled={create.isPending} type="submit" className="button button-primary" data-testid="button-submit-create-project">{create.isPending ? 'Creating…' : 'Create project'} <ArrowRight size={15} /></button></div>{create.isError && <div className="form-error"><CircleAlert size={14} /> Project could not be created. Check the fields and try again.</div>}</form></div></div>;
}

function ProjectWorkspacePage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data, isLoading, isError, refetch } = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId) } });
  const runsQuery = useListProjectRuns(projectId, { query: { queryKey: getListProjectRunsQueryKey(projectId) } });
  const runMutation = useCreateProjectRun();
  const updateProject = useUpdateProject();
  const qc = useQueryClient();
  const [runLabel, setRunLabel] = useState('Controlled evidence analysis');
  if (isLoading) return <div className="page"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-2/3 mt-4" /><LoadingRows count={6} /></div>;
  if (isError || !data) return <div className="page"><div className="error-card"><CircleAlert size={18} /><div><strong>Project workspace unavailable</strong><p>We could not find this project.</p></div><button className="button button-secondary" onClick={() => refetch()} data-testid="button-retry-project">Retry</button></div></div>;
  const { project, findings = [], reports = [], recentAuditEvents = [] } = data;
  const runs = runsQuery.data ?? data.runs ?? [];
  const startRun = () => runMutation.mutate({ projectId, data: { label: runLabel } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) }) });
  const archive = () => updateProject.mutate({ projectId, data: { status: project.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) }) });
  return <div className="page"><div className="workspace-top"><div><Link href="/projects" className="back-link" data-testid="link-back-projects">Projects <ChevronRight size={13} /></Link><div className="eyebrow">Project workspace / {project.id.slice(0, 8)}</div><div className="workspace-title"><h1>{project.name}</h1><Badge tone={project.status === 'ACTIVE' ? 'green' : 'neutral'}>{titleCase(project.status)}</Badge></div><p>{project.scope.productName} · {project.scope.intendedUse}</p></div><div className="workspace-actions"><button className="button button-secondary" onClick={archive} data-testid="button-toggle-project-status">{project.status === 'ACTIVE' ? <Archive size={15} /> : <Check size={15} />}{project.status === 'ACTIVE' ? 'Archive' : 'Reactivate'}</button><button className="button button-primary" onClick={startRun} disabled={runMutation.isPending} data-testid="button-start-run"><Zap size={15} />{runMutation.isPending ? 'Starting…' : 'Start controlled run'}</button></div></div>
    <div className="workflow-line">{(['CREATED', 'SCOPED', 'DOCUMENTS_ANALYZED', 'EVIDENCE_RETRIEVED', 'GAPS_IDENTIFIED', 'FINDINGS_VERIFIED', 'REPORT_DRAFTED', 'HUMAN_REVIEW'] as WorkflowState[]).map((step, i) => <div className={`workflow-step ${project.workflowState === step ? 'current' : ''} ${i < ['CREATED', 'SCOPED', 'DOCUMENTS_ANALYZED', 'EVIDENCE_RETRIEVED', 'GAPS_IDENTIFIED', 'FINDINGS_VERIFIED', 'REPORT_DRAFTED', 'HUMAN_REVIEW'].indexOf(project.workflowState) ? 'complete' : ''}`} key={step}><span>{i + 1}</span>{titleCase(step)}</div>)}</div>
    <div className="workspace-grid"><div className="workspace-main"><section className="panel"><div className="panel-head"><div><div className="eyebrow">Defined boundary</div><h2>Scope & context</h2></div><button className="icon-button" data-testid="button-edit-scope" aria-label="Edit scope"><SlidersHorizontal size={16} /></button></div><div className="scope-grid">{[['Product', project.scope.productName], ['Intended use', project.scope.intendedUse], ['Project phase', project.scope.projectPhase], ['Assessment framework', project.scope.assessmentFramework], ['Jurisdiction', project.scope.jurisdictionContext || 'Not specified'], ['Scope notes', project.scope.scopeNotes || 'No additional notes']].map(([label, value]) => <div className="scope-cell" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><div className="eyebrow">Traceable outputs / {findings.length}</div><h2>Findings</h2></div><Link href="/findings" className="text-link" data-testid="link-workspace-findings">Open traceability <ArrowRight size={14} /></Link></div>{findings.length ? <div className="finding-list">{findings.map((finding) => <FindingRow finding={finding} key={finding.id} />)}</div> : <EmptyState icon={ShieldCheck} title="No findings yet" detail="Start a controlled run to analyze the defined scope." action={<button className="button button-primary" onClick={startRun} data-testid="button-empty-start-run"><Zap size={15} /> Start run</button>} />}</section>
    </div><aside className="workspace-side"><section className="panel run-panel"><div className="panel-head"><div><div className="eyebrow">Controlled analysis</div><h2>Runs</h2></div><button className="icon-button" onClick={startRun} aria-label="Start run" data-testid="button-start-run-small"><Plus size={16} /></button></div><label className="compact-label">Run label<input value={runLabel} onChange={(e) => setRunLabel(e.target.value)} data-testid="input-run-label" /></label>{runs.length ? <div className="run-list">{runs.map((run) => <div className="run-row" key={run.id} data-testid={`row-run-${run.id}`}><div className={`run-state run-${run.state.toLowerCase()}`}><Activity size={13} /></div><div><strong>{run.label}</strong><span>{titleCase(run.state)} · {relative(run.updatedAt)}</span></div><ChevronRight size={14} /></div>)}</div> : <p className="muted-copy">No controlled runs have been started.</p>}</section><section className="panel"><div className="panel-head"><div><div className="eyebrow">Readiness material</div><h2>Reports</h2></div><FileText size={17} /></div>{reports.length ? reports.map((report) => <div className="report-row" key={report.id}><div className="report-icon"><FileText size={15} /></div><div><strong>{report.title}</strong><span>{report.findingCount} findings · {fmtDate(report.generatedAt)}</span></div><Badge tone={report.status === 'APPROVED' ? 'green' : report.status === 'HUMAN_REVIEW' ? 'amber' : 'neutral'}>{titleCase(report.status)}</Badge></div>) : <p className="muted-copy">Reports appear after findings are verified.</p>}</section><section className="panel"><div className="panel-head"><div><div className="eyebrow">Audit</div><h2>Recent events</h2></div><History size={17} /></div>{recentAuditEvents.slice(0, 4).map((event) => <ActivityRow event={event} key={event.id} />)}</section></aside></div>
  </div>;
}

function FindingRow({ finding }: { finding: Finding }) {
  return <div className="finding-row" data-testid={`row-finding-${finding.id}`}><div className="finding-status"><span /></div><div className="finding-main"><div className="finding-title"><h3>{finding.title}</h3><Badge tone={finding.status === 'SUPPORTED' ? 'green' : finding.status === 'REQUIRES_HUMAN_REVIEW' ? 'amber' : 'neutral'}>{titleCase(finding.status)}</Badge></div><p>{finding.summary}</p><div className="provenance-stack">{finding.provenance?.slice(0, 3).map((source) => <Signal type={source.sourceType} key={`${source.sourceType}-${source.label}`} />)}</div></div><div className="finding-confidence"><span>Confidence</span><strong>{titleCase(finding.confidence)}</strong><small>{relative(finding.updatedAt)}</small></div></div>;
}

function Traceability() {
  const { data: projects } = useListProjects();
  const [projectId, setProjectId] = useState('');
  const [source, setSource] = useState('');
  const { data: findings, isLoading, isError, refetch } = useListProjectFindings(projectId, { query: { enabled: !!projectId, queryKey: getListProjectFindingsQueryKey(projectId) } });
  const filtered = (findings || []).filter((f) => !source || f.provenance?.some((p) => p.sourceType === source));
  return <div className="page"><PageIntro eyebrow="Workspace / traceability" title="Findings ledger" detail="A cross-project view of what was found, how confident it is, and where it came from." /><div className="trace-callout"><div className="trace-graphic"><div className="trace-node node-one" /><div className="trace-node node-two" /><div className="trace-node node-three" /><div className="trace-line line-one" /><div className="trace-line line-two" /></div><div><strong>Provenance is part of the finding.</strong><span>External evidence, project memory, project documents, and human decisions stay visually distinct.</span></div></div><div className="toolbar"><div className="select-field"><FolderKanban size={15} /><select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="select-findings-project"><option value="">Select a project to inspect</option>{projects?.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div><div className="filter-tabs source-tabs"><button className={!source ? 'active' : ''} onClick={() => setSource('')} data-testid="button-filter-source-all">All sources</button><button className={source === 'EXTERNAL_EVIDENCE' ? 'active' : ''} onClick={() => setSource('EXTERNAL_EVIDENCE')} data-testid="button-filter-source-external">External evidence</button><button className={source === 'PROJECT_MEMORY' ? 'active' : ''} onClick={() => setSource('PROJECT_MEMORY')} data-testid="button-filter-source-memory">Project memory</button><button className={source === 'HUMAN_DECISION' ? 'active' : ''} onClick={() => setSource('HUMAN_DECISION')} data-testid="button-filter-source-human">Human decision</button></div></div>{!projectId ? <EmptyState icon={BookOpenCheck} title="Choose a project" detail="Select a project above to open its traceable findings ledger." /> : isError ? <div className="error-card"><CircleAlert size={18} /><div><strong>Findings could not load</strong><p>Try again to reconnect.</p></div><button className="button button-secondary" onClick={() => refetch()} data-testid="button-retry-findings">Retry</button></div> : isLoading ? <LoadingRows /> : filtered.length ? <div className="finding-list ledger-list">{filtered.map((finding) => <FindingRow finding={finding} key={finding.id} />)}</div> : <EmptyState icon={ShieldCheck} title="No findings match" detail="Try another provenance filter or run analysis for this project." />}</div>;
}

function ReviewQueue() {
  const { data, isLoading, isError, refetch } = useListReviewQueue({ query: { queryKey: getListReviewQueueQueryKey() } });
  return <div className="page"><PageIntro eyebrow="Workspace / qualified review" title="Review queue" detail="Human decisions are the final control point before material can be treated as verified." action={<div className="queue-chip"><ClipboardCheck size={16} /><strong>{data?.length ?? 0}</strong><span>open items</span></div>} /><div className="review-banner"><div className="notice-mark amber"><CircleAlert size={17} /></div><div><strong>Review is a qualified action.</strong><span>Read the supporting provenance before recording a decision. AI-generated content remains preliminary until reviewed.</span></div></div>{isError ? <div className="error-card"><CircleAlert size={18} /><div><strong>Queue could not load</strong><p>Try again to reconnect.</p></div><button className="button button-secondary" onClick={() => refetch()} data-testid="button-retry-review-queue">Retry</button></div> : isLoading ? <LoadingRows count={5} /> : data?.length ? <div className="review-list">{data.map((item) => <ReviewRow item={item} key={item.id} />)}</div> : <EmptyState icon={ClipboardCheck} title="Queue is clear" detail="No findings or reports are waiting for qualified review." />}</div>;
}
function ReviewRow({ item }: { item: ReviewItem }) {
  return <div className="review-row" data-testid={`row-review-${item.id}`}><div className={`priority-rail priority-${item.priority.toLowerCase()}`} /><div className="review-main"><div className="review-title"><span className="project-code">{item.projectId.slice(0, 8).toUpperCase()}</span><Badge tone={item.priority === 'HIGH' ? 'red' : item.priority === 'MEDIUM' ? 'amber' : 'neutral'}>{titleCase(item.priority)} priority</Badge></div><h3>{item.title}</h3><p>{item.reason}</p><span className="review-created"><Clock3 size={13} /> Added {relative(item.createdAt)}</span></div><Link href={`/projects/${item.projectId}`} className="button button-secondary" data-testid={`link-review-project-${item.id}`}>Open context <ArrowRight size={14} /></Link></div>;
}

function Reports() {
  const { data: projects } = useListProjects();
  const [projectId, setProjectId] = useState('');
  const { data, isLoading } = useListProjectReports(projectId, { query: { enabled: !!projectId, queryKey: getListProjectReportsQueryKey(projectId) } });
  return <div className="page"><PageIntro eyebrow="Workspace / readiness material" title="Reports" detail="Preliminary readiness reports generated from the controlled evidence workflow." /><div className="toolbar"><div className="select-field"><FileText size={15} /><select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="select-reports-project"><option value="">Select a project</option>{projects?.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div><div className="report-disclaimer"><CircleAlert size={14} /> Preliminary only</div></div>{!projectId ? <EmptyState icon={FileCheck2} title="Select a project" detail="Choose a project to view its readiness reports." /> : isLoading ? <LoadingRows count={3} /> : data?.length ? <div className="report-index">{data.map((report) => <div className="report-card" key={report.id} data-testid={`card-report-${report.id}`}><div className="report-icon large"><FileText size={20} /></div><div className="report-card-main"><div className="report-card-title"><h3>{report.title}</h3><Badge tone={report.status === 'APPROVED' ? 'green' : report.status === 'HUMAN_REVIEW' ? 'amber' : 'neutral'}>{titleCase(report.status)}</Badge></div><p>Generated {fmtDate(report.generatedAt)} · {report.findingCount} traceable findings</p><div className="report-progress"><span style={{ width: `${Math.min(94, 30 + report.findingCount * 4)}%` }} /></div></div><button className="icon-button" data-testid={`button-open-report-${report.id}`} aria-label="Open report"><ArrowRight size={17} /></button></div>)}</div> : <EmptyState icon={FileCheck2} title="No reports yet" detail="Reports appear after a controlled workflow produces verified findings." />}</div>;
}

function AuditTrail() {
  const { data: projects } = useListProjects();
  const [projectId, setProjectId] = useState('');
  const { data, isLoading, isError, refetch } = useListProjectAuditEvents(projectId, { query: { enabled: !!projectId, queryKey: getListProjectAuditEventsQueryKey(projectId) } });
  return <div className="page"><PageIntro eyebrow="Workspace / accountability" title="Audit trail" detail="A durable record of workflow activity, actors, and decisions across the workspace." /><div className="toolbar"><div className="select-field"><History size={15} /><select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="select-audit-project"><option value="">Select a project</option>{projects?.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div><button className="button button-secondary" data-testid="button-audit-filter"><Filter size={15} /> Filter events</button></div>{!projectId ? <EmptyState icon={History} title="Choose a project" detail="Select a project to inspect its immutable activity history." /> : isError ? <div className="error-card"><CircleAlert size={18} /><div><strong>Audit events could not load</strong><p>Try again to reconnect.</p></div><button className="button button-secondary" onClick={() => refetch()} data-testid="button-retry-audit">Retry</button></div> : isLoading ? <LoadingRows count={5} /> : data?.length ? <div className="audit-list">{data.map((event) => <div className="audit-row" key={event.id} data-testid={`row-audit-${event.id}`}><div className="audit-date">{fmtDate(event.createdAt)}<span>{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div className="audit-mark"><span /></div><div className="audit-detail"><div><Badge>{titleCase(event.eventType)}</Badge><span className="actor">by {event.actor}</span></div><h3>{event.description}</h3></div></div>)}</div> : <EmptyState icon={History} title="No events yet" detail="Project activity will appear here as work progresses." />}</div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell><Switch><Route path="/" component={Dashboard} /><Route path="/projects" component={Projects} /><Route path="/projects/:projectId" component={ProjectWorkspacePage} /><Route path="/findings" component={Traceability} /><Route path="/review-queue" component={ReviewQueue} /><Route path="/reports" component={Reports} /><Route path="/audit-trail" component={AuditTrail} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;