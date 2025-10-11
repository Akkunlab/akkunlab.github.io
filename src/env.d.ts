/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {

    // Notion API
	readonly NOTION_TOKEN: string;
	readonly PORTFOLIO_DATABASE_ID: string;
	readonly EDUCATION_CAREER_DATABASE_ID: string;
	readonly CERTIFICATIONS_DATABASE_ID: string;
	readonly MEDIA_COVERAGE_DATABASE_ID: string;
	readonly SKILLS_INTERESTS_DATABASE_ID: string;
	readonly SOCIAL_LINKS_DATABASE_ID: string;

	// Cloudflare KV
	readonly CF_ACCOUNT_ID: string;
	readonly CF_KV_NAMESPACE_ID: string;
	readonly CF_API_TOKEN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
