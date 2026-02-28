import fs from "fs";
import path from "path";

export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    date: string;
    author: string;
    tags: string[];
    readingTime: string;
    content: string;
    locale: string;
}

export interface BlogPostMeta {
    slug: string;
    title: string;
    description: string;
    date: string;
    author: string;
    tags: string[];
    readingTime: string;
    locale: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

/**
 * Parse frontmatter from a markdown file.
 * Format:
 * ---
 * title: My Post
 * description: A description
 * date: 2026-02-28
 * author: AutoApply AI Team
 * tags: ["tag1", "tag2"]
 * ---
 * Content here...
 */
function parseFrontmatter(fileContent: string): {
    metadata: Record<string, string>;
    content: string;
} {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = fileContent.match(frontmatterRegex);

    if (!match) {
        return { metadata: {}, content: fileContent };
    }

    const [, frontmatter, content] = match;
    const metadata: Record<string, string> = {};

    frontmatter.split("\n").forEach((line) => {
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) return;
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        // Remove surrounding quotes if present
        metadata[key] = value.replace(/^["']|["']$/g, "");
    });

    return { metadata, content: content.trim() };
}

function estimateReadingTime(text: string): string {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
}

/**
 * Get all blog posts for a given locale, sorted by date (newest first).
 */
export function getAllPosts(locale: string): BlogPostMeta[] {
    const dir = path.join(CONTENT_DIR, locale);

    if (!fs.existsSync(dir)) {
        return [];
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

    const posts: BlogPostMeta[] = files.map((filename) => {
        const slug = filename.replace(/\.md$/, "");
        const filePath = path.join(dir, filename);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const { metadata, content } = parseFrontmatter(fileContent);

        let tags: string[] = [];
        try {
            if (metadata.tags) {
                tags = JSON.parse(metadata.tags.replace(/'/g, '"'));
            }
        } catch {
            tags = metadata.tags
                ? metadata.tags.split(",").map((t) => t.trim())
                : [];
        }

        return {
            slug,
            title: metadata.title || slug,
            description: metadata.description || "",
            date: metadata.date || new Date().toISOString().split("T")[0],
            author: metadata.author || "AutoApply AI Team",
            tags,
            readingTime: estimateReadingTime(content),
            locale,
        };
    });

    return posts.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

/**
 * Get a single blog post by slug and locale.
 */
export function getPostBySlug(
    locale: string,
    slug: string
): BlogPost | null {
    const filePath = path.join(CONTENT_DIR, locale, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { metadata, content } = parseFrontmatter(fileContent);

    let tags: string[] = [];
    try {
        if (metadata.tags) {
            tags = JSON.parse(metadata.tags.replace(/'/g, '"'));
        }
    } catch {
        tags = metadata.tags
            ? metadata.tags.split(",").map((t) => t.trim())
            : [];
    }

    return {
        slug,
        title: metadata.title || slug,
        description: metadata.description || "",
        date: metadata.date || new Date().toISOString().split("T")[0],
        author: metadata.author || "AutoApply AI Team",
        tags,
        readingTime: estimateReadingTime(content),
        content,
        locale,
    };
}

/**
 * Get all slugs across all locales (for generating static paths).
 */
export function getAllSlugs(): string[] {
    const slugs = new Set<string>();

    const enDir = path.join(CONTENT_DIR, "en");
    if (fs.existsSync(enDir)) {
        fs.readdirSync(enDir)
            .filter((f) => f.endsWith(".md"))
            .forEach((f) => slugs.add(f.replace(/\.md$/, "")));
    }

    return Array.from(slugs);
}
