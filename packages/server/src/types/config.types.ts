export interface AppConfig {
  server: {
    port: number;
    host: string;
    env: 'development' | 'test' | 'staging' | 'production';
  };
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  adminJwt: {
    secret: string;
    expiresIn: string;
  };
}

export interface JwtPayload {
  sub: string;
  phone: string;
  tier: string;
}

export interface AdminJwtPayload {
  sub: string;
  username: string;
}
