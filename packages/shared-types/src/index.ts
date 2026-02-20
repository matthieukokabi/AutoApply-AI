// ═══════════════════════════════════════════════════════════
// AutoApply AI — Shared Type Definitions
// Used across web app, mobile app, and n8n workflows
// ═══════════════════════════════════════════════════════════

// ─── User ──────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    clerkId: string;
    name: string;
    automationEnabled: boolean;
    subscriptionStatus: "free" | "pro" | "unlimited";
    creditsRemaining: number;
    createdAt: string;
}

// ─── Master Profile ────────────────────────────────────────

export interface MasterProfile {
    id: string;
    userId: string;
    rawText: string;
    structuredJson: StructuredCV;
    updatedAt: string;
}

export interface StructuredCV {
    contact: {
        name: string;
        email: string;
        phone?: string;
        location?: string;
        linkedin?: string;
        website?: string;
    };
    summary: string;
    experience: WorkExperience[];
    education: Education[];
    skills: string[];
    certifications?: string[];
    languages?: string[];
}

export interface WorkExperience {
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string; // null = current
    bullets: string[];
}

export interface Education {
    degree: string;
    institution: string;
    location?: string;
    graduationDate?: string;
    gpa?: string;
}

// ─── Job Preferences ───────────────────────────────────────

export interface JobPreferences {
    id: string;
    userId: string;
    targetTitles: string[];
    locations: string[];
    remotePreference: "remote" | "hybrid" | "onsite" | "any";
    salaryMin?: number;
    industries: string[];
}

// ─── Job ───────────────────────────────────────────────────

export interface Job {
    id: string;
    externalId: string;
    title: string;
    company: string;
    location: string;
    description: string;
    source: JobSource;
    url: string;
    salary?: string;
    postedAt?: string;
    fetchedAt: string;
}

export type JobSource = "adzuna" | "themuse" | "remotive" | "arbeitnow" | "manual";

// ─── Application ───────────────────────────────────────────

export interface Application {
    id: string;
    userId: string;
    jobId: string;
    compatibilityScore: number;
    atsKeywords: string[];
    matchingStrengths: string[];
    gaps: string[];
    recommendation: "apply" | "stretch" | "skip";
    tailoredCvUrl?: string;
    coverLetterUrl?: string;
    tailoredCvMarkdown?: string;
    coverLetterMarkdown?: string;
    status: ApplicationStatus;
    appliedAt?: string;
    notes?: string;
    createdAt: string;
    job?: Job;
}

export type ApplicationStatus =
    | "discovered"
    | "tailored"
    | "applied"
    | "interview"
    | "offer"
    | "rejected";

// ─── LLM Response Types ───────────────────────────────────

export interface CompatibilityResult {
    compatibility_score: number;
    ats_keywords: string[];
    matching_strengths: string[];
    gaps: string[];
    recommendation: "apply" | "stretch" | "skip";
}

export interface TailoredDocuments {
    tailored_cv_markdown: string;
    motivation_letter_markdown: string;
}

// ─── API Types ─────────────────────────────────────────────

export interface TailorRequest {
    jobDescription: string;
    jobUrl?: string;
    jobTitle?: string;
    company?: string;
}

export interface TailorResponse {
    message: string;
    jobId: string;
}

export interface N8NWebhookPayload {
    type: "new_applications" | "workflow_error";
    data: any;
}

// ─── Stripe ────────────────────────────────────────────────

export interface PricingPlan {
    name: string;
    price: number;
    interval?: "month" | "year";
    credits: number;
    features: string[];
    priceId?: string;
    popular?: boolean;
}
