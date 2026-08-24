import { Controller, Post, Put, Body, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Enable2FaDto } from './dto/enable-2fa.dto';
import { Disable2FaDto } from './dto/disable-2fa.dto';
import { Verify2FaLoginDto } from './dto/verify-2fa-login.dto';
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

  /**
   * PUT /api/v1/auth/change-password
   * Allows an authenticated user to change their password while logged in.
   */
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { message: 'Your password has been updated successfully.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  async setup2FA(@CurrentUser() user: any) {
    return this.authService.setup2FA(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  async enable2FA(@CurrentUser() user: any, @Body() dto: Enable2FaDto) {
    return this.authService.enable2FA(user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disable2FA(@CurrentUser() user: any, @Body() dto: Disable2FaDto) {
    return this.authService.disable2FA(user.id, dto.password);
  }

  @Throttle(10, 60)
  @Post('2fa/verify-login')
  async verifyLogin2FA(@Body() dto: Verify2FaLoginDto) {
    return this.authService.verifyLogin2FA(dto.challengeToken, dto.code);
  }
}