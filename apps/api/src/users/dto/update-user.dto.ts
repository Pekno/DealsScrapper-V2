import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { stripXss } from '../../common/utils/sanitize.utils.js';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => stripXss(value))
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => stripXss(value))
  lastName?: string;

  @ApiProperty({ example: 'Europe/Paris', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiProperty({ example: 'fr', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    example: true,
    required: false,
    description: 'Enable/disable email notifications for deal matches',
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Enable/disable marketing emails',
  })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Enable/disable weekly digest emails',
  })
  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;
}
