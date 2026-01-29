import { User as PrismaUser } from '@prisma/client';

export type User = PrismaUser;

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}