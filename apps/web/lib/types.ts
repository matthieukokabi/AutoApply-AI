/**
 * Shared types for AutoApply AI
 */

/** Structured CV data stored in MasterProfile.structuredJson */
export interface StructuredCV {
    contact: {
        name: string;
        email: string;
        phone: string;
        location: string;
        linkedin?: string;
        website?: string;
    };
    summary: string;
    experience: Array<{
        title: string;
        company: string;
        location?: string;
        startDate: string;
        endDate?: string;
        bullets: string[];
    }>;
    education: Array<{
        degree: string;
        institution: string;
        location?: string;
        graduationDate?: string;
    }>;
    skills: string[];
    photoBase64?: string;
}

/** Parsed CV section from markdown */
export interface ParsedCVSubsection {
    heading: string;
    meta?: string;
    bullets: string[];
    paragraphs: string[];
}

export interface ParsedCVSection {
    title: string;
    content: string;
    subsections: ParsedCVSubsection[];
    paragraphs: string[];
}

/** Parsed CV from Claude's markdown output */
export interface ParsedCV {
    name: string;
    subtitle: string;
    contactLine: string;
    sections: ParsedCVSection[];
}
