import { describe, it, expect } from 'vitest';
import {
  MOCK_USER,
  MOCK_ALERTS,
  MOCK_RESOURCES,
  MOCK_CHECKLIST,
} from '../constants';

describe('Constants - Mock Data', () => {
  describe('MOCK_USER', () => {
    it('should have required user fields', () => {
      expect(MOCK_USER).toHaveProperty('id');
      expect(MOCK_USER).toHaveProperty('name');
      expect(MOCK_USER).toHaveProperty('role');
      expect(MOCK_USER).toHaveProperty('safetyScore');
      expect(MOCK_USER).toHaveProperty('xp');
    });

    it('should have valid role', () => {
      const validRoles = ['Admin', 'Responder', 'Viewer', 'Reporter'];
      expect(validRoles).toContain(MOCK_USER.role);
    });
  });

  describe('MOCK_ALERTS', () => {
    it('should be an array with at least one alert', () => {
      expect(Array.isArray(MOCK_ALERTS)).toBe(true);
      expect(MOCK_ALERTS.length).toBeGreaterThan(0);
    });

    it('each alert should have required fields', () => {
      MOCK_ALERTS.forEach((alert) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('title');
        expect(alert).toHaveProperty('severity');
      });
    });
  });

  describe('MOCK_RESOURCES', () => {
    it('should be an array', () => {
      expect(Array.isArray(MOCK_RESOURCES)).toBe(true);
    });

    it('each resource should have location coordinates', () => {
      MOCK_RESOURCES.forEach((resource) => {
        expect(resource).toHaveProperty('lat');
        expect(resource).toHaveProperty('lng');
        expect(typeof resource.lat).toBe('number');
        expect(typeof resource.lng).toBe('number');
      });
    });
  });

  describe('MOCK_CHECKLIST', () => {
    it('should be an array with items', () => {
      expect(Array.isArray(MOCK_CHECKLIST)).toBe(true);
      expect(MOCK_CHECKLIST.length).toBeGreaterThan(0);
    });

    it('each item should have title, xp, completed', () => {
      MOCK_CHECKLIST.forEach((item) => {
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('xp');
        expect(typeof item.completed).toBe('boolean');
      });
    });
  });
});
