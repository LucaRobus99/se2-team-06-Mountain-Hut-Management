import { describe, it, expect } from 'vitest';
import { hutPhotos, latestNews } from '../../../../src/data/homeContent.js';

describe('Home Content Structural (White-Box) Tests', () => {

  it('should validate hutPhotos array structure and required object properties', () => {
    // Verify that hutPhotos is exported as a non-empty array
    expect(Array.isArray(hutPhotos)).toBe(true);
    expect(hutPhotos.length).toBeGreaterThan(0);

    // Inspect the internal structure and types of each photo object
    hutPhotos.forEach((photo) => {
      expect(photo).toHaveProperty('src');
      expect(typeof photo.src).toBe('string');
      expect(photo.src.length).toBeGreaterThan(0);

      expect(photo).toHaveProperty('alt');
      expect(typeof photo.alt).toBe('string');
      expect(photo.alt.length).toBeGreaterThan(0);

      expect(photo).toHaveProperty('caption');
      expect(typeof photo.caption).toBe('string');
    });
  });

  it('should validate latestNews array structure, properties, and date format', () => {
    // Verify that latestNews is exported as a non-empty array
    expect(Array.isArray(latestNews)).toBe(true);
    expect(latestNews.length).toBeGreaterThan(0);

    // Regular expression for YYYY-MM-DD date format validation
    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Inspect the internal structure and types of each news item object
    latestNews.forEach((news) => {
      expect(news).toHaveProperty('date');
      expect(news.date).toMatch(dateFormatRegex);

      expect(news).toHaveProperty('title');
      expect(typeof news.title).toBe('string');
      expect(news.title.length).toBeGreaterThan(0);

      expect(news).toHaveProperty('text');
      expect(typeof news.text).toBe('string');
      expect(news.text.length).toBeGreaterThan(0);
    });
  });

});