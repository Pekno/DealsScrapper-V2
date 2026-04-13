declare module 'user-agents' {
  export default class UserAgent {
    constructor(options?: { deviceCategory?: string; platform?: string });
    toString(): string;
    userAgent: string;
    data: {
      deviceCategory: string;
      platform: string;
      userAgent: string;
    };
  }
}
