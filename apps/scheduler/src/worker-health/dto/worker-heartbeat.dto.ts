import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for worker heartbeat request
 */
export class WorkerHeartbeatDto {
  @ApiProperty({
    description: 'Unique identifier for the worker sending the heartbeat',
    example: 'scraper-worker-001',
  })
  @IsString({ message: 'workerId must be a string' })
  @IsNotEmpty({ message: 'workerId is required' })
  readonly workerId!: string;

  @ApiProperty({
    description: 'Current number of jobs being processed by the worker',
    example: 3,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({}, { message: 'currentLoad must be a number' })
  @Min(0, { message: 'currentLoad cannot be negative' })
  @Max(100, { message: 'currentLoad cannot exceed 100' })
  readonly currentLoad!: number;

  @ApiProperty({
    description: 'Current status of the worker',
    example: 'active',
    enum: ['active', 'busy', 'idle', 'maintenance'],
  })
  @IsString({ message: 'status must be a string' })
  @IsIn(['active', 'busy', 'idle', 'maintenance'], {
    message: 'status must be one of: active, busy, idle, maintenance',
  })
  readonly status!: string;

  @ApiProperty({
    description: 'Timestamp when the heartbeat was generated',
    example: '2025-01-10T12:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString({}, { message: 'timestamp must be a valid ISO date string' })
  readonly timestamp!: string;
}
