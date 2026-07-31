export class EmailNormalizer {
  static normalize(email: string): string {
    if (!email) throw new Error('Email is required');
    const trimmed = email.trim().toLowerCase();
    // basic validation
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(trimmed)) {
      throw new Error('Invalid email format');
    }
    if (trimmed.length > 255) {
      throw new Error('Email is too long');
    }
    return trimmed;
  }
}
