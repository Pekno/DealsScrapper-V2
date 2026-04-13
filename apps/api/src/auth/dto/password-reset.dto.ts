import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'JWT reset token from the email link' })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NewStrongP@ssw0rd',
    minLength: 8,
    description:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'If this email is registered, a reset link has been sent',
  })
  message: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password reset successfully' })
  message: string;
}

export class ValidateResetTokenResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({ example: 'Token is invalid or expired', required: false })
  message?: string;
}
