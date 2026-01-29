import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Redesign' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Redesign company website with modern UI' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsString()
  @IsOptional()
  color?: string;
}