import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../common/entities/user.entity';
import { Task } from '../../common/entities/task.entity';

@Entity('projects')
export class Project extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  color: string;

  @ManyToOne(() => User, (user) => user.ownedProjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: string;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @Column({ default: true })
  isActive: boolean;
}