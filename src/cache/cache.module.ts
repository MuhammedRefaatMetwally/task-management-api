import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redis.url');
        
        if (!redisUrl) {
          console.warn('Redis URL not configured, using in-memory cache');
          return {
            ttl: 300000, // 5 minutes in milliseconds
          };
        }

        return {
          store: await redisStore({
            url: redisUrl,
            ttl: 300000, // 5 minutes
          }),
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}