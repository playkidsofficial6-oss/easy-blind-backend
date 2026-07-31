import mongoose from 'mongoose';
import { User, UserSchema } from './user.schema';

describe('UserSchema - phoneNumber validation', () => {
  let UserModel: mongoose.Model<User>;

  beforeAll(() => {
    UserModel = mongoose.model<User>('TestUser', UserSchema);
  });

  it('should accept valid phone numbers with country codes (+91, +957, +1, etc.)', async () => {
    const validNumbers = [
      '+919876543210',
      '+95712345678',
      '+12025550123',
      '+442071234567',
    ];

    for (const num of validNumbers) {
      const user = new UserModel({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        phoneNumber: num,
        passwordHash: 'hash',
      });

      await expect(user.validate()).resolves.not.toThrow();
    }
  });

  it('should reject phone numbers without country code or with invalid format', async () => {
    const invalidNumbers = [
      '9876543210', // missing + and country code
      '09876543210',
      '+91', // too short
      '+abcdefghij', // not digits
      '12345', // too short, missing +
    ];

    for (const num of invalidNumbers) {
      const user = new UserModel({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        phoneNumber: num,
        passwordHash: 'hash',
      });

      const err = await user.validate().catch((e) => e);
      expect(err).toBeDefined();
      expect(err?.errors['phoneNumber']).toBeDefined();
      expect(err?.errors['phoneNumber'].message).toBe(
        'Phone number must include country code (e.g. +91, +957)',
      );
    }
  });
});
