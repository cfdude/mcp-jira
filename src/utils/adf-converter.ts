/**
 * Utility functions for converting plain text to Atlassian Document Format (ADF)
 * Jira Cloud now requires ADF for rich text fields like description
 */

export interface AdfDocument {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}

export interface AdfNode {
  type: string;
  attrs?: Record<string, any>;
  content?: AdfNode[];
  text?: string;
  marks?: AdfMark[];
}

export interface AdfMark {
  type: string;
  attrs?: Record<string, any>;
}

/**
 * Convert plain text to basic ADF format
 * Handles newlines and basic formatting
 */
export function textToAdf(text: string): AdfDocument {
  if (!text || text.trim() === '') {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '',
            },
          ],
        },
      ],
    };
  }

  // Split text by newlines and create paragraphs
  const lines = text.split('\n').filter(line => line.trim() !== '');

  if (lines.length === 0) {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '',
            },
          ],
        },
      ],
    };
  }

  const content: AdfNode[] = lines.map(line => ({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: line.trim(),
      },
    ],
  }));

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Convert simple Markdown-like text to ADF
 * Supports basic formatting: **bold**, *italic*, `code`, [links](url)
 */
export function markdownToAdf(text: string): AdfDocument {
  if (!text || text.trim() === '') {
    return textToAdf('');
  }

  // For now, just handle plain text conversion
  // TODO: Add support for markdown parsing if needed
  return textToAdf(text);
}

/**
 * Create a simple ADF paragraph with plain text
 */
export function createAdfParagraph(text: string): AdfNode {
  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: text || '',
      },
    ],
  };
}

/**
 * Create an ADF code block
 */
export function createAdfCodeBlock(code: string, language?: string): AdfNode {
  return {
    type: 'codeBlock',
    attrs: language ? { language } : {},
    content: [
      {
        type: 'text',
        text: code,
      },
    ],
  };
}

/**
 * Create an ADF list (bulleted)
 */
export function createAdfBulletList(items: string[]): AdfNode {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: item,
            },
          ],
        },
      ],
    })),
  };
}

/**
 * Helper function to check if a value is already in ADF format
 */
export function isAdfFormat(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.type === 'doc' &&
    value.version === 1 &&
    Array.isArray(value.content)
  );
}

/**
 * Safe converter that handles both plain text and ADF
 */
export function ensureAdfFormat(input: string | AdfDocument): AdfDocument {
  if (typeof input === 'string') {
    return textToAdf(input);
  }

  if (isAdfFormat(input)) {
    return input as AdfDocument;
  }

  // If it's some other object, convert to string and then to ADF
  return textToAdf(String(input));
}
