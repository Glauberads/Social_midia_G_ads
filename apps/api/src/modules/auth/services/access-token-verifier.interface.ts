export interface AuthenticatedIdentity {
  userId: string;
  email?: string;
  audience: string | string[];
  issuer: string;
  expiresAt: Date;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<AuthenticatedIdentity>;
}
