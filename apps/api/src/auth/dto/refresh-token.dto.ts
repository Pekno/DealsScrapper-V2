import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  refresh_token: string;

  @ApiProperty({ example: '15m' })
  expires_in: string;

  @ApiProperty({
    example: {
      id: 'cuid123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  })
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
    createdAt: Date;
  };
}

export class RegistrationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example:
      'Registration successful. Please check your email to verify your account.',
  })
  message: string;

  @ApiProperty({
    example: {
      user: {
        id: 'cuid123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      nextStep: 'verify-email',
    },
  })
  data: {
    user: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      emailVerified: boolean;
      createdAt: Date;
    };
    nextStep: 'verify-email';
  };
}
