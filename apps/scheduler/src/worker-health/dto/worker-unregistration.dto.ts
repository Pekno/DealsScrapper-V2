import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for worker unregistration request
 */
export class WorkerUnregistrationDto {
  @ApiProperty({
    description: 'Unique identifier for the worker to unregister',
    example: 'scraper-worker-001',
  })
  @IsString({ message: 'workerId must be a string' })
  @IsNotEmpty({ message: 'workerId is required' })
  readonly workerId!: string;
}
