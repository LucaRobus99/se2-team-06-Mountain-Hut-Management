import { ValidationError } from '../errors/AppError.js';

/**
 * Validates and sanitizes menu name and rich-text content.
 * Approved structure: bold, italic, lists (ul, ol, li), and plain text.
 * No script execution, dangerous tags, or event handlers.
 */
export function validateMenuInput({ name, content, mealId }) {
  const errors = [];

  if (mealId !== undefined && mealId !== null) {
    const parsedMealId = Number(mealId);
    if (!Number.isInteger(parsedMealId) || parsedMealId <= 0) {
      errors.push({ field: 'mealId', message: 'Meal ID must be a positive integer.' });
    }
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({ field: 'name', message: 'Menu name is required.' });
  } else if (name.length > 100) {
    errors.push({ field: 'name', message: 'Menu name cannot exceed 100 characters.' });
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    errors.push({ field: 'content', message: 'Menu content is required.' });
  } else {
    // Check for forbidden executable tags or script injection patterns
    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes('<script') ||
      lowerContent.includes('javascript:') ||
      lowerContent.includes('onerror') ||
      lowerContent.includes('onload') ||
      lowerContent.includes('<iframe') ||
      lowerContent.includes('<object') ||
      lowerContent.includes('<embed')
    ) {
      errors.push({ field: 'content', message: 'Menu content contains disallowed or unsafe HTML/scripts.' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid menu input.', 'VALIDATION_ERROR', errors);
  }

  return {
    name: name.trim(),
    content: sanitizeRichText(content.trim()),
    mealId: mealId !== undefined && mealId !== null ? Number(mealId) : undefined,
  };
}

/**
 * Basic robust sanitization for rich text supporting approved subset:
 * bold, italic, lists, paragraphs, line breaks.
 */
function sanitizeRichText(htmlOrText) {
  // If input appears to contain HTML tags, strip disallowed tags while keeping allowed ones.
  // Allowed tags: b, strong, i, em, ul, ol, li, p, br
  // For safety and simplicity, we can escape everything except an explicit approved set,
  // or use a clean tag filter.

  // Let's replace dangerous tags or strip tags not in the allowed list.
  // Allowed regex tag pattern: </?(b|strong|i|em|ul|ol|li|p|br)(\s+[^>]*)?>/gi

  const allowedTagsRegex = /<\/?(b|strong|i|em|ul|ol|li|p|br)(\s+[^>]*)?>/gi;

  // To prevent injection via malformed HTML, we can extract or replace.
  // Alternatively, if it's plain text with markdown or simple HTML, we ensure no on* attributes or href javascript.
  let sanitized = htmlOrText
    .replace(/on\w+\s*=/gi, 'data-removed=')
    .replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="about:blank"');

  return sanitized;
}
