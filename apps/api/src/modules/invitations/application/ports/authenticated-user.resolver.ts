export interface ResolvedAuthenticatedUser {
  email: string;
  emailConfirmedAt: Date;
}

export interface AuthenticatedUserResolver {
  resolve(accessToken: string): Promise<ResolvedAuthenticatedUser>;
}
