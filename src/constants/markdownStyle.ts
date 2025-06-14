export const MARKDOWN_STYLES = `
  /* Headings */
  [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-light-text [&_h1]:mb-6
  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-light-text [&_h2]:mb-4 [&_h2]:mt-8
  [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-light-text [&_h3]:mb-4 [&_h3]:mt-6

  /* Text content */
  [&_p]:text-light-text [&_p]:leading-relaxed [&_p]:mb-4

  /* Lists */
  [&_ul]:list-disc [&_ul]:list-inside [&_ul]:ml-6 [&_ul]:mb-4 [&_ul]:text-light-text
  [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:ml-6 [&_ol]:mb-4 [&_ol]:text-light-text
  [&_li]:mb-2 [&_li]:text-light-text

  /* Quotes */
  [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:my-6
  [&_blockquote]:text-primary [&_blockquote]:bg-blue-50 [&_blockquote]:py-3 [&_blockquote]:rounded-r
  [&_blockquote_p]:mb-0

  /* Code blocks */
  [&_pre]:bg-gray-100 [&_pre]:border [&_pre]:border-gray-300 [&_pre]:rounded-lg [&_pre]:p-4
  [&_pre]:overflow-auto [&_pre]:my-6 [&_pre]:text-emerald-700 [&_pre]:font-mono

  [&_code]:bg-gray-200 [&_code]:text-primary [&_code]:px-1 [&_code]:py-0.5
  [&_code]:rounded [&_code]:text-sm [&_code]:font-mono

  [&_pre_code]:bg-transparent [&_pre_code]:text-emerald-700 [&_pre_code]:p-0

  /* Links and text emphasis */
  [&_a]:text-primary [&_a:hover]:text-primary-hover [&_a]:underline [&_a]:transition-colors
  [&_strong]:text-primary [&_strong]:font-bold
  [&_em]:text-purple-600 [&_em]:italic
`.trim();
