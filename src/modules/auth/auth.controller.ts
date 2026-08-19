import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/v1/auth/register — rate limit: 5 req/min */
  @Throttle(5, 60)
  @Post('register')
  async register(@Body() registerDto: RegisterAuthDto) {
    return this.authService.register(registerDto);
  }

  /** POST /api/v1/auth/login — rate limit: 10 req/min */
  @Throttle(10, 60)
  @Post('login')
  async login(@Body() loginDto: LoginAuthDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Accepts an email and sends a reset link if the user exists.
   * Always returns a generic success message to prevent email enumeration.
   * Rate limited to 3 requests per 10 minutes.
   */
  @Throttle(3, 600)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * POST /api/v1/auth/reset-password/:token
   * Validates the raw token, updates the password, and marks the token as used.
   */
  @Post('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.authService.resetPassword(
      token,
      dto.newPassword,
      dto.confirmPassword,
    );
    return { message: 'Your password has been reset successfully. You can now log in.' };
  }
}
