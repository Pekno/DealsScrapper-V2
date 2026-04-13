import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for worker capacity configuration
 */
export class WorkerCapacityDto {
  @ApiProperty({
    description: 'Maximum number of concurrent jobs this worker can handle',
    example: 5,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber({}, { message: 'maxConcurrentJobs must be a number' })
  @Min(1, { message: 'maxConcurrentJobs must be at least 1' })
  @Max(100, { message: 'maxConcurrentJobs cannot exceed 100' })
  readonly maxConcurrentJobs!: number;

  @ApiProperty({
    description: 'Maximum memory limit for this worker in MB',
    example: 512,
    minimum: 128,
    maximum: 8192,
  })
  @IsNumber({}, { message: 'maxMemoryMB must be a number' })
  @Min(128, { message: 'maxMemoryMB must be at least 128 MB' })
  @Max(8192, { message: 'maxMemoryMB cannot exceed 8192 MB' })
  readonly maxMemoryMB!: number;

  @ApiProperty({
    description: 'List of job types this worker can handle',
    example: ['SCRAPING', 'DATA_PROCESSING'],
    type: [String],
  })
  @IsArray({ message: 'supportedJobTypes must be an array' })
  @IsString({ each: true, message: 'Each supported job type must be a string' })
  @IsNotEmpty({ each: true, message: 'Job types cannot be empty strings' })
  readonly supportedJobTypes!: string[];
}

/**
 * DTO for worker registration request
 */
export class WorkerRegistrationDto {
  @ApiProperty({
    description: 'Unique identifier for the worker',
    example: 'scraper-worker-001',
    minLength: 3,
    maxLength: 100,
  })
  @IsString({ message: 'workerId must be a string' })
  @IsNotEmpty({ message: 'workerId is required' })
  readonly workerId!: string;

  @ApiProperty({
    description: 'HTTP endpoint where the worker can be reached',
    example: 'http://localhost:3002',
    format: 'uri',
  })
  @IsString({ message: 'endpoint must be a string' })
  @IsNotEmpty({ message: 'endpoint is required' })
  readonly endpoint!: string;

  @ApiPropertyOptional({
    description: 'Site this worker is dedicated to (e.g. dealabs, vinted, leboncoin)',
    example: 'dealabs',
  })
  @IsOptional()
  @IsString({ message: 'site must be a string' })
  readonly site?: string;

  @ApiProperty({
    description: 'Worker capacity and capabilities configuration',
    type: WorkerCapacityDto,
  })
  @ValidateNested({ message: 'capacity must be a valid configuration object' })
  @Type(() => WorkerCapacityDto)
  readonly capacity!: WorkerCapacityDto;
}
