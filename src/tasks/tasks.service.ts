import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '../notifications/dto/notification.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import type { Task } from '@prisma/client';
import { NotificationsGateway } from 'src/notifications/notifications/notifications.gateway';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(userId: string, createTaskDto: CreateTaskDto): Promise<Task> {
    const project = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const task = await this.prisma.task.create({
      data: {
        ...createTaskDto,
        createdById: userId,
        dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.cacheManager.del(`tasks:user:${userId}`);
    await this.cacheManager.del(`tasks:project:${createTaskDto.projectId}`);
    await this.cacheManager.del(`project:${createTaskDto.projectId}`);

    // Send notification if task is assigned to someone
    if (task.assignedToId && task.assignedToId !== userId) {
      this.notificationsGateway.sendNotificationToUser(task.assignedToId, {
        type: NotificationType.TASK_ASSIGNED,
        title: 'New Task Assigned',
        message: `You have been assigned to "${task.title}"`,
        userId: task.assignedToId,
        data: task,
      });
    }

    return task;
  }

  async findAll(userId: string): Promise<Task[]> {
    const cacheKey = `tasks:user:${userId}`;

    // Try to get from cache
    const cached = await this.cacheManager.get<Task[]>(cacheKey);
    if (cached) {
      console.log('Returning tasks from cache');
      return cached;
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { createdById: userId },
          { assignedToId: userId },
        ],
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, tasks, 300000);

    return tasks;
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const cacheKey = `task:${id}`;

    const cached = await this.cacheManager.get<Task>(cacheKey);
    if (cached) {
      console.log('Returning task from cache');
      return cached;
    }

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            ownerId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (
      task.createdById !== userId &&
      task.assignedToId !== userId &&
      task.project.ownerId !== userId
    ) {
      throw new ForbiddenException('You do not have access to this task');
    }

    await this.cacheManager.set(cacheKey, task, 300000);

    return task;
  }

  async update(id: string, userId: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.createdById !== userId && task.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to update this task');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        ...updateTaskDto,
        dueDate: updateTaskDto.dueDate ? new Date(updateTaskDto.dueDate) : undefined,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.cacheManager.del(`task:${id}`);
    await this.cacheManager.del(`tasks:user:${userId}`);
    await this.cacheManager.del(`tasks:project:${task.projectId}`);
    await this.cacheManager.del(`project:${task.projectId}`);

    if (updatedTask.assignedToId) {
      await this.cacheManager.del(`tasks:user:${updatedTask.assignedToId}`);
    }

    // Send notifications
    if (updateTaskDto.status && updatedTask.assignedToId && updatedTask.assignedToId !== userId) {
      this.notificationsGateway.sendNotificationToUser(updatedTask.assignedToId, {
        type: NotificationType.TASK_UPDATED,
        title: 'Task Updated',
        message: `"${updatedTask.title}" status changed to ${updatedTask.status}`,
        userId: updatedTask.assignedToId,
        data: updatedTask,
      });
    }

    if (updateTaskDto.isCompleted && updatedTask.createdById !== userId) {
      this.notificationsGateway.sendNotificationToUser(updatedTask.createdById, {
        type: NotificationType.TASK_COMPLETED,
        title: 'Task Completed',
        message: `"${updatedTask.title}" has been completed`,
        userId: updatedTask.createdById,
        data: updatedTask,
      });
    }

    return updatedTask;
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.createdById !== userId && task.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this task');
    }

    await this.prisma.task.delete({ where: { id } });

    // Invalidate caches
    await this.cacheManager.del(`task:${id}`);
    await this.cacheManager.del(`tasks:user:${userId}`);
    await this.cacheManager.del(`tasks:project:${task.projectId}`);
    await this.cacheManager.del(`project:${task.projectId}`);

    if (task.assignedToId) {
      await this.cacheManager.del(`tasks:user:${task.assignedToId}`);
    }

    return { message: 'Task deleted successfully' };
  }

  async findByProject(projectId: string, userId: string): Promise<Task[]> {
    const cacheKey = `tasks:project:${projectId}`;

    const cached = await this.cacheManager.get<Task[]>(cacheKey);
    if (cached) {
      console.log('Returning project tasks from cache');
      return cached;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
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
    });

    await this.cacheManager.set(cacheKey, tasks, 300000);

    return tasks;
  }
}