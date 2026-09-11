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
	readonly PUBLICATIONS_DATABASE_ID: string;

	// Cloudflare KV
	readonly CF_ACCOUNT_ID: string;
	readonly CF_KV_NAMESPACE_ID: string;
	readonly CF_API_TOKEN: string;

	// Cloudflare R2 (S3 compatible)
	readonly CF_R2_ACCESS_KEY_ID: string;
	readonly CF_R2_SECRET_ACCESS_KEY: string;
	readonly CF_R2_BUCKET_NAME: string;
	readonly CF_R2_PUBLIC_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
