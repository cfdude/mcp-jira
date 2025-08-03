/**
 * Atlassian Document Format (ADF) conversion utilities
 * Converts plain text to proper ADF format required by Jira API v3
 */

export interface ADFNode {
  type: string;
  version?: number;
  content?: ADFNode[];
  text?: string;
  attrs?: Record<string, any>;
  marks?: ADFMark[];
}

export interface ADFMark {
  type: string;
  attrs?: Record<string, any>;
}

/**
 * Convert plain text to ADF document format
 * Handles multiline text, preserves line breaks, and creates proper paragraph structure
 */
export function convertTextToADF(text: string): ADFNode {
  if (!text || typeof text !== 'string') {
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

  // Split text into lines and process each line
  const lines = text.split('\n');
  const content: ADFNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Handle empty lines
    if (line === '') {
      content.push({
        type: 'paragraph',
        content: [],
      });
      continue;
    }

    // Check for markdown-style formatting and convert to ADF
    const paragraphContent = processLineFormatting(line);

    content.push({
      type: 'paragraph',
      content: paragraphContent,
    });
  }

  // Ensure we have at least one paragraph
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    });
  }

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Process a line for basic markdown-style formatting
 * Converts **bold**, *italic*, `code`, and handles bullet points
 */
function processLineFormatting(line: string): ADFNode[] {
  const content: ADFNode[] = [];

  // Handle bullet points
  if (line.startsWith('- ') || line.startsWith('* ')) {
    return [
      {
        type: 'text',
        text: line.substring(2), // Remove bullet marker for now - full list support can be added later
      },
    ];
  }

  // Handle headers
  const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headerMatch) {
    // const level = Math.min(headerMatch[1].length, 6); // TODO: Use for header levels when ADF supports it
    return [
      {
        type: 'text',
        text: headerMatch[2],
        marks: [
          {
            type: 'strong',
          },
        ],
      },
    ];
  }

  // For now, handle basic text with simple bold/italic conversion
  // This is a simplified implementation - full markdown parsing would be more complex
  let processedText = line;
  const marks: ADFMark[] = [];

  // Simple bold detection (**text**)
  if (processedText.includes('**')) {
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '$1');
    marks.push({ type: 'strong' });
  }

  // Simple italic detection (*text*)
  if (processedText.includes('*') && !processedText.includes('**')) {
    processedText = processedText.replace(/\*(.*?)\*/g, '$1');
    marks.push({ type: 'em' });
  }

  // Simple code detection (`text`)
  if (processedText.includes('`')) {
    processedText = processedText.replace(/`(.*?)`/g, '$1');
    marks.push({ type: 'code' });
  }

  const textNode: ADFNode = {
    type: 'text',
    text: processedText,
  };

  if (marks.length > 0) {
    textNode.marks = marks;
  }

  content.push(textNode);
  return content;
}

/**
 * Convert text to ADF format optimized for comments
 * More compact format suitable for comment fields
 */
export function convertTextToCommentADF(text: string): ADFNode {
  const adf = convertTextToADF(text);

  // For comments, we can be more compact
  // If there's only one paragraph with simple text, keep it simple
  if (adf.content && adf.content.length === 1) {
    const firstParagraph = adf.content[0];
    if (
      firstParagraph.type === 'paragraph' &&
      firstParagraph.content &&
      firstParagraph.content.length === 1 &&
      firstParagraph.content[0].type === 'text'
    ) {
      return adf;
    }
  }

  return adf;
}

/**
 * Validate ADF document structure
 * Ensures the ADF is valid before sending to Jira
 */
export function validateADF(adf: ADFNode): boolean {
  if (!adf || typeof adf !== 'object') {
    return false;
  }

  if (adf.type !== 'doc' || adf.version !== 1) {
    return false;
  }

  if (!adf.content || !Array.isArray(adf.content)) {
    return false;
  }

  // Basic validation - each content item should be a valid node
  return adf.content.every(
    node => node && typeof node === 'object' && typeof node.type === 'string'
  );
}

/**
 * Create a simple ADF paragraph with plain text
 * Fallback for when complex conversion fails
 */
export function createSimpleADFParagraph(text: string): ADFNode {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: text || '',
          },
        ],
      },
    ],
  };
}

/**
 * Convert plain text to ADF with error handling
 * Returns a valid ADF document or falls back to simple format
 */
export function safeConvertTextToADF(text: string): ADFNode {
  try {
    const adf = convertTextToADF(text);

    if (validateADF(adf)) {
      return adf;
    }

    console.error('Generated ADF failed validation, using simple format');
    return createSimpleADFParagraph(text);
  } catch (error) {
    console.error('Error converting text to ADF:', error);
    return createSimpleADFParagraph(text);
  }
}
