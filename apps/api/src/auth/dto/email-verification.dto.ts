import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for requesting email verification (send/resend)
 */
export class SendVerificationEmailDto {
  @ApiProperty({
    description: 'Email address to send verification to',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  readonly email!: string;
}

/**
 * DTO for email verification token processing
 */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'JWT verification token from email link',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    minLength: 10,
  })
  @IsString({ message: 'Token must be a valid string' })
  @IsNotEmpty({ message: 'Verification token is required' })
  readonly token!: string;
}

/**
 * Response DTO for successful email verification
 */
export class EmailVerificationResponseDto {
  @ApiProperty({
    description: 'Verification success status',
    example: true,
  })
  readonly success!: boolean;

  @ApiProperty({
    description: 'Verification result message',
    example: 'Email verification completed successfully',
  })
  readonly message!: string;

  @ApiProperty({
    description: 'User ID that was verified',
    example: 'clm123abc456def789',
  })
  readonly userId!: string;

  @ApiProperty({
    description: 'Email address that was verified',
    example: 'user@example.com',
  })
  readonly email!: string;
}

/**
 * Response DTO for verification email sending
 */
export class VerificationEmailSentResponseDto {
  @ApiProperty({
    description: 'Email sending success status',
    example: true,
  })
  readonly success!: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Verification email sent successfully',
  })
  readonly message!: string;

  @ApiProperty({
    description: 'Email address where verification was sent',
    example: 'user@example.com',
  })
  readonly email!: string;
}

/**
 * DTO for requesting email verification resend (public endpoint)
 */
export class ResendVerificationEmailDto {
  @ApiProperty({
    description: 'User ID to resend verification email to',
    example: 'cuid123',
  })
  @IsString({ message: 'User ID must be a string' })
  @IsNotEmpty({ message: 'User ID is required' })
  readonly userId!: string;
}

/**
 * Response DTO for public verification email resend
 */
export class ResendVerificationResponseDto {
  @ApiProperty({
    description: 'Request processing success status',
    example: true,
  })
  readonly success!: boolean;

  @ApiProperty({
    description: 'Security-conscious response message',
    example:
      'If this account exists and is unverified, a verification email has been sent',
  })
  readonly message!: string;
}
