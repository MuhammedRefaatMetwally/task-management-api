import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { Project } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(userId: string, createProjectDto: CreateProjectDto): Promise<Project> {
    const project = await this.prisma.project.create({
      data: {
        ...createProjectDto,
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Invalidate user's projects cache
    await this.cacheManager.del(`projects:user:${userId}`);

    return project;
  }

  async findAll(userId: string): Promise<Project[]> {
    const cacheKey = `projects:user:${userId}`;
    
    // Try to get from cache
    const cached = await this.cacheManager.get<Project[]>(cacheKey);
    if (cached) {
      console.log('Returning projects from cache');
      return cached;
    }

    // If not in cache, get from database
    const projects = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
        isActive: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Store in cache for 5 minutes
    await this.cacheManager.set(cacheKey, projects, 300000);

    return projects;
  }

  async findOne(id: string, userId: string): Promise<Project> {
    const cacheKey = `project:${id}`;

    // Try to get from cache
    const cached = await this.cacheManager.get<Project>(cacheKey);
    if (cached) {
      console.log('Returning project from cache');
      
      // Still need to verify ownership
      if (cached.ownerId !== userId) {
        throw new ForbiddenException('You do not have access to this project');
      }
      
      return cached;
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tasks: {
          include: {
            assignedTo: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, project, 300000);

    return project;
  }

  async update(id: string, userId: string, updateProjectDto: UpdateProjectDto): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to update this project');
    }

    const updatedProject = await this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.cacheManager.del(`project:${id}`);
    await this.cacheManager.del(`projects:user:${userId}`);

    return updatedProject;
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this project');
    }

    await this.prisma.project.delete({ where: { id } });

    // Invalidate caches
    await this.cacheManager.del(`project:${id}`);
    await this.cacheManager.del(`projects:user:${userId}`);

    return { message: 'Project deleted successfully' };
  }
}